import type { ClinicalVersion, PrescriptionContent } from "@clinic/contracts";
import { useTreatmentRead } from "../treatment/useTreatmentRead.js";
import { treatmentGet } from "../treatment/treatment.api.js";
type PrintablePrescription = {
  version: ClinicalVersion<PrescriptionContent>;
  superseded: boolean;
};
export function usePrescriptionPrint(
  patientId: string,
  id: string,
  revision: number,
  cacheKey: readonly string[],
) {
  const read = useTreatmentRead<PrintablePrescription>([...cacheKey, id]);
  const load = (chosen: number) =>
    read.read((signal) =>
      treatmentGet<PrintablePrescription>(
        `clinical/${patientId}/prescriptions/${id}/print/${chosen}`,
        signal,
      ),
    );
  return {
    ...read,
    prepare: () => load(revision),
    authorize: () => load(read.data?.version.revision ?? revision),
  };
}
