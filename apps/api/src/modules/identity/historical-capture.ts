import { captureClinical } from "../clinical/index.js";
import { captureTreatment } from "../treatment/index.js";
import { captureBilling, captureOwnInvoices } from "../billing/index.js";
import { captureAttachments } from "../files/index.js";
import { capturePatient } from "../patients/index.js";
import type { ClinicTransaction } from "../../database.js";
import type { HistoricalSnapshot } from "@clinic/contracts";
import { AppError } from "../../errors/app-error.js";
export async function captureRemoval(
  tx: ClinicTransaction,
  clinicId: string,
  patientId: string,
  accountId: string,
  cutoff: string,
): Promise<HistoricalSnapshot> {
  const patient = await capturePatient(tx, clinicId, patientId);
  if (!patient) throw new AppError(404, "Patient introuvable.");
  const attachments = await captureAttachments(tx, clinicId, patientId);
  return {
    patient,
    cutoff,
    clinical: await captureClinical(tx, clinicId, patientId),
    ...(await captureTreatment(tx, clinicId, patientId, attachments)),
    financial: await captureBilling(
      tx,
      { clinicId, accountId, ownWork: true, clinical: true },
      patientId,
    ),
    invoices: await captureOwnInvoices(tx, clinicId, patientId, accountId),
    attachments,
  };
}
