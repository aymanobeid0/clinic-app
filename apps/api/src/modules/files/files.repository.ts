import type {
  AttachmentClass,
  AttachmentEvent,
  AttachmentVersion,
  AttachmentRecord,
  AttachmentUsage,
} from "@clinic/contracts";
import type { ClinicTransaction } from "../../database.js";
import { AppError } from "../../errors/app-error.js";
export class FilesRepository {
  constructor(
    readonly tx: ClinicTransaction,
    readonly clinicId: string,
  ) {}
  async lock() {
    await this.tx
      .$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${this.clinicId + ":files"},0))::text`;
  }
  async usage(): Promise<AttachmentUsage> {
    const [versions, reservations] = await Promise.all([
      this.tx.attachmentVersion.aggregate({
        where: { clinicId: this.clinicId },
        _sum: { size: true },
      }),
      this.tx.attachmentReservation.aggregate({
        where: { clinicId: this.clinicId },
        _sum: { size: true },
      }),
    ]);
    return {
      retainedBytes: versions._sum.size ?? 0,
      reservedBytes: reservations._sum.size ?? 0,
      limitBytes: 2_000_000_000,
      fileLimitBytes: 20_000_000,
    };
  }
  async head(patientId: string, id: string) {
    const row = await this.tx.attachment.findFirst({
      where: { clinicId: this.clinicId, patientId, id },
    });
    if (!row) throw new AppError(404, "Fichier introuvable.");
    return row;
  }
  async version(patientId: string, id: string, revision: number) {
    const row = await this.tx.attachmentVersion.findFirst({
      where: { clinicId: this.clinicId, patientId, attachmentId: id, revision },
    });
    if (!row) throw new AppError(404, "Version introuvable.");
    return {
      key: row.key,
      value: row.snapshot as unknown as AttachmentVersion,
    };
  }
  async record(patientId: string, id: string): Promise<AttachmentRecord> {
    const head = await this.head(patientId, id);
    return {
      ...(await this.version(patientId, id, head.revision)).value,
      removed: head.removed,
      events: head.events as unknown as AttachmentEvent[],
      versions: (await this.tx.attachmentVersion.findMany({where:{clinicId:this.clinicId,patientId,attachmentId:id},orderBy:{revision:'asc'}})).map(row=>row.snapshot as unknown as AttachmentVersion),
    };
  }
  async list(patientId: string, classification: AttachmentClass) {
    const heads = await this.tx.attachment.findMany({
      where: {
        clinicId: this.clinicId,
        patientId,
        classification,
        removed: false,
      },
      orderBy: { id: "asc" },
    });
    return Promise.all(
      heads.map((h) =>
        this.version(patientId, h.id, h.revision).then((r) => r.value),
      ),
    );
  }
  async replay(commandId: string, actorId: string, hash: string) {
    const old = await this.tx.attachmentCommand.findUnique({
      where: { clinicId_commandId: { clinicId: this.clinicId, commandId } },
    });
    if (old && (old.actorId !== actorId || old.payloadHash !== hash))
      throw new AppError(409, "Commande déjà utilisée.");
    return old?.receipt as unknown as AttachmentVersion | undefined;
  }
  save(
    commandId: string,
    actorId: string,
    hash: string,
    value: AttachmentVersion,
  ) {
    return this.tx.attachmentCommand.create({
      data: {
        clinicId: this.clinicId,
        commandId,
        actorId,
        payloadHash: hash,
        receipt: value,
      },
    });
  }
  reservations() {
    return this.tx.attachmentReservation.findMany({
      where: { clinicId: this.clinicId },
    });
  }
  reservation(key: string) {
    return this.tx.attachmentReservation.findFirst({
      where: { clinicId: this.clinicId, key },
    });
  }
  release(key: string) {
    return this.tx.attachmentReservation.deleteMany({
      where: { clinicId: this.clinicId, key },
    });
  }
  reserve(data: {
    key: string;
    patientId: string;
    commandId: string;
    actorId: string;
    payloadHash: string;
    size: number;
    expiresAt: Date;
  }) {
    return this.tx.attachmentReservation.create({
      data: { ...data, clinicId: this.clinicId },
    });
  }
  async publish(key: string, value: AttachmentVersion) {
    const event: AttachmentEvent = {
      action: value.revision === 1 ? "upload" : "replace",
      actorId: value.actorId,
      at: value.at,
      revision: value.revision,
      reason: value.reason,
    };
    if (value.revision === 1)
      await this.tx.attachment.create({
        data: {
          id: value.id,
          clinicId: this.clinicId,
          patientId: value.patientId,
          classification: value.classification,
          revision: 1,
          events: [event],
        },
      });
    else {
      const old = await this.head(value.patientId, value.id);
      await this.tx.attachment.update({
        where: { id: value.id },
        data: {
          revision: value.revision,
          events: [...(old.events as unknown as AttachmentEvent[]), event],
        },
      });
    }
    await this.tx.attachmentVersion.create({
      data: {
        key,
        clinicId: this.clinicId,
        patientId: value.patientId,
        attachmentId: value.id,
        revision: value.revision,
        size: value.size,
        snapshot: value,
      },
    });
    await this.release(key);
  }
  async remove(patientId: string, id: string, event: AttachmentEvent) {
    const old = await this.head(patientId, id);
    await this.tx.attachment.update({
      where: { id },
      data: {
        removed: true,
        events: [...(old.events as unknown as AttachmentEvent[]), event],
      },
    });
  }
}
