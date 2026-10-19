import { AppError } from '../../errors/app-error.js';
import { recordProcedureStart } from './procedure-start.js';
import {
  visitAppointments,
  transitionVisitAppointment,
} from '../scheduling/index.js';
import { randomUUID } from 'node:crypto';
import type { z } from 'zod';
import type {
  startVisitSchema,
  visitActionSchema,
  Visit,
  ProcedureStart,
  ProcedureCompletion,
} from '@clinic/contracts';
import type { Actor, IdentityAccess } from '../identity/index.js';
import type { ClinicUpdates } from '../../clinic-updates.js';
import { TreatmentRepository } from './treatment.repository.js';
import { VisitRepository } from './visit.repository.js';
export class VisitService {
  constructor(
    readonly identity: IdentityAccess,
    readonly updates: ClinicUpdates,
    readonly now: () => number,
  ) {}
  state(actor: Actor | undefined, patientId: string) {
    return this.identity.withClinicalPermission(
      actor,
      patientId,
      'clinical.read',
      async (c, tx) => ({
        ...(await new VisitRepository(tx, c.clinicId).state(patientId)),
        appointments: await visitAppointments(
          tx,
          c.clinicId,
          patientId,
          c.accountId,
          this.now,
        ),
      }),
    );
  }
  async action(
    actor: Actor | undefined,
    patientId: string,
    data: z.infer<typeof visitActionSchema>,
  ) {
    const result = await this.identity.withClinicalPermission(
      actor,
      patientId,
      data.action === 'complete' ? 'procedures.complete' : 'procedures.start',
      async (c, tx) => {
        if (!c.permissions.includes('clinical.read'))
          throw new AppError(403, 'Accès en lecture clinique requis.');
        const plans = new TreatmentRepository(tx, c.clinicId),
          r = new VisitRepository(tx, c.clinicId);
        await plans.lock();
        const replay = await plans.replay(
          data.commandId,
          ['visit-action', patientId, data],
          c.accountId,
        );
        if (replay.receipt) {
          const saved = await r.existing(data.id);
          return {
            clinicId: c.clinicId,
            value: saved!.snapshot as unknown as Visit,
          };
        }
        const state = await r.state(patientId),
          old = state.visits.find((v) => v.id === data.id);
        if (!old) throw new AppError(404, 'Visite introuvable.');
        if (old.doctorId !== c.accountId)
          throw new AppError(
            403,
            'Seul le dentiste de cette visite peut la modifier.',
          );
        if (old.status !== 'draft' || old.revision !== data.revision)
          throw new AppError(
            409,
            'La visite a changé. Rechargez et relisez les soins.',
          );
        const at = new Date(this.now()).toISOString(),
          name = await plans.name(c.accountId);
        const visit: Visit = { ...old, revision: old.revision + 1 };
        if (data.action === 'end') {
          visit.status = 'ended';
          visit.endedAt = at;
          if (visit.appointmentId)
            await transitionVisitAppointment(
              tx,
              c.clinicId,
              patientId,
              c.accountId,
              visit.appointmentId,
              'end',
              this.now,
            );
        } else {
          if (
            !old.procedures.some(
              (v) => v.planId === data.planId && v.itemId === data.itemId,
            ) ||
            !state.starts.some(
              (v) => v.planId === data.planId && v.itemId === data.itemId,
            )
          )
            throw new AppError(
              409,
              'Sélectionnez un acte commencé dans cette visite.',
            );
          if (
            state.completions.some(
              (v) => v.planId === data.planId && v.itemId === data.itemId,
            )
          )
            throw new AppError(409, 'Cet acte est déjà terminé.');
          const event: ProcedureCompletion = {
            id: randomUUID(),
            patientId,
            planId: data.planId,
            itemId: data.itemId,
            visitId: visit.id,
            completedBy: c.accountId,
            completedByName: name,
            at,
          };
          await r.complete(event);
          const plan = (await plans.versions(patientId, data.planId)).at(-1)!;
          if (
            plan.acceptance && ['accepted','in_progress'].includes(plan.status) && plan.items.every(
              (i) =>
                i.id === data.itemId ||
                state.completions.some(
                  (v) => v.planId === plan.id && v.itemId === i.id,
                ),
            )
          )
            await plans.append(patientId, {
              ...plan,
              status: 'completed',
              revision: plan.revision + 1,
              authorId: c.accountId,
              authorName: name,
              recordedAt: at,
            });
        }
        await r.update(visit);
        await plans.save(data.commandId, c.accountId, replay.hash, visit);
        return { clinicId: c.clinicId, value: visit };
      },
    );
    this.updates.publish(result.clinicId);
    if(data.action==='complete')this.updates.publish(result.clinicId,'suggestions:'+patientId);
    return result.value;
  }
  async start(
    actor: Actor | undefined,
    patientId: string,
    data: z.infer<typeof startVisitSchema>,
  ) {
    const result = await this.identity.withClinicalPermission(
      actor,
      patientId,
      'procedures.start',
      async (c, tx) => {
        if (!c.permissions.includes('clinical.read'))
          throw new AppError(403, 'Accès en lecture clinique requis.');
        const plans = new TreatmentRepository(tx, c.clinicId),
          r = new VisitRepository(tx, c.clinicId);
        await plans.lock();
        const replay = await plans.replay(
          data.commandId,
          ['visit', patientId, data],
          c.accountId,
        );
        if (replay.receipt) {
          const saved = await r.existing(data.id);
          return {
            clinicId: c.clinicId,
            value: saved!.snapshot as unknown as Visit,
          };
        }
        if (!(await r.available(patientId)))
          throw new AppError(409, 'Patient indisponible ou archivé.');
        if (await r.existing(data.id))
          throw new AppError(409, 'Identifiant de visite déjà utilisé.');
        const at = new Date(this.now()).toISOString(),
          name = await plans.name(c.accountId);
        const visit: Visit = {
          id: data.id,
          patientId,
          doctorId: c.accountId,
          doctorName: name,
          appointmentId: data.appointmentId,
          revision: 1,
          status: 'draft',
          startedAt: at,
          procedures: [],
        };
        if (data.appointmentId)
          await transitionVisitAppointment(
            tx,
            c.clinicId,
            patientId,
            c.accountId,
            data.appointmentId,
            'start',
            this.now,
          );
        const state = await r.state(patientId);
        if (
          state.visits.some(
            (v) => v.doctorId === c.accountId && v.status === 'draft',
          )
        )
          throw new AppError(
            409,
            'Une visite est déjà en cours pour ce patient.',
          );
        const events: ProcedureStart[] = [];
        const changed = new Map<
          string,
          Awaited<ReturnType<typeof plans.versions>>
        >();
        const seen = new Set<string>();
        for (const selection of data.procedures) {
          const key = selection.planId + ':' + selection.itemId;
          if (seen.has(key))
            throw new AppError(400, 'Acte sélectionné en double.');
          seen.add(key);
          const versions = await plans.versions(patientId, selection.planId),
            plan = versions.at(-1);
          if (
            !plan ||
            !plan.acceptance ||
            !['accepted', 'in_progress'].includes(plan.status) ||
            plan.revision !== selection.planRevision
          )
            throw new AppError(
              409,
              'Relisez la version acceptée du plan.',
            );
          if (
            state.completions.some(
              (v) => v.planId === plan.id && v.itemId === selection.itemId,
            )
          )
            throw new AppError(409, 'Cet acte est déjà terminé.');
          const item = plan.items.find((i) => i.id === selection.itemId);
          if (!item) throw new AppError(409, 'Acte introuvable.');
          visit.procedures.push({
            planId: plan.id,
            itemId: item.id,
            name: item.name,
          });
          if (
            !state.starts.some(
              (s) => s.planId === plan.id && s.itemId === item.id,
            )
          ) {
            events.push({
              id: randomUUID(),
              patientId,
              planId: plan.id,
              itemId: item.id,
              visitId: visit.id,
              acceptedRevision: versions.find(
                (v) =>
                  v.acceptance?.proposalRevision === plan.acceptance!.proposalRevision &&
                  v.acceptance?.confirmedAt === plan.acceptance!.confirmedAt,
              )!.revision,
              acceptance: plan.acceptance,
              item,
              currency: plan.currency,
              agreedMinor: (
                BigInt(item.priceMinor) -
                BigInt(item.discountMinor) +
                (item.extras ?? []).reduce(
                  (n, e) => n + BigInt(e.amountMinor),
                  0n,
                )
              ).toString(),
              performedBy: c.accountId,
              performedByName: name,
              at,
            });
            if (plan.status === 'accepted') changed.set(plan.id, versions);
          }
        }
        await r.create(visit);
        // This immutable fact and the participating billing operation must share tx (#20).
        for (const event of events)
          await recordProcedureStart(tx, c.clinicId, event);
        for (const versions of changed.values()) {
          const plan = versions.at(-1)!;
          await plans.append(patientId, {
            ...plan,
            status: 'in_progress',
            revision: plan.revision + 1,
            authorId: c.accountId,
            authorName: name,
            recordedAt: at,
          });
        }
        await plans.save(data.commandId, c.accountId, replay.hash, visit);
        return { clinicId: c.clinicId, value: visit };
      },
    );
    this.updates.publish(result.clinicId);
    return result.value;
  }
}
