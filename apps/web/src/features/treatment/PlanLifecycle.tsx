import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type { Identity, TreatmentPlan } from '@clinic/contracts';
import { useTreatmentCommand, CommandState } from './useTreatmentCommand.js';
import {
  planLifecycleMessages as t,
  planStatus,
} from './treatment.messages.js';
import { PlanPrint } from './PlanPrint.js';
import { treatmentGet } from './treatment.api.js';
import type { PrintablePlan } from './PlanPrint.js';
import { PlanVersionDetails } from './PlanVersionDetails.js';
export function PlanLifecycle({
  plan,
  patientId,
  identity,
  cacheKey,
  onLock,
  dirty,
  onDone,
}: {
  plan: TreatmentPlan;
  patientId: string;
  identity: Identity;
  cacheKey: string[];
  onLock: (kind: string, v: boolean) => void;
  dirty: boolean;
  onDone: (plan: TreatmentPlan) => void;
}) {
  const f = useForm<{
    acceptedBy: string;
    acceptedAt: string;
    method: string;
    reason: string;
  }>();
  const [print, setPrint] = useState<PrintablePlan>();
  const [printError, setPrintError] = useState('');
  const [printRevision, setPrintRevision] = useState('');
  const [reviewedRevision, setReviewedRevision] = useState(plan.revision);
  const [reviewing, setReviewing] = useState(false);
  const command = useTreatmentCommand<TreatmentPlan>(
    cacheKey,
    onDone,
    onLock,
    t.saved,
  );
  const send = (action: string, extra: object = {}) => {
    if (confirm(t.confirm))
      void command.save(`treatment/${patientId}/plans/lifecycle`, {
        id: plan.id,
        revision: reviewedRevision,
        action,
        ...extra,
      });
  };
  return (
    <section aria-label="Présentation et accord">
      <p>État : {planStatus[plan.status]}</p>
      {plan.evidence && (
        <p>
          Accord consigné : {plan.evidence.acceptedBy} ·{' '}
          {new Date(plan.evidence.acceptedAt).toLocaleString('fr')} ·{' '}
          {plan.evidence.method} · saisi par {plan.evidence.recordedByName} ·
          proposition version {plan.evidence.proposalRevision}
        </p>
      )}
      {plan.acceptance && (
        <p>
          Acceptation confirmée par {plan.acceptance.confirmedByName} ·{' '}
          {new Date(plan.acceptance.confirmedAt).toLocaleString('fr')}
        </p>
      )}
      {plan.cancellation && (
        <p>
          Annulation : {plan.cancellation.reason} ·{' '}
          {plan.cancellation.actorName}
        </p>
      )}
      {plan.status === 'draft' &&
        plan.events.some((v) => v.status === 'accepted') && <p>{t.renewal}</p>}
      {dirty && (
        <p>Enregistrez et relisez la proposition avant de poursuivre.</p>
      )}
      {plan.revision !== reviewedRevision && (
        <p role="alert">
          La proposition distante a changé. Relisez-la avant toute action.
          Saisie conservée.
        </p>
      )}
      {(command.error || plan.revision !== reviewedRevision) &&
        !command.uncertain && (
          <button
            type="button"
            disabled={command.busy}
            onClick={() => {
              setReviewedRevision(plan.revision);
              setReviewing(true);
            }}
          >
            Relire la proposition pour l’accord
          </button>
        )}
      {reviewing && <PlanVersionDetails version={plan} />}
      <fieldset
        disabled={
          dirty ||
          command.busy ||
          command.uncertain ||
          plan.revision !== reviewedRevision
        }
      >
        <legend>Actions sur la version {plan.revision}</legend>
        {plan.status === 'draft' &&
          identity.kind === 'doctor' && identity.permissions.includes('plans.finalize') && (
            <button type="button" onClick={() => send('present')}>
              {t.present}
            </button>
          )}
        {plan.status === 'presented' &&
          identity.permissions.includes('acceptance.draft') && (
            <form
              onSubmit={f.handleSubmit((v) =>
                send('evidence', {
                  acceptedBy: v.acceptedBy,
                  method: v.method,
                  acceptedAt: new Date(v.acceptedAt).toISOString(),
                }),
              )}
            >
              <label>
                {t.acceptedBy}
                <input required maxLength={200} {...f.register('acceptedBy')} />
              </label>
              <label>
                {t.acceptedAt}
                <input
                  required
                  type="datetime-local"
                  {...f.register('acceptedAt')}
                />
              </label>
              <label>
                {t.method}
                <input required maxLength={1000} {...f.register('method')} />
              </label>
              <button>{t.evidence}</button>
            </form>
          )}
        {plan.status === 'presented' &&
          plan.evidence &&
          identity.kind === 'doctor' && identity.permissions.includes('plans.accept') && (
            <button type="button" onClick={() => send('accept')}>
              {t.accept}
            </button>
          )}
        {['draft', 'presented', 'accepted'].includes(plan.status) &&
          identity.kind === 'doctor' && identity.permissions.includes('plans.finalize') && (
            <form
              onSubmit={f.handleSubmit((v) =>
                send('cancel', { reason: v.reason }),
              )}
            >
              <label>
                Motif d’annulation
                <input required maxLength={1000} {...f.register('reason')} />
              </label>
              <button>{t.cancel}</button>
            </form>
          )}
      </fieldset>
      <CommandState state={command} />
      {command.error && !command.uncertain && (
        <p>
          Relisez la version distante et vérifiez votre saisie conservée avant
          de réessayer.
        </p>
      )}
      {identity.permissions.includes('clinical.print') && (
        <>
          <label>
            Version à imprimer
            <select
              value={printRevision}
              onChange={(e) => setPrintRevision(e.target.value)}
            >
              <option value="">Version actuelle ({plan.revision})</option>
              {plan.events
                .filter((v) => v.revision !== plan.revision)
                .map((v) => (
                  <option key={v.revision} value={v.revision}>
                    Version {v.revision} · {planStatus[v.status]}
                  </option>
                ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => {
              setPrintError('');
              void treatmentGet<PrintablePlan>(
                `treatment/${patientId}/plans/${plan.id}/versions/${printRevision || plan.revision}/print`,
              )
                .then(setPrint)
                .catch((e: Error) => setPrintError(e.message));
            }}
          >
            {t.print}
          </button>
        </>
      )}
      {printError && <p role="alert">{printError}</p>}
      {print && <PlanPrint plan={print} close={() => setPrint(undefined)} />}
    </section>
  );
}
