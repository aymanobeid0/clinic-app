import { accountOnboardingStage } from '../identity/index.js';
import { randomUUID, createHash } from 'node:crypto';
import type { Appointment, AppointmentStatus, SchedulingSettings } from '@clinic/contracts';
import type { ClinicTransaction } from '../../database.js';
import { IdentityError } from '../identity/index.js';
export class SchedulingRepository {
  constructor(
    private readonly tx: ClinicTransaction,
    private readonly clinicId: string,
    private readonly actorId: string,
    private readonly now: () => number,
  ) {}
  async visitChoices(patientId: string, dentistId: string) {
    return (
      await this.tx.appointment.findMany({
        where: {
          clinicId: this.clinicId,
          patientId,
          dentistId,
          status: { in: ['booked', 'confirmed', 'arrived'] },
        },
        orderBy: { startsAt: 'asc' },
        select: { id: true, startsAt: true, walkIn: true },
      })
    ).map((a) => ({ ...a, startsAt: a.startsAt.toISOString() }));
  }
  async settings(): Promise<SchedulingSettings> {
    const s = await this.tx.schedulingSettings.upsert({
      where: { clinicId: this.clinicId },
      create: { clinicId: this.clinicId },
      update: {},
    });
    return {
      revision: s.revision,
      defaultDurationMinutes: s.defaultDurationMinutes,
      chairs: s.chairs,
    };
  }
  async receipt(commandId: string, payload: unknown) {
    const hash = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    const old = await this.tx.schedulingCommand.findUnique({
      where: { clinicId_commandId: { clinicId: this.clinicId, commandId } },
    });
    if (old && (old.actorId !== this.actorId || old.payloadHash !== hash))
      throw new IdentityError(409, 'Cette demande a déjà été utilisée.');
    return { hash, previous: old?.receipt };
  }
  async saveReceipt(
    commandId: string,
    hash: string,
    receipt: Appointment | SchedulingSettings,
  ) {
    await this.tx.schedulingCommand.create({
      data: {
        clinicId: this.clinicId,
        commandId,
        actorId: this.actorId,
        payloadHash: hash,
        receipt,
      },
    });
  }
  async get(id: string): Promise<Appointment> {
    const a = await this.tx.appointment.findFirst({
      where: { clinicId: this.clinicId, id },
    });
    if (!a) throw new IdentityError(404, 'Rendez-vous introuvable.');
    const [p, d] = await Promise.all([
      this.tx.patient.findFirstOrThrow({
        where: { clinicId: this.clinicId, id: a.patientId },
      }),
      this.tx.account.findFirstOrThrow({
        where: { clinicId: this.clinicId, id: a.dentistId },
      }),
    ]);
    return {
      ...a,
      startsAt: a.startsAt.toISOString(),
      status: a.status as AppointmentStatus,
      patientName: p.name,
      patientNumber: p.patientNumber,
      dentistName: d.displayName,
    };
  }
  async agenda(date: string, dentistId?: string) {
    const from = new Date(`${date}T00:00:00Z`);
    const to = new Date(from.getTime() + 86400000);
    const rows = await this.tx.appointment.findMany({
      where: {
        clinicId: this.clinicId,
        startsAt: { gte: new Date(from.getTime() - 480 * 60000), lt: to },
        ...(dentistId ? { dentistId } : {}),
      },
      orderBy: [{ startsAt: 'asc' }, { id: 'asc' }],
    });
    return Promise.all(
      rows
        .filter((a) => a.startsAt.getTime() + a.durationMinutes * 60000 > from.getTime())
        .map((a) => this.get(a.id)),
    );
  }
  async choices(q: string) {
    return {
      patients: await this.tx.patient.findMany({
        where: {
          clinicId: this.clinicId,
          archived: false,
          ...(q
            ? {
                OR: [
                  { name: { contains: q, mode: 'insensitive' } },
                  ...(Number.isSafeInteger(Number(q)) ? [{ patientNumber: Number(q) }] : []),
                ],
              }
            : {}),
        },
        select: { id: true, name: true, patientNumber: true },
        orderBy: { patientNumber: 'desc' },
        take: 50,
      }),
      dentists: await this.tx.account
        .findMany({
          where: {
            clinicId: this.clinicId,
            kind: 'doctor',
            disabled: false,
            historicalOnly: false,
            temporaryExpiresAt: null,
          },
          orderBy: { displayName: 'asc' },
        })
        .then((rows) =>
          rows
            .filter((d) => accountOnboardingStage(d) === 'ready')
            .map((d) => ({ id: d.id, displayName: d.displayName })),
        ),
    };
  }
  async validateSlot(
    data: {
      patientId: string;
      dentistId: string;
      chairId: string | null;
      startsAt: string;
      durationMinutes: number;
    },
    exclude?: string,
  ) {
    const patient = await this.tx.patient.findFirst({
      where: { clinicId: this.clinicId, id: data.patientId, archived: false },
    });
    if (!patient) throw new IdentityError(409, 'Patient indisponible ou archivé.');
    const d = await this.tx.account.findFirst({
      where: {
        clinicId: this.clinicId,
        id: data.dentistId,
        kind: 'doctor',
        disabled: false,
        historicalOnly: false,
        temporaryExpiresAt: null,
      },
    });
    if (!d || accountOnboardingStage(d) !== 'ready')
      throw new IdentityError(409, 'Dentiste indisponible.');
    const settings = await this.settings();
    if (data.chairId !== null && !settings.chairs.includes(data.chairId))
      throw new IdentityError(400, 'Fauteuil indisponible.');
    const end = new Date(new Date(data.startsAt).getTime() + data.durationMinutes * 60000);
    const rows = await this.tx.appointment.findMany({
      where: {
        clinicId: this.clinicId,
        ...(exclude ? { id: { not: exclude } } : {}),
        status: { in: ['booked', 'confirmed', 'arrived', 'in_care'] },
        startsAt: { lt: end },
        OR: [
          { dentistId: data.dentistId },
          ...(data.chairId ? [{ chairId: data.chairId }] : []),
        ],
      },
    });
    return rows.some(
      (a) =>
        a.startsAt.getTime() + a.durationMinutes * 60000 > new Date(data.startsAt).getTime(),
    );
  }
  async record(appointment: Appointment, action: string, override: boolean) {
    await this.tx.appointmentHistory.create({
      data: {
        id: randomUUID(),
        clinicId: this.clinicId,
        appointmentId: appointment.id,
        actorId: this.actorId,
        at: new Date(this.now()),
        action,
        override,
        appointment,
      },
    });
  }
  async history(id: string) {
    await this.get(id);
    const rows = await this.tx.appointmentHistory.findMany({
      where: { clinicId: this.clinicId, appointmentId: id },
      orderBy: [{ at: 'asc' }],
    });
    rows.sort(
      (a, b) =>
        (a.appointment as Appointment).revision - (b.appointment as Appointment).revision,
    );
    return Promise.all(
      rows.map(async (e) => ({
        ...e,
        at: e.at.toISOString(),
        actorName: (
          await this.tx.account.findFirstOrThrow({
            where: { clinicId: this.clinicId, id: e.actorId },
          })
        ).displayName,
      })),
    );
  }
  async book(data: {
    patientId: string;
    dentistId: string;
    chairId: string | null;
    startsAt: string;
    durationMinutes: number;
    walkIn: boolean;
  }) {
    const id = randomUUID();
    await this.tx.appointment.create({
      data: {
        id,
        clinicId: this.clinicId,
        patientId: data.patientId,
        dentistId: data.dentistId,
        chairId: data.chairId,
        durationMinutes: data.durationMinutes,
        walkIn: data.walkIn,
        startsAt: new Date(data.startsAt),
        status: data.walkIn ? 'arrived' : 'booked',
      },
    });
    return this.get(id);
  }
  async reschedule(
    id: string,
    data: {
      dentistId: string;
      chairId: string | null;
      startsAt: string;
      durationMinutes: number;
    },
  ) {
    await this.tx.appointment.update({
      where: { id },
      data: {
        dentistId: data.dentistId,
        chairId: data.chairId,
        durationMinutes: data.durationMinutes,
        startsAt: new Date(data.startsAt),
        revision: { increment: 1 },
      },
    });
    return this.get(id);
  }
  async status(id: string, status: AppointmentStatus, reason: string) {
    await this.tx.appointment.update({
      where: { id },
      data: {
        status,
        cancellationReason: status === 'cancelled' ? reason : '',
        revision: { increment: 1 },
      },
    });
    return this.get(id);
  }
  async changeSettings(data: SchedulingSettings) {
    return this.tx.schedulingSettings.update({
      where: { clinicId: this.clinicId },
      data: {
        defaultDurationMinutes: data.defaultDurationMinutes,
        chairs: data.chairs,
        revision: { increment: 1 },
      },
      select: { revision: true, defaultDurationMinutes: true, chairs: true },
    });
  }
}
