import { procedureDurations } from '../treatment/index.js';
import type { z } from 'zod';
import type {
  bookAppointmentSchema,
  rescheduleAppointmentSchema,
  changeAppointmentStatusSchema,
  schedulingSettingsSchema,
  Appointment,
  SchedulingSettings,
} from '@clinic/contracts';
import { IdentityError, type Actor, type IdentityAccess } from '../identity/index.js';
import type { ClinicUpdates } from '../../clinic-updates.js';
import { SchedulingRepository } from './scheduling.repository.js';
export class SchedulingService {
  constructor(
    private readonly identity: IdentityAccess,
    private readonly updates: ClinicUpdates,
    private readonly now: () => number,
  ) {}
  private run<T>(
    actor: Actor | undefined,
    action: (r: SchedulingRepository, permissions: readonly string[]) => Promise<T>,
  ) {
    return this.identity.withPermission(actor, 'appointments.manage', (context, tx) =>
      action(
        new SchedulingRepository(tx, context.clinicId, context.accountId, this.now),
        context.permissions,
      ),
    );
  }
  agenda(actor: Actor | undefined, date: string, dentistId?: string) {
    return this.run(actor, async (r) => ({
      appointments: await r.agenda(date, dentistId),
    }));
  }
  choices(actor: Actor | undefined, q: string) {
    return this.run(actor, (r) => r.choices(q));
  }
  settings(actor: Actor | undefined) {
    return this.identity.withPermissionOrManager(actor, 'appointments.manage', (c, tx) =>
      new SchedulingRepository(tx, c.clinicId, c.accountId, this.now).settings(),
    );
  }
  history(actor: Actor | undefined, id: string) {
    return this.run(actor, (r) => r.history(id));
  }
  suggestions(actor: Actor | undefined) {
    return this.identity.withPermission(actor,'appointments.manage',async(c,tx)=>{const suggestions=await procedureDurations(tx,c.clinicId);return {available:suggestions.length>0,suggestions};});
  }
  authorizeStream(actor: Actor | undefined) {
    return this.identity.withPermission(actor, 'appointments.manage', async (c) => c.clinicId);
  }
  private override(conflict: boolean, override: boolean, permissions: readonly string[]) {
    if (override && !permissions.includes('appointments.override'))
      throw new IdentityError(403, 'Autorisation de dérogation requise.');
    if (conflict && !override)
      throw new IdentityError(
        409,
        'Conflit de dentiste ou de fauteuil. Choisissez un autre créneau ou confirmez une dérogation autorisée.',
      );
  }
  private async mutate<T extends Appointment | SchedulingSettings>(
    actor: Actor | undefined,
    commandId: string,
    payload: unknown,
    action: (r: SchedulingRepository, p: readonly string[]) => Promise<T>,
  ) {
    const result = await this.identity.withPermission(
      actor,
      'appointments.manage',
      async (c, tx) => {
        const r = new SchedulingRepository(tx, c.clinicId, c.accountId, this.now);
        const receipt = await r.receipt(commandId, payload);
        if (receipt.previous) return { clinicId: c.clinicId, value: receipt.previous as T };
        const value = await action(r, c.permissions);
        await r.saveReceipt(commandId, receipt.hash, value);
        return { clinicId: c.clinicId, value };
      },
    );
    this.updates.publish(result.clinicId);
    return result.value;
  }
  book(actor: Actor | undefined, data: z.infer<typeof bookAppointmentSchema>) {
    return this.mutate(actor, data.commandId, ['book', data], async (r, p) => {
      const resolved = {
        ...data,
        durationMinutes: data.durationMinutes ?? (await r.settings()).defaultDurationMinutes,
      };
      this.override(await r.validateSlot(resolved), data.override, p);
      const a = await r.book(resolved);
      await r.record(a, data.walkIn ? 'walk_in' : 'booked', data.override);
      return a;
    });
  }
  reschedule(
    actor: Actor | undefined,
    id: string,
    data: z.infer<typeof rescheduleAppointmentSchema>,
  ) {
    return this.mutate(actor, data.commandId, ['reschedule', id, data], async (r, p) => {
      const old = await r.get(id);
      if (old.revision !== data.revision)
        throw new IdentityError(
          409,
          'Ce rendez-vous a changé. Rechargez puis réconciliez votre saisie.',
        );
      if (!['booked', 'confirmed', 'arrived'].includes(old.status))
        throw new IdentityError(409, 'Ce rendez-vous ne peut pas être déplacé.');
      this.override(
        await r.validateSlot({ ...data, patientId: old.patientId }, id),
        data.override,
        p,
      );
      const a = await r.reschedule(id, data);
      await r.record(a, 'rescheduled', data.override);
      return a;
    });
  }
  status(
    actor: Actor | undefined,
    id: string,
    data: z.infer<typeof changeAppointmentStatusSchema>,
  ) {
    return this.mutate(actor, data.commandId, ['status', id, data], async (r, p) => {
      const old = await r.get(id);
      if (old.revision !== data.revision)
        throw new IdentityError(
          409,
          'Ce rendez-vous a changé. Rechargez puis réconciliez votre saisie.',
        );
      const transitions: Record<string, string[]> = {
        booked: ['confirmed', 'arrived', 'cancelled', 'no_show'],
        confirmed: ['booked', 'arrived', 'cancelled', 'no_show'],
        arrived: ['confirmed', 'cancelled'],
        cancelled: ['booked'],
        no_show: ['booked'],
      };
      if (!transitions[old.status]?.includes(data.status))
        throw new IdentityError(
          409,
          'Transition impossible. Le début et la fin des soins nécessitent une visite clinique.',
        );
      if (['booked', 'confirmed', 'arrived'].includes(data.status))
        this.override(await r.validateSlot(old, id), data.override, p);
      else this.override(false, data.override, p);
      const a = await r.status(id, data.status, data.reason);
      await r.record(a, 'status', data.override);
      return a;
    });
  }
  async changeSettings(
    actor: Actor | undefined,
    data: z.infer<typeof schedulingSettingsSchema>,
  ) {
    const result = await this.identity.withManager(actor, async (c, tx) => {
      const r = new SchedulingRepository(tx, c.clinicId, c.accountId, this.now);
      const receipt = await r.receipt(data.commandId, ['settings', data]);
      if (receipt.previous)
        return {
          clinicId: c.clinicId,
          value: receipt.previous as SchedulingSettings,
        };
      const old = await r.settings();
      if (old.revision !== data.revision)
        throw new IdentityError(
          409,
          'Les paramètres ont changé. Rechargez puis réconciliez votre saisie.',
        );
      const value = await r.changeSettings(data);
      await r.saveReceipt(data.commandId, receipt.hash, value);
      return { clinicId: c.clinicId, value };
    });
    this.updates.publish(result.clinicId);
    return result.value;
  }
}

// Clinical caller supplies its already authorized patient scope and transaction.
export async function visitAppointments(
  tx: import('../../database.js').ClinicTransaction,
  clinicId: string,
  patientId: string,
  doctorId: string,
  now: () => number,
) {
  return new SchedulingRepository(tx, clinicId, doctorId, now).visitChoices(
    patientId,
    doctorId,
  );
}
export async function transitionVisitAppointment(
  tx: import('../../database.js').ClinicTransaction,
  clinicId: string,
  patientId: string,
  doctorId: string,
  id: string,
  action: 'start' | 'end',
  now: () => number,
) {
  const r = new SchedulingRepository(tx, clinicId, doctorId, now),
    old = await r.get(id);
  if (
    old.patientId !== patientId ||
    old.dentistId !== doctorId ||
    !(
      action === 'start' ? ['booked', 'confirmed', 'arrived'] : ['in_care']
    ).includes(old.status)
  )
    throw new IdentityError(409, 'Rendez-vous indisponible pour ces soins.');
  const value = await r.status(
    id,
    action === 'start' ? 'in_care' : 'completed',
    '',
  );
  await r.record(
    value,
    action === 'start' ? 'care_started' : 'care_ended',
    false,
  );
}
