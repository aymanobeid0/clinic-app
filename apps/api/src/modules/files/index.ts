import type { IdentityAccess } from "../identity/index.js";
import type { ClinicUpdates } from "../../clinic-updates.js";
import { FilesService } from "./files.service.js";
import { FilesController } from "./files.controller.js";
import { filesRoutes } from "./files.routes.js";
import type { PrivateFileStore } from "./private-file-store.js";
import { FilesRepository } from "./files.repository.js";
import { AppError } from "../../errors/app-error.js";
export {
  privateFileStore,
  type PrivateFileStore,
} from "./private-file-store.js";
export function createFileRoutes(
  identity: IdentityAccess,
  updates: ClinicUpdates,
  now: () => number,
  store?: PrivateFileStore,
) {
  return filesRoutes(
    new FilesController(new FilesService(identity, updates, now, store),updates,now),
  );
}

// The treatment module calls this inside its already-authorized clinical
// transaction. The immutable version reference survives removal/replacement.
export async function acceptanceAttachment(
  tx: import("../../database.js").ClinicTransaction,
  context: { clinicId: string; canReadFinancialFiles: boolean },
  patientId: string,
  reference: { id: string; revision: number },
) {
  const r = new FilesRepository(tx, context.clinicId);
  await r.lock();
  const head = await r.head(patientId, reference.id);
  if (head.removed || head.revision !== reference.revision)
    throw new AppError(409, "Sélectionnez un fichier actuel.");
  if (
    head.classification === "financial" ||
    (head.classification === "mixed" && !context.canReadFinancialFiles)
  )
    throw new AppError(403, "Preuve clinique ou mixte autorisée requise.");
  await r.version(patientId, reference.id, reference.revision);
  return reference;
}
export async function captureAttachments(tx:import('../../database.js').ClinicTransaction,clinicId:string,patientId:string) {
  return new FilesRepository(tx,clinicId).historical(patientId);
}
