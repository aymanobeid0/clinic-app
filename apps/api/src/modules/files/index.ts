import type { IdentityAccess } from "../identity/index.js";
import type { ClinicUpdates } from "../../clinic-updates.js";
import { FilesService } from "./files.service.js";
import { FilesController } from "./files.controller.js";
import { filesRoutes } from "./files.routes.js";
import type { PrivateFileStore } from "./private-file-store.js";
import { FilesRepository } from "./files.repository.js";
import { AppError } from "../../errors/app-error.js";
import { createHash } from 'node:crypto';
export {
  privateFileStore,
  type PrivateFileStore,
} from "./private-file-store.js";

// Caller has checked export, history and complete opaque-content scope in the
// same clinic transaction. Storage keys never leave this owning module.
export async function exportAttachments(tx:import('../../database.js').ClinicTransaction,clinicId:string,request:Extract<import('@clinic/contracts').ExportRequest,{category:'attachments'}>,store:PrivateFileStore|undefined) {
  if(!store) throw new AppError(503,'Stockage privé non configuré.');
  const repository=new FilesRepository(tx,clinicId);
  const result:{name:string;bytes:Buffer;version:import('@clinic/contracts').AttachmentVersion}[]=[];
  let size=0;
  const seen=new Set<string>();
  for(const reference of request.versions) {
    const name=`attachments/${reference.id}/${reference.revision}`;
    if(seen.has(name)) throw new AppError(400,'Version dupliquée.');
    seen.add(name);
    const head=await repository.head(request.patientId,reference.id);
    if(head.classification!==request.classification) throw new AppError(403,'Classe de fichier non autorisée.');
    const row=await repository.version(request.patientId,reference.id,reference.revision);
    if(row.value.classification!==request.classification) throw new AppError(403,'Classe de fichier non autorisée.');
    size+=row.value.size;
    if(size>25_000_000) throw new AppError(413,'Export limité à 25 Mo. Réduisez la sélection.');
    let bytes:Buffer;
    try {bytes=await store.read(row.key);} catch {throw new AppError(503,'Fichier temporairement indisponible.');}
    if(bytes.length!==row.value.size || createHash('sha256').update(bytes).digest('hex')!==row.value.sha256) throw new AppError(503,'Intégrité du fichier invalide.');
    result.push({name,bytes,version:row.value});
  }
  return result;
}
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
export async function captureAttachments(tx:import('../../database.js').ClinicTransaction,clinicId:string,patientId:string,includeMixed=false) {
  const repository=new FilesRepository(tx,clinicId);
  if(includeMixed) await repository.boundExport(patientId);
  return repository.historical(patientId,includeMixed);
}
export async function boundAttachmentsExport(tx:import('../../database.js').ClinicTransaction,clinicId:string,patientId:string) {await new FilesRepository(tx,clinicId).boundExport(patientId);}
