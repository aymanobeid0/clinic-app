import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { createApplication } from '../src/application.js';
import { openDatabase } from '../src/database.js';
import { provisionClinic } from '../src/modules/identity/index.js';
const owner = openDatabase(`postgresql://clinic_test:fictional-only@127.0.0.1:${process.env.CLINIC_TEST_PORT ?? "55437"}/clinic_issue7`);
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

it('registers a child with guardian contact, retrieves it and assigns a stable clinic ID', async () => {
  const m = await manager();
  const accountId = (await m.browser.get('/api/identity')).body.accountId;
  await m.post(`/accounts/${accountId}/permissions`, {
    permissions: ['patients.read', 'patients.create', 'patients.edit', 'patients.archive'],
    currentPassword: 'Fictional-manager-pass-2',
  });
  const data = {
    commandId: randomUUID(),
    name: 'Enfant Fictif',
    phone: '+223 70 00 00 00',
    contactKind: 'guardian',
    contactName: 'Parent Fictif',
  };
  const created = await m.post('/patients', data);
  expect(created.status).toBe(201);
  expect(created.body.patient).toMatchObject({
    name: data.name,
    phone: data.phone,
    contactKind: 'guardian',
    contactName: data.contactName,
    patientNumber: 1,
    archived: false,
    revision: 0,
  });
  const found = await m.browser.get(`/api/patients/${created.body.patient.id}`);
  expect(found.status).toBe(200);
  expect(found.body).toEqual(created.body.patient);
});
async function permittedManager() {
  const m = await manager();
  const accountId = (await m.browser.get('/api/identity')).body.accountId;
  await m.post(`/accounts/${accountId}/permissions`, {
    permissions: ['patients.read', 'patients.create', 'patients.edit', 'patients.archive'],
    currentPassword: 'Fictional-manager-pass-2',
  });
  return m;
}
const details = {
  name: 'Famille Fictive',
  phone: '+223 70 00 00 00',
  contactKind: 'patient',
  contactName: '',
};
it('lost-response retries and concurrent registration reuse one patient only for the same command', async () => {
  const m = await permittedManager();
  const commandId = randomUUID();
  const results = await Promise.all([
    m.post('/patients', { ...details, commandId }),
    m.post('/patients', { ...details, commandId }),
  ]);
  expect(results.map((r) => r.status)).toEqual([201, 201]);
  expect(results[0]!.body.patient.id).toBe(results[1]!.body.patient.id);
  expect((await m.post('/patients', { ...details, commandId, name: 'Different' })).status).toBe(
    409,
  );
  const second = await m.post('/patients', {
    ...details,
    commandId: randomUUID(),
  });
  expect(second.body.patient.patientNumber).toBe(2);
});
it('shared guardian phones warn without rejecting distinct patients and authorized searches find name, contact and number', async () => {
  const m = await permittedManager();
  const first = (await m.post('/patients', { ...details, commandId: randomUUID() })).body.patient;
  const second = await m.post('/patients', {
    ...details,
    name: 'Enfant Fictif',
    phone: '+22370000000',
    contactKind: 'guardian',
    contactName: 'Parent Fictif',
    commandId: randomUUID(),
  });
  expect(second.status).toBe(201);
  expect(second.body.patient.patientNumber).toBe(2);
  expect(second.body.duplicates).toEqual([first]);
  for (const q of ['223 70', 'enfant', 'Parent', '2']) {
    const result = await m.browser.get('/api/patients').query({ q });
    expect(result.status).toBe(200);
    expect(result.body.patients.map((p: { id: string }) => p.id)).toContain(second.body.patient.id);
  }
});
it('contact edits reject stale versions, archive/reactivate retains identity and dated history with safe retries', async () => {
  const m = await permittedManager();
  const p = (await m.post('/patients', { ...details, commandId: randomUUID() })).body.patient;
  const edit = {
    ...details,
    name: 'Nom corrigé',
    revision: 0,
    commandId: randomUUID(),
  };
  const changed = await m.post(`/patients/${p.id}/contact`, edit);
  expect(changed.status).toBe(200);
  expect(changed.body).toMatchObject({
    name: 'Nom corrigé',
    revision: 1,
    patientNumber: 1,
  });
  expect(
    (
      await m.post(`/patients/${p.id}/contact`, {
        ...edit,
        name: 'Stale',
        commandId: randomUUID(),
      })
    ).status,
  ).toBe(409);
  const archive = { revision: 1, commandId: randomUUID() };
  expect((await m.post(`/patients/${p.id}/archive`, archive)).body).toMatchObject({
    archived: true,
    revision: 2,
  });
  expect((await m.post(`/patients/${p.id}/archive`, archive)).status).toBe(200);
  expect((await m.browser.get('/api/patients')).body.patients).toEqual([]);
  expect((await m.browser.get('/api/patients').query({ archived: true })).body.patients[0].id).toBe(
    p.id,
  );
  expect(
    (
      await m.post(`/patients/${p.id}/reactivate`, {
        revision: 2,
        commandId: randomUUID(),
      })
    ).body,
  ).toMatchObject({ id: p.id, patientNumber: 1, archived: false, revision: 3 });
  const history = await m.browser.get(`/api/patients/${p.id}/history`);
  expect(history.status).toBe(200);
  expect(history.body.map((e: { action: string }) => e.action)).toEqual([
    'registered',
    'contact',
    'archived',
    'reactivated',
  ]);
  expect(history.body[0].patient.name).toBe(details.name);
  expect(history.body[1].patient.name).toBe('Nom corrigé');
  expect(
    history.body.every((e: { at: string; actorId: string }) => Boolean(e.at && e.actorId)),
  ).toBe(true);
  const csrf = (await m.browser.get('/api/session')).body.csrfToken;
  expect(
    (
      await m.browser
        .delete(`/api/patients/${p.id}`)
        .set('Origin', origin)
        .set('x-csrf-token', csrf)
    ).status,
  ).toBe(404);
});
async function grant(m: Awaited<ReturnType<typeof manager>>, id: string, permissions: string[]) {
  return m.post(`/accounts/${id}/permissions`, {
    permissions,
    currentPassword: 'Fictional-manager-pass-2',
  });
}
async function employee(
  m: Awaited<ReturnType<typeof manager>>,
  kind: 'staff' | 'doctor' = 'staff',
) {
  const username = `user-${randomUUID()}`;
  const account = (
    await m.post('/accounts', {
      username,
      displayName: 'Utilisateur fictif',
      kind,
      temporaryPassword: 'Fictional-user-temp-1',
      currentPassword: 'Fictional-manager-pass-2',
    })
  ).body;
  const browser = request.agent(app);
  let csrf = (await browser.get('/api/session')).body.csrfToken;
  const post = (path: string, body: object) =>
    browser.post(`/api${path}`).set('Origin', origin).set('x-csrf-token', csrf).send(body);
  const login = async (password: string) => {
    csrf = (await browser.get('/api/session')).body.csrfToken;
    const r = await post('/sign-in', {
      method: 'clinic_username',
      clinicCode: m.code,
      username,
      password,
    });
    csrf = r.body.csrfToken;
    return r;
  };
  await login('Fictional-user-temp-1');
  return {
    account,
    browser,
    post,
    login,
    async ready() {
      await post('/onboarding/password', {
        password: 'Fictional-user-personal',
      });
      await login('Fictional-user-personal');
    },
  };
}
it('patient capabilities are explicit for managers and staff, checked on the next request and restricted by session readiness/status', async () => {
  const m = await manager();
  expect((await m.browser.get('/api/patients')).status).toBe(403);
  expect((await m.post('/patients', { ...details, commandId: randomUUID() })).status).toBe(403);
  const accountId = (await m.browser.get('/api/identity')).body.accountId;
  await grant(m, accountId, [
    'patients.read',
    'patients.create',
    'patients.edit',
    'patients.archive',
  ]);
  const p = (await m.post('/patients', { ...details, commandId: randomUUID() })).body.patient;
  const s = await employee(m);
  await grant(m, s.account.id, ['patients.read']);
  expect((await s.browser.get('/api/patients')).status).toBe(403);
  await s.ready();
  expect((await s.browser.get('/api/patients')).body.patients[0].id).toBe(p.id);
  expect((await s.post('/patients', { ...details, commandId: randomUUID() })).status).toBe(403);
  expect(
    (
      await s.post(`/patients/${p.id}/contact`, {
        ...details,
        commandId: randomUUID(),
        revision: 0,
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await s.post(`/patients/${p.id}/archive`, {
        commandId: randomUUID(),
        revision: 0,
      })
    ).status,
  ).toBe(403);
  await grant(m, s.account.id, []);
  expect((await s.browser.get(`/api/patients/${p.id}`)).status).toBe(403);
  expect((await s.browser.get(`/api/patients/${p.id}/history`)).status).toBe(403);
  await grant(m, s.account.id, ['patients.read']);
  await m.post(`/accounts/${s.account.id}/status`, {
    status: 'historical',
    currentPassword: 'Fictional-manager-pass-2',
  });
  await s.login('Fictional-user-personal');
  expect((await s.browser.get('/api/patients')).status).toBe(403);
  await m.post(`/accounts/${s.account.id}/status`, {
    status: 'disabled',
    currentPassword: 'Fictional-manager-pass-2',
  });
  expect((await s.browser.get('/api/patients')).status).toBe(401);
  const other = await permittedManager();
  expect((await other.browser.get(`/api/patients/${p.id}`)).status).toBe(404);
  expect((await other.browser.get(`/api/patients/${p.id}/history`)).status).toBe(404);
  expect(
    (
      await other.post(`/patients/${p.id}/archive`, {
        commandId: randomUUID(),
        revision: 0,
      })
    ).status,
  ).toBe(404);
  expect((await request(app).get('/api/patients')).status).toBe(401);
});
it('create-only duplicate warnings reveal no other profiles and replay returns the original receipt after edits', async () => {
  const m = await permittedManager();
  await m.post('/patients', { ...details, commandId: randomUUID() });
  const s = await employee(m, 'doctor');
  await s.ready();
  await grant(m, s.account.id, ['patients.create']);
  const data = { ...details, commandId: randomUUID(), name: 'Enfant fictif' };
  const registered = await s.post('/patients', data);
  expect(registered.body).toMatchObject({
    duplicateWarning: true,
    duplicates: [],
  });
  const p = registered.body.patient;
  await m.post(`/patients/${p.id}/contact`, {
    ...details,
    name: 'Contact confidentiel modifié',
    revision: 0,
    commandId: randomUUID(),
  });
  expect((await s.post('/patients', data)).body.patient).toEqual(p);
  expect((await s.browser.get(`/api/patients/${p.id}`)).status).toBe(403);
});
it('concurrent independent registrations get unique increasing numbers and competing edits never overwrite', async () => {
  const m = await permittedManager();
  const registrations = await Promise.all(
    Array.from({ length: 6 }, (_, i) =>
      m.post('/patients', {
        ...details,
        name: `Fictif ${i}`,
        commandId: randomUUID(),
      }),
    ),
  );
  expect(registrations.map((r) => r.body.patient.patientNumber).sort()).toEqual([1, 2, 3, 4, 5, 6]);
  const p = registrations[0]!.body.patient;
  const edits = await Promise.all(
    ['Premier', 'Second'].map((name) =>
      m.post(`/patients/${p.id}/contact`, {
        ...details,
        name,
        revision: 0,
        commandId: randomUUID(),
      }),
    ),
  );
  expect(edits.map((r) => r.status).sort()).toEqual([200, 409]);
  expect((await m.browser.get(`/api/patients/${p.id}/history`)).body).toHaveLength(2);
  expect(
    (
      await m.post(`/patients/${p.id}/contact`, {
        ...details,
        id: randomUUID(),
        revision: 1,
        commandId: randomUUID(),
      })
    ).status,
  ).toBe(400);
});
it('patient invalidation streams publish after committed changes and terminate after grant revocation', async () => {
  const m = await permittedManager();
  const accountId = (await m.browser.get('/api/identity')).body.accountId;
  const login = await m.login('Fictional-manager-pass-2');
  const cookie = (login.headers['set-cookie'] as unknown as string[])
    .map((v) => v.split(';')[0])
    .join('; ');
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address() as { port: number };
  const abort = new AbortController();
  try {
    const stream = await fetch(`http://127.0.0.1:${address.port}/api/patients/events`, {
      headers: { Cookie: cookie },
      signal: abort.signal,
    });
    expect(stream.status).toBe(200);
    expect(stream.headers.get('content-type')).toContain('text/event-stream');
    const reader = stream.body!.getReader();
    const first = new TextDecoder().decode((await reader.read()).value);
    expect(first).toContain('event: invalidate');
    await m.post('/patients', { ...details, commandId: randomUUID() });
    const next = new TextDecoder().decode((await reader.read()).value);
    expect(next).toContain('event: invalidate');
    expect(next).not.toContain(details.name);
    await grant(m, accountId, []);
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
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
it('archive-only mutations acknowledge status without revealing patient contact details', async () => {
  const m = await permittedManager();
  const p = (await m.post('/patients', { ...details, commandId: randomUUID() })).body.patient;
  const s = await employee(m);
  await s.ready();
  await grant(m, s.account.id, ['patients.archive']);
  const result = await s.post(`/patients/${p.id}/archive`, {
    revision: 0,
    commandId: randomUUID(),
  });
  expect(result.status).toBe(200);
  expect(result.body).toEqual({ id: p.id, revision: 1, archived: true });
  expect((await s.browser.get(`/api/patients/${p.id}`)).status).toBe(403);
});
it('persisted session deletion on sign-out terminates an existing patient stream', async () => {
  const m = await permittedManager();
  const login = await m.login('Fictional-manager-pass-2');
  const cookie = (login.headers['set-cookie'] as unknown as string[])
    .map((v) => v.split(';')[0])
    .join('; ');
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const abort = new AbortController();
  try {
    const stream = await fetch(
      `http://127.0.0.1:${(server.address() as { port: number }).port}/api/patients/events`,
      { headers: { Cookie: cookie }, signal: abort.signal },
    );
    const reader = stream.body!.getReader();
    await reader.read();
    await m.post('/sign-out', {});
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
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
it('registration remains available beyond one search page with no patient-count quota', async () => {
  const m = await permittedManager();
  for (let i = 0; i < 51; i++)
    expect(
      (
        await m.post('/patients', {
          ...details,
          name: `Patient fictif ${i}`,
          commandId: randomUUID(),
        })
      ).status,
    ).toBe(201);
  const first = await m.browser.get('/api/patients');
  const second = await m.browser.get('/api/patients').query({ offset: 50 });
  expect(first.body.patients).toHaveLength(50);
  expect(second.body.patients.map((p: { patientNumber: number }) => p.patientNumber)).toEqual([1]);
});
