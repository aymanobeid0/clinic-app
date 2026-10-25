import { PlanItems } from "./PlanItems.js";
import type { Catalog, Identity, TreatmentPlan } from "@clinic/contracts";
import { CommandState } from "./useTreatmentCommand.js";
import { treatmentMessages as t } from "./treatment.messages.js";
import { PlanSummary } from "./TreatmentPanel.js";
import { usePlanForm } from "./usePlanForm.js";
export type { PlanFields, PlanItemFields } from "./usePlanForm.js";
export function PlanForm({
  patientId,
  plan,
  catalog,
  identity,
  cacheKey,
  onLock,
  onDirty,
}: {
  patientId: string;
  plan?: TreatmentPlan;
  catalog: Catalog;
  identity: Identity;
  cacheKey: string[];
  onLock: (kind: string, v: boolean) => void;
  onDirty: (v: boolean) => void;
}) {
  const {
    f,
    array,
    snapshot,
    id,
    revision,
    remote,
    reconciled,
    reloadError,
    command,
    canOverride,
    canDiscount,
    currency,
    locked,
    submit,
    reload,
  } = usePlanForm({
    patientId,
    plan,
    catalog,
    identity,
    cacheKey,
    onLock,
    onDirty,
  });
  return (
    <form
      onSubmit={f.handleSubmit((v) => {
        void submit(v);
      })}
    >
      <fieldset disabled={locked}>
        <legend>{plan ? `Modifier la proposition ${id}` : t.newPlan}</legend>
        <p>
          Identifiant : {id} · version enregistrée {revision}
        </p>
        <label>
          {t.proposal}
          <input required maxLength={160} {...f.register("title")} />
        </label>
        <label>
          {t.currency}
          <select
            aria-label={t.currency}
            disabled={!!revision || array.fields.length > 0}
            {...f.register("currency")}
          >
            {catalog.currencies.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
        <label>
          Notes de la proposition
          <textarea maxLength={10000} {...f.register("notes")} />
        </label>
        <p>{t.exactHelp}</p>
        <PlanItems
          catalog={catalog}
          currency={currency}
          snapshot={snapshot}
          register={f.register}
          fields={array.fields}
          append={array.append}
          remove={array.remove}
          canOverride={canOverride}
          canDiscount={canDiscount}
          control={f.control}
        />
        {snapshot && snapshot.status !== "draft" && (
          <p>
            Toute modification de la portée ou du prix exige une nouvelle
            acceptation. Les notes conservent l’accord.
          </p>
        )}
        <button disabled={!array.fields.length}>{t.save}</button>
      </fieldset>
      <p role="status">{f.formState.isDirty ? t.unsaved : command.notice}</p>
      <CommandState state={command} />
      {command.error && !command.uncertain && (
        <button
          type="button"
          onClick={() => {
            reload();
          }}
        >
          {t.reconcile}
        </button>
      )}
      {reloadError && <p role="alert">{reloadError}</p>}
      {reconciled && <p role="status">{reconciled}</p>}
      {remote && <PlanSummary plan={remote} />}
    </form>
  );
}
