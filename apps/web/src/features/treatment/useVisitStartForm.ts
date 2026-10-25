import { useState } from "react";
import { useForm } from "react-hook-form";
import type {
  TreatmentPlan,
  VisitState,
  VisitSelection,
} from "@clinic/contracts";
import { visitMessages as t } from "./visit.messages.js";
export function useVisitStartForm(
  plans: TreatmentPlan[],
  completions: VisitState["completions"],
  submit: (selections: VisitSelection[], appointmentId: string | null) => void,
) {
  const [reviewed, setReviewed] = useState(() =>
    plans.map(({ id, revision }) => ({ id, revision })),
  );
  const f = useForm<{ selected: string[]; appointmentId: string }>({
    defaultValues: { selected: [], appointmentId: "" },
  });
  const changed =
    reviewed.some(
      (p) => plans.find((v) => v.id === p.id)?.revision !== p.revision,
    ) || reviewed.length !== plans.length;
  const choices = plans.flatMap((plan) =>
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
    .watch("selected")
    .some((key) => !choices.some((c) => `${c.plan.id}:${c.item.id}` === key));
  const onSubmit = f.handleSubmit((v) => {
    if (changed || invalid) {
      f.setError("selected", { message: t.stale });
      return;
    }
    const selected = choices.filter((c) =>
      v.selected.includes(`${c.plan.id}:${c.item.id}`),
    );
    if (!selected.length || selected.length !== v.selected.length) {
      f.setError("selected", {
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
  });
  function review() {
    f.clearErrors("selected");
    setReviewed(plans.map(({ id, revision }) => ({ id, revision })));
    const available = new Set(
      plans.flatMap((p) =>
        p.items
          .filter(
            (i) =>
              !completions.some((c) => c.planId === p.id && c.itemId === i.id),
          )
          .map((i) => `${p.id}:${i.id}`),
      ),
    );
    f.setValue(
      "selected",
      f.getValues("selected").filter((key) => available.has(key)),
      { shouldValidate: true },
    );
  }
  return { f, changed, invalid, choices, onSubmit, review };
}
