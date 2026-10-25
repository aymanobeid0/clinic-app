import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import type {
  Identity,
  MedicationEntry,
  PrescriptionTemplate,
} from "@clinic/contracts";
import { useCareQuery } from "./useCareQuery.js";
import { useTreatmentCommand } from "../treatment/useTreatmentCommand.js";
import { useTreatmentRead } from "../treatment/useTreatmentRead.js";
import { treatmentGet } from "../treatment/treatment.api.js";
import { referenceMessages as r } from "./reference.messages.js";
export function useMedicationReferences(identity: Identity) {
  const query = useCareQuery<MedicationEntry[]>(
    ["medications", identity.clinicId, identity.accountId],
    "medications?retired=true",
    "medications/events",
  );
  return { query };
}
export function useMedicationForm(
  entry: MedicationEntry | null,
  onLock: (v: boolean) => void,
  identity: Identity,
) {
  const [id] = useState(() => entry?.id ?? crypto.randomUUID()),
    [revision, setRevision] = useState(entry?.revision ?? 0);
  const read = useTreatmentRead<MedicationEntry[]>([
    "medications",
    identity.clinicId,
    identity.accountId,
  ]);
  const remote = read.data?.find((m) => m.id === id);
  const readError = read.error;
  const f = useForm({
      defaultValues: {
        name: entry?.name ?? "",
        strength: entry?.strength ?? "",
        form: entry?.form ?? "",
        active: entry?.active ?? true,
      },
    }),
    command = useTreatmentCommand<MedicationEntry>(
      ["medications", identity.clinicId, identity.accountId],
      (v) => {
        setRevision(v.revision);
        f.reset(f.getValues());
      },
      undefined,
      r.saved,
    );
  useEffect(() => {
    onLock(command.busy || command.uncertain || f.formState.isDirty);
    return () => onLock(false);
  }, [onLock, command.busy, command.uncertain, f.formState.isDirty]);
  async function reload() {
    const rows = await read.read((signal) =>
      treatmentGet<MedicationEntry[]>("medications?retired=true", signal),
    );
    if (rows) setRevision(rows.find((m) => m.id === id)?.revision ?? 0);
  }
  return {
    f,
    command,
    remote,
    readError,
    reload,
    submit: f.handleSubmit((v) => {
      void command.save("medications", { ...v, id, revision });
    }),
  };
}
export function usePrescriptionTemplate(identity: Identity) {
  return useCareQuery<PrescriptionTemplate>(
    ["prescription-template", identity.clinicId, identity.accountId],
    "prescription-template",
  );
}
export function usePrescriptionTemplateForm(
  value: PrescriptionTemplate,
  identity: Identity,
) {
  const f = useForm({
      defaultValues: { header: value.header, footer: value.footer },
    }),
    command = useTreatmentCommand([
      "prescription-template",
      identity.clinicId,
      identity.accountId,
    ]);
  const submit = f.handleSubmit((v) => {
    void command.save("prescription-template", {
      ...v,
      revision: value.revision,
    });
  });
  return { f, command, submit };
}
