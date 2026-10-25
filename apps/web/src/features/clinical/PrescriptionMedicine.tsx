import { usePrescriptionMedicine } from "./usePrescriptionMedicine.js";
import type { UseFormReturn } from "react-hook-form";
import type { Identity, PrescriptionContent } from "@clinic/contracts";
import { CommandState } from "../treatment/useTreatmentCommand.js";
import { prescriptionMessages as t } from "./prescription.messages.js";
export function PrescriptionMedicine({
  form,
  index,
  lookupAllowed,
  addAllowed,
  identity,
}: {
  form: UseFormReturn<{
    content: Pick<PrescriptionContent, "medicines" | "instructions">;
    reason: string;
  }>;
  index: number;
  lookupAllowed: boolean;
  addAllowed: boolean;
  identity: Identity;
}) {
  const {
    query,
    command,
    select,
    addReference,
    name,
    savedReference,
    descriptor,
  } = usePrescriptionMedicine(form, index, lookupAllowed, identity);
  return (
    <fieldset>
      <legend>Médicament {index + 1}</legend>
      {(
        [
          "name",
          "strength",
          "form",
          "dose",
          "route",
          "frequency",
          "duration",
          "quantity",
          "instructions",
        ] as const
      ).map((field) => (
        <label key={field}>
          {t[field]}
          <input
            required={[
              "name",
              "dose",
              "route",
              "frequency",
              "duration",
            ].includes(field)}
            maxLength={
              field === "instructions" ? 2000 : field === "name" ? 160 : 200
            }
            {...form.register(`content.medicines.${index}.${field}`)}
          />
        </label>
      ))}
      {lookupAllowed && (
        <>
          <p>{t.manual}</p>
          {query.isFetching && <p role="status">Recherche des références…</p>}
          {query.error && <p role="alert">{t.lookupError}</p>}
          {query.data && (
            <ul aria-label="Références correspondantes">
              {query.data.map((m) => (
                <li key={m.id}>
                  <button type="button" onClick={() => select(m)}>
                    Choisir {m.name} · {m.strength} · {m.form}
                  </button>
                </li>
              ))}
            </ul>
          )}
          <button
            type="button"
            disabled={
              !addAllowed ||
              command.busy ||
              command.uncertain ||
              !name.trim() ||
              savedReference === descriptor
            }
            onClick={addReference}
          >
            {t.addReference}
          </button>
          <CommandState state={command} />
        </>
      )}
    </fieldset>
  );
}
