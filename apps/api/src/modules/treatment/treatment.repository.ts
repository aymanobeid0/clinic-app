import { randomUUID, createHash } from 'node:crypto';
import type { CatalogEntry, TreatmentVersion } from '@clinic/contracts';
import type { ClinicTransaction } from '../../database.js';
import { IdentityError } from '../identity/index.js';
export class TreatmentRepository {
  constructor(
    readonly tx: ClinicTransaction,
    readonly clinicId: string,
  ) {}
  async lock() {
    await this.tx
      .$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${this.clinicId + ':treatment'},0))::text`;
  }
  async replay(commandId: string, payload: unknown, actorId: string) {
    const hash = createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
    const old = await this.tx.treatmentCommand.findUnique({
      where: { clinicId_commandId: { clinicId: this.clinicId, commandId } },
    });
    if (old && (old.actorId !== actorId || old.payloadHash !== hash))
      throw new IdentityError(409, 'Commande déjà utilisée.');
    return { hash, receipt: old?.receipt };
  }
  save(commandId: string, actorId: string, hash: string, receipt: object) {
    return this.tx.treatmentCommand.create({
      data: {
        clinicId: this.clinicId,
        commandId,
        actorId,
        payloadHash: hash,
        receipt,
      },
    });
  }
  async durations() {
    return (
      await this.tx.catalogProcedure.findMany({
        where: { clinicId: this.clinicId, active: true },
        select: { id: true, name: true, durationMinutes: true },
        orderBy: { name: 'asc' },
      })
    ).map((r) => ({
      procedureId: r.id,
      label: r.name,
      durationMinutes: r.durationMinutes,
    }));
  }
  async bind(patientId: string, planId: string) {
    const old = await this.tx.treatmentPlanIdentity.findUnique({
      where: { clinicId_planId: { clinicId: this.clinicId, planId } },
    });
    if (old && old.patientId !== patientId)
      throw new IdentityError(
        409,
        'Identifiant de proposition déjà lié à un autre patient.',
      );
    if (!old)
      await this.tx.treatmentPlanIdentity.create({
        data: { clinicId: this.clinicId, patientId, planId },
      });
  }
  async versions(patientId: string, planId?: string) {
    return (
      await this.tx.treatmentPlanRevision.findMany({
        where: {
          clinicId: this.clinicId,
          patientId,
          ...(planId ? { planId } : {}),
        },
        orderBy: { revision: 'asc' },
      })
    ).map((r) => r.snapshot as unknown as TreatmentVersion);
  }
  async append(patientId: string, version: TreatmentVersion) {
    await this.tx.treatmentPlanRevision.create({
      data: {
        id: randomUUID(),
        clinicId: this.clinicId,
        patientId,
        planId: version.id,
        revision: version.revision,
        authorId: version.authorId,
        snapshot: version,
      },
    });
  }
  async name(id: string) {
    return (
      await this.tx.account.findUniqueOrThrow({
        where: { clinicId_id: { clinicId: this.clinicId, id } },
        select: { displayName: true },
      })
    ).displayName;
  }
  async printIdentity(patientId: string) {
    const [clinic, patient] = await Promise.all([
      this.tx.clinic.findUniqueOrThrow({
        where: { id: this.clinicId },
        select: { name: true },
      }),
      this.tx.patient.findUniqueOrThrow({
        where: { clinicId_id: { clinicId: this.clinicId, id: patientId } },
        select: { name: true, patientNumber: true },
      }),
    ]);
    return {
      clinicName: clinic.name,
      patientName: patient.name,
      patientNumber: patient.patientNumber,
    };
  }
  async currencies() {
    return this.tx.clinicCurrency.findMany({
      where: { clinicId: this.clinicId },
      select: { code: true, precision: true },
      orderBy: { code: 'asc' },
    });
  }
  async catalog() {
    const [rows, currencies] = await Promise.all([
      this.tx.catalogProcedure.findMany({
        where: { clinicId: this.clinicId },
        orderBy: { name: 'asc' },
      }),
      this.tx.clinicCurrency.findMany({
        where: { clinicId: this.clinicId },
        orderBy: { code: 'asc' },
      }),
    ]);
    return {
      entries: rows.map(({ clinicId: _, ...r }) => ({
        ...r,
        currency: r.currency as CatalogEntry['currency'],
        priceMinor: r.priceMinor.toString(),
      })),
      currencies: currencies.map((c) => c.code as CatalogEntry['currency']),
    };
  }
  async currency(code: string, precision: number) {
    if (!(await this.enabled(code)))
      await this.tx.clinicCurrency.create({
        data: { clinicId: this.clinicId, code, precision },
      });
    return { code, precision };
  }
  async enabled(code: string) {
    return this.tx.clinicCurrency.findUnique({
      where: { clinicId_code: { clinicId: this.clinicId, code } },
    });
  }
  async procedure(id: string) {
    return this.tx.catalogProcedure.findUnique({
      where: { clinicId_id: { clinicId: this.clinicId, id } },
    });
  }
  async put(data: Omit<CatalogEntry, 'priceMinor'> & { priceMinor: bigint }) {
    const { id, ...content } = data;
    return this.tx.catalogProcedure.upsert({
      where: { clinicId_id: { clinicId: this.clinicId, id } },
      create: { ...content, id, clinicId: this.clinicId },
      update: content,
    });
  }
}
