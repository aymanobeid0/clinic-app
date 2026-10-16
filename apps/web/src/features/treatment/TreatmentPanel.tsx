import { useCallback, useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  verifiedCurrencies,
  type Catalog,
  type Identity,
  type TreatmentPlan,
} from '@clinic/contracts';
import { HttpError } from '../identity/identity.api.js';
import { treatmentApi, formatMinor } from './treatment.api.js';
import { treatmentMessages as t } from './treatment.messages.js';
import { PlanForm } from './PlanForm.js';
import { PlanLifecycle } from './PlanLifecycle.js';
import { PlanVersionDetails } from './PlanVersionDetails.js';
import { planStatus } from './treatment.messages.js';
export function TreatmentPanel({
  id,
  identity,
  onLock,
}: {
  id: string;
  identity: Identity;
  onLock: (kind: string, v: boolean) => void;
}) {
  const cache = useQueryClient();
  const key = ['plans', identity.clinicId, identity.accountId, id];
  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => treatmentApi.plans(id, signal),
    gcTime: 0,
    retry: false,
  });
  const catalog = useQuery({
    queryKey: ['catalog', identity.clinicId, identity.accountId],
    queryFn: ({ signal }) => treatmentApi.catalog(signal),
    gcTime: 0,
    retry: false,
  });
  const [selected, setSelected] = useState(''),
    [epoch, setEpoch] = useState(0),
    [locked, setLocked] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [connected, setConnected] = useState(true);
  useEffect(() => {
    const stream = new EventSource(`/api/treatment/${id}/events`);
    const refresh = () => {
      setConnected(true);
      void cache.invalidateQueries({
        queryKey: ['plans', identity.clinicId, identity.accountId, id],
      });
      void cache.invalidateQueries({
        queryKey: ['catalog', identity.clinicId, identity.accountId],
      });
    };
    stream.addEventListener('invalidate', refresh);
    stream.onopen = refresh;
    stream.onerror = () => {
      setConnected(false);
      void cache.invalidateQueries({
        queryKey: ['plans', identity.clinicId, identity.accountId, id],
      });
    };
    return () => {
      stream.close();
      void cache.cancelQueries({
        queryKey: ['plans', identity.clinicId, identity.accountId, id],
      });
      cache.removeQueries({
        queryKey: ['plans', identity.clinicId, identity.accountId, id],
      });
    };
  }, [id, identity.clinicId, identity.accountId, cache]);
  const lock = useCallback(
    (kind: string, v: boolean) => {
      setLocked(v);
      onLock(kind, v);
    },
    [onLock],
  );
  const forbidden =
    query.error instanceof HttpError &&
    [401, 403, 404].includes(query.error.status);
  if (forbidden) return <p role="alert">{query.error!.message}</p>;
  const plan = query.data?.find((p) => p.id === selected);
  return (
    <section className="treatment" aria-label={t.title}>
      <h4>{t.title}</h4>
      <p>{t.noDebt}</p>
      {!connected && (
        <p role="alert">
          Connexion interrompue. Saisie conservée dans cet onglet.
        </p>
      )}
      {query.error && <p role="alert">{query.error.message}</p>}
      {catalog.error && <p role="alert">{catalog.error.message}</p>}
      {query.isPending && <p role="status">{t.loading}</p>}
      {query.data?.length === 0 && <p>{t.empty}</p>}
      <ul>
        {query.data?.map((p) => (
          <li key={p.id}>
            <button
              disabled={locked}
              onClick={() => {
                if (confirm(t.patientSwitch)) {
                  setSelected(p.id);
                  setEpoch((x) => x + 1);
                }
              }}
            >
              {p.title} · {p.currency} · version {p.revision}
            </button>
            <PlanSummary plan={p} />
          </li>
        ))}
      </ul>
      {plan && (
        <PlanLifecycle
          key={`${selected}:${epoch}`}
          plan={plan}
          patientId={id}
          identity={identity}
          cacheKey={key}
          onLock={lock}
          dirty={dirty || locked}
          onDone={(value) => {
            cache.setQueryData<TreatmentPlan[]>(key, (rows) =>
              rows?.map((p) => (p.id === value.id ? value : p)),
            );
            setEpoch((x) => x + 1);
          }}
        />
      )}
      {identity.permissions.includes('plans.draft') &&
        catalog.data &&
        !['cancelled', 'completed', 'in_progress'].includes(
          plan?.status ?? '',
        ) && (
          <>
            <button
              disabled={locked}
              onClick={() => {
                if (confirm(t.patientSwitch)) {
                  setSelected('');
                  setEpoch((x) => x + 1);
                }
              }}
            >
              {t.newPlan}
            </button>
            <PlanForm
              key={`${selected}:${epoch}`}
              patientId={id}
              plan={plan}
              catalog={catalog.data as Catalog}
              identity={identity}
              cacheKey={key}
              onLock={lock}
              onDirty={setDirty}
            />
          </>
        )}
    </section>
  );
}
export function PlanSummary({ plan }: { plan: TreatmentPlan }) {
  return (
    <details>
      <summary>
        Proposition {plan.id} · {planStatus[plan.status]} · total{' '}
        {formatMinor(plan.totalMinor, verifiedCurrencies[plan.currency])}{' '}
        {plan.currency}
      </summary>
      <PlanVersionDetails version={plan} />
      {plan.events.length > 0 && (
        <details>
          <summary>Historique essentiel de la proposition</summary>
          {plan.events.map((v) => (
            <PlanVersionDetails key={v.revision} version={v} />
          ))}
        </details>
      )}
    </details>
  );
}
