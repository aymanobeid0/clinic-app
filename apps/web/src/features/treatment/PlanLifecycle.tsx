import { ValidatedForm } from "../../forms/ValidatedForm.js";
import { usePlanLifecycle } from "./usePlanLifecycle.js";
import type { Identity, TreatmentPlan } from "@clinic/contracts";
import { CommandState } from "./useTreatmentCommand.js";
import {
  planLifecycleMessages as t,
  planStatus,
} from "./treatment.messages.js";
import { PlanPrint } from "./PlanPrint.js";
import { PlanVersionDetails } from "./PlanVersionDetails.js";
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
  const {
    f,
    command,
    evidence,
    cancel,
    send,
    reviewedRevision,
    reviewing,
    review,
    printState,
    printRevision,
    setPrintRevision,
    preview,
    canPresent,
    canAccept,
    canCancel,
    canRecordEvidence,
    canPrint,
  } = usePlanLifecycle({
    plan,
    patientId,
    identity,
    cacheKey,
    onLock,
    dirty,
    onDone,
  });
  return (
    <section aria-label="Présentation et accord">
      <p>État : {planStatus[plan.status]}</p>
      {plan.evidence && (
        <p>
          Accord consigné : {plan.evidence.acceptedBy} ·{" "}
          {new Date(plan.evidence.acceptedAt).toLocaleString("fr")} ·{" "}
          {plan.evidence.method} · saisi par {plan.evidence.recordedByName} ·
          proposition version {plan.evidence.proposalRevision}
        </p>
      )}
      {plan.acceptance && (
        <p>
          Acceptation confirmée par {plan.acceptance.confirmedByName} ·{" "}
          {new Date(plan.acceptance.confirmedAt).toLocaleString("fr")}
        </p>
      )}
      {plan.cancellation && (
        <p>
          Annulation : {plan.cancellation.reason} ·{" "}
          {plan.cancellation.actorName}
        </p>
      )}
      {plan.status === "draft" &&
        plan.events.some((v) => v.status === "accepted") && <p>{t.renewal}</p>}
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
              review();
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
        {canPresent && (
          <button
            type="button"
            onClick={() => send("present", {}, confirm(t.confirm))}
          >
            {t.present}
          </button>
        )}
        {canRecordEvidence && (
          <ValidatedForm
            onSubmit={(event) => {
              event.preventDefault();
              if (confirm(t.confirm)) void evidence(true)(event);
            }}
          >
            <label>
              {t.acceptedBy}
              <input required maxLength={200} {...f.register("acceptedBy")} />
            </label>
            <label>
              {t.acceptedAt}
              <input
                required
                type="datetime-local"
                {...f.register("acceptedAt")}
              />
            </label>
            <label>
              {t.method}
              <input required maxLength={1000} {...f.register("method")} />
            </label>
            <button>{t.evidence}</button>
          </ValidatedForm>
        )}
        {canAccept && (
          <button
            type="button"
            onClick={() => send("accept", {}, confirm(t.confirm))}
          >
            {t.accept}
          </button>
        )}
        {canCancel && (
          <ValidatedForm
            onSubmit={(event) => {
              event.preventDefault();
              if (confirm(t.confirm)) void cancel(true)(event);
            }}
          >
            <label>
              Motif d’annulation
              <input required maxLength={1000} {...f.register("reason")} />
            </label>
            <button>{t.cancel}</button>
          </ValidatedForm>
        )}
      </fieldset>
      <CommandState state={command} />
      {command.error && !command.uncertain && (
        <p>
          Relisez la version distante et vérifiez votre saisie conservée avant
          de réessayer.
        </p>
      )}
      {canPrint && (
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
              preview();
            }}
          >
            {t.print}
          </button>
        </>
      )}
      {printState.error && <p role="alert">{printState.error}</p>}
      {printState.data && (
        <PlanPrint
          cacheKey={cacheKey}
          plan={printState.data}
          close={printState.clear}
        />
      )}
    </section>
  );
}
