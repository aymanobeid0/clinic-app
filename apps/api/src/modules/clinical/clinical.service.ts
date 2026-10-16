import type { z } from 'zod';
import type {
  clinicalDraftSchema,
  clinicalConfirmSchema,
  chartDraftSchema,
  ClinicalRecord,
  ClinicalContent,
} from '@clinic/contracts';
import {
  IdentityError,
  type Actor,
  type IdentityAccess,
} from '../identity/index.js';
import type { ClinicUpdates } from '../../clinic-updates.js';
import { ClinicalRepository } from './clinical.repository.js';
function readable(
  record: ClinicalRecord<ClinicalContent>,
  permissions: readonly string[],
) {
  return {
    ...record,
    events: permissions.includes('clinical.history') ? record.events : [],
  };
}
export class ClinicalService {
  constructor(
    private readonly identity: IdentityAccess,
    private readonly updates: ClinicUpdates,
    private readonly now: () => number,
  ) {}
  authorizeDiscovery(actor: Actor | undefined) {
    return this.identity.withClinicalPatients(actor, async (c) => c.clinicId);
  }
  authorizeStream(actor: Actor | undefined, id: string) {
    return this.identity.withClinicalPermission(
      actor,
      id,
      'clinical.read',
      async (c) => c.clinicId,
    );
  }
  patients(actor: Actor | undefined) {
    return this.identity.withClinicalPatients(actor, (c, tx) =>
      new ClinicalRepository(tx, c.clinicId, '').patients(c.patientIds),
    );
  }
  get(actor: Actor | undefined, id: string) {
    return this.identity.withClinicalPermission(
      actor,
      id,
      'clinical.read',
      async (c, tx) => {
        const r = new ClinicalRepository(tx, c.clinicId, id);
        return {
          history: readable(await r.record('history'), c.permissions),
          chart: readable(await r.record('chart'), c.permissions),
        };
      },
    );
  }
  async change(
    actor: Actor | undefined,
    id: string,
    kind: 'history' | 'chart',
    action: 'draft' | 'confirm',
    data:
      | z.infer<typeof clinicalDraftSchema>
      | z.infer<typeof chartDraftSchema>
      | z.infer<typeof clinicalConfirmSchema>,
  ) {
    const result = await this.identity.withClinicalPermission(
      actor,
      id,
      kind === 'history'
        ? action === 'draft'
          ? 'history.draft'
          : 'history.finalize'
        : action === 'draft'
          ? 'chart.draft'
          : 'chart.finalize',
      async (c, tx) => {
        const r = new ClinicalRepository(tx, c.clinicId, id);
        if (!c.permissions.includes('clinical.read'))
          throw new IdentityError(403, 'Accès en lecture clinique requis.');
        await r.lock();
        const replay = await r.replay(
          data.commandId,
          [id, kind, action, data],
          c.accountId,
        );
        if (replay.receipt) {
          // Receipt identity stays stable; access to superseded content is current.
          const visible = c.permissions.includes('clinical.history')
            ? replay.receipt
            : { ...(await r.record(kind)), revision: replay.receipt.revision };
          return {
            clinicId: c.clinicId,
            record: readable(visible, c.permissions),
          };
        }
        const record = await r.record(kind);
        if (record.revision !== data.revision)
          throw new IdentityError(
            409,
            'Ce dossier a changé. Rechargez et réconciliez votre saisie conservée.',
          );
        if (action === 'confirm' && !record.draft)
          throw new IdentityError(409, 'Aucun brouillon à confirmer.');
        const observedAt =
          'observedAt' in data ? data.observedAt : record.draft!.observedAt;
        if (Date.parse(observedAt) > this.now())
          throw new IdentityError(
            400,
            'La date d’observation ne peut pas être future.',
          );
        const authorId =
          action === 'draft' ? c.accountId : record.draft!.authorId;
        const version = {
          revision: record.revision + 1,
          observedAt,
          recordedAt: new Date(this.now()).toISOString(),
          authorId,
          authorName: await r.name(authorId),
          finalizerId: action === 'confirm' ? c.accountId : null,
          finalizerName:
            action === 'confirm' ? await r.name(c.accountId) : null,
          status: action === 'draft' ? ('draft' as const) : ('final' as const),
          content: 'content' in data ? data.content : record.draft!.content,
        };
        return {
          clinicId: c.clinicId,
          record: readable(
            await r.append(
              kind,
              data.commandId,
              replay.hash,
              c.accountId,
              version,
            ),
            c.permissions,
          ),
        };
      },
    );
    this.updates.publish(result.clinicId);
    return result.record;
  }
}
