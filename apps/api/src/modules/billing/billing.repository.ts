import { createHash } from "node:crypto";
import type {
  ProcedureStart,
  BillingAdjustment,
  OpeningBalance,
} from "@clinic/contracts";
import type { ClinicTransaction } from "../../database.js";
import { IdentityError } from "../identity/index.js";

export class BillingRepository {
  constructor(
    readonly tx: ClinicTransaction,
    readonly clinicId: string,
  ) {}
  async entries(patientId: string) {
    return this.tx.billingEntry.findMany({
      where: { clinicId: this.clinicId, patientId },
      orderBy: { id: "asc" },
    });
  }
  async charge(event: ProcedureStart) {
    await this.tx.billingEntry.create({
      data: {
        id: event.id,
        clinicId: this.clinicId,
        patientId: event.patientId,
        kind: "charge",
        sourceId: event.id,
        performedBy: event.performedBy,
        currency: event.currency,
        amountMinor: event.agreedMinor,
        snapshot: event,
      },
    });
  }
  async opening(patientId: string, value: OpeningBalance) {
    if (await this.tx.billingEntry.findUnique({ where: { id: value.id } }))
      throw new IdentityError(409, "Identifiant de solde déjà utilisé.");
    await this.tx.billingEntry.create({
      data: {
        id: value.id,
        clinicId: this.clinicId,
        patientId,
        kind: "opening",
        sourceId: value.id,
        currency: value.currency,
        amountMinor: value.amountMinor,
        snapshot: value,
      },
    });
  }
  async adjust(
    patientId: string,
    currency: string,
    performedBy: string,
    value: BillingAdjustment,
  ) {
    await this.tx.billingEntry.create({
      data: {
        id: value.id,
        clinicId: this.clinicId,
        patientId,
        kind: "adjustment",
        sourceId: value.id,
        performedBy,
        currency,
        amountMinor: value.amountMinor,
        snapshot: value,
      },
    });
  }
  async replay(commandId: string, actorId: string, payload: unknown) {
    const hash = createHash("sha256")
      .update(JSON.stringify(payload))
      .digest("hex");
    const old = await this.tx.billingCommand.findUnique({
      where: { clinicId_commandId: { clinicId: this.clinicId, commandId } },
    });
    if (old && (old.actorId !== actorId || old.payloadHash !== hash))
      throw new IdentityError(409, "Commande déjà utilisée.");
    return { hash, receipt: old?.receipt };
  }
  save(commandId: string, actorId: string, hash: string, receipt: object) {
    return this.tx.billingCommand.create({
      data: {
        clinicId: this.clinicId,
        commandId,
        actorId,
        payloadHash: hash,
        receipt,
      },
    });
  }
}
