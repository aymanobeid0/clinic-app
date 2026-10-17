import { VisitStartForm } from './VisitStartForm.js';
import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  Identity,
  TreatmentPlan,
  Visit,
  VisitState,
} from '@clinic/contracts';
import { HttpError } from '../identity/identity.api.js';
import { treatmentGet } from './treatment.api.js';
import { useTreatmentCommand, CommandState } from './useTreatmentCommand.js';
import { visitMessages as t } from './visit.messages.js';
export function VisitPanel({
  patientId,
  identity,
  plans,
  onLock,
  dirty,
}: {
  patientId: string;
  identity: Identity;
  plans: TreatmentPlan[];
  onLock: (kind: string, v: boolean) => void;
  dirty: boolean;
}) {
  const cache = useQueryClient(),
    key = ['visits', identity.clinicId, identity.accountId, patientId];
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) =>
      treatmentGet<VisitState>(`treatment/${patientId}/visits`, signal),
    gcTime: 0,
    retry: false,
  });
  const [epoch, setEpoch] = useState(0);
  const lock = useCallback(
    (_kind: string, value: boolean) => onLock('visit', value),
    [onLock],
  );
  const command = useTreatmentCommand<Visit>(
    key,
    () => {
      setEpoch((x) => x + 1);
      void cache.invalidateQueries({
        queryKey: ['plans', identity.clinicId, identity.accountId, patientId],
      });
    },
    lock,
    t.saved,
  );
  useEffect(() => {
    return () => {
      void cache.cancelQueries({
        queryKey: ['visits', identity.clinicId, identity.accountId, patientId],
      });
      cache.removeQueries({
        queryKey: ['visits', identity.clinicId, identity.accountId, patientId],
      });
    };
  }, [cache, identity.clinicId, identity.accountId, patientId]);
  const forbidden =
    query.error instanceof HttpError &&
    [401, 403, 404].includes(query.error.status);
  if (forbidden) return <p role="alert">{query.error!.message}</p>;
  const data = query.data,
    active = data?.visits.find(
      (v) => v.status === 'draft' && v.doctorId === identity.accountId,
    );
  const busy = command.busy || command.uncertain;
  const choices = plans.filter((p) =>
    ['accepted', 'in_progress'].includes(p.status),
  );
  return (
    <section className="treatment visits" aria-label={t.title}>
      <h4>{t.title}</h4>
      {query.error && <p role="alert">{query.error.message}</p>}
      {query.isPending && <p role="status">{t.loading}</p>}
      {data && (
        <>
          <p>{t.startedCount(data.starts.length)}</p>
          <p>{t.completedCount(data.completions.length)}</p>
          {identity.kind === 'doctor' &&
            identity.permissions.includes('procedures.start') &&
            choices.length > 0 && (
              <VisitStartForm
                key={epoch}
                plans={choices}
                appointments={data.appointments}
                disabled={!!active || busy || dirty}
                completions={data.completions}
                submit={(procedures, appointmentId) => {
                  if (confirm(t.confirmStart))
                    void command.save(`treatment/${patientId}/visits`, {
                      id: crypto.randomUUID(),
                      appointmentId,
                      procedures,
                    });
                }}
              />
            )}
          {data.visits.length === 0 && <p>{t.empty}</p>}
          <ol>
            {data.visits.map((v) => (
              <li key={v.id} className="visit-record">
                <h5>{v.status === 'draft' ? t.draft : t.ended}</h5>
                <p>
                  {v.doctorName} · {new Date(v.startedAt).toLocaleString('fr')}{' '}
                  · {v.appointmentId ? t.linkedAppointment : t.walkIn} ·{' '}
                  {t.version} {v.revision}
                </p>
                <ul>
                  {v.procedures.map((p, index) => {
                    const completed = data.completions.find(
                      (c) => c.planId === p.planId && c.itemId === p.itemId,
                    );
                    return (
                      <li key={`${p.planId}:${p.itemId}`}>
                        {p.name} · {completed ? t.completed : t.inProgress}
                        {completed && (
                          <span>
                            {' '}
                            · {completed.completedByName} ·{' '}
                            {new Date(completed.at).toLocaleString('fr')}
                          </span>
                        )}
                        {v.status === 'draft' &&
                          v.doctorId === identity.accountId &&
                          identity.permissions.includes(
                            'procedures.complete',
                          ) &&
                          !completed && (
                            <button
                              type="button"
                              disabled={busy || dirty}
                              onClick={() => {
                                if (confirm(t.confirmComplete))
                                  void command.save(
                                    `treatment/${patientId}/visits/actions`,
                                    {
                                      id: v.id,
                                      revision: v.revision,
                                      action: 'complete',
                                      planId: p.planId,
                                      itemId: p.itemId,
                                    },
                                  );
                              }}
                            >
                              {t.completeAct(index + 1, p.name)}
                            </button>
                          )}
                      </li>
                    );
                  })}
                </ul>
                {v.endedAt && (
                  <p>{t.careEnded(new Date(v.endedAt).toLocaleString('fr'))}</p>
                )}
                {v.status === 'draft' &&
                  v.doctorId === identity.accountId &&
                  identity.permissions.includes('procedures.start') && (
                    <button
                      type="button"
                      disabled={busy || dirty}
                      onClick={() => {
                        if (confirm(t.confirmEnd))
                          void command.save(
                            `treatment/${patientId}/visits/actions`,
                            { id: v.id, revision: v.revision, action: 'end' },
                          );
                      }}
                    >
                      {t.end}
                    </button>
                  )}
              </li>
            ))}
          </ol>
        </>
      )}
      <CommandState state={command} />
    </section>
  );
}
