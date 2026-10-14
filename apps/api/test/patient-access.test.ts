import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { createApplication } from '../src/application.js';
import { openDatabase } from '../src/database.js';
import { provisionClinic, createIdentityAccess } from '../src/modules/identity/index.js';
const owner = openDatabase('postgresql://clinic_test:fictional-only@127.0.0.1:55437/clinic_issue7');
const runtime = openDatabase(
  'postgresql://clinic_runtime_test:fictional-runtime-only@127.0.0.1:55437/clinic_issue7',
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

it('authorized managers share a patient with multiple eligible doctors and staff without opening clinical records', async () => {
  const m = await manager();
  const ownId = (await m.browser.get('/api/identity')).body.accountId;
  await m.post(`/accounts/${ownId}/permissions`, {
    currentPassword: 'Fictional-manager-pass-2',
    permissions: ['patients.create'],
  });
  const p = (
    await m.post('/patients', {
      commandId: randomUUID(),
      name: 'Patient accès fictif',
      phone: '70000000',
      contactKind: 'patient',
      contactName: '',
    })
  ).body.patient;
  const d = (
    await m.post('/accounts', {
      username: 'dentist',
      displayName: 'Dentiste',
      kind: 'doctor',
      temporaryPassword: 'Fictional-initial-pass-1',
      currentPassword: 'Fictional-manager-pass-2',
    })
  ).body;
  await m.post(`/accounts/${d.id}/permissions`, {
    currentPassword: 'Fictional-manager-pass-2',
    permissions: ['clinical.read'],
  });
  await activateEmployee(m.code, 'dentist');
  const shared = await m.post(`/patient-access/${p.id}/share`, {
    commandId: randomUUID(),
    revision: 0,
    accountId: d.id,
    kind: 'assigned',
  });
  expect(shared.status).toBe(200);
  expect(shared.body.grants).toEqual([
    { accountId: d.id, displayName: 'Dentiste', kind: 'assigned' },
  ]);
  expect((await m.browser.get(`/api/patient-access/${p.id}`)).body.grants).toEqual(
    shared.body.grants,
  );
});

async function activateEmployee(code: string, username: string) {
  const browser = request.agent(app);
  let csrf = (await browser.get('/api/session')).body.csrfToken;
  const post = (path: string, body: object) =>
    browser.post(`/api${path}`).set('Origin', origin).set('x-csrf-token', csrf).send(body);
  const signIn = async (password: string) => {
    const result = await post('/sign-in', {
      method: 'clinic_username',
      clinicCode: code,
      username,
      password,
    });
    csrf = result.body.csrfToken;
    return result;
  };
  await signIn('Fictional-initial-pass-1');
  await post('/onboarding/password', { password: 'Fictional-employee-pass-2' });
  csrf = (await browser.get('/api/session')).body.csrfToken;
  expect((await signIn('Fictional-employee-pass-2')).status).toBe(200);
  const identity = (await browser.get('/api/identity')).body;
  return { browser, post, identity, signIn };
}

async function scenario() {
  const m = await manager();
  const ownId = (await m.browser.get('/api/identity')).body.accountId;
  await m.post(`/accounts/${ownId}/permissions`, {
    currentPassword: 'Fictional-manager-pass-2',
    permissions: ['patients.create'],
  });
  const patient = (
    await m.post('/patients', {
      commandId: randomUUID(),
      name: 'Patient confidentiel fictif',
      phone: '70000000',
      contactKind: 'patient',
      contactName: '',
    })
  ).body.patient;
  const create = async (
    username: string,
    kind = 'doctor',
    permissions = ['clinical.read', 'notes.draft'],
  ) => {
    const account = (
      await m.post('/accounts', {
        username,
        displayName: username,
        kind,
        temporaryPassword: 'Fictional-initial-pass-1',
        currentPassword: 'Fictional-manager-pass-2',
      })
    ).body;
    await m.post(`/accounts/${account.id}/permissions`, {
      currentPassword: 'Fictional-manager-pass-2',
      permissions,
    });
    const employee = await activateEmployee(m.code, username);
    return { ...employee, id: account.id };
  };
  return { m, patient, create };
}
it('explicit multi-doctor sharing, staff grants, lost responses and removals preserve dated access history', async () => {
  const { m, patient, create } = await scenario();
  const a = await create('doctor-a');
  const b = await create('doctor-b');
  const s = await create('assistant', 'staff');
  for (const [revision, account] of [a, b, s].entries()) {
    const command = {
      commandId: randomUUID(),
      revision,
      accountId: account.id,
      kind: revision === 0 ? 'assigned' : 'shared',
    };
    const response = await m.post(`/patient-access/${patient.id}/share`, command);
    expect(response.status).toBe(200);
    expect((await m.post(`/patient-access/${patient.id}/share`, command)).body).toEqual(
      response.body,
    );
  }
  expect((await m.browser.get(`/api/patient-access/${patient.id}`)).body.grants).toHaveLength(3);
  const removal = { commandId: randomUUID(), revision: 3, accountId: a.id };
  expect((await m.post(`/patient-access/${patient.id}/remove`, removal)).body.grants).toHaveLength(
    2,
  );
  expect((await m.post(`/patient-access/${patient.id}/remove`, removal)).body.revision).toBe(4);
  const history = (await m.browser.get(`/api/patient-access/${patient.id}/history`)).body;
  expect(history[0]).toMatchObject({
    actorDisplayName: 'Responsable',
    accountDisplayName: 'doctor-a',
    accountId: a.id,
  });
  expect(Object.keys(history[0]).sort()).toEqual([
    'accountDisplayName',
    'accountId',
    'action',
    'actorDisplayName',
    'actorId',
    'at',
    'snapshot',
  ]);
  expect(history.map((h: { action: string }) => h.action)).toEqual([
    'share',
    'share',
    'share',
    'remove',
  ]);
  expect(history.every((h: { at: string }) => !Number.isNaN(Date.parse(h.at)))).toBe(true);
});
it('concurrent sharing rejects stale revisions; command reuse cannot change target or bypass tenant scope', async () => {
  const { m, patient, create } = await scenario();
  const a = await create('doctor-a');
  const b = await create('doctor-b');
  const command = {
    commandId: randomUUID(),
    revision: 0,
    accountId: a.id,
    kind: 'shared',
  };
  const responses = await Promise.all([
    m.post(`/patient-access/${patient.id}/share`, command),
    m.post(`/patient-access/${patient.id}/share`, {
      ...command,
      accountId: b.id,
      commandId: randomUUID(),
    }),
  ]);
  expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(
    (
      await m.post(`/patient-access/${patient.id}/share`, {
        ...command,
        accountId: b.id,
      })
    ).status,
  ).toBe(409);
  const foreign = await scenario();
  expect((await foreign.m.browser.get(`/api/patient-access/${patient.id}`)).status).toBe(404);
  expect(
    (
      await m.post(`/patient-access/${patient.id}/share`, {
        ...command,
        commandId: randomUUID(),
        revision: 1,
        accountId: (await foreign.create('foreign-doctor')).id,
      })
    ).status,
  ).toBe(404);
});
it('assignment delegation exposes minimal eligible candidates but never account permission administration', async () => {
  const { m, patient, create } = await scenario();
  const delegate = await create('reception', 'staff', ['patients.assign']);
  const doctor = await create('doctor');
  const forbidden = await create('staff-finalizer', 'staff', ['notes.finalize']);
  expect((await delegate.browser.get('/api/accounts')).status).toBe(403);
  const candidates = (await delegate.browser.get('/api/patient-access/candidates')).body;
  expect(candidates).toContainEqual({
    id: doctor.id,
    displayName: 'doctor',
    kind: 'doctor',
  });
  expect(candidates.some((c: { id: string }) => c.id === forbidden.id)).toBe(false);
  expect(Object.keys(candidates[0]).sort()).toEqual(['displayName', 'id', 'kind']);
  expect(
    (
      await delegate.post(`/patient-access/${patient.id}/share`, {
        commandId: randomUUID(),
        revision: 0,
        accountId: doctor.id,
        kind: 'shared',
      })
    ).status,
  ).toBe(200);
  expect((await doctor.browser.get(`/api/patient-access/${patient.id}`)).status).toBe(403);
  expect(
    (
      await m.post(`/patient-access/${patient.id}/share`, {
        commandId: randomUUID(),
        revision: 1,
        accountId: forbidden.id,
        kind: 'shared',
      })
    ).status,
  ).toBe(403);
});

it('clinical application reads and writes require current patient scope; removals deny retries and rollback consuming writes', async () => {
  const { m, patient, create } = await scenario();
  const doctor = await create('doctor');
  const access = createIdentityAccess(runtime, Date.now);
  const actor = {
    clinicId: doctor.identity.clinicId,
    accountId: doctor.id,
    version: 1,
  };
  const read = () =>
    access.withClinicalPermission(actor, patient.id, 'clinical.read', async (c, tx) => {
      const p = await tx.patient.findFirstOrThrow({
        where: { clinicId: c.clinicId, id: c.patientId },
      });
      return p.name;
    });
  await expect(read()).rejects.toMatchObject({ status: 403 });
  await m.post(`/patient-access/${patient.id}/share`, {
    commandId: randomUUID(),
    revision: 0,
    accountId: doctor.id,
    kind: 'assigned',
  });
  expect(await read()).toBe('Patient confidentiel fictif');
  await expect(
    access.withPermission(actor, 'clinical.read', async () => 'bypass'),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    access.withClinicalPermission(actor, patient.id, 'notes.draft', async (c, tx) => {
      await tx.patient.update({
        where: { id: patient.id, clinicId: c.clinicId },
        data: { name: 'Should roll back' },
      });
      throw new Error('Consuming workflow failed');
    }),
  ).rejects.toThrow('Consuming workflow failed');
  expect(await read()).toBe('Patient confidentiel fictif');
  await access.withClinicalPermission(actor, patient.id, 'notes.draft', async (c, tx) => {
    await tx.patient.update({
      where: { id: c.patientId, clinicId: c.clinicId },
      data: { name: 'Authorized fixture write' },
    });
  });
  expect(await read()).toBe('Authorized fixture write');
  const foreign = await scenario();
  await expect(
    access.withClinicalPermission(actor, foreign.patient.id, 'clinical.read', async (c, tx) =>
      tx.patient.findFirst({
        where: { id: c.patientId, clinicId: c.clinicId },
      }),
    ),
  ).rejects.toMatchObject({ status: 403 });
  await expect(
    access.withClinicalPermission(actor, foreign.patient.id, 'notes.draft', async (c, tx) =>
      tx.patient.update({
        where: { id: c.patientId, clinicId: c.clinicId },
        data: { name: 'Denied foreign write' },
      }),
    ),
  ).rejects.toMatchObject({ status: 403 });
  await m.post(`/patient-access/${patient.id}/remove`, {
    commandId: randomUUID(),
    revision: 1,
    accountId: doctor.id,
  });
  await expect(read()).rejects.toMatchObject({ status: 403 });
  await expect(
    access.withClinicalPermission(actor, patient.id, 'notes.draft', async (c, tx) =>
      tx.patient.update({
        where: { id: patient.id, clinicId: c.clinicId },
        data: { name: 'Denied write' },
      }),
    ),
  ).rejects.toMatchObject({ status: 403 });
  await m.post(`/patient-access/${patient.id}/share`, {
    commandId: randomUUID(),
    revision: 2,
    accountId: doctor.id,
    kind: 'shared',
  });
  expect(await read()).toBe('Authorized fixture write');
});
it('doctor-managers still need capability and patient scope; non-doctor managers never receive clinical authority', async () => {
  const { m, patient } = await scenario();
  const identity = (await m.browser.get('/api/identity')).body;
  const access = createIdentityAccess(runtime, Date.now);
  await m.post(`/accounts/${identity.accountId}/permissions`, {
    currentPassword: 'Fictional-manager-pass-2',
    permissions: ['clinical.read', 'notes.draft'],
  });
  await expect(
    access.withClinicalPermission(
      { clinicId: identity.clinicId, accountId: identity.accountId, version: 1 },
      patient.id,
      'clinical.read',
      async () => 'Denied',
    ),
  ).rejects.toMatchObject({ status: 403 });
  expect(
    (
      await m.post(`/patient-access/${patient.id}/share`, {
        commandId: randomUUID(),
        revision: 0,
        accountId: identity.accountId,
        kind: 'shared',
      })
    ).status,
  ).toBe(403);
  await m.post(`/accounts/${identity.accountId}/kind`, {
    currentPassword: 'Fictional-manager-pass-2',
    kind: 'doctor',
  });
  await m.login('Fictional-manager-pass-2');
  const actor = { clinicId: identity.clinicId, accountId: identity.accountId, version: 2 };
  await expect(
    access.withClinicalPermission(actor, patient.id, 'clinical.read', async () => 'Denied'),
  ).rejects.toMatchObject({ status: 403 });
  expect(
    (
      await m.post(`/patient-access/${patient.id}/share`, {
        commandId: randomUUID(),
        revision: 0,
        accountId: identity.accountId,
        kind: 'assigned',
      })
    ).status,
  ).toBe(200);
  expect(
    await access.withClinicalPermission(actor, patient.id, 'clinical.read', async (c) => ({
      patientId: c.patientId,
      accountId: c.accountId,
    })),
  ).toEqual({ patientId: patient.id, accountId: identity.accountId });
  await m.post(`/accounts/${identity.accountId}/permissions`, {
    currentPassword: 'Fictional-manager-pass-2',
    permissions: [],
  });
  await expect(
    access.withClinicalPermission(actor, patient.id, 'clinical.read', async () => 'Denied'),
  ).rejects.toMatchObject({ status: 403 });
});
it('permitted staff may draft but cannot finalize; disablement and historical-only status override reassignment', async () => {
  const { m, patient, create } = await scenario();
  const staff = await create('assistant', 'staff', [
    'clinical.read',
    'notes.draft',
    'notes.finalize',
  ]);
  const access = createIdentityAccess(runtime, Date.now);
  const actor = { clinicId: staff.identity.clinicId, accountId: staff.id, version: 1 };
  await m.post(`/patient-access/${patient.id}/share`, {
    commandId: randomUUID(),
    revision: 0,
    accountId: staff.id,
    kind: 'shared',
  });
  expect(
    await access.withClinicalPermission(actor, patient.id, 'notes.draft', async (c) => c.patientId),
  ).toBe(patient.id);
  await expect(
    access.withClinicalPermission(actor, patient.id, 'notes.finalize', async () => 'Forbidden'),
  ).rejects.toMatchObject({ status: 403 });
  await m.post(`/accounts/${staff.id}/status`, {
    currentPassword: 'Fictional-manager-pass-2',
    status: 'historical',
  });
  await expect(
    access.withClinicalPermission(actor, patient.id, 'clinical.read', async () => 'Forbidden'),
  ).rejects.toMatchObject({ status: 401 });
  expect(
    (
      await m.post(`/patient-access/${patient.id}/share`, {
        commandId: randomUUID(),
        revision: 1,
        accountId: staff.id,
        kind: 'shared',
      })
    ).status,
  ).toBe(403);
  await m.post(`/accounts/${staff.id}/status`, {
    currentPassword: 'Fictional-manager-pass-2',
    status: 'disabled',
  });
  expect(
    (
      await m.post(`/patient-access/${patient.id}/share`, {
        commandId: randomUUID(),
        revision: 1,
        accountId: staff.id,
        kind: 'shared',
      })
    ).status,
  ).toBe(403);
});
it('assignment SSE contains no patient content and closes when delegated assignment authority is revoked', async () => {
  const { m, patient, create } = await scenario();
  const delegate = await create('reception', 'staff', ['patients.assign']);
  const doctor = await create('doctor');
  const login = await delegate.signIn('Fictional-employee-pass-2');
  const cookie = (login.headers['set-cookie'] as unknown as string[])
    .map((v) => v.split(';')[0])
    .join('; ');
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const abort = new AbortController();
  try {
    const stream = await fetch(
      `http://127.0.0.1:${(server.address() as { port: number }).port}/api/assignment-events`,
      { headers: { Cookie: cookie }, signal: abort.signal },
    );
    expect(stream.status).toBe(200);
    const reader = stream.body!.getReader();
    await reader.read();
    await m.post(`/patient-access/${patient.id}/share`, {
      commandId: randomUUID(),
      revision: 0,
      accountId: doctor.id,
      kind: 'shared',
    });
    const event = new TextDecoder().decode((await reader.read()).value);
    expect(event).toContain('event: invalidate');
    expect(event).not.toContain(patient.name);
    expect(event).not.toContain(doctor.id);
    await m.post(`/accounts/${delegate.id}/permissions`, {
      currentPassword: 'Fictional-manager-pass-2',
      permissions: [],
    });
    let closed = false;
    for (let i = 0; i < 5; i++) {
      if ((await reader.read()).done) {
        closed = true;
        break;
      }
    }
    expect(closed).toBe(true);
    expect((await delegate.browser.get('/api/assignment-patients')).status).toBe(403);
  } finally {
    abort.abort();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
