import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import request from 'supertest';
import { test, expect, type Page } from '@playwright/test';
import { openDatabase } from '../../api/src/database.js';
import { createApplication } from '../../api/src/application.js';
import { provisionClinic } from '../../api/src/modules/identity/index.js';
const owner = openDatabase(
  `postgresql://clinic_test:fictional-only@127.0.0.1:${process.env.CLINIC_TEST_PORT ?? "55437"}/clinic_issue7`,
);
const runtime = openDatabase(
  `postgresql://clinic_runtime_test:fictional-runtime-only@127.0.0.1:${process.env.CLINIC_TEST_PORT ?? "55437"}/clinic_issue7`,
);
const code = `patients-${randomUUID()}`.slice(0, 32);
const email = `${code}@example.invalid`;
const password = 'Fictional-patients-personal';
let server: Server;
let token = '';
let manager: ReturnType<typeof request.agent>;
let csrf = '';
let requestCounts = new Map<string, number>();
let doctorId = '';
const createBrowserApp = () =>
  createApplication({
    database: runtime,
    sessionSecret: 'fictional-patient-browser-secret-long-enough',
    origin: 'http://127.0.0.1:4173',
    secureCookies: false,
    mail: {
      async sendVerification(m) {
        token = m.token;
      },
    },
  });
const post = (path: string, body: object) =>
  manager
    .post(`/api/${path}`)
    .set('Origin', 'http://127.0.0.1:4173')
    .set('x-csrf-token', csrf)
    .send(body);
test.beforeAll(async () => {
  await owner.connect();
  await runtime.connect();
  await provisionClinic(owner, {
    clinicCode: code,
    clinicName: 'Clinique patients fictifs',
    username: 'manager',
    displayName: 'Accueil',
    email,
    temporaryPassword: 'Fictional-patients-initial',
  });
  server = createBrowserApp().listen(3000, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  manager = request.agent('http://127.0.0.1:3000');
  csrf = (await manager.get('/api/session')).body.csrfToken;
  csrf = (
    await post('sign-in', {
      method: 'email',
      email,
      password: 'Fictional-patients-initial',
    })
  ).body.csrfToken;
  await post('onboarding/password', { password });
  csrf = (await manager.get('/api/session')).body.csrfToken;
  csrf = (await post('sign-in', { method: 'email', email, password })).body
    .csrfToken;
  await post('onboarding/email', { email });
  const codes = await post('onboarding/verify-email', { token });
  await post('onboarding/codes-saved', {
    batchId: codes.body.batchId,
    saved: true,
  });
  const identity = (await manager.get('/api/identity')).body;
  await post(`accounts/${identity.accountId}/permissions`, {
    revision: 0,
    currentPassword: password,
    permissions: ['patients.create', 'catalog.manage', 'appointments.manage'],
  });
  const account = (
    await post('accounts', {
      username: 'doctor',
      displayName: 'Dentiste fictif',
      kind: 'doctor',
      temporaryPassword: 'Fictional-doctor-temporary',
      currentPassword: password,
    })
  ).body;
  doctorId = account.id;
  await post(`accounts/${doctorId}/permissions`, {
    revision: 0,
    currentPassword: password,
    permissions: [
      'clinical.read',
      'clinical.history',
      'history.draft',
      'history.finalize',
      'chart.draft',
      'chart.finalize',
      'plans.draft',
      'procedures.start',
      'procedures.complete',
      'plans.finalize',
      'plans.accept',
      'acceptance.draft',
      'clinical.print',
      'prices.override',
      'discounts',
    ],
  });
  const employee = request.agent('http://127.0.0.1:3000');
  let employeeCsrf = (await employee.get('/api/session')).body.csrfToken;
  const employeePost = (path: string, body: object) =>
    employee
      .post(`/api/${path}`)
      .set('Origin', 'http://127.0.0.1:4173')
      .set('x-csrf-token', employeeCsrf)
      .send(body);
  employeeCsrf = (
    await employeePost('sign-in', {
      method: 'clinic_username',
      clinicCode: code,
      username: 'doctor',
      password: 'Fictional-doctor-temporary',
    })
  ).body.csrfToken;
  await employeePost('onboarding/password', {
    password: 'Fictional-doctor-personal',
  });
  await post('catalog/currencies', { commandId: randomUUID(), code: 'MRU' });
  await post('catalog', {
    commandId: randomUUID(),
    id: randomUUID(),
    revision: 0,
    name: 'Restauration fictive',
    currency: 'MRU',
    price: '100.00',
    durationMinutes: 45,
    active: true,
  });
});

test.beforeEach(async ({ page }) => {
  requestCounts = new Map();
  page.on('request', (r) => {
    const path = new URL(r.url()).pathname;
    if (path.startsWith('/api'))
      requestCounts.set(path, (requestCounts.get(path) ?? 0) + 1);
  });
  page.on('dialog', (dialog) => dialog.accept());
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  server = createBrowserApp().listen(3000, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
});
test.afterEach(async ({ page }) => {
  console.log('REQUEST COUNTS', Object.fromEntries(requestCounts));
  const logout = page.getByRole('button', {
    name: 'Se déconnecter',
    exact: true,
  });
  if (await logout.isVisible()) {
    await logout.click();
    await expect(
      page.getByRole('button', { name: 'Se connecter', exact: true }),
    ).toBeVisible();
  }
  await page.goto('about:blank');
  // Complete an authenticated DB round trip after the page closes its SSE stream.
  await manager.get('/api/clinic');
});
test.afterAll(async () => {
  server?.closeAllConnections();
  if (server)
    await new Promise<void>((resolve) => server.close(() => resolve()));
  await runtime.close();
  await owner.close();
});
async function patient() {
  return (
    await post('patients', {
      commandId: randomUUID(),
      name: `Patient accès ${randomUUID().slice(0, 6)}`,
      phone: '70000000',
      contactKind: 'patient',
      contactName: '',
    })
  ).body.patient;
}

async function loginDoctor(page: Page) {
  await page.goto('/');
  await page.getByLabel('Mode de connexion').selectOption('clinic_username');
  await page.getByLabel('Code de la clinique').fill(code);
  await page.getByLabel('Identifiant', { exact: true }).fill('doctor');
  await page
    .getByLabel('Mot de passe', { exact: true })
    .fill('Fictional-doctor-personal');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(
    page.getByRole('heading', { name: 'Clinique patients fictifs' }),
  ).toBeVisible();
}
async function grant() {
  const p = await patient();
  expect(
    (
      await post(`patient-access/${p.id}/share`, {
        commandId: randomUUID(),
        revision: 0,
        accountId: doctorId,
        kind: 'assigned',
      })
    ).status,
  ).toBe(200);
  return p;
}

async function acceptedPatient() {
  const p = await grant();
  const browser = request.agent('http://127.0.0.1:3000');
  let token = (await browser.get('/api/session')).body.csrfToken;
  const send = (path: string, body: object) =>
    browser
      .post(`/api/${path}`)
      .set('Origin', 'http://127.0.0.1:4173')
      .set('x-csrf-token', token)
      .send(body);
  token = (
    await send('sign-in', {
      method: 'clinic_username',
      clinicCode: code,
      username: 'doctor',
      password: 'Fictional-doctor-personal',
    })
  ).body.csrfToken;
  const catalog = (await browser.get('/api/catalog')).body.entries[0];
  const planId = randomUUID();
  const planPath = `treatment/${p.id}/plans`;
  expect(
    (
      await send(planPath, {
        commandId: randomUUID(),
        id: planId,
        revision: 0,
        title: 'Soins fictifs acceptés',
        currency: 'MRU',
        items: [1, 2].map(() => ({
          id: randomUUID(),
          procedureId: catalog.id,
          catalogRevision: catalog.revision,
          scope: 'whole_mouth',
          teeth: [],
          price: '90',
          discount: '5',
          discountReason: 'Tarif famille',
        })),
      })
    ).status,
  ).toBe(200);
  for (const [action, revision, extra] of [
    ['present', 1, {}],
    [
      'evidence',
      2,
      {
        acceptedBy: 'Patient fictif',
        acceptedAt: '2026-10-16T12:00:00.000Z',
        method: 'Oral',
      },
    ],
    ['accept', 3, {}],
  ] as const)
    expect(
      (
        await send(`${planPath}/lifecycle`, {
          commandId: randomUUID(),
          id: planId,
          revision,
          action,
          ...extra,
        })
      ).status,
    ).toBe(200);
  // Fictional fixture HTTP setup must not consume the human journey's IP budget.
  // Restart only before browser login; sessions and records remain in real PostgreSQL.
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  server = createBrowserApp().listen(3000, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  return { p, send, planId, browser };
}
test('French care journey retries a lost response, ends visits separately, and completes each procedure explicitly', async ({
  page,
}) => {
  const errors: string[] = [],
    logs: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (
      ['error', 'warning'].includes(m.type()) &&
      !m.text().includes('status of 401') &&
      !m.text().includes('ERR_FAILED')
    )
      logs.push(m.text());
  });
  const { p } = await acceptedPatient();
  await loginDoctor(page);
  await page
    .getByRole('button', {
      name: `Ouvrir le dossier n°${p.patientNumber} — ${p.name}`,
      exact: true,
    })
    .click();
  const visits = page.getByRole('region', {
    name: 'Visites et actes réalisés',
    exact: true,
  });
  await visits.getByRole('checkbox').nth(0).focus();
  await page.keyboard.press('Space');
  await page.keyboard.press('Tab');
  await expect(visits.getByRole('checkbox').nth(1)).toBeFocused();
  await page.keyboard.press('Space');
  let intercepted = false;
  await page.route(`**/api/treatment/${p.id}/visits`, async (route) => {
    if (route.request().method() === 'POST' && !intercepted) {
      intercepted = true;
      await route.fetch();
      await route.abort();
    } else await route.continue();
  });
  await visits
    .getByRole('button', {
      name: 'Démarrer les soins sélectionnés',
      exact: true,
    })
    .click();
  await expect(
    visits.getByText('Réponse incertaine.', { exact: false }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', {
      name: `Ouvrir le dossier n°${p.patientNumber} — ${p.name}`,
      exact: true,
    }),
  ).toBeDisabled();
  await visits
    .getByRole('button', { name: 'Réessayer la même commande', exact: true })
    .click();
  await expect(
    visits.getByText('Visite en cours', { exact: true }),
  ).toBeVisible();
  await expect(
    visits.getByText('Actes commencés : 2', { exact: true }),
  ).toBeVisible();
  await visits
    .getByRole('button', { name: 'Terminer la visite', exact: true })
    .click();
  await expect(
    visits.getByText('Visite terminée', { exact: true }),
  ).toHaveCount(1);
  await expect(
    visits.getByText('Actes terminés : 0', { exact: true }),
  ).toBeVisible();
  const booked = await post('appointments', {
    commandId: randomUUID(),
    patientId: p.id,
    dentistId: doctorId,
    chairId: null,
    startsAt: '2026-10-17T11:00:00.000Z',
    durationMinutes: 30,
  });
  expect(booked.status).toBe(201);
  await expect(
    visits.getByLabel('Origine de la visite').locator('option'),
  ).toHaveCount(2);
  await visits.getByLabel('Origine de la visite').selectOption(booked.body.id);
  await visits.getByRole('checkbox').nth(0).check();
  await visits.getByRole('checkbox').nth(1).check();
  await visits
    .getByRole('button', {
      name: 'Démarrer les soins sélectionnés',
      exact: true,
    })
    .click();
  await expect(
    visits.getByText('Visite en cours', { exact: true }),
  ).toBeVisible();
  await visits.getByRole('button', { name: /Terminer l’acte 1/ }).click();
  await expect(
    visits.getByText('Actes terminés : 1', { exact: true }),
  ).toBeVisible();
  await expect(
    visits.getByRole('button', { name: /Terminer l’acte 2/ }),
  ).toBeEnabled();
  for (const width of [320, 768, 1024, 1440, 375]) {
    await page.setViewportSize({ width, height: 900 });
    await visits.locator('.visit-record').last().scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: join(tmpdir(), `clinic-15-visits-${width}.png`),
    });
  }
  await visits.getByRole('button', { name: /Terminer l’acte 2/ }).click();
  await expect(
    visits.getByText('Actes terminés : 2', { exact: true }),
  ).toBeVisible();
  await visits
    .getByRole('button', { name: 'Terminer la visite', exact: true })
    .click();
  await expect(
    visits.getByText('Visite terminée', { exact: true }),
  ).toHaveCount(2);
  await expect(
    visits.getByText('Actes commencés : 2', { exact: true }),
  ).toBeVisible();
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  await expect(page).toHaveTitle('Dentara · Connexion');
  expect(page.url()).toBe('http://127.0.0.1:4173/');
  expect(errors).toEqual([]);
  expect(logs).toEqual([]);
});

test('booked care works for a doctor who also manages the agenda', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const { p } = await acceptedPatient();
  const account = (await manager.get('/api/accounts')).body.find(
    (a: { id: string }) => a.id === doctorId,
  );
  expect(
    (
      await post(`accounts/${doctorId}/permissions`, {
        revision: account.revision,
        currentPassword: password,
        permissions: [...account.permissions, 'appointments.manage'],
      })
    ).status,
  ).toBe(200);
  const booked = await post('appointments', {
    commandId: randomUUID(),
    patientId: p.id,
    dentistId: doctorId,
    chairId: null,
    startsAt: '2026-10-17T14:00:00.000Z',
    durationMinutes: 30,
  });
  expect(booked.status).toBe(201);
  await loginDoctor(page);
  await page
    .getByRole('button', {
      name: `Ouvrir le dossier n°${p.patientNumber} — ${p.name}`,
      exact: true,
    })
    .click();
  const visits = page.getByRole('region', {
    name: 'Visites et actes réalisés',
    exact: true,
  });
  await visits.getByLabel('Origine de la visite').selectOption(booked.body.id);
  await visits.getByRole('checkbox').first().check();
  await visits
    .getByRole('button', {
      name: 'Démarrer les soins sélectionnés',
      exact: true,
    })
    .click();
  await expect(
    visits.getByText('Visite en cours', { exact: true }),
  ).toBeVisible();
  await visits.getByRole('button', { name: /Terminer l’acte 1/ }).click();
  await expect(
    visits.getByText('Actes terminés : 1', { exact: true }),
  ).toBeVisible();
  await visits
    .getByRole('button', { name: 'Terminer la visite', exact: true })
    .click();
  await expect(
    visits.getByText('Visite terminée', { exact: true }),
  ).toHaveCount(1);
  const agenda = (await manager.get('/api/appointments?date=2026-10-17')).body;
  expect(
    agenda.appointments.find((a: { id: string }) => a.id === booked.body.id)
      .status,
  ).toBe('completed');
  expect(errors).toEqual([]);
});

test('remote completion prunes hidden checked procedures only after explicit rereview', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const { p, send, planId, browser } = await acceptedPatient();
  const account = (await manager.get('/api/accounts')).body.find(
    (a: { id: string }) => a.id === doctorId,
  );
  await post(`accounts/${doctorId}/permissions`, {
    revision: account.revision,
    currentPassword: password,
    permissions: account.permissions.filter(
      (p: string) => p !== 'appointments.manage',
    ),
  });
  const plan = (await browser.get(`/api/treatment/${p.id}/plans`)).body[0];
  await loginDoctor(page);
  await page
    .getByRole('button', {
      name: `Ouvrir le dossier n°${p.patientNumber} — ${p.name}`,
      exact: true,
    })
    .click();
  const visits = page.getByRole('region', {
    name: 'Visites et actes réalisés',
    exact: true,
  });
  await visits.getByRole('checkbox').nth(0).check();
  await visits.getByRole('checkbox').nth(1).check();
  const id = randomUUID(),
    path = `treatment/${p.id}/visits`;
  expect(
    (
      await send(path, {
        commandId: randomUUID(),
        id,
        appointmentId: null,
        procedures: [{ planId, itemId: plan.items[0].id, planRevision: 4 }],
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await send(`${path}/actions`, {
        commandId: randomUUID(),
        id,
        revision: 1,
        action: 'complete',
        planId,
        itemId: plan.items[0].id,
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await send(`${path}/actions`, {
        commandId: randomUUID(),
        id,
        revision: 2,
        action: 'end',
      })
    ).status,
  ).toBe(200);
  await expect(visits.getByRole('checkbox')).toHaveCount(1);
  await visits
    .getByRole('button', {
      name: 'Relire les plans pour les soins',
      exact: true,
    })
    .click();
  await expect(visits.getByRole('checkbox')).toBeChecked();
  await visits
    .getByRole('button', {
      name: 'Démarrer les soins sélectionnés',
      exact: true,
    })
    .click();
  await expect(
    visits.getByText('Visite en cours', { exact: true }),
  ).toBeVisible();
  await expect(
    visits.getByText('Actes commencés : 2', { exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});
