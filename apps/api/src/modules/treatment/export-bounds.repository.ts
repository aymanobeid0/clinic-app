import type { ClinicTransaction } from "../../database.js";
import { AppError } from "../../errors/app-error.js";
// Refuse oversized histories before materializing their JSON projections.
export async function assertExportBound(
  tx: ClinicTransaction,
  clinicId: string,
  patientId: string,
) {
  const counts = await Promise.all([
    tx.consultationRevision.count({where:{clinicId,patientId}}),
    tx.treatmentPlanRevision.count({ where: { clinicId, patientId } }),
    tx.treatmentVisit.count({ where: { clinicId, patientId } }),
    tx.procedureStart.count({ where: { clinicId, patientId } }),
    tx.procedureCompletion.count({ where: { clinicId, patientId } }),
  ]);
  if (counts.reduce((n, v) => n + v, 0) > 1000)
    throw new AppError(
      413,
      "Export limité à 1 000 enregistrements. Contactez le responsable.",
    );
}
