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
  csrf = (await post('sign-in', { method: 'email', email, password })).body.csrfToken;
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
    permissions: ['patients.create', 'appointments.manage', 'appointments.override'],
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
    permissions: ['clinical.read', 'notes.draft'],
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
});

test.beforeEach(async () => {
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  server = createBrowserApp().listen(3000, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
});
test.afterEach(async ({ page }) => {
  await page.goto('about:blank');
  // Complete an authenticated DB round trip after the page closes its SSE stream.
  await manager.get('/api/clinic');
});
test.afterAll(async () => {
  server?.closeAllConnections();
  if (server) await new Promise<void>((resolve) => server.close(() => resolve()));
  await runtime.close();
  await owner.close();
});
async function login(page: Page) {
  await page.goto('/');
  await page.getByLabel('Adresse e-mail de connexion').fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('heading', { name: 'Clinique patients fictifs' })).toBeVisible();
}

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
test('French appointment booking, status, reschedule and cancellation journey with responsive evidence', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error' && !m.text().includes('401')) errors.push(m.text());
  });
  const p = await patient();
  await login(page);
  const panel = page.getByRole('region', {
    name: 'Agenda des rendez-vous',
    exact: true,
  });
  await expect(panel.getByRole('heading', { name: 'Agenda des rendez-vous' })).toBeVisible();
  const date = new Date().toISOString().slice(0, 10);
  await panel.getByLabel('Patient', { exact: true }).selectOption(p.id);
  await panel.getByLabel('Dentiste', { exact: true }).selectOption(doctorId);
  await panel.getByLabel('Début · heure de Nouakchott (UTC)').fill(`${date}T09:00`);
  await panel.getByLabel('Fauteuil (facultatif)').selectOption('Fauteuil 1');
  await panel.getByRole('button', { name: 'Enregistrer le rendez-vous', exact: true }).click();
  await expect(
    panel.getByRole('status').filter({ hasText: 'Modification enregistrée.' }),
  ).toBeVisible();
  await expect(panel.getByText('Réservé', { exact: false })).toBeVisible();
  await panel.getByRole('button', { name: `Gérer le rendez-vous de ${p.name}` }).click();
  await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/status') && r.request().method() === 'POST'),
    panel.getByRole('button', { name: 'Confirmé', exact: true }).click(),
  ]);
  await expect(panel.getByRole('heading', { name: 'Rendez-vous de ' + p.name })).toHaveCount(0);
  await panel.getByRole('button', { name: `Gérer le rendez-vous de ${p.name}` }).click();
  await expect(panel.getByText('État : Confirmé')).toBeVisible();
  await panel.getByLabel('Début · heure de Nouakchott (UTC)').fill(`${date}T10:00`);
  await panel.getByRole('button', { name: 'Enregistrer le déplacement' }).click();
  await panel.getByRole('button', { name: `Gérer le rendez-vous de ${p.name}` }).click();
  await panel.getByText('Historique du rendez-vous', { exact: true }).click();
  await expect(panel.getByText(/Déplacement · Confirmé/)).toBeVisible();
  await page.setViewportSize({ width: 1440, height: 900 });
  await panel.screenshot({
    path: join(tmpdir(), 'clinic-scheduling-desktop.png'),
  });
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(panel.getByRole('heading', { name: 'Agenda des rendez-vous' })).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await panel.screenshot({
    path: join(tmpdir(), 'clinic-scheduling-mobile.png'),
  });
  await panel.getByLabel('Motif d’annulation (facultatif)').fill('Patient indisponible');
  page.once('dialog', (dialog) => dialog.accept());
  await panel.getByRole('button', { name: 'Annulé', exact: true }).click();
  await expect(panel.getByText(/Annulé/)).toBeVisible();
  await page.keyboard.press('Tab');
  expect(errors).toEqual([]);
  expect(await page.title()).toContain('Dentara');
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
});
test('lost booking responses retry the same command, stale edits reconcile, and settings preserve the appointment draft', async ({
  page,
}) => {
  const p = await patient();
  await login(page);
  const panel = page.getByRole('region', { name: 'Agenda des rendez-vous', exact: true });
  await panel.getByLabel('Jour', { exact: true }).fill('2026-12-01');
  await panel.getByLabel('Patient', { exact: true }).selectOption(p.id);
  await panel.getByLabel('Dentiste', { exact: true }).selectOption(doctorId);
  await panel.getByLabel('Début · heure de Nouakchott (UTC)').fill('2026-12-01T09:00');
  const commands: string[] = [];
  let lost = false;
  await page.route('**/api/appointments', async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    commands.push(route.request().postData() ?? '');
    if (!lost) {
      lost = true;
      await route.fetch();
      await route.abort('failed');
    } else await route.continue();
  });
  await panel.getByRole('button', { name: 'Enregistrer le rendez-vous', exact: true }).click();
  await expect(panel.getByText(/Réponse incertaine/)).toBeVisible();
  await expect(panel.getByLabel('Patient', { exact: true })).toBeDisabled();
  await panel.getByRole('button', { name: 'Réessayer la même demande' }).click();
  await expect(panel.getByText('Modification enregistrée.', { exact: true })).toBeVisible();
  expect(commands).toHaveLength(2);
  expect(commands[0]).toBe(commands[1]);
  await page.unroute('**/api/appointments');
  const a = (await manager.get('/api/appointments?date=2026-12-01')).body.appointments.find(
    (v: { patientId: string }) => v.patientId === p.id,
  );
  await panel.getByRole('button', { name: `Gérer le rendez-vous de ${p.name}` }).click();
  await panel.getByLabel('Durée (minutes)', { exact: true }).fill('77');
  await post(`appointments/${a.id}/status`, {
    commandId: randomUUID(),
    revision: 0,
    status: 'confirmed',
  });
  await panel.getByRole('button', { name: 'Enregistrer le déplacement' }).click();
  await expect(panel.getByRole('alert')).toContainText('a changé');
  await expect(panel.getByLabel('Durée (minutes)', { exact: true })).toHaveValue('77');
  page.once('dialog', (dialog) => dialog.accept());
  await panel.getByRole('button', { name: 'Recharger et réconcilier' }).click();
  await expect(panel.getByText('État : Confirmé')).toBeVisible();
  await expect(panel.getByLabel('Durée (minutes)', { exact: true })).toHaveValue('30');
  await panel.getByLabel('Durée (minutes)', { exact: true }).fill('77');
  await panel.getByText('Paramètres de l’agenda', { exact: true }).click();
  await panel.getByLabel('Durée par défaut (minutes)', { exact: true }).fill('41');
  await panel.getByRole('button', { name: 'Enregistrer les paramètres' }).click();
  await expect(panel.getByText('Modification enregistrée.', { exact: true })).toBeVisible();
  await expect(panel.getByLabel('Durée (minutes)', { exact: true })).toHaveValue('77');
  await expect(panel.getByText('État : Confirmé')).toBeVisible();
  await panel.getByText('Paramètres de l’agenda', { exact: true }).click();
  await panel.getByLabel('Durée par défaut (minutes)', { exact: true }).fill('42');
  await panel.getByRole('button', { name: 'Enregistrer le déplacement' }).click();
  await expect(panel.getByText('Modification enregistrée.', { exact: true })).toBeVisible();
  await expect(panel.getByLabel('Durée par défaut (minutes)', { exact: true })).toHaveValue(
    '42',
  );
});

test('a failed patient search preserves the booking draft until choices can be retried', async ({
  page,
}) => {
  const p = await patient();
  await login(page);
  const panel = page.getByRole('region', {
    name: 'Agenda des rendez-vous',
    exact: true,
  });
  await panel.getByLabel('Jour', { exact: true }).fill('2026-12-02');
  await panel.getByLabel('Patient', { exact: true }).selectOption(p.id);
  await panel.getByLabel('Dentiste', { exact: true }).selectOption(doctorId);
  await panel
    .getByLabel('Début · heure de Nouakchott (UTC)')
    .fill('2026-12-02T11:00');
  await panel.getByLabel('Durée (minutes)', { exact: true }).fill('65');
  await page.route('**/api/appointments/choices?*', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Recherche temporairement indisponible.' }),
    }),
  );
  await panel
    .getByLabel('Rechercher un patient par nom ou numéro')
    .fill('autre recherche');
  await panel
    .getByRole('button', { name: 'Rechercher dans les patients' })
    .click();
  await expect(panel.getByRole('alert')).toContainText(
    'Recherche temporairement indisponible.',
  );
  await expect(panel.getByLabel('Patient', { exact: true })).toHaveValue(p.id);
  await expect(
    panel.getByLabel('Durée (minutes)', { exact: true }),
  ).toHaveValue('65');
  await expect(
    panel.getByLabel('Début · heure de Nouakchott (UTC)'),
  ).toHaveValue('2026-12-02T11:00');
  await page.unroute('**/api/appointments/choices?*');
  await panel
    .getByLabel('Rechercher un patient par nom ou numéro')
    .fill(p.name);
  await panel
    .getByRole('button', { name: 'Rechercher dans les patients' })
    .click();
  await expect(panel.getByRole('alert')).toHaveCount(0);
  await expect(panel.getByLabel('Patient', { exact: true })).toHaveValue(p.id);
  await expect(
    panel.getByLabel('Durée (minutes)', { exact: true }),
  ).toHaveValue('65');
  await panel
    .getByRole('button', { name: 'Enregistrer le rendez-vous', exact: true })
    .click();
  await expect(
    panel.getByText('Modification enregistrée.', { exact: true }),
  ).toBeVisible();
  const saved = (await manager.get('/api/appointments?date=2026-12-02')).body
    .appointments;
  expect(saved).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        patientId: p.id,
        durationMinutes: 65,
        startsAt: '2026-12-02T11:00:00.000Z',
      }),
    ]),
  );
});
