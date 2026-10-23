import type { ClinicTransaction } from "../../database.js";
import { AppError } from "../../errors/app-error.js";
// Refuse oversized histories before materializing their JSON projections.
export async function assertExportBound(
  tx: ClinicTransaction,
  clinicId: string,
) {
  const counts = await Promise.all([
    tx.inventoryItem.count({ where: { clinicId } }),
    tx.inventorySupplier.count({ where: { clinicId } }),
    tx.inventoryBatch.count({ where: { clinicId } }),
    tx.inventoryMovement.count({ where: { clinicId } }),
  ]);
  if (counts.reduce((n, v) => n + v, 0) > 1000)
    throw new AppError(
      413,
      "Export limité à 1 000 enregistrements. Contactez le responsable.",
    );
}
