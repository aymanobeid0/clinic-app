import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { PrintablePlan } from "./treatment.api.js";
import { useTreatmentRead } from "./useTreatmentRead.js";
import { PlanVersionDetails } from "./PlanVersionDetails.js";
import { treatmentGet } from "./treatment.api.js";
export function PlanPrint({
  plan,
  close,
  cacheKey,
}: {
  cacheKey: string[];
  plan: PrintablePlan;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef(document.activeElement as HTMLElement | null);
  const state = useTreatmentRead<PrintablePlan>(cacheKey);
  useEffect(() => {
    dialog.current?.showModal();
    const previous = trigger.current;
    return () => previous?.focus();
  }, []);
  async function print() {
    const authorized = await state.read((signal) =>
      treatmentGet<PrintablePlan>(
        `treatment/${plan.patientId}/plans/${plan.id}/versions/${plan.revision}/print`,
        signal,
      ),
    );
    if (authorized) window.print();
  }

  return createPortal(
    <dialog
      ref={dialog}
      className="plan-print"
      aria-label="Proposition imprimable"
      onCancel={close}
    >
      <div className="no-print">
        <button type="button" onClick={close}>
          Fermer l’aperçu
        </button>
        <button
          type="button"
          disabled={state.busy}
          onClick={() => {
            void print();
          }}
        >
          Imprimer cette version
        </button>
        {state.error && <p role="alert">{state.error}</p>}
      </div>
      {!state.denied && (
        <>
          <h1>Proposition de traitement</h1>
          <p>{plan.clinicName}</p>
          <p>
            Patient : {plan.patientName} · n°{plan.patientNumber}
          </p>
          <PlanVersionDetails version={plan} />
          <p>Les soins proposés non démarrés ne constituent pas une dette.</p>
        </>
      )}
    </dialog>,
    document.body,
  );
}
