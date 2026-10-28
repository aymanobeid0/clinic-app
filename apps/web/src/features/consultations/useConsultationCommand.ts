import { useQueryClient } from "@tanstack/react-query";
import type { Identity } from "@clinic/contracts";
import { useTreatmentCommand } from "../treatment/useTreatmentCommand.js";
import { consultationKey } from "./consultation.access.js";
// Retain exact uncertain commands using the existing transport workflow. Server
// projections stay in Query; command receipts are not retained as React state.
export function useConsultationCommand<T>(
  identity: Identity,
  patientId = "",
  accessScope = "active",
) {
  const cache = useQueryClient();
  return useTreatmentCommand<T>(
    consultationKey(identity, patientId, accessScope),
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
  );
}
