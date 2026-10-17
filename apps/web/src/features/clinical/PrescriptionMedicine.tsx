import { useState } from "react";
import type { UseFormReturn } from "react-hook-form";
import { useQuery } from "@tanstack/react-query";
import type { MedicationEntry, PrescriptionContent } from "@clinic/contracts";
import { treatmentGet } from "../treatment/treatment.api.js";
import {
  useTreatmentCommand,
  CommandState,
} from "../treatment/useTreatmentCommand.js";
import { prescriptionMessages as t } from "./prescription.messages.js";
export function PrescriptionMedicine({
  form,
  index,
  lookupAllowed,
  addAllowed,
}: {
  form: UseFormReturn<{
    content: Pick<PrescriptionContent, "medicines" | "instructions">;
    reason: string;
  }>;
  index: number;
  lookupAllowed: boolean;
  addAllowed: boolean;
}) {
  const name = form.watch(`content.medicines.${index}.name`),
    [savedReference, setSavedReference] = useState("");
  const descriptor=JSON.stringify([name.trim(),form.watch(`content.medicines.${index}.strength`).trim(),form.watch(`content.medicines.${index}.form`).trim()]);
  const query = useQuery({
    queryKey: ["medications", "lookup", name],
    queryFn: ({ signal }) =>
      treatmentGet<MedicationEntry[]>(
        `medications?q=${encodeURIComponent(name)}`,
        signal,
      ),
    enabled: lookupAllowed && name.trim().length > 0,
    retry: false,
    gcTime: 0,
  });
  const command = useTreatmentCommand<MedicationEntry>(
    ["medications"],
    (v) => setSavedReference(JSON.stringify([v.name,v.strength,v.form])),
    undefined,
    "Référence enregistrée dans la liste. Ordonnance à enregistrer séparément.",
  );
  function select(m: MedicationEntry) {
    for (const field of ["name", "strength", "form"] as const)
      form.setValue(`content.medicines.${index}.${field}`, m[field], {
        shouldDirty: true,
      });
  }
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
              !addAllowed || command.busy || command.uncertain || !name.trim() || savedReference===descriptor
            }
            onClick={() => {
              const m = form.getValues(`content.medicines.${index}`);
              void command.save("medications", {
                id: crypto.randomUUID(),
                revision: 0,
                name: m.name,
                strength: m.strength,
                form: m.form,
                active: true,
              });
            }}
          >
            {t.addReference}
          </button>
          <CommandState state={command} />
        </>
      )}
    </fieldset>
  );
}
