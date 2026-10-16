import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TreatmentVersion } from '@clinic/contracts';
import { PlanVersionDetails } from './PlanVersionDetails.js';
import { treatmentGet } from './treatment.api.js';
export type PrintablePlan = TreatmentVersion & {
  clinicName: string;
  patientName: string;
  patientNumber: number;
};
export function PlanPrint({
  plan,
  close,
}: {
  plan: PrintablePlan;
  close: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef(document.activeElement as HTMLElement | null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    dialog.current?.showModal();
    const previous = trigger.current;
    return () => previous?.focus();
  }, []);
  async function print() {
    setBusy(true);
    setError('');
    try {
      await treatmentGet(
        `treatment/${plan.patientId}/plans/${plan.id}/versions/${plan.revision}/print`,
      );
      window.print();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Impression indisponible.');
    } finally {
      setBusy(false);
    }
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
          disabled={busy}
          onClick={() => {
            void print();
          }}
        >
          Imprimer cette version
        </button>
        {error && <p role="alert">{error}</p>}
      </div>
      <h1>Proposition de traitement</h1>
      <p>{plan.clinicName}</p>
      <p>
        Patient : {plan.patientName} · n°{plan.patientNumber}
      </p>
      <PlanVersionDetails version={plan} />
      <p>Les soins proposés non démarrés ne constituent pas une dette.</p>
    </dialog>,
    document.body,
  );
}
