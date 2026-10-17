import { createHash } from "node:crypto";
import { IdentityError } from "../identity/index.js";
import type { ClinicTransaction } from "../../database.js";
import type { MedicationEntry, PrescriptionTemplate } from "@clinic/contracts";
export class PrescriptionRepository {
  constructor(
    readonly tx: ClinicTransaction,
    readonly clinicId: string,
  ) {}
  async lock() {
    await this.tx
      .$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${this.clinicId + ":prescription-reference"},0))::text`;
  }
  async replay(commandId: string, payload: unknown, actorId: string) {
    const hash = createHash("sha256")
      .update(JSON.stringify(payload))
      .digest("hex");
    const old = await this.tx.prescriptionCommand.findUnique({
      where: { clinicId_commandId: { clinicId: this.clinicId, commandId } },
    });
    if (old && (old.actorId !== actorId || old.payloadHash !== hash))
      throw new IdentityError(409, "Commande déjà utilisée.");
    return { hash, receipt: old?.receipt };
  }
  save(
    commandId: string,
    actorId: string,
    payloadHash: string,
    receipt: object,
  ) {
    return this.tx.prescriptionCommand.create({
      data: {
        clinicId: this.clinicId,
        commandId,
        actorId,
        payloadHash,
        receipt,
      },
    });
  }
  async printIdentity(patientId: string) {
    const clinic = await this.tx.clinic.findUniqueOrThrow({
      where: { id: this.clinicId },
      select: { name: true },
    });
    const patient = await this.tx.patient.findUniqueOrThrow({
      where: { clinicId_id: { clinicId: this.clinicId, id: patientId } },
      select: { name: true, patientNumber: true },
    });
    return {
      clinicName: clinic.name,
      patientName: patient.name,
      patientNumber: patient.patientNumber,
    };
  }
  async medications(q: string, includeRetired = false) {
    return this.tx.medicationReference.findMany({
      where: {
        clinicId: this.clinicId,
        ...(!includeRetired ? { active: true } : {}),
        name: { contains: q, mode: "insensitive" },
      },
      orderBy: { name: "asc" },
      take: includeRetired ? undefined : 100,
      select: {
        id: true,
        revision: true,
        name: true,
        strength: true,
        form: true,
        active: true,
      },
    });
  }
  exactMedication(
    name: string,
    strength: string,
    form: string,
    exceptId: string,
  ) {
    return this.tx.medicationReference.findFirst({
      where: {
        clinicId: this.clinicId,
        id: { not: exceptId },
        active: true,
        name: { equals: name, mode: "insensitive" },
        strength: { equals: strength, mode: "insensitive" },
        form: { equals: form, mode: "insensitive" },
      },
    });
  }
  medication(id: string) {
    return this.tx.medicationReference.findUnique({
      where: { clinicId_id: { clinicId: this.clinicId, id } },
    });
  }
  putMedication(data: MedicationEntry) {
    const { id, ...values } = data;
    return this.tx.medicationReference.upsert({
      where: { clinicId_id: { clinicId: this.clinicId, id } },
      create: { id, clinicId: this.clinicId, ...values },
      update: values,
    });
  }
  async template(): Promise<PrescriptionTemplate> {
    const v = await this.tx.prescriptionTemplate.findUnique({
      where: { clinicId: this.clinicId },
    });
    return {
      revision: v?.revision ?? 0,
      header: v?.header ?? "",
      footer: v?.footer ?? "",
    };
  }
  putTemplate(data: PrescriptionTemplate) {
    return this.tx.prescriptionTemplate.upsert({
      where: { clinicId: this.clinicId },
      create: { clinicId: this.clinicId, ...data },
      update: data,
    });
  }
  async ids(patientId: string) {
    const rows = await this.tx.clinicalRevision.findMany({
      where: {
        clinicId: this.clinicId,
        patientId,
        kind: { startsWith: "prescription:" },
      },
      select: { kind: true },
      distinct: ["kind"],
    });
    return rows.map((v) => v.kind.slice(13));
  }
}
