import { AppError } from '../../errors/app-error.js';
import type { Patient, PatientDetails } from '@clinic/contracts';
import type { ClinicTransaction } from '../../database.js';
import { randomUUID, createHash } from 'node:crypto';

function summary(p: Patient): Patient {
  return {
    id: p.id,
    patientNumber: p.patientNumber,
    name: p.name,
    phone: p.phone,
    contactKind: p.contactKind,
    contactName: p.contactName,
    archived: p.archived,
    revision: p.revision,
  };
}
export class PatientRepository {
  constructor(
    private readonly tx: ClinicTransaction,
    private readonly clinicId: string,
    private readonly actorId: string,
    private readonly now: () => number,
  ) {}
  async get(id: string) {
    const p = await this.tx.patient.findFirst({
      where: { id, clinicId: this.clinicId },
    });
    return p ? summary(p as Patient) : null;
  }
  async search(q: string, archived: boolean, offset: number) {
    const digits = /^[+\d ().-]+$/.test(q) ? q.replace(/\D/g, '') : '';
    const rows = await this.tx.$queryRaw<
      Patient[]
    >`SELECT * FROM "Patient" WHERE "clinicId"=${this.clinicId}::uuid AND archived=${archived} AND (
      ${q}='' OR position(lower(${q}) in lower(name))>0 OR position(lower(${q}) in lower("contactName"))>0
      OR "patientNumber"::text=${q} OR (${digits}<>'' AND position(${digits} in regexp_replace(phone,'[^0-9]','','g'))>0)
    ) ORDER BY "patientNumber" DESC LIMIT 50 OFFSET ${offset}`;
    return rows.map(summary);
  }
  async duplicates(patient: Patient) {
    const digits = patient.phone.replace(/\D/g, '');
    const rows = await this.tx.$queryRaw<
      Patient[]
    >`SELECT * FROM "Patient" WHERE "clinicId"=${this.clinicId}::uuid AND id<>${patient.id}::uuid AND (lower(name)=lower(${patient.name}) OR regexp_replace(phone,'[^0-9]','','g')=${digits}) ORDER BY "patientNumber" LIMIT 20`;
    return rows.map(summary);
  }
  async register(commandId: string, details: PatientDetails) {
    const registrationHash = createHash('sha256')
      .update(
        JSON.stringify([details.name, details.phone, details.contactKind, details.contactName]),
      )
      .digest('hex');
    const previous = await this.tx.patient.findUnique({
      where: { clinicId_commandId: { clinicId: this.clinicId, commandId } },
    });
    if (previous) {
      if (previous.registrationHash !== registrationHash)
        throw new AppError(409, 'Cette demande a déjà été utilisée.');
      const receipt = await this.tx.patientHistory.findUniqueOrThrow({
        where: { clinicId_commandId: { clinicId: this.clinicId, commandId } },
      });
      if (receipt.actorId !== this.actorId)
        throw new AppError(409, 'Cette demande a déjà été utilisée.');
      return receipt.patient as Patient;
    }
    const clinic = await this.tx.clinic.update({
      where: { id: this.clinicId },
      data: { nextPatientNumber: { increment: 1 } },
    });
    const p = await this.tx.patient.create({
      data: {
        id: randomUUID(),
        clinicId: this.clinicId,
        patientNumber: clinic.nextPatientNumber,
        ...details,
        commandId,
        registrationHash,
      },
    });
    const patient = summary(p as Patient);
    await this.record(patient, commandId, registrationHash, 'registered');
    return patient;
  }
  private record(patient: Patient, commandId: string, payloadHash: string, action: string) {
    return this.tx.patientHistory.create({
      data: {
        id: randomUUID(),
        clinicId: this.clinicId,
        patientId: patient.id,
        actorId: this.actorId,
        commandId,
        payloadHash,
        action,
        at: new Date(this.now()),
        patient,
      },
    });
  }
  async history(id: string) {
    return (
      await this.tx.patientHistory.findMany({
        where: { clinicId: this.clinicId, patientId: id },
      })
    )
      .sort((a, b) => (a.patient as Patient).revision - (b.patient as Patient).revision)
      .map((e) => ({
        action: e.action,
        at: e.at.toISOString(),
        actorId: e.actorId,
        patient: e.patient,
      }));
  }
  async change(
    id: string,
    commandId: string,
    revision: number,
    action: 'contact' | 'archived' | 'reactivated',
    details?: PatientDetails,
  ) {
    const patient = await this.get(id);
    if (!patient) throw new AppError(404, 'Patient introuvable.');
    const payloadHash = createHash('sha256')
      .update(
        JSON.stringify([
          id,
          revision,
          action,
          details?.name,
          details?.phone,
          details?.contactKind,
          details?.contactName,
        ]),
      )
      .digest('hex');
    const previous = await this.tx.patientHistory.findUnique({
      where: { clinicId_commandId: { clinicId: this.clinicId, commandId } },
    });
    if (previous) {
      if (previous.payloadHash !== payloadHash || previous.actorId !== this.actorId)
        throw new AppError(409, 'Cette demande a déjà été utilisée.');
      return previous.patient as Patient;
    }
    if (patient.revision !== revision)
      throw new AppError(409, 'Ce dossier a changé. Rechargez et réconciliez votre saisie.');
    if (action === 'contact' && patient.archived)
      throw new AppError(409, 'Réactivez ce patient avant modification.');
    if (
      (action === 'archived' && patient.archived) ||
      (action === 'reactivated' && !patient.archived)
    )
      throw new AppError(409, 'État du dossier déjà modifié.');
    const updated = summary(
      (await this.tx.patient.update({
        where: { id },
        data:
          action === 'contact'
            ? {
                name: details!.name,
                phone: details!.phone,
                contactKind: details!.contactKind,
                contactName: details!.contactName,
                revision: { increment: 1 },
              }
            : { archived: action === 'archived', revision: { increment: 1 } },
      })) as Patient,
    );
    await this.record(updated, commandId, payloadHash, action);
    return updated;
  }
}
