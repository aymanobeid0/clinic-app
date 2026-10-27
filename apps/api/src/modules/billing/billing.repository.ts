import { AppError } from "../../errors/app-error.js";
import { createHash } from "node:crypto";
import type {
  ProcedureStart,
  BillingAdjustment,
  OpeningBalance,
  PaymentMethod,
  Settlement,
  Invoice,
  FinancialCorrection,
} from "@clinic/contracts";
import type { ClinicTransaction } from "../../database.js";

export class BillingRepository {
  async consultationCharge(
    event: import("@clinic/contracts").ConsultationCharge,
  ) {
    await this.tx.billingEntry.create({
      data: {
        id: event.id,
        clinicId: this.clinicId,
        patientId: event.patientId,
        kind: "charge",
        sourceId: event.consultationId,
        performedBy: event.performedBy,
        currency: event.currency,
        amountMinor: event.agreedMinor,
        snapshot: event,
      },
    });
  }
  constructor(
    readonly tx: ClinicTransaction,
    readonly clinicId: string,
  ) {}
  async correction(value: FinancialCorrection) {
    await this.tx.billingEntry.create({
      data: {
        id: value.id,
        clinicId: this.clinicId,
        patientId: value.patientId,
        kind: "correction",
        sourceId: value.id,
        currency: value.currency,
        amountMinor: "0",
        snapshot: value,
      },
    });
  }
  async invoices(patientId?: string): Promise<Invoice[]> {
    const rows = await this.tx.billingInvoice.findMany({
      where: { clinicId: this.clinicId, ...(patientId ? { patientId } : {}) },
      orderBy: { number: "asc" },
    });
    return rows.map((r) => r.snapshot as unknown as Invoice);
  }
  async invoice(value: Invoice) {
    await this.tx.billingInvoice.create({
      data: {
        id: value.id,
        clinicId: this.clinicId,
        patientId: value.patientId,
        number: value.number,
        snapshot: value,
      },
    });
    await this.tx.billingInvoiceCharge.createMany({
      data: value.items.map((i) => ({
        clinicId: this.clinicId,
        chargeId: i.chargeId,
        invoiceId: value.id,
      })),
    });
  }
  async nextInvoice(year: number) {
    const prefix = `INV-${year}-`;
    const values = await this.invoices();
    const next =
      values
        .filter((v) => v.number.startsWith(prefix))
        .reduce(
          (n, v) => Math.max(n, Number(v.number.slice(prefix.length))),
          0,
        ) + 1;
    return prefix + String(next).padStart(6, "0");
  }
  async documentIdentity(patientId: string) {
    const patient = await this.tx.patient.findFirstOrThrow({
      where: { clinicId: this.clinicId, id: patientId },
      select: { name: true, patientNumber: true },
    });
    const clinic = await this.tx.clinic.findUniqueOrThrow({
      where: { id: this.clinicId },
      select: { name: true },
    });
    return {
      patientName: patient.name,
      patientNumber: patient.patientNumber,
      clinicName: clinic.name,
    };
  }
  async methods(): Promise<PaymentMethod[]> {
    const rows = await this.tx.billingMethod.findMany({
      where: { clinicId: this.clinicId },
      orderBy: { revision: "asc" },
    });
    return [
      ...new Map(
        rows.map((r) => [r.id, r.snapshot as unknown as PaymentMethod]),
      ).values(),
    ];
  }
  method(value: PaymentMethod) {
    return this.tx.billingMethod.create({
      data: {
        clinicId: this.clinicId,
        id: value.id,
        revision: value.revision,
        snapshot: value,
      },
    });
  }
  async nextReceipt(year: number) {
    const rows = await this.tx.billingEntry.findMany({
      where: { clinicId: this.clinicId, kind: "settlement" },
      select: { snapshot: true },
    });
    const prefix = `REC-${year}-`;
    const numbers = rows
      .map((r) => (r.snapshot as unknown as Settlement).receiptNumber)
      .filter((n): n is string => !!n?.startsWith(prefix));
    const next =
      numbers.reduce(
        (n, value) => Math.max(n, Number(value.slice(prefix.length))),
        0,
      ) + 1;
    return prefix + String(next).padStart(6, "0");
  }
  settlement(value: Settlement) {
    return this.tx.billingEntry.create({
      data: {
        id: value.id,
        clinicId: this.clinicId,
        patientId: value.patientId,
        kind: "settlement",
        sourceId: value.id,
        currency: value.currency,
        amountMinor: value.newMoneyMinor,
        snapshot: value,
      },
    });
  }
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
      throw new AppError(409, "Identifiant de solde déjà utilisé.");
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
      throw new AppError(409, "Commande déjà utilisée.");
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
