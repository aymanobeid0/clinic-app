import { AppError } from '../../errors/app-error.js';
import type { z } from 'zod';
import type {
  VisitNote,
  ClinicalRecord,
  VisitNoteContent,
  noteDraftSchema,
  clinicalConfirmSchema,
} from '@clinic/contracts';
import type { Actor, IdentityAccess } from '../identity/index.js';
import type { ClinicUpdates } from '../../clinic-updates.js';
import { noteVisit, noteVisits } from '../treatment/index.js';
import { ClinicalRepository } from './clinical.repository.js';
export class NoteService {
  constructor(
    private readonly identity: IdentityAccess,
    private readonly updates: ClinicUpdates,
    private readonly now: () => number,
  ) {}
  list(actor: Actor | undefined, patientId: string) {
    return this.identity.withClinicalPermission(
      actor,
      patientId,
      'clinical.read',
      async (c, tx) => {
        const visits = await noteVisits(tx, c.clinicId, patientId),
          r = new ClinicalRepository(tx, c.clinicId, patientId);
        return Promise.all(
          visits.map(async (v) =>
            this.visible(
              await r.record<VisitNoteContent>(`note:${v.id}`),
              v.id,
              v.status,
              c.permissions,
            ),
          ),
        );
      },
    );
  }
  get(actor: Actor | undefined, patientId: string, visitId: string) {
    return this.identity.withClinicalPermission(
      actor,
      patientId,
      'clinical.read',
      async (c, tx) => {
        const visit = await noteVisit(tx, c.clinicId, patientId, visitId);
        if (!visit) throw new AppError(404, 'Visite introuvable.');
        const record = await new ClinicalRepository(
          tx,
          c.clinicId,
          patientId,
        ).record<VisitNoteContent>(`note:${visit.id}`);
        return this.visible(record, visitId, visit.status, c.permissions);
      },
    );
  }
  private visible(
    record: ClinicalRecord<VisitNoteContent>,
    visitId: string,
    status: string,
    permissions: readonly string[],
  ): VisitNote {
    return {
      ...record,
      events: permissions.includes('clinical.history') ? record.events : [],
      visitId,
      pending: status === 'ended' && (!record.current || !!record.draft),
    };
  }
  async change(
    actor: Actor | undefined,
    patientId: string,
    visitId: string,
    action: 'draft' | 'finalize',
    data:
      z.infer<typeof noteDraftSchema> | z.infer<typeof clinicalConfirmSchema>,
  ) {
    const result = await this.identity.withClinicalPermission(
      actor,
      patientId,
      action === 'draft' ? 'notes.draft' : 'notes.finalize',
      async (c, tx) => {
        if (!c.permissions.includes('clinical.read'))
          throw new AppError(403, 'Accès en lecture clinique requis.');
        const visit = await noteVisit(tx, c.clinicId, patientId, visitId);
        if (!visit) throw new AppError(404, 'Visite introuvable.');
        const r = new ClinicalRepository(tx, c.clinicId, patientId),
          kind = `note:${visit.id}`;
        await r.lock(kind);
        const replay = await r.replay<VisitNoteContent>(
          data.commandId,
          [patientId, visit.id, action, data],
          c.accountId,
        );
        const record = await r.record<VisitNoteContent>(kind);
        if (replay.receipt) {
          // A retry acknowledges its revision but exposes only currently permitted content.
          const value = c.permissions.includes('clinical.history')
            ? replay.receipt
            : { ...record, revision: replay.receipt.revision };
          return {
            clinicId: c.clinicId,
            value: this.visible(value, visitId, visit.status, c.permissions),
          };
        }
        if (record.revision !== data.revision)
          throw new AppError(
            409,
            'Cette note a changé. Comparez la version du serveur avec votre saisie conservée.',
          );
        if (
          action === 'finalize' &&
          (!record.draft || !record.draft.content.text.trim())
        )
          throw new AppError(409, 'Un brouillon non vide est requis.');
        const at = new Date(this.now()).toISOString(),
          authorId = action === 'draft' ? c.accountId : record.draft!.authorId;
        const saved = await r.append(
          kind,
          data.commandId,
          replay.hash,
          c.accountId,
          {
            revision: record.revision + 1,
            observedAt: action === 'draft' ? at : record.draft!.observedAt,
            recordedAt: at,
            authorId,
            authorName: await r.name(authorId),
            finalizerId: action === 'finalize' ? c.accountId : null,
            finalizerName:
              action === 'finalize' ? await r.name(c.accountId) : null,
            status: action === 'draft' ? 'draft' : 'final',
            content:
              'text' in data ? { text: data.text } : record.draft!.content,
          },
        );
        return {
          clinicId: c.clinicId,
          value: this.visible(saved, visitId, visit.status, c.permissions),
        };
      },
    );
    this.updates.publish(result.clinicId, `notes:${patientId}`);
    return result.value;
  }
}
