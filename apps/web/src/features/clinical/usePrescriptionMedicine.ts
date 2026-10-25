import { useState } from "react";
import { useCareQuery } from "./useCareQuery.js";
import type { UseFormReturn } from "react-hook-form";
import type {
  MedicationEntry,
  PrescriptionContent,
  Identity,
} from "@clinic/contracts";
import { useTreatmentCommand } from "../treatment/useTreatmentCommand.js";
export type PrescriptionValues = {
  content: Pick<PrescriptionContent, "medicines" | "instructions">;
  reason: string;
};
export function usePrescriptionMedicine(
  form: UseFormReturn<PrescriptionValues>,
  index: number,
  lookupAllowed: boolean,
  identity: Identity,
) {
  const name = form.watch(`content.medicines.${index}.name`),
    [savedReference, setSavedReference] = useState("");
  const descriptor = JSON.stringify([
    name.trim(),
    form.watch(`content.medicines.${index}.strength`).trim(),
    form.watch(`content.medicines.${index}.form`).trim(),
  ]);
  const query = useCareQuery<MedicationEntry[]>(
    ["medications", identity.clinicId, identity.accountId, "lookup", name],
    `medications?q=${encodeURIComponent(name)}`,
    undefined,
    lookupAllowed && name.trim().length > 0,
  );
  const command = useTreatmentCommand<MedicationEntry>(
    ["medications", identity.clinicId, identity.accountId],
    (v) => setSavedReference(JSON.stringify([v.name, v.strength, v.form])),
    undefined,
    "Référence enregistrée dans la liste. Ordonnance à enregistrer séparément.",
  );
  function select(m: MedicationEntry) {
    for (const field of ["name", "strength", "form"] as const)
      form.setValue(`content.medicines.${index}.${field}`, m[field], {
        shouldDirty: true,
      });
  }
  function addReference() {
    const m = form.getValues(`content.medicines.${index}`);
    void command.save("medications", {
      id: crypto.randomUUID(),
      revision: 0,
      name: m.name,
      strength: m.strength,
      form: m.form,
      active: true,
    });
  }
  return {
    query,
    command,
    select,
    addReference,
    name,
    savedReference,
    descriptor,
  };
}
