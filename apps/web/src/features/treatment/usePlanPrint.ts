import { treatmentGet, type PrintablePlan } from "./treatment.api.js";
import { useTreatmentRead } from "./useTreatmentRead.js";

export function usePlanPrint(plan: PrintablePlan, cacheKey: readonly string[]) {
  const state = useTreatmentRead<PrintablePlan>(cacheKey);
  return {
    ...state,
    authorize: () =>
      state.read((signal) =>
        treatmentGet<PrintablePlan>(
          `treatment/${plan.patientId}/plans/${plan.id}/versions/${plan.revision}/print`,
          signal,
        ),
      ),
  };
}
