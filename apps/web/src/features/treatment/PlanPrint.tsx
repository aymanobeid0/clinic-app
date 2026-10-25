import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import type { PrintablePlan } from "./treatment.api.js";
import { usePlanPrint } from "./usePlanPrint.js";
import { PlanVersionDetails } from "./PlanVersionDetails.js";
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
  const state = usePlanPrint(plan, cacheKey);
  useEffect(() => {
    dialog.current?.showModal();
    const previous = trigger.current;
    return () => previous?.focus();
  }, []);
  async function print() {
    const authorized = await state.authorize();
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
