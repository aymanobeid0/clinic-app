import { useState } from 'react';
import { useForm } from 'react-hook-form';
import type {
  TreatmentPlan,
  VisitState,
  VisitSelection,
} from '@clinic/contracts';
import { visitMessages as t } from './visit.messages.js';
export function VisitStartForm({
  plans,
  appointments,
  completions,
  disabled,
  submit,
}: {
  plans: TreatmentPlan[];
  appointments: VisitState['appointments'];
  completions: VisitState['completions'];
  disabled: boolean;
  submit: (selections: VisitSelection[], appointmentId: string | null) => void;
}) {
  const [reviewed, setReviewed] = useState(plans);
  const f = useForm<{ selected: string[]; appointmentId: string }>({
    defaultValues: { selected: [], appointmentId: '' },
  });
  const changed =
    reviewed.some(
      (p) => plans.find((v) => v.id === p.id)?.revision !== p.revision,
    ) || reviewed.length !== plans.length;
  const choices = reviewed.flatMap((plan) =>
    plan.items
      .map((item, index) => ({ plan, item, index }))
      .filter(
        (c) =>
          !completions.some(
            (v) => v.planId === c.plan.id && v.itemId === c.item.id,
          ),
      ),
  );
  const invalid = f
    .watch('selected')
    .some((key) => !choices.some((c) => `${c.plan.id}:${c.item.id}` === key));
  return (
    <form
      onSubmit={f.handleSubmit((v) => {
        const selected = choices.filter((c) =>
          v.selected.includes(`${c.plan.id}:${c.item.id}`),
        );
        if (!selected.length || selected.length !== v.selected.length) {
          f.setError('selected', {
            message: t.selectionRequired,
          });
          return;
        }
        submit(
          selected.map((c) => ({
            planId: c.plan.id,
            itemId: c.item.id,
            planRevision: c.plan.revision,
          })),
          v.appointmentId || null,
        );
      })}
    >
      <p>{t.select}</p>
      {(changed || invalid) && (
        <>
          <p role="alert">{t.stale}</p>
          <button
            type="button"
            disabled={disabled}
            onClick={() => {
              setReviewed(plans);
              const available = new Set(
                plans.flatMap((p) =>
                  p.items
                    .filter(
                      (i) =>
                        !completions.some(
                          (c) => c.planId === p.id && c.itemId === i.id,
                        ),
                    )
                    .map((i) => `${p.id}:${i.id}`),
                ),
              );
              f.setValue(
                'selected',
                f.getValues('selected').filter((key) => available.has(key)),
                { shouldValidate: true },
              );
            }}
          >
            {t.review}
          </button>
        </>
      )}
      <fieldset disabled={disabled || changed}>
        <legend>{t.actsLegend}</legend>
        <label>
          {t.origin}
          <select {...f.register('appointmentId')}>
            <option value="">{t.walkIn}</option>
            {appointments.map((a) => (
              <option key={a.id} value={a.id}>
                {new Date(a.startsAt).toLocaleString('fr')} ·{' '}
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
              {...f.register('selected', {
                validate: (v) =>
                  (v.length > 0 &&
                    v.every((key) =>
                      choices.some((c) => `${c.plan.id}:${c.item.id}` === key),
                    )) ||
                  t.selectionRequired,
              })}
            />
            {c.plan.title} · {c.item.name} · {t.itemNumber(c.index + 1)} ·{' '}
            {t.version} {c.plan.revision}
          </label>
        ))}
        {f.formState.errors.selected && (
          <p role="alert">{f.formState.errors.selected.message}</p>
        )}
        <button>{t.start}</button>
      </fieldset>
    </form>
  );
}
