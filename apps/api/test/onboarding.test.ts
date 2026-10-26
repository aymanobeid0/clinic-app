import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApplication } from '../src/application.js';
import { openDatabase } from '../src/database.js';
import { provisionClinic } from '../src/modules/identity/index.js';

const url = `postgresql://clinic_test:fictional-only@127.0.0.1:${process.env.CLINIC_TEST_PORT ?? "55437"}/clinic_issue7`;
const database = openDatabase(url);
const origin = 'http://localhost:4173';
const deliveries: { to: string; token: string }[] = [];
const runtime = openDatabase(
  `postgresql://clinic_runtime_test:fictional-runtime-only@127.0.0.1:${process.env.CLINIC_TEST_PORT ?? "55437"}/clinic_issue7`,
);
const options = {
  database: runtime,
  origin,
  secureCookies: false,
  sessionSecret: 'fictional-test-session-secret-at-least-32-characters',
  mail: {
    async sendVerification(message: { to: string; token: string }) {
      deliveries.push(message);
    },
  },
};
const app = createApplication(options);

describe('manager onboarding', () => {
  beforeAll(async () => {
    await database.connect();
    await runtime.connect();
  });
  afterAll(async () => {
    await runtime.close();
    await database.close();
  });
  it('persists operator-provisioned identity but requires temporary password replacement before clinic access', async () => {
    const clinicCode = `test-${randomUUID()}`.slice(0, 32);
    await provisionClinic(database, {
      clinicCode,
      email: `${clinicCode}@example.invalid`,
      clinicName: 'Clinique fictive',
      username: 'Manager',
      displayName: 'Responsable fictif',
      temporaryPassword: 'Fictional-initial-pass-1',
    });
    const browser = request.agent(app);
    const session = await browser.get('/api/session');
    const login = await browser
      .post('/api/sign-in')
      .set('Origin', origin)
      .set('x-csrf-token', session.body.csrfToken)
      .send({
        method: 'email',
        email: ` ${clinicCode.toUpperCase()}@EXAMPLE.INVALID `,
        password: 'Fictional-initial-pass-1',
      });
    expect(login.status).toBe(200);
    expect(login.body.stage).toBe('password');
    const missing = await browser.post('/api/onboarding/password').set('Origin', origin)
      .set('x-csrf-token', login.body.csrfToken).send({});
    expect(missing.status).toBe(400);
    expect(missing.body.fields.password).toBe('Ce champ est obligatoire.');
    const short = await browser.post('/api/onboarding/password').set('Origin', origin)
      .set('x-csrf-token', login.body.csrfToken).send({ password: 'short' });
    expect(short.body.fields.password).toBe('Saisissez au moins 12 caractères.');
    expect((await browser.get('/api/clinic')).status).toBe(403);
    const recreated = createApplication(options);
    const identity = await request(recreated)
      .get('/api/identity')
      .set('Cookie', login.headers['set-cookie']);
    expect(identity.body.username).toBe('manager');
    expect(identity.body.stage).toBe('password');
  });
  it('replaces a temporary password once, revokes both sessions and requires signing in again', async () => {
    const clinicCode = `test-${randomUUID()}`.slice(0, 32);
    await provisionClinic(database, {
      clinicCode,
      email: `${clinicCode}@example.invalid`,
      clinicName: 'Clinique fictive',
      username: 'manager',
      displayName: 'Responsable',
      temporaryPassword: 'Fictional-initial-pass-1',
    });
    const browsers = [request.agent(app), request.agent(app)];
    const tokens: string[] = [];
    for (const browser of browsers) {
      const session = await browser.get('/api/session');
      const login = await browser
        .post('/api/sign-in')
        .set('Origin', origin)
        .set('x-csrf-token', session.body.csrfToken)
        .send({
          method: 'email',
          email: `${clinicCode}@example.invalid`,
          password: 'Fictional-initial-pass-1',
        });
      tokens.push(login.body.csrfToken);
    }
    const responses = await Promise.all(
      browsers.map((browser, i) =>
        browser
          .post('/api/onboarding/password')
          .set('Origin', origin)
          .set('x-csrf-token', tokens[i])
          .send({ password: 'Fictional-replacement-pass-2' }),
      ),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([204, 401]);
    for (const browser of browsers) expect((await browser.get('/api/identity')).status).toBe(401);
    const session = await browsers[0].get('/api/session');
    const signIn = (password: string) =>
      browsers[0]
        .post('/api/sign-in')
        .set('Origin', origin)
        .set('x-csrf-token', session.body.csrfToken)
        .send({
          method: 'email',
          email: `${clinicCode}@example.invalid`,
          password,
        });
    expect((await signIn('Fictional-initial-pass-1')).status).toBe(401);
    expect((await signIn('Fictional-replacement-pass-2')).body.stage).toBe('email');
  });

  it('requires verified email and saved codes, keeps tokens single-use and then permits the persistent clinic identity', async () => {
    const clinicCode = `test-${randomUUID()}`.slice(0, 32);
    await provisionClinic(database, {
      clinicCode,
      email: `${clinicCode}@example.invalid`,
      clinicName: 'Clinique démonstration',
      username: 'manager',
      displayName: 'Responsable',
      temporaryPassword: 'Fictional-initial-pass-1',
    });
    const browser = request.agent(app);
    let csrf = (await browser.get('/api/session')).body.csrfToken;
    const post = (path: string, body: object) =>
      browser.post(path).set('Origin', origin).set('x-csrf-token', csrf).send(body);
    csrf = (
      await post('/api/sign-in', {
        method: 'email',
        email: `${clinicCode}@example.invalid`,
        password: 'Fictional-initial-pass-1',
      })
    ).body.csrfToken;
    await post('/api/onboarding/password', {
      password: 'Fictional-replacement-pass-2',
    });
    csrf = (await browser.get('/api/session')).body.csrfToken;
    csrf = (
      await post('/api/sign-in', {
        method: 'email',
        email: `${clinicCode}@example.invalid`,
        password: 'Fictional-replacement-pass-2',
      })
    ).body.csrfToken;
    expect(
      (
        await post('/api/onboarding/email', {
          email: `${clinicCode}@example.invalid`,
        })
      ).status,
    ).toBe(202);
    const first = deliveries.at(-1)!;
    expect((await browser.get('/api/clinic')).status).toBe(403);
    await post('/api/onboarding/email', {
      email: `${clinicCode}@example.invalid`,
    });
    expect((await post('/api/onboarding/verify-email', { token: first.token })).status).toBe(400);
    const token = deliveries.at(-1)!.token;
    const verified = await post('/api/onboarding/verify-email', { token });
    expect(verified.status).toBe(200);
    expect(verified.body.codes).toHaveLength(10);
    expect(new Set(verified.body.codes).size).toBe(10);
    expect((await post('/api/onboarding/verify-email', { token })).status).toBe(400);
    expect((await browser.get('/api/clinic')).status).toBe(403);
    expect(
      (
        await post('/api/onboarding/codes-saved', {
          batchId: verified.body.batchId,
          saved: true,
        })
      ).status,
    ).toBe(204);
    expect((await browser.get('/api/clinic')).body).toEqual({
      code: clinicCode,
      name: 'Clinique démonstration',
    });
    expect((await browser.get('/api/identity')).body.stage).toBe('ready');
    expect((await post('/api/sign-out', {})).status).toBe(204);
    expect((await browser.get('/api/clinic')).status).toBe(401);
  });

  it('denies invalid credentials, forged login and expired temporary credentials without exposing clinic data', async () => {
    const clinicCode = `test-${randomUUID()}`.slice(0, 32);
    await provisionClinic(
      database,
      {
        clinicCode,
        email: `${clinicCode}@example.invalid`,
        clinicName: 'Clinique fictive',
        username: 'manager',
        displayName: 'Responsable',
        temporaryPassword: 'Fictional-initial-pass-1',
      },
      Date.now() - 24 * 60 * 60 * 1000,
    );
    const browser = request.agent(app);
    const session = await browser.get('/api/session');
    expect(
      (
        await browser.post('/api/sign-in').send({
          method: 'email',
          email: `${clinicCode}@example.invalid`,
          password: 'Fictional-initial-pass-1',
        })
      ).status,
    ).toBe(403);
    for (const code of [clinicCode, 'unknown-clinic']) {
      const response = await browser
        .post('/api/sign-in')
        .set('Origin', origin)
        .set('x-csrf-token', session.body.csrfToken)
        .send({
          method: 'email',
          email: `${code}@example.invalid`,
          password: 'Fictional-initial-pass-1',
        });
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: 'Identifiants invalides.' });
    }
    expect((await browser.get('/api/clinic')).status).toBe(401);
  });

  it('isolates two clinics through the real runtime Prisma pool and clears transaction context', async () => {
    const codes = [`test-${randomUUID()}`.slice(0, 32), `test-${randomUUID()}`.slice(0, 32)];
    for (const clinicCode of codes)
      await provisionClinic(database, {
        clinicCode,
        email: `${clinicCode}@example.invalid`,
        clinicName: clinicCode,
        username: 'manager',
        displayName: 'Responsable',
        temporaryPassword: 'Fictional-initial-pass-1',
      });
    const clinics = await database.client.clinic.findMany({
      where: { code: { in: codes } },
    });
    // Infrastructure security boundary: deliberately omit application WHERE filters
    // to demonstrate database RLS, rather than assert application storage internals.
    expect(await runtime.client.account.findMany()).toEqual([]);
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, i) => {
        const clinic = clinics[i % 2];
        return runtime.clinicTransaction(clinic.id, async (tx) => {
          const visible = await tx.clinic.findMany({ select: { code: true } });
          const accounts = await tx.account.findMany({
            select: { clinicId: true },
          });
          expect(visible).toEqual([{ code: clinic.code }]);
          expect(accounts).toEqual([{ clinicId: clinic.id }]);
        });
      }),
    );
    expect(results).toHaveLength(12);
    expect(await runtime.client.account.findMany()).toEqual([]);
    await expect(
      runtime.client.clinic.create({
        data: { code: 'forbidden', name: 'Forbidden' },
      }),
    ).rejects.toThrow();
  });

  it('keeps setup blocked on delivery failure and verification expiry, and replaces lost code batches only with the current password', async () => {
    let time = Date.now();
    let failDelivery = true;
    let delivered = '';
    const clinicCode = `test-${randomUUID()}`.slice(0, 32);
    await provisionClinic(
      database,
      {
        clinicCode,
        email: `${clinicCode}@example.invalid`,
        clinicName: 'Clinique fictive',
        username: 'manager',
        displayName: 'Responsable',
        temporaryPassword: 'Fictional-initial-pass-1',
      },
      time,
    );
    const instance = createApplication({
      ...options,
      now: () => time,
      mail: {
        async sendVerification(message) {
          delivered = message.token;
          if (failDelivery) throw new Error('Fictional delivery outage');
        },
      },
    });
    const browser = request.agent(instance);
    let csrf = (await browser.get('/api/session')).body.csrfToken;
    const post = (path: string, body: object) =>
      browser.post(path).set('Origin', origin).set('x-csrf-token', csrf).send(body);
    const login = async (password: string) => {
      csrf = (await browser.get('/api/session')).body.csrfToken;
      csrf = (
        await post('/api/sign-in', {
          method: 'email',
          email: `${clinicCode}@example.invalid`,
          password,
        })
      ).body.csrfToken;
    };
    await login('Fictional-initial-pass-1');
    await post('/api/onboarding/password', {
      password: 'Fictional-replacement-pass-2',
    });
    await login('Fictional-replacement-pass-2');
    expect(
      (
        await post('/api/onboarding/email', {
          email: `${clinicCode}@example.invalid`,
        })
      ).status,
    ).toBe(503);
    expect((await post('/api/onboarding/verify-email', { token: delivered })).status).toBe(400);
    failDelivery = false;
    await post('/api/onboarding/email', {
      email: `${clinicCode}@example.invalid`,
    });
    const expiredToken = delivered;
    time += 24 * 60 * 60 * 1000;
    await login('Fictional-replacement-pass-2');
    expect((await post('/api/onboarding/verify-email', { token: expiredToken })).status).toBe(400);
    await post('/api/onboarding/email', {
      email: `${clinicCode}@example.invalid`,
    });
    const responses = await Promise.all([
      post('/api/onboarding/verify-email', { token: delivered }),
      post('/api/onboarding/verify-email', { token: delivered }),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 400]);
    const batch = responses.find((response) => response.status === 200)!.body;
    expect((await post('/api/onboarding/codes', { password: 'wrong' })).status).toBe(401);
    const replacement = await post('/api/onboarding/codes', {
      password: 'Fictional-replacement-pass-2',
    });
    expect(replacement.status).toBe(200);
    expect(replacement.body.codes.some((code: string) => batch.codes.includes(code))).toBe(false);
    expect(
      (
        await post('/api/onboarding/codes-saved', {
          batchId: batch.batchId,
          saved: true,
        })
      ).status,
    ).toBe(409);
    expect(
      (
        await post('/api/onboarding/codes-saved', {
          batchId: replacement.body.batchId,
          saved: true,
        })
      ).status,
    ).toBe(204);
    expect((await browser.get('/api/clinic')).status).toBe(200);
    time += 12 * 60 * 60 * 1000;
    expect((await browser.get('/api/clinic')).status).toBe(401);
  });
});
