import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { expect, it } from 'vitest';
import { openDatabase } from '../src/database.js';
import { provisionClinic } from '../src/modules/identity/index.js';
import { createApplication } from '../src/application.js';

it('authenticates a primary manager by normalized email, limits activation, and rejects username bypass', async () => {
  const db = openDatabase(`postgresql://clinic_test:fictional-only@127.0.0.1:${process.env.CLINIC_TEST_PORT ?? "55437"}/clinic_issue7`);
  const runtime = openDatabase(
    `postgresql://clinic_runtime_test:fictional-runtime-only@127.0.0.1:${process.env.CLINIC_TEST_PORT ?? "55437"}/clinic_issue7`,
  );
  const code = `email-${randomUUID()}`.slice(0, 32);
  const email = `${randomUUID()}@example.invalid`;
  try {
    await provisionClinic(db, {
      clinicCode: code,
      clinicName: 'Fictive',
      username: 'manager',
      displayName: 'Manager',
      email,
      temporaryPassword: 'Fictional-initial-pass-1',
    });
    const app = createApplication({
      database: runtime,
      origin: 'http://localhost:4173',
      secureCookies: false,
      sessionSecret: 'fictional-test-session-secret-at-least-32-characters',
    });
    const browser = request.agent(app);
    const csrf = (await browser.get('/api/session')).body.csrfToken;
    const post = (body: object) =>
      browser
        .post('/api/sign-in')
        .set('Origin', 'http://localhost:4173')
        .set('x-csrf-token', csrf)
        .send(body);
    expect(
      (
        await post({
          method: 'clinic_username',
          clinicCode: code,
          username: 'manager',
          password: 'Fictional-initial-pass-1',
        })
      ).status,
    ).toBe(401);
    expect(
      (
        await post({
          method: 'email',
          email: ` ${email.toUpperCase()} `,
          password: 'Fictional-initial-pass-1',
        })
      ).status,
    ).toBe(200);
    expect((await browser.get('/api/clinic')).status).toBe(403);
    expect((await browser.get('/api/identity')).body).toMatchObject({
      loginMethod: 'email',
      isManager: true,
      stage: 'password',
    });
  } finally {
    await runtime.close();
    await db.close();
  }
});
it('keeps employee login when a doctor receives manager authority and enforces manager setup', async () => {
  const db = openDatabase(`postgresql://clinic_test:fictional-only@127.0.0.1:${process.env.CLINIC_TEST_PORT ?? "55437"}/clinic_issue7`);
  const runtime = openDatabase(
    `postgresql://clinic_runtime_test:fictional-runtime-only@127.0.0.1:${process.env.CLINIC_TEST_PORT ?? "55437"}/clinic_issue7`,
  );
  const email = `${randomUUID()}@example.invalid`;
  const code = `doctor-${randomUUID()}`.slice(0, 32);
  try {
    await provisionClinic(db, {
      clinicCode: code,
      clinicName: 'Fictive',
      username: 'manager',
      displayName: 'Manager',
      email,
      temporaryPassword: 'Fictional-initial-pass-1',
    });
    // Operator-only fixture: account administration/promotion endpoints belong to #8.
    const { hash } = await import('argon2');
    const clinic = await db.client.clinic.findUniqueOrThrow({
      where: { code },
    });
    const doctor = await db.client.account.create({
      data: {
        clinicId: clinic.id,
        username: 'doctor',
        displayName: 'Docteur',
        passwordHash: await hash('Fictional-doctor-pass-1'),
      },
    });
    const app = createApplication({
      database: runtime,
      origin: 'http://localhost:4173',
      secureCookies: false,
      sessionSecret: 'fictional-test-session-secret-at-least-32-characters',
    });
    const browser = request.agent(app);
    let csrf = (await browser.get('/api/session')).body.csrfToken;
    const post = (path: string, body: object) =>
      browser
        .post(path)
        .set('Origin', 'http://localhost:4173')
        .set('x-csrf-token', csrf)
        .send(body);
    const credentials = {
      method: 'clinic_username',
      clinicCode: code,
      username: ' DOCTOR ',
      password: 'Fictional-doctor-pass-1',
    };
    csrf = (await post('/api/sign-in', credentials)).body.csrfToken;
    expect((await browser.get('/api/identity')).body).toMatchObject({
      isManager: false,
      loginMethod: 'clinic_username',
      stage: 'ready',
    });
    expect((await post('/api/onboarding/codes', { password: credentials.password })).status).toBe(
      409,
    );
    await db.client.account.update({
      where: { id: doctor.id },
      data: { isManager: true, credentialVersion: { increment: 1 } },
    });
    expect((await browser.get('/api/identity')).status).toBe(401);
    csrf = (await post('/api/sign-in', credentials)).body.csrfToken;
    expect((await browser.get('/api/identity')).body).toMatchObject({
      isManager: true,
      loginMethod: 'clinic_username',
      stage: 'email',
    });
    expect((await browser.get('/api/clinic')).status).toBe(403);
    expect(
      (
        await post('/api/sign-in', {
          method: 'email',
          email,
          password: credentials.password,
        })
      ).status,
    ).toBe(401);
  } finally {
    await runtime.close();
    await db.close();
  }
});

it('reserves primary manager emails globally and exposes only exact email matches before authentication', async () => {
  const db = openDatabase(`postgresql://clinic_test:fictional-only@127.0.0.1:${process.env.CLINIC_TEST_PORT ?? "55437"}/clinic_issue7`);
  const runtime = openDatabase(
    `postgresql://clinic_runtime_test:fictional-runtime-only@127.0.0.1:${process.env.CLINIC_TEST_PORT ?? "55437"}/clinic_issue7`,
  );
  const email = `${randomUUID()}@example.invalid`;
  const record = (suffix: string) => ({
    clinicCode: `unique-${randomUUID()}`.slice(0, 32),
    clinicName: suffix,
    username: 'manager',
    displayName: 'Manager',
    email,
    temporaryPassword: 'Fictional-initial-pass-1',
  });
  try {
    const outcomes = await Promise.allSettled([
      provisionClinic(db, record('A')),
      provisionClinic(db, {
        ...record('B'),
        email: ` ${email.toUpperCase()} `,
      }),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1);
    expect(await runtime.client.account.findMany()).toEqual([]);
    await runtime.client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT set_config('app.login_email', ${email}, true)`;
      expect(await tx.account.findMany({ select: { loginEmail: true } })).toEqual([
        { loginEmail: email },
      ]);
      expect((await tx.account.updateMany({ data: { displayName: 'Forbidden' } })).count).toBe(0);
      expect(await tx.clinic.findMany()).toEqual([]);
    });
    expect(await runtime.client.account.findMany()).toEqual([]);
  } finally {
    await runtime.close();
    await db.close();
  }
});
it('retains primary email login after manager authority is removed without bypassing email verification', async () => {
  const db = openDatabase(`postgresql://clinic_test:fictional-only@127.0.0.1:${process.env.CLINIC_TEST_PORT ?? "55437"}/clinic_issue7`);
  const runtime = openDatabase(
    `postgresql://clinic_runtime_test:fictional-runtime-only@127.0.0.1:${process.env.CLINIC_TEST_PORT ?? "55437"}/clinic_issue7`,
  );
  const email = `${randomUUID()}@example.invalid`;
  const code = `demote-${randomUUID()}`.slice(0, 32);
  try {
    await provisionClinic(db, {
      clinicCode: code,
      clinicName: 'Fictive',
      username: 'manager',
      displayName: 'Manager',
      email,
      temporaryPassword: 'Fictional-initial-pass-1',
    });
    const account = await db.client.account.findUniqueOrThrow({ where: { loginEmail: email } });
    // Operator-only fixture for #8 demotion; no account-management API added.
    await db.client.account.update({
      where: { id: account.id },
      data: { isManager: false, temporaryExpiresAt: null, credentialVersion: { increment: 1 } },
    });
    let token = '';
    const app = createApplication({
      database: runtime,
      origin: 'http://localhost:4173',
      secureCookies: false,
      sessionSecret: 'fictional-test-session-secret-at-least-32-characters',
      mail: {
        async sendVerification(message) {
          token = message.token;
        },
      },
    });
    const browser = request.agent(app);
    let csrf = (await browser.get('/api/session')).body.csrfToken;
    const login = async () => {
      const result = await browser
        .post('/api/sign-in')
        .set('Origin', 'http://localhost:4173')
        .set('x-csrf-token', csrf)
        .send({ method: 'email', email, password: 'Fictional-initial-pass-1' });
      expect(result.status).toBe(200);
      csrf = result.body.csrfToken;
    };
    await login();
    expect((await browser.get('/api/identity')).body).toMatchObject({
      isManager: false,
      loginMethod: 'email',
      stage: 'email',
    });
    expect((await browser.get('/api/clinic')).status).toBe(403);
    const post = (path: string, body: object) =>
      browser
        .post(path)
        .set('Origin', 'http://localhost:4173')
        .set('x-csrf-token', csrf)
        .send(body);
    expect((await post('/api/onboarding/email', { email })).status).toBe(202);
    const verified = await post('/api/onboarding/verify-email', { token });
    expect(verified.status).toBe(200);
    expect(verified.body).toBeNull();
    await login();
    expect((await browser.get('/api/identity')).body).toMatchObject({
      isManager: false,
      loginMethod: 'email',
      stage: 'ready',
    });
    expect((await browser.get('/api/clinic')).status).toBe(200);
  } finally {
    await runtime.close();
    await db.close();
  }
});
