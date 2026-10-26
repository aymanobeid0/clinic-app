import { ValidatedForm } from "../../forms/ValidatedForm.js";
import { useVisitStartForm } from "./useVisitStartForm.js";
import type {
  TreatmentPlan,
  VisitState,
  VisitSelection,
} from "@clinic/contracts";
import { visitMessages as t } from "./visit.messages.js";
export function VisitStartForm({
  plans,
  appointments,
  completions,
  disabled,
  submit,
}: {
  plans: TreatmentPlan[];
  appointments: VisitState["appointments"];
  completions: VisitState["completions"];
  disabled: boolean;
  submit: (selections: VisitSelection[], appointmentId: string | null) => void;
}) {
  const { f, changed, invalid, choices, onSubmit, review } = useVisitStartForm(
    plans,
    completions,
    submit,
  );
  return (
    <ValidatedForm onSubmit={onSubmit}>
      <p>{t.select}</p>
      {(changed || invalid) && (
        <>
          <p role="alert">{t.stale}</p>
          <button type="button" disabled={disabled} onClick={review}>
            {t.review}
          </button>
        </>
      )}
      <fieldset disabled={disabled || changed}>
        <legend>{t.actsLegend}</legend>
        <label>
          {t.origin}
          <select {...f.register("appointmentId")}>
            <option value="">{t.walkIn}</option>
            {appointments.map((a) => (
              <option key={a.id} value={a.id}>
                {new Date(a.startsAt).toLocaleString("fr")} ·{" "}
                {a.walkIn ? t.arrived : t.appointment}
              </option>
            ))}
          </select>
        </label>
        {choices.map((c) => (
          <label className="check" key={`${c.plan.id}:${c.item.id}`}>
            <input
              type="checkbox"
              value={`${c.plan.id}:${c.item.id}`}
              {...f.register("selected", {
                validate: (v) =>
                  (v.length > 0 &&
                    v.every((key) =>
                      choices.some((c) => `${c.plan.id}:${c.item.id}` === key),
                    )) ||
                  t.selectionRequired,
              })}
            />
            {c.plan.title} · {c.item.name} · {t.itemNumber(c.index + 1)} ·{" "}
            {t.version} {c.plan.revision}
          </label>
        ))}
        {f.formState.errors.selected && (
          <p role="alert">{f.formState.errors.selected.message}</p>
        )}
        <button>{t.start}</button>
      </fieldset>
    </ValidatedForm>
  );
}
