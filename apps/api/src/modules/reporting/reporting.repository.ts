import { createHash, randomUUID } from "node:crypto";
import type { FollowUp } from "@clinic/contracts";
import { AppError } from "../../errors/app-error.js";
import type { ClinicTransaction } from "../../database.js";
export class ReportingRepository {
  constructor(
    readonly tx: ClinicTransaction,
    readonly clinicId: string,
  ) {}
  async events(ids: string[] | null, taskId?: string) {
    const rows = await this.tx.followUpEvent.findMany({
      where: {
        clinicId: this.clinicId,
        ...(ids === null ? {} : { patientId: { in: ids } }),
        ...(taskId ? { taskId } : {}),
      },
      orderBy: { revision: "asc" },
    });
    return rows.map((r) => r.snapshot as unknown as FollowUp);
  }
  async replay(commandId: string, actorId: string, payload: unknown) {
    const hash = createHash("sha256")
      .update(JSON.stringify(payload))
      .digest("hex");
    const old = await this.tx.followUpEvent.findUnique({
      where: { clinicId_commandId: { clinicId: this.clinicId, commandId } },
    });
    if (old && (old.actorId !== actorId || old.payloadHash !== hash))
      throw new AppError(409, "Commande déjà utilisée.");
    return { hash, receipt: old?.snapshot as unknown as FollowUp | undefined };
  }
  async append(commandId: string, hash: string, value: FollowUp) {
    await this.tx.followUpEvent.create({
      data: {
        id: randomUUID(),
        clinicId: this.clinicId,
        taskId: value.id,
        patientId: value.patientId,
        revision: value.revision,
        actorId: value.actorId,
        commandId,
        payloadHash: hash,
        at: new Date(value.at),
        snapshot: value,
      },
    });
    return value;
  }
  async clinicName() {
    return (
      await this.tx.clinic.findUniqueOrThrow({
        where: { id: this.clinicId },
        select: { name: true },
      })
    ).name;
  }
  patients(ids: string[] | null) {
    return this.tx.patient.findMany({
      where: {
        clinicId: this.clinicId,
        ...(ids === null ? {} : { id: { in: ids } }),
      },
      select: { id: true, patientNumber: true, name: true },
      orderBy: { patientNumber: "asc" },
    });
  }
}
