import { useQueryClient } from "@tanstack/react-query";
import type { Identity } from "@clinic/contracts";
import { useTreatmentCommand } from "../treatment/useTreatmentCommand.js";
import { consultationKey } from "./consultation.access.js";
import { useConsultationAuthority } from "./consultation.authority.js";
import { treatmentDenied } from "../treatment/treatment.workflow.js";
// Retain exact uncertain commands using the existing transport workflow. Server
// projections stay in Query; command receipts are not retained as React state.
export function useConsultationCommand<T>(
  identity: Identity,
  patientId = "",
  accessScope = "active",
  commandScope = "",
) {
  const cache = useQueryClient();
  const authority = useConsultationAuthority(identity, patientId, accessScope);
  const command = useTreatmentCommand<T>(
    [
      ...consultationKey(identity, patientId, accessScope),
      "command",
      commandScope,
      authority.suspended ? "suspended" : "current",
    ],
    () => {
      // Consultation entry/payment changes existing consumer projections too.
      void cache.invalidateQueries({
        predicate: ({ queryKey }) =>
          [
            "consultations",
            "billing",
            "visits",
            "plans",
            "scheduling",
            "reporting",
            "clinical",
            "notes",
          ].includes(String(queryKey[0])),
      });
    },
    undefined,
    undefined,
    (error) => {
      if (treatmentDenied(error)) void authority.retire();
    },
  );
  return {
    ...command,
    denied: authority.suspended || command.denied,
    save: (path: string, data: object) =>
      authority.suspended
        ? Promise.resolve(undefined)
        : command.save(path, data),
    retry: () =>
      authority.suspended ? Promise.resolve(undefined) : command.retry(),
  };
}
