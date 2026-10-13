import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { createApplication } from '../src/application.js';
import { openDatabase } from '../src/database.js';
import { provisionClinic } from '../src/modules/identity/index.js';
const owner = openDatabase('postgresql://clinic_test:fictional-only@127.0.0.1:55437/clinic_issue7');
const runtime = openDatabase(
  'postgresql://clinic_runtime_test:fictional-runtime-only@127.0.0.1:55437/clinic_issue7',
);
const origin = 'http://localhost:4173';
let token = '';
let recoveryToken = '';
let failRecovery = false;
const notifications: string[] = [];
const options = {
  database: runtime,
  origin,
  secureCookies: false,
  sessionSecret: 'fictional-session-secret-at-least-32-characters',
  mail: {
    async sendNotification(message: { to: string }) {
      notifications.push(message.to);
    },
    async sendRecovery(message: { token: string }) {
      recoveryToken = message.token;
      if (failRecovery) throw new Error('Fictional delivery failure');
    },
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
it('manager creates individual staff credentials, usable from another PC only after replacement; staff cannot administer', async () => {
  const m = await manager();
  const created = await m.post('/accounts', {
    username: 'Reception',
    displayName: 'Accueil',
    kind: 'staff',
    temporaryPassword: 'Fictional-staff-temp-1',
    currentPassword: 'Fictional-manager-pass-2',
  });
  expect(created.status).toBe(201);
  expect(created.body).toMatchObject({
    username: 'reception',
    kind: 'staff',
    isManager: false,
  });
  expect(JSON.stringify(created.body)).not.toContain('passwordHash');
  const staff = request.agent(app);
  let csrf = (await staff.get('/api/session')).body.csrfToken;
  const post = (path: string, body: object) =>
    staff.post(`/api${path}`).set('Origin', origin).set('x-csrf-token', csrf).send(body);
  csrf = (
    await post('/sign-in', {
      method: 'clinic_username',
      clinicCode: m.code,
      username: 'RECEPTION',
      password: 'Fictional-staff-temp-1',
    })
  ).body.csrfToken;
  expect((await staff.get('/api/clinic')).status).toBe(403);
  expect(
    (
      await post('/onboarding/password', {
        password: 'Fictional-staff-new-pass',
      })
    ).status,
  ).toBe(204);
  csrf = (await staff.get('/api/session')).body.csrfToken;
  csrf = (
    await post('/sign-in', {
      method: 'clinic_username',
      clinicCode: m.code,
      username: 'reception',
      password: 'Fictional-staff-new-pass',
    })
  ).body.csrfToken;
  expect((await staff.get('/api/clinic')).status).toBe(200);
  expect((await staff.get('/api/accounts')).status).toBe(403);
  expect(
    (
      await post('/accounts', {
        username: 'other',
        displayName: 'Other',
        kind: 'doctor',
        temporaryPassword: 'Fictional-temp-password',
        currentPassword: 'Fictional-staff-new-pass',
      })
    ).status,
  ).toBe(403);
});
it('self password change revokes every PC session and offline manager recovery enters restricted setup once', async () => {
  const m = await manager();
  const second = request.agent(app);
  let csrf = (await second.get('/api/session')).body.csrfToken;
  csrf = (
    await second.post('/api/sign-in').set('Origin', origin).set('x-csrf-token', csrf).send({
      method: 'email',
      email: m.email,
      password: 'Fictional-manager-pass-2',
    })
  ).body.csrfToken;
  expect(
    (
      await m.post('/password', {
        currentPassword: 'wrong',
        password: 'Fictional-manager-pass-3',
      })
    ).status,
  ).toBe(401);
  expect(
    (
      await m.post('/password', {
        currentPassword: 'Fictional-manager-pass-2',
        password: 'Fictional-manager-pass-3',
      })
    ).status,
  ).toBe(204);
  expect((await second.get('/api/clinic')).status).toBe(401);
  expect((await m.browser.get('/api/clinic')).status).toBe(401);
  const recovery = request.agent(app);
  csrf = (await recovery.get('/api/session')).body.csrfToken;
  const recover = () =>
    recovery
      .post('/api/recovery/code')
      .set('Origin', origin)
      .set('x-csrf-token', csrf)
      .send({
        identity: { method: 'email', email: m.email },
        code: m.codes[0],
        password: 'Fictional-recovered-pass-4',
      });
  const result = await recover();
  expect(result.status).toBe(200);
  csrf = result.body.csrfToken;
  expect((await recovery.get('/api/identity')).body.stage).toBe('email');
  expect((await recovery.get('/api/clinic')).status).toBe(403);
  expect((await recover()).status).toBe(400);
  expect((await m.login('Fictional-manager-pass-3')).status).toBe(401);
});
it('requested username changes retain reserved identifiers, permissions apply immediately, disable invalidates sessions and last configured manager is protected', async () => {
  const m = await manager();
  const data = {
    username: 'doctor',
    displayName: 'Docteur fictif',
    kind: 'doctor',
    temporaryPassword: 'Fictional-doctor-temp',
    currentPassword: 'Fictional-manager-pass-2',
  };
  const a = (await m.post('/accounts', data)).body;
  expect(
    (
      await m.post(`/accounts/${a.id}/username`, {
        username: 'doctor.new',
        currentPassword: 'wrong',
      })
    ).status,
  ).toBe(401);
  expect(
    (
      await m.post(`/accounts/${a.id}/username`, {
        username: 'doctor.new',
        currentPassword: 'Fictional-manager-pass-2',
      })
    ).status,
  ).toBe(200);
  expect((await m.post('/accounts', data)).status).toBe(409);
  expect(
    (
      await m.post(`/accounts/${a.id}/permissions`, {
        permissions: ['appointments.manage', 'inventory.read'],
        currentPassword: 'Fictional-manager-pass-2',
      })
    ).body.permissions,
  ).toEqual(['appointments.manage', 'inventory.read']);
  const actor = (await m.browser.get('/api/identity')).body;
  expect(
    (
      await m.post(`/accounts/${actor.accountId}/status`, {
        status: 'disabled',
        currentPassword: 'Fictional-manager-pass-2',
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await m.post(`/accounts/${actor.accountId}/manager`, {
        isManager: false,
        currentPassword: 'Fictional-manager-pass-2',
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await m.post(`/accounts/${randomUUID()}/status`, {
        status: 'disabled',
        currentPassword: 'Fictional-manager-pass-2',
      })
    ).status,
  ).toBe(404);
});
it('ordinary manager email changes retain old login until verification, then revoke sessions and notify old address', async () => {
  const m = await manager();
  const replacement = `new-${m.code}@example.invalid`;
  expect((await m.post('/email', { email: replacement, currentPassword: 'wrong' })).status).toBe(
    401,
  );
  expect(
    (
      await m.post('/email', {
        email: replacement,
        currentPassword: 'Fictional-manager-pass-2',
      })
    ).status,
  ).toBe(202);
  expect((await m.browser.get('/api/identity')).body.loginEmail).toBe(m.email);
  expect((await m.post('/onboarding/verify-email', { token })).status).toBe(200);
  expect((await m.browser.get('/api/identity')).status).toBe(401);
  expect((await m.login('Fictional-manager-pass-2')).status).toBe(401);
});

async function staffSession(clinicCode: string, username: string, password: string) {
  const browser = request.agent(app);
  let csrf = (await browser.get('/api/session')).body.csrfToken;
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
  const login = async (value: string) => {
    csrf = (await browser.get('/api/session')).body.csrfToken;
    const r = await post('/sign-in', {
      method: 'clinic_username',
      clinicCode,
      username,
      password: value,
    });
    csrf = r.body.csrfToken;
    return r;
  };
  await login(password);
  return { browser, post, login };
}
it('promoted doctor keeps username login, requires email/codes and concurrent last-manager demotions cannot remove both managers', async () => {
  const m = await manager();
  const created = await m.post('/accounts', {
    username: 'doctor',
    displayName: 'Dentiste',
    kind: 'doctor',
    temporaryPassword: 'Fictional-doctor-temp',
    currentPassword: 'Fictional-manager-pass-2',
  });
  const id = created.body.id;
  const d = await staffSession(m.code, 'doctor', 'Fictional-doctor-temp');
  await d.post('/onboarding/password', {
    password: 'Fictional-doctor-personal',
  });
  await d.login('Fictional-doctor-personal');
  expect(
    (
      await m.post(`/accounts/${id}/manager`, {
        isManager: true,
        currentPassword: 'Fictional-manager-pass-2',
      })
    ).status,
  ).toBe(200);
  expect((await d.browser.get('/api/clinic')).status).toBe(401);
  expect((await d.login('Fictional-doctor-personal')).body.stage).toBe('email');
  expect((await d.browser.get('/api/identity')).body).toMatchObject({
    kind: 'doctor',
    isManager: true,
    loginMethod: 'clinic_username',
  });
  await d.post('/onboarding/email', {
    email: `doctor-${m.code}@example.invalid`,
  });
  const verified = await d.post('/onboarding/verify-email', { token });
  await d.post('/onboarding/codes-saved', {
    saved: true,
    batchId: verified.body.batchId,
  });
  const primary = (await m.browser.get('/api/identity')).body.accountId;
  const results = await Promise.all([
    m.post(`/accounts/${primary}/manager`, {
      isManager: false,
      currentPassword: 'Fictional-manager-pass-2',
    }),
    d.post(`/accounts/${id}/manager`, {
      isManager: false,
      currentPassword: 'Fictional-doctor-personal',
    }),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  const other = await manager();
  expect(
    (
      await other.post(`/accounts/${id}/status`, {
        status: 'disabled',
        currentPassword: 'Fictional-manager-pass-2',
      })
    ).status,
  ).toBe(404);
});
it('reset and disable revoke direct sessions, expired reset credentials fail and historical status is restored only by manager', async () => {
  const m = await manager();
  const a = (
    await m.post('/accounts', {
      username: 'staff',
      displayName: 'Personnel',
      kind: 'staff',
      temporaryPassword: 'Fictional-staff-temp',
      currentPassword: 'Fictional-manager-pass-2',
    })
  ).body;
  const staff = await staffSession(m.code, 'staff', 'Fictional-staff-temp');
  await staff.post('/onboarding/password', {
    password: 'Fictional-staff-personal',
  });
  await staff.login('Fictional-staff-personal');
  expect(
    (
      await m.post(`/accounts/${a.id}/permissions`, {
        permissions: ['inventory.read'],
        currentPassword: 'Fictional-manager-pass-2',
      })
    ).status,
  ).toBe(200);
  expect((await staff.browser.get('/api/identity')).body.permissions).toEqual(['inventory.read']);
  expect(
    (
      await m.post(`/accounts/${a.id}/reset-password`, {
        temporaryPassword: 'Fictional-staff-reset',
        currentPassword: 'Fictional-manager-pass-2',
      })
    ).status,
  ).toBe(204);
  expect((await staff.browser.get('/api/identity')).status).toBe(401);
  expect((await staff.login('Fictional-staff-personal')).status).toBe(401);
  expect((await staff.login('Fictional-staff-reset')).body.stage).toBe('password');
  await staff.post('/onboarding/password', {
    password: 'Fictional-staff-personal-2',
  });
  await staff.login('Fictional-staff-personal-2');
  await m.post(`/accounts/${a.id}/status`, {
    status: 'historical',
    currentPassword: 'Fictional-manager-pass-2',
  });
  await staff.login('Fictional-staff-personal-2');
  expect((await staff.browser.get('/api/clinic')).status).toBe(403);
  await m.post(`/accounts/${a.id}/status`, {
    status: 'active',
    currentPassword: 'Fictional-manager-pass-2',
  });
  await staff.login('Fictional-staff-personal-2');
  expect((await staff.browser.get('/api/clinic')).status).toBe(200);
  await m.post(`/accounts/${a.id}/status`, {
    status: 'disabled',
    currentPassword: 'Fictional-manager-pass-2',
  });
  expect((await staff.browser.get('/api/clinic')).status).toBe(401);
  expect((await staff.login('Fictional-staff-personal-2')).status).toBe(401);
});

it('email recovery links expire, replace predecessors, keep sessions active until completion and allow verified lost-mail replacement', async () => {
  let time = Date.now();
  app = createApplication({ ...options, now: () => time });
  const m = await manager();
  const identity = { method: 'email', email: m.email };
  expect((await m.post('/recovery/request', { identity })).status).toBe(202);
  const first = recoveryToken;
  expect((await m.browser.get('/api/clinic')).status).toBe(200);
  await m.post('/recovery/request', { identity });
  const second = recoveryToken;
  expect(
    (
      await m.post('/recovery/email', {
        identity,
        token: first,
        password: 'Fictional-recovered-password',
      })
    ).status,
  ).toBe(400);
  time += 30 * 60 * 1000;
  expect(
    (
      await m.post('/recovery/email', {
        identity,
        token: second,
        password: 'Fictional-recovered-password',
      })
    ).status,
  ).toBe(400);
  await m.post('/recovery/request', { identity });
  const third = recoveryToken;
  const recovery = request.agent(app);
  let csrf = (await recovery.get('/api/session')).body.csrfToken;
  const post = (path: string, body: object) =>
    recovery.post(`/api${path}`).set('Origin', origin).set('x-csrf-token', csrf).send(body);
  const done = await post('/recovery/email', {
    identity,
    token: third,
    password: 'Fictional-recovered-password',
  });
  expect(done.status).toBe(200);
  csrf = done.body.csrfToken;
  expect((await m.browser.get('/api/clinic')).status).toBe(401);
  expect((await recovery.get('/api/clinic')).status).toBe(403);
  const replacement = `replacement-${m.code}@example.invalid`;
  expect((await post('/onboarding/email', { email: replacement })).status).toBe(202);
  const verified = await post('/onboarding/verify-email', { token });
  expect(verified.status).toBe(200);
  // Email-login replacement revokes the restricted recovery session too.
  expect((await recovery.get('/api/identity')).status).toBe(401);
  expect(notifications).toContain(m.email);
  csrf = (await recovery.get('/api/session')).body.csrfToken;
  const login = await post('/sign-in', {
    method: 'email',
    email: replacement,
    password: 'Fictional-recovered-password',
  });
  expect(login.body.stage).toBe('codes');
  csrf = login.body.csrfToken;
  const fresh = await post('/onboarding/codes', { password: 'Fictional-recovered-password' });
  expect(fresh.body.codes).toHaveLength(10);
  await post('/onboarding/codes-saved', { saved: true, batchId: fresh.body.batchId });
  expect((await recovery.get('/api/clinic')).status).toBe(200);
  expect(
    (
      await post('/recovery/code', {
        identity: { method: 'email', email: replacement },
        code: m.codes[1],
        password: 'Fictional-recovered-again',
      })
    ).status,
  ).toBe(400);
});
it('failed recovery delivery and unknown accounts give the same response without leaving a usable link', async () => {
  const m = await manager();
  failRecovery = true;
  const identity = { method: 'email', email: m.email };
  expect((await m.post('/recovery/request', { identity })).status).toBe(202);
  const undelivered = recoveryToken;
  expect(
    (
      await m.post('/recovery/request', {
        identity: { method: 'email', email: 'unknown@example.invalid' },
      })
    ).status,
  ).toBe(202);
  expect(
    (
      await m.post('/recovery/email', {
        identity,
        token: undelivered,
        password: 'Fictional-recovery-failure',
      })
    ).status,
  ).toBe(400);
  expect((await m.browser.get('/api/clinic')).status).toBe(200);
  failRecovery = false;
});
it('another configured manager resets a lost mailbox without reusing pending links; disabled and historical managers cannot recover', async () => {
  const m = await manager();
  const id = (
    await m.post('/accounts', {
      username: 'second',
      displayName: 'Responsable dentiste',
      kind: 'doctor',
      temporaryPassword: 'Fictional-second-temp',
      currentPassword: 'Fictional-manager-pass-2',
    })
  ).body.id;
  const d = await staffSession(m.code, 'second', 'Fictional-second-temp');
  await d.post('/onboarding/password', { password: 'Fictional-second-personal' });
  await d.login('Fictional-second-personal');
  await m.post(`/accounts/${id}/manager`, {
    isManager: true,
    currentPassword: 'Fictional-manager-pass-2',
  });
  await d.login('Fictional-second-personal');
  await d.post('/onboarding/email', { email: `second-${m.code}@example.invalid` });
  const batch = await d.post('/onboarding/verify-email', { token });
  await d.post('/onboarding/codes-saved', { saved: true, batchId: batch.body.batchId });
  const primary = (await m.browser.get('/api/identity')).body.accountId;
  await m.post('/email', {
    email: `pending-${m.code}@example.invalid`,
    currentPassword: 'Fictional-manager-pass-2',
  });
  const pending = token;
  expect(
    (
      await d.post(`/accounts/${primary}/reset-password`, {
        temporaryPassword: 'Fictional-manager-reset',
        currentPassword: 'Fictional-second-personal',
      })
    ).status,
  ).toBe(204);
  expect((await m.browser.get('/api/identity')).status).toBe(401);
  await m.login('Fictional-manager-reset');
  await m.post('/onboarding/password', { password: 'Fictional-manager-restored' });
  await m.login('Fictional-manager-restored');
  expect((await m.post('/onboarding/verify-email', { token: pending })).status).toBe(400);
  expect(
    (await m.post('/onboarding/email', { email: `restored-${m.code}@example.invalid` })).status,
  ).toBe(202);
  expect((await m.post('/onboarding/verify-email', { token })).status).toBe(200);
  expect(notifications).toContain(m.email);
  // The second configured manager can restrict primary without restoring it through recovery.
  await d.post(`/accounts/${primary}/status`, {
    status: 'disabled',
    currentPassword: 'Fictional-second-personal',
  });
  expect(
    (
      await d.post('/recovery/code', {
        identity: { method: 'email', email: `restored-${m.code}@example.invalid` },
        code: m.codes[0],
        password: 'Fictional-disabled-recovery',
      })
    ).status,
  ).toBe(400);
  await d.post(`/accounts/${primary}/status`, {
    status: 'historical',
    currentPassword: 'Fictional-second-personal',
  });
  expect(
    (
      await d.post('/recovery/code', {
        identity: { method: 'email', email: `restored-${m.code}@example.invalid` },
        code: m.codes[1],
        password: 'Fictional-history-recovery',
      })
    ).status,
  ).toBe(400);
});

it('two managers editing a loaded account must reconcile stale permission changes instead of overwriting', async () => {
  const m = await manager();
  const a = (
    await m.post('/accounts', {
      username: 'concurrent',
      displayName: 'Personnel',
      kind: 'staff',
      temporaryPassword: 'Fictional-concurrency-temp',
      currentPassword: 'Fictional-manager-pass-2',
    })
  ).body;
  const results = await Promise.all([
    m.post(`/accounts/${a.id}/permissions`, {
      revision: a.revision,
      permissions: ['inventory.read'],
      currentPassword: 'Fictional-manager-pass-2',
    }),
    m.post(`/accounts/${a.id}/permissions`, {
      revision: a.revision,
      permissions: ['appointments.manage'],
      currentPassword: 'Fictional-manager-pass-2',
    }),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  const winner = results.find((r) => r.status === 200)!.body;
  const current = (await m.browser.get('/api/accounts')).body.find(
    (v: { id: string }) => v.id === a.id,
  );
  expect(current.permissions).toEqual(winner.permissions);
  expect(current.revision).toBe(a.revision + 1);
});
