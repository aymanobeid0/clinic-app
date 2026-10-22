import { randomUUID, createHash } from "node:crypto";
import type { z } from "zod";
import type {
  AttachmentClass,
  AttachmentVersion,
  attachmentUploadSchema,
  attachmentRemoveSchema,
} from "@clinic/contracts";
import type { Actor, IdentityAccess } from "../identity/index.js";
import type { ClinicUpdates } from "../../clinic-updates.js";
import { AppError } from "../../errors/app-error.js";
import { FilesRepository } from "./files.repository.js";
import type { PrivateFileStore } from "./private-file-store.js";
import { validateContent } from "./validate-content.js";
type Upload = z.infer<typeof attachmentUploadSchema>;
const digest = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
export class FilesService {
  async authorizeHistoricalContent(actor:Actor|undefined,patientId:string,id:string,revision:number) {
    return this.identity.withHistoricalFile(actor,patientId,id,revision,async()=>{});
  }
  async historicalContent(actor:Actor|undefined,patientId:string,id:string,revision:number) {
    const snapshot=await this.identity.historicalSnapshot(actor,patientId);
    const permitted=snapshot.attachments.find(v=>v.id===id && v.revision===revision);
    if(!permitted) throw new AppError(404,'Version historique introuvable.');
    // Resolve only an immutable, authorized clinical version; no current metadata.
    const result=await this.identity.withHistoricalFile(actor,patientId,id,revision,async(c,tx)=>{
      const row=await new FilesRepository(tx,c.clinicId).version(patientId,id,revision);
      let bytes:Buffer;
      try { bytes=await this.storage().read(row.key); } catch {throw new AppError(503,'Fichier temporairement indisponible.');}
      if(bytes.length!==permitted.size || createHash('sha256').update(bytes).digest('hex')!==permitted.sha256) throw new AppError(503,'Fichier temporairement indisponible.');
      return {version:permitted,bytes};
    });
    return result;
  }
  constructor(
    readonly identity: IdentityAccess,
    readonly updates: ClinicUpdates,
    readonly now: () => number,
    readonly store?: PrivateFileStore,
  ) {}
  authorize(
    actor: Actor | undefined,
    patientId: string,
    classification: AttachmentClass,
    action: "upload" | "replace",
  ) {
    return this.identity.withAttachmentPermission(
      actor,
      patientId,
      classification,
      action,
      async () => {},
    );
  }
  private storage() {
    if (!this.store) throw new AppError(503, "Stockage privé non configuré.");
    return this.store;
  }
  private async expected(
    r: FilesRepository,
    patientId: string,
    id: string | undefined,
    data: Upload,
  ) {
    if (!id) return;
    const old = await r.head(patientId, id);
    if (old.classification !== data.classification)
      throw new AppError(404, "Fichier introuvable.");
    if (old.removed || old.revision !== data.revision)
      throw new AppError(409, "Relisez la version actuelle du fichier.");
    if (!data.reason) throw new AppError(400, "Motif de remplacement requis.");
  }
  async upload(
    actor: Actor | undefined,
    patientId: string,
    id: string | undefined,
    data: Upload,
    bytes: Buffer,
    mediaType: string,
    cancelled: () => boolean = () => false,
  ) {
    const store = this.storage();
    await validateContent(bytes, mediaType);
    const sha256 = createHash("sha256").update(bytes).digest("hex");
    const hash = digest([patientId, id ?? null, data, mediaType, sha256]);
    const action = id ? "replace" : "upload";
    const start = await this.identity.withAttachmentPermission(
      actor,
      patientId,
      data.classification,
      action,
      async (c, tx) => {
        const r = new FilesRepository(tx, c.clinicId);
        await r.lock();
        if (cancelled()) throw new AppError(409, "Téléversement annulé.");
        const receipt = await r.replay(data.commandId, c.accountId, hash);
        if (receipt) return { receipt, key: null };
        // No temporary object exists before a durable reservation. Expired objects
        // are unreachable; discard them before releasing their reserved bytes.
        for (const pending of await r.reservations()) {
          if (pending.cancelled || pending.expiresAt.getTime() <= this.now()) {
            await store.discard(pending.key);
            await r.cancel(pending.key);
          } else if (pending.commandId === data.commandId)
            throw new AppError(409, "Téléversement déjà en cours. Réessayez.");
        }
        await this.expected(r, patientId, id, data);
        const usage = await r.usage();
        if (
          usage.retainedBytes + usage.reservedBytes + bytes.length >
          usage.limitBytes
        )
          throw new AppError(
            409,
            "Quota de 2 Go atteint. Les fichiers conservés restent accessibles.",
          );
        const key = randomUUID();
        await r.reserve({
          key,
          patientId,
          commandId: data.commandId,
          actorId: c.accountId,
          payloadHash: hash,
          size: bytes.length,
          expiresAt: new Date(this.now() + 10 * 60_000),
        });
        return { receipt: null, key };
      },
    );
    if (start.receipt) return start.receipt;
    const key = start.key!;
    try {
      await store.put(key, bytes);
      const result = await this.identity.withAttachmentPermission(
        actor,
        patientId,
        data.classification,
        action,
        async (c, tx) => {
          const r = new FilesRepository(tx, c.clinicId);
          await r.lock();
          if (cancelled()) throw new AppError(409, "Téléversement annulé.");
          const reservation = await r.reservation(key);
          if (
            !reservation ||
            reservation.cancelled ||
            reservation.expiresAt.getTime() <= this.now()
          )
            throw new AppError(409, "Réservation expirée. Réessayez.");
          await this.expected(r, patientId, id, data);
          const value: AttachmentVersion = {
            id: id ?? randomUUID(),
            patientId,
            revision: id ? data.revision! + 1 : 1,
            classification: data.classification,
            name: data.name,
            mediaType,
            size: bytes.length,
            sha256,
            actorId: c.accountId,
            at: new Date(this.now()).toISOString(),
            reason: data.reason ?? "",
          };
          await r.publish(key, value);
          await r.save(data.commandId, c.accountId, hash, value);
          return { clinicId: c.clinicId, value };
        },
      );
      this.updates.publish(result.clinicId);
      return result.value;
    } catch (error) {
      // Reconcile under the same lock before discarding: an uncertain commit
      // must never remove an object whose version was actually published.
      try {
        await this.identity.withAttachmentPermission(
          actor,
          patientId,
          data.classification,
          action,
          async (c, tx) => {
            const r = new FilesRepository(tx, c.clinicId);
            await r.lock();
            if (!(await r.published(key))) {
              await store.discard(key);
              await r.release(key);
            }
          },
        );
      } catch {
        /* Durable lease is reclaimed by the next authorized upload. */
      }
      throw error;
    }
  }
  list(
    actor: Actor | undefined,
    patientId: string,
    classification: AttachmentClass,
  ) {
    return this.identity.withAttachmentPermission(
      actor,
      patientId,
      classification,
      "read",
      async (c, tx) => {
        const r = new FilesRepository(tx, c.clinicId);
        return {
          attachments: await r.list(patientId, classification),
          usage: await r.usage(),
        };
      },
    );
  }
  history(
    actor: Actor | undefined,
    patientId: string,
    id: string,
    classification: AttachmentClass,
  ) {
    return this.identity.withAttachmentPermission(
      actor,
      patientId,
      classification,
      "history",
      async (c, tx) => {
        const r = new FilesRepository(tx, c.clinicId),
          head = await r.head(patientId, id);
        if (head.classification !== classification)
          throw new AppError(404, "Fichier introuvable.");
        return r.record(patientId, id);
      },
    );
  }
  content(
    actor: Actor | undefined,
    patientId: string,
    id: string,
    revision: number,
    classification: AttachmentClass,
    output: "inline" | "download" | "print",
  ) {
    return this.identity.withAttachmentPermission(
      actor,
      patientId,
      classification,
      output === "inline" ? "read" : output,
      async (c, tx) => {
        const r = new FilesRepository(tx, c.clinicId),
          head = await r.head(patientId, id);
        if (head.classification !== classification)
          throw new AppError(404, "Fichier introuvable.");
        if ((head.removed || head.revision !== revision) && !c.canHistory)
          throw new AppError(403, "Autorisation d’historique requise.");
        const version = await r.version(patientId, id, revision);
        let bytes: Buffer;
        try {
          bytes = await this.storage().read(version.key);
        } catch {
          throw new AppError(503, "Fichier temporairement indisponible.");
        }
        if (
          bytes.length !== version.value.size ||
          createHash("sha256").update(bytes).digest("hex") !==
            version.value.sha256
        )
          throw new AppError(503, "Fichier temporairement indisponible.");
        return { version: version.value, bytes };
      },
    );
  }
  async remove(
    actor: Actor | undefined,
    patientId: string,
    id: string,
    classification: AttachmentClass,
    data: z.infer<typeof attachmentRemoveSchema>,
  ) {
    const result = await this.identity.withAttachmentPermission(
      actor,
      patientId,
      classification,
      "remove",
      async (c, tx) => {
        const r = new FilesRepository(tx, c.clinicId);
        await r.lock();
        const head = await r.head(patientId, id);
        if (head.classification !== classification)
          throw new AppError(404, "Fichier introuvable.");
        const hash = digest(["remove", patientId, id, classification, data]);
        const prior = await r.replay(data.commandId, c.accountId, hash);
        if (prior) return { clinicId: c.clinicId, value: prior };
        if (head.removed || head.revision !== data.revision)
          throw new AppError(409, "Relisez la version actuelle du fichier.");
        await r.remove(patientId, id, {
          action: "remove",
          actorId: c.accountId,
          at: new Date(this.now()).toISOString(),
          revision: head.revision,
          reason: data.reason,
        });
        const value = (await r.version(patientId, id, head.revision)).value;
        await r.save(data.commandId, c.accountId, hash, value);
        return { clinicId: c.clinicId, value };
      },
    );
    this.updates.publish(result.clinicId);
    return result.value;
  }
}
