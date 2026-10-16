import { createHash, randomUUID } from 'node:crypto';
import type {
  ClinicalRecord,
  ClinicalVersion,
  ClinicalContent,
} from '@clinic/contracts';
import type { ClinicTransaction } from '../../database.js';
import { IdentityError } from '../identity/index.js';
export class ClinicalRepository {
  constructor(
    private readonly tx: ClinicTransaction,
    private readonly clinicId: string,
    private readonly patientId: string,
  ) {}
  async patients(ids: string[]) {
    return this.tx.patient.findMany({
      where: { clinicId: this.clinicId, id: { in: ids } },
      select: { id: true, patientNumber: true, name: true },
      orderBy: { patientNumber: 'asc' },
    });
  }
  async lock() {
    await this.tx
      .$queryRaw`SELECT pg_advisory_xact_lock(hashtextextended(${this.clinicId + ':' + this.patientId + ':clinical'},0))::text`;
  }
  async record(kind: string): Promise<ClinicalRecord<ClinicalContent>> {
    const rows = await this.tx.clinicalRevision.findMany({
      where: { clinicId: this.clinicId, patientId: this.patientId, kind },
      orderBy: { revision: 'asc' },
    });
    const events = rows.map(
      (r) => r.snapshot as unknown as ClinicalVersion<ClinicalContent>,
    );
    const latest = events.at(-1);
    return {
      revision: latest?.revision ?? 0,
      current: events.findLast((e) => e.status === 'final') ?? null,
      draft: latest?.status === 'draft' ? latest : null,
      events,
    };
  }
  async replay(commandId: string, payload: unknown, actorId: string) {
    const hash = createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');
    const old = await this.tx.clinicalRevision.findUnique({
      where: { clinicId_commandId: { clinicId: this.clinicId, commandId } },
    });
    if (old && (old.actorId !== actorId || old.payloadHash !== hash))
      throw new IdentityError(409, 'Commande déjà utilisée.');
    return {
      hash,
      receipt: old?.receipt as unknown as
        ClinicalRecord<ClinicalContent> | undefined,
    };
  }
  async append(
    kind: string,
    commandId: string,
    hash: string,
    actorId: string,
    version: ClinicalVersion<ClinicalContent>,
  ) {
    const previous = await this.record(kind);
    const receipt = {
      revision: version.revision,
      current: version.status === 'final' ? version : previous.current,
      draft: version.status === 'draft' ? version : null,
      events: [...previous.events, version],
    };
    await this.tx.clinicalRevision.create({
      data: {
        id: randomUUID(),
        clinicId: this.clinicId,
        patientId: this.patientId,
        kind,
        revision: version.revision,
        commandId,
        actorId,
        payloadHash: hash,
        at: new Date(version.recordedAt),
        snapshot: version,
        receipt,
      },
    });
    return receipt;
  }
  async name(id: string) {
    return (
      await this.tx.account.findFirstOrThrow({
        where: { clinicId: this.clinicId, id },
        select: { displayName: true },
      })
    ).displayName;
  }
}
