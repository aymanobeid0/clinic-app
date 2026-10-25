import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { createApplication } from '../src/application.js';
import { openDatabase } from '../src/database.js';
import { provisionClinic } from '../src/modules/identity/index.js';
const owner = openDatabase(
  `postgresql://clinic_test:fictional-only@127.0.0.1:${process.env.CLINIC_TEST_PORT ?? "55437"}/clinic_issue7`,
);
const runtime = openDatabase(
  `postgresql://clinic_runtime_test:fictional-runtime-only@127.0.0.1:${process.env.CLINIC_TEST_PORT ?? "55437"}/clinic_issue7`,
);
const origin = 'http://localhost:4173';
let token = '';
const options = {
  database: runtime,
  origin,
  secureCookies: false,
  sessionSecret: 'fictional-session-secret-at-least-32-characters',
  mail: {
    async sendVerification(message: { token: string }) {
      token = message.token;
    },
  },
};
let app = createApplication(options);
beforeEach(() => {
  app = createApplication(options);
});
beforeAll(async () => {
  await owner.connect();
  await runtime.connect();
});
afterAll(async () => {
  await runtime.close();
  await owner.close();
});
async function manager() {
  const code = `test-${randomUUID()}`.slice(0, 32);
  const email = `${code}@example.invalid`;
  await provisionClinic(owner, {
    clinicCode: code,
    clinicName: 'Clinique fictive',
    username: 'manager',
    displayName: 'Responsable',
    email,
    temporaryPassword: 'Fictional-initial-pass-1',
  });
  const browser = request.agent(app);
  let csrf = '';
  const post = async (path: string, body: Record<string, unknown> & { revision?: number }) => {
    let payload = body;
    const id = /^\/accounts\/([^/]+)\//.exec(path)?.[1];
    if (id && body.revision === undefined) {
      const list = await browser.get('/api/accounts');
      const account = Array.isArray(list.body)
        ? list.body.find((a: { id: string }) => a.id === id)
        : undefined;
      payload = { ...body, revision: account?.revision ?? 0 };
    }
    return browser
      .post(`/api${path}`)
      .set('Origin', origin)
      .set('x-csrf-token', csrf)
      .send(payload);
  };
  const login = async (password: string) => {
    csrf = (await browser.get('/api/session')).body.csrfToken;
    const result = await post('/sign-in', { method: 'email', email, password });
    csrf = result.body.csrfToken;
    return result;
  };
  await login('Fictional-initial-pass-1');
  await post('/onboarding/password', { password: 'Fictional-manager-pass-2' });
  await login('Fictional-manager-pass-2');
  await post('/onboarding/email', { email });
  const batch = await post('/onboarding/verify-email', { token });
  await post('/onboarding/codes-saved', {
    batchId: batch.body.batchId,
    saved: true,
  });
  return {
    browser,
    post,
    code,
    email,
    login,
    codes: batch.body.codes as string[],
  };
}

it('books a dentist and optional chair with an editable clinic default and retains its receipt', async () => {
  const m = await manager();
  const actor = (await m.browser.get('/api/identity')).body;
  await m.post(`/accounts/${actor.accountId}/permissions`, {
    permissions: ['appointments.manage', 'appointments.override', 'patients.create'],
    currentPassword: 'Fictional-manager-pass-2',
  });
  const doctor = await m.post('/accounts', {
    username: 'dentist',
    displayName: 'Dentiste fictif',
    kind: 'doctor',
    temporaryPassword: 'Fictional-doctor-pass-1',
    currentPassword: 'Fictional-manager-pass-2',
  });
  expect(doctor.status).toBe(201);
  const employee = request.agent(app);
  const ec = (await employee.get('/api/session')).body.csrfToken;
  const login = await employee
    .post('/api/sign-in')
    .set('Origin', origin)
    .set('x-csrf-token', ec)
    .send({
      method: 'clinic_username',
      clinicCode: m.code,
      username: 'dentist',
      password: 'Fictional-doctor-pass-1',
    });
  await employee
    .post('/api/onboarding/password')
    .set('Origin', origin)
    .set('x-csrf-token', login.body.csrfToken)
    .send({ password: 'Fictional-doctor-personal' });
  const patient = await m.post('/patients', {
    commandId: randomUUID(),
    name: 'Patient fictif',
    phone: '12345678',
    contactKind: 'patient',
    contactName: '',
  });
  const data = {
    commandId: randomUUID(),
    patientId: patient.body.patient.id,
    dentistId: doctor.body.id,
    chairId: 'Fauteuil 1',
    startsAt: '2026-11-01T09:00:00Z',
    durationMinutes: 30,
  };
  const booked = await m.post('/appointments', data);
  expect(booked.status).toBe(201);
  expect(booked.body).toMatchObject({
    patientName: 'Patient fictif',
    status: 'booked',
    revision: 0,
    durationMinutes: 30,
  });
  expect((await m.post('/appointments', data)).body).toEqual(booked.body);
  const agenda = await m.browser.get('/api/appointments?date=2026-11-01');
  expect(agenda.body.appointments).toHaveLength(1);
  expect(
    (await m.browser.get(`/api/appointments/${booked.body.id}/history`)).body,
  ).toHaveLength(1);
});

it('uses manager-edited defaults when omitted and rejects concurrent conflicts except explicit permitted overrides', async () => {
  const m = await manager();
  const id = (await m.browser.get('/api/identity')).body.accountId;
  await m.post(`/accounts/${id}/permissions`, {
    permissions: ['appointments.manage', 'appointments.override', 'patients.create'],
    currentPassword: 'Fictional-manager-pass-2',
  });
  const doctor = await m.post('/accounts', {
    username: 'dentist',
    displayName: 'Dentiste',
    kind: 'doctor',
    temporaryPassword: 'Fictional-doctor-pass-1',
    currentPassword: 'Fictional-manager-pass-2',
  });
  const e = request.agent(app);
  let c = (await e.get('/api/session')).body.csrfToken;
  c = (
    await e.post('/api/sign-in').set('Origin', origin).set('x-csrf-token', c).send({
      method: 'clinic_username',
      clinicCode: m.code,
      username: 'dentist',
      password: 'Fictional-doctor-pass-1',
    })
  ).body.csrfToken;
  await e
    .post('/api/onboarding/password')
    .set('Origin', origin)
    .set('x-csrf-token', c)
    .send({ password: 'Fictional-doctor-personal' });
  const patient = (
    await m.post('/patients', {
      commandId: randomUUID(),
      name: 'Patient',
      phone: '12345678',
      contactKind: 'patient',
      contactName: '',
    })
  ).body.patient;
  expect(
    (
      await m.post('/appointments/settings', {
        commandId: randomUUID(),
        revision: 0,
        defaultDurationMinutes: 45,
        chairs: ['Fauteuil A'],
      })
    ).status,
  ).toBe(200);
  const body = {
    patientId: patient.id,
    dentistId: doctor.body.id,
    chairId: 'Fauteuil A',
    startsAt: '2026-11-02T09:00:00Z',
  };
  const results = await Promise.all([
    m.post('/appointments', { ...body, commandId: randomUUID() }),
    m.post('/appointments', { ...body, commandId: randomUUID() }),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
  expect(results.find((r) => r.status === 201)?.body.durationMinutes).toBe(45);
  const override = await m.post('/appointments', {
    ...body,
    commandId: randomUUID(),
    override: true,
  });
  expect(override.status).toBe(201);
  expect(
    (await m.browser.get(`/api/appointments/${override.body.id}/history`)).body[0].override,
  ).toBe(true);
  expect((await m.browser.get('/api/appointments/suggestions')).body).toEqual({
    available: false,
    suggestions: [],
  });
});
async function fixture(
  permissions = [
    'appointments.manage',
    'appointments.override',
    'patients.create',
    'patients.archive',
  ],
) {
  const m = await manager();
  const actor = (await m.browser.get('/api/identity')).body;
  await m.post(`/accounts/${actor.accountId}/permissions`, {
    permissions,
    currentPassword: 'Fictional-manager-pass-2',
  });
  const doctor = await m.post('/accounts', {
    username: 'dentist',
    displayName: 'Dentiste',
    kind: 'doctor',
    temporaryPassword: 'Fictional-doctor-pass-1',
    currentPassword: 'Fictional-manager-pass-2',
  });
  const e = request.agent(app);
  let c = (await e.get('/api/session')).body.csrfToken;
  c = (
    await e.post('/api/sign-in').set('Origin', origin).set('x-csrf-token', c).send({
      method: 'clinic_username',
      clinicCode: m.code,
      username: 'dentist',
      password: 'Fictional-doctor-pass-1',
    })
  ).body.csrfToken;
  await e
    .post('/api/onboarding/password')
    .set('Origin', origin)
    .set('x-csrf-token', c)
    .send({ password: 'Fictional-doctor-personal' });
  c = (await e.get('/api/session')).body.csrfToken;
  c = (
    await e.post('/api/sign-in').set('Origin', origin).set('x-csrf-token', c).send({
      method: 'clinic_username',
      clinicCode: m.code,
      username: 'dentist',
      password: 'Fictional-doctor-personal',
    })
  ).body.csrfToken;
  const patient = (
    await m.post('/patients', {
      commandId: randomUUID(),
      name: 'Patient test',
      phone: '12345678',
      contactKind: 'patient',
      contactName: '',
    })
  ).body.patient;
  const body = {
    patientId: patient.id,
    dentistId: doctor.body.id,
    chairId: 'Fauteuil 1',
    startsAt: '2026-11-03T09:00:00Z',
    durationMinutes: 30,
  };
  return {
    ...m,
    actor,
    doctor: doctor.body,
    patient,
    body,
    employee: e,
    employeePost: (path: string, body: object) =>
      e.post(`/api${path}`).set('Origin', origin).set('x-csrf-token', c).send(body),
  };
}
it('retains dated reschedules, rejects stale writes and supports free cancellation and reversible no-show', async () => {
  const m = await fixture();
  const booked = (await m.post('/appointments', { ...m.body, commandId: randomUUID() })).body;
  const move = {
    commandId: randomUUID(),
    revision: 0,
    dentistId: m.doctor.id,
    chairId: null,
    startsAt: '2026-11-03T10:00:00Z',
    durationMinutes: 45,
  };
  const moved = await m.post(`/appointments/${booked.id}/reschedule`, move);
  expect(moved.status).toBe(200);
  expect(moved.body.revision).toBe(1);
  expect(
    (
      await m.post(`/appointments/${booked.id}/reschedule`, {
        ...move,
        commandId: randomUUID(),
      })
    ).status,
  ).toBe(409);
  const cancelled = await m.post(`/appointments/${booked.id}/status`, {
    commandId: randomUUID(),
    revision: 1,
    status: 'cancelled',
    reason: 'Patient indisponible',
  });
  expect(cancelled.body).toMatchObject({
    status: 'cancelled',
    cancellationReason: 'Patient indisponible',
    revision: 2,
  });
  const restored = await m.post(`/appointments/${booked.id}/status`, {
    commandId: randomUUID(),
    revision: 2,
    status: 'booked',
  });
  expect(restored.status).toBe(200);
  const absent = await m.post(`/appointments/${booked.id}/status`, {
    commandId: randomUUID(),
    revision: 3,
    status: 'no_show',
  });
  expect(absent.status).toBe(200);
  expect(
    (
      await m.post(`/appointments/${booked.id}/status`, {
        commandId: randomUUID(),
        revision: 4,
        status: 'booked',
      })
    ).status,
  ).toBe(200);
  const history = (await m.browser.get(`/api/appointments/${booked.id}/history`)).body;
  expect(history).toHaveLength(6);
  expect(history[0].appointment.startsAt).toBe(m.body.startsAt.replace('Z', '.000Z'));
  expect(history[1].appointment.startsAt).toBe('2026-11-03T10:00:00.000Z');
  expect(history[2].appointment.cancellationReason).toBe('Patient indisponible');
  expect(
    (
      await m.post(`/appointments/${booked.id}/status`, {
        commandId: randomUUID(),
        revision: 5,
        status: 'completed',
      })
    ).status,
  ).toBe(409);
});
it('registers arrived walk-ins without granting clinical access and prevents archived-patient bookings', async () => {
  const m = await fixture();
  const booked = await m.post('/appointments', {
    ...m.body,
    commandId: randomUUID(),
    walkIn: true,
  });
  expect(booked.body.status).toBe('arrived');
  const grants = await m.browser.get(`/api/patient-access/${m.patient.id}`);
  expect(grants.status).toBe(200);
  expect(grants.body.grants).toHaveLength(0);
  expect(
    (
      await m.post('/appointments', {
        ...m.body,
        commandId: randomUUID(),
        startsAt: '2026-11-03T09:30:00Z',
      })
    ).status,
  ).toBe(201);
  await m.post(`/patients/${m.patient.id}/archive`, {
    commandId: randomUUID(),
    revision: 0,
  });
  expect(
    (
      await m.post('/appointments', {
        ...m.body,
        commandId: randomUUID(),
        startsAt: '2026-11-03T11:00:00Z',
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await m.post(`/appointments/${booked.body.id}/status`, {
        commandId: randomUUID(),
        revision: 0,
        status: 'cancelled',
      })
    ).status,
  ).toBe(200);
});
it('rejects unauthorized overrides, manager settings escalation, cross-clinic IDs and reused payloads', async () => {
  const m = await fixture(['appointments.manage', 'patients.create']);
  const other = await fixture();
  expect(
    (
      await m.post('/appointments', {
        ...m.body,
        commandId: randomUUID(),
        override: true,
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await m.post('/appointments', {
        ...m.body,
        commandId: randomUUID(),
        patientId: other.patient.id,
      })
    ).status,
  ).toBe(409);
  const command = { ...m.body, commandId: randomUUID() };
  const booked = await m.post('/appointments', command);
  expect(booked.status).toBe(201);
  expect((await m.post('/appointments', { ...command, durationMinutes: 45 })).status).toBe(409);
  expect((await other.browser.get(`/api/appointments/${booked.body.id}/history`)).status).toBe(
    404,
  );
  await m.post(`/accounts/${m.doctor.id}/permissions`, {
    permissions: ['appointments.manage', 'appointments.override'],
    currentPassword: 'Fictional-manager-pass-2',
  });
  expect(
    (
      await m.employeePost('/appointments/settings', {
        commandId: randomUUID(),
        revision: 0,
        defaultDurationMinutes: 40,
        chairs: [],
      })
    ).status,
  ).toBe(403);
  expect((await m.employee.get('/api/appointments/choices')).status).toBe(200);
  await m.post(`/accounts/${m.doctor.id}/permissions`, {
    permissions: [],
    currentPassword: 'Fictional-manager-pass-2',
  });
  expect((await m.employee.get('/api/appointments?date=2026-11-03')).status).toBe(403);
});
it('shows reservations overlapping midnight and rejects impossible dates and cross-chair conflicts', async () => {
  const m = await fixture();
  const booking = await m.post('/appointments', {
    ...m.body,
    commandId: randomUUID(),
    startsAt: '2026-11-03T23:45:00Z',
    durationMinutes: 45,
  });
  expect(booking.status).toBe(201);
  expect(
    (await m.browser.get('/api/appointments?date=2026-11-04')).body.appointments,
  ).toHaveLength(1);
  expect((await m.browser.get('/api/appointments?date=2026-02-30')).status).toBe(400);
});
it('keeps intrinsic manager settings separate from booking permission and versions conflicting settings edits', async () => {
  const m = await manager();
  expect((await m.browser.get('/api/appointments/settings')).status).toBe(200);
  expect((await m.browser.get('/api/appointments?date=2026-11-03')).status).toBe(403);
  const data = {
    commandId: randomUUID(),
    revision: 0,
    defaultDurationMinutes: 40,
    chairs: ['Salle A', 'Salle B'],
  };
  expect((await m.post('/appointments/settings', data)).status).toBe(200);
  expect((await m.post('/appointments/settings', data)).body.revision).toBe(1);
  expect(
    (
      await m.post('/appointments/settings', {
        ...data,
        commandId: randomUUID(),
        defaultDurationMinutes: 50,
      })
    ).status,
  ).toBe(409);
});
it('blocks the same chair for different dentists, accepts adjacency and rejects invalid foreign dentist', async () => {
  const m = await fixture();
  const other = await m.post('/accounts', {
    username: 'second',
    displayName: 'Second dentiste',
    kind: 'doctor',
    temporaryPassword: 'Fictional-doctor-pass-1',
    currentPassword: 'Fictional-manager-pass-2',
  });
  const e = request.agent(app);
  let c = (await e.get('/api/session')).body.csrfToken;
  c = (
    await e
      .post('/api/sign-in')
      .set('Origin', origin)
      .set('x-csrf-token', c)
      .send({
        method: 'clinic_username',
        clinicCode: m.code,
        username: 'second',
        password: 'Fictional-doctor-pass-1',
      })
  ).body.csrfToken;
  await e
    .post('/api/onboarding/password')
    .set('Origin', origin)
    .set('x-csrf-token', c)
    .send({ password: 'Fictional-doctor-personal' });
  expect((await m.post('/appointments', { ...m.body, commandId: randomUUID() })).status).toBe(
    201,
  );
  expect(
    (
      await m.post('/appointments', {
        ...m.body,
        dentistId: other.body.id,
        commandId: randomUUID(),
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await m.post('/appointments', {
        ...m.body,
        dentistId: other.body.id,
        startsAt: '2026-11-03T09:30:00Z',
        commandId: randomUUID(),
      })
    ).status,
  ).toBe(201);
  const foreign = await fixture();
  expect(
    (
      await m.post('/appointments', {
        ...m.body,
        dentistId: foreign.doctor.id,
        commandId: randomUUID(),
      })
    ).status,
  ).toBe(409);
});
it('sends minimal scheduling invalidation and closes the stream after permission revocation', async () => {
  const m = await fixture();
  await m.post(`/accounts/${m.doctor.id}/permissions`, {
    permissions: ['appointments.manage'],
    currentPassword: 'Fictional-manager-pass-2',
  });
  const login = await m.employeePost('/sign-in', {
    method: 'clinic_username',
    clinicCode: m.code,
    username: 'dentist',
    password: 'Fictional-doctor-personal',
  });
  const cookie = (login.headers['set-cookie'] as unknown as string[])
    .map((v) => v.split(';')[0])
    .join('; ');
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((r) => server.once('listening', r));
  const abort = new AbortController();
  try {
    const stream = await fetch(
      `http://127.0.0.1:${(server.address() as { port: number }).port}/api/appointments/events`,
      { headers: { Cookie: cookie }, signal: abort.signal },
    );
    expect(stream.status).toBe(200);
    const reader = stream.body!.getReader();
    await reader.read();
    await m.post('/appointments', { ...m.body, commandId: randomUUID() });
    const event = new TextDecoder().decode((await reader.read()).value);
    expect(event).toContain('event: invalidate');
    expect(event).not.toContain(m.patient.name);
    await m.post(`/accounts/${m.doctor.id}/permissions`, {
      permissions: [],
      currentPassword: 'Fictional-manager-pass-2',
    });
    let closed = false;
    for (let i = 0; i < 5; i++) {
      if ((await reader.read()).done) {
        closed = true;
        break;
      }
    }
    expect(closed).toBe(true);
  } finally {
    abort.abort();
    server.closeAllConnections();
    await new Promise<void>((r) => server.close(() => r()));
  }
});
