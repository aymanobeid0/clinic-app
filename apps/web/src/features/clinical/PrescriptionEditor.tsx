import { useFieldArray } from "react-hook-form";
import type { Identity, Prescription } from "@clinic/contracts";
import {
  emptyMedicine,
  usePrescriptionEditor,
} from "./usePrescriptionEditor.js";
import { PrescriptionMedicine } from "./PrescriptionMedicine.js";
import { PrescriptionVersion } from "./PrescriptionPrint.js";
import { prescriptionMessages as t } from "./prescription.messages.js";
export function PrescriptionEditor({
  patientId,
  record,
  identity,
  onLock,
}: {
  patientId: string;
  record: Prescription;
  identity: Identity;
  onLock: (kind: string, value: boolean) => void;
}) {
  const e = usePrescriptionEditor(patientId, record, onLock),
    fields = useFieldArray({
      control: e.form.control,
      name: "content.medicines",
    });
  const writable = identity.permissions.includes("prescriptions.draft"),
    doctor =
      identity.kind === "doctor" &&
      identity.permissions.includes("prescriptions.sign");
  return (
    <form
      onSubmit={e.form.handleSubmit(() => {
        void e.save();
      })}
    >
      <fieldset disabled={!writable || e.busy || e.uncertain || e.conflict}>
        <legend>{record.current ? t.correction : t.new}</legend>
        {fields.fields.map((field, index) => (
          <div key={field.id}>
            <PrescriptionMedicine
              form={e.form}
              index={index}
              lookupAllowed={identity.permissions.includes(
                "prescriptions.draft",
              )}
              addAllowed={doctor}
            />
            {fields.fields.length > 1 && (
              <button type="button" onClick={() => fields.remove(index)}>
                Retirer le médicament {index + 1}
              </button>
            )}
          </div>
        ))}
        <button
          type="button"
          onClick={() => fields.append({ ...emptyMedicine })}
        >
          {t.addLine}
        </button>
        <label>
          {t.general}
          <textarea {...e.form.register("content.instructions")} />
        </label>
        {record.current && (
          <label>
            {t.reason}
            <input required {...e.form.register("reason")} />
          </label>
        )}
        <button>{t.save}</button>
      </fieldset>
      <p role="status">{e.busy ? t.saving : e.dirty ? t.unsaved : t.saved}</p>
      {e.error && <p role="alert">{e.error}</p>}
      {e.uncertain && (
        <button type="button" disabled={e.busy} onClick={() => void e.save()}>
          {t.retry}
        </button>
      )}
      {e.conflict && (
        <>
          <p role="alert">Conflit : votre saisie est conservée.</p>
          <button type="button" onClick={() => void e.compare()}>
            {t.compare}
          </button>
        </>
      )}
      {e.compared && (
        <>
          {(e.compared.draft ?? e.compared.current) ? (
            <PrescriptionVersion
              version={(e.compared.draft ?? e.compared.current)!}
            />
          ) : (
            <p>Aucun brouillon sur le serveur.</p>
          )}
          <button type="button" onClick={() => e.resolve(true)}>
            {t.keep}
          </button>
          <button type="button" onClick={() => e.resolve(false)}>
            {t.useServer}
          </button>
        </>
      )}
      {record.draft && <PrescriptionVersion version={record.draft} />}{" "}
      {doctor && (
        <button
          type="button"
          disabled={
            e.busy || e.dirty || e.uncertain || e.conflict || !record.draft
          }
          onClick={() => {
            if (confirm(t.confirm)) void e.save("finalize");
          }}
        >
          {t.finalize}
        </button>
      )}
    </form>
  );
}
