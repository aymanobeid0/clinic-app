import type { ClinicTransaction } from "../../database.js";
import type { HistoricalSnapshot } from "@clinic/contracts";
import { ClinicalRepository } from "./clinical.repository.js";
// Called inside the same clinic authorization transaction as care removal.
export async function captureClinical(
  tx: ClinicTransaction,
  clinicId: string,
  patientId: string,
): Promise<HistoricalSnapshot["clinical"]> {
  return new ClinicalRepository(tx, clinicId, patientId).historical();
}
