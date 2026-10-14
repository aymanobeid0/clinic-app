import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import request from 'supertest';
import { test, expect, type Page } from '@playwright/test';
import { openDatabase } from '../../api/src/database.js';
import { createApplication } from '../../api/src/application.js';
import { provisionClinic } from '../../api/src/modules/identity/index.js';
const owner = openDatabase('postgresql://clinic_test:fictional-only@127.0.0.1:55437/clinic_issue7');
const runtime = openDatabase(
  'postgresql://clinic_runtime_test:fictional-runtime-only@127.0.0.1:55437/clinic_issue7',
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
    permissions: ['patients.create'],
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
async function openPatient(page: Page, id: number) {
  await page.getByRole('button', { name: `Choisir ce patient n°${id}`, exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Accès du patient' })).toBeVisible();
  await page.getByLabel('Médecin ou personnel autorisé').selectOption(doctorId);
}
test('French manager shares without operational read permission and removes an explicitly confirmed grant', async ({
  page,
}) => {
  const errors: string[] = [];
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    // Normal signed-out session discovery returns 401 and renders sign-in.
    if (
      message.text().includes('status of 401') &&
      new URL(message.location().url || 'http://localhost').pathname === '/api/identity'
    )
      return;
    if (message.type() === 'error' || message.type() === 'warning')
      consoleErrors.push(message.text());
  });
  page.on('pageerror', (e) => errors.push(e.message));
  const p = await patient();
  await login(page);
  const panel = page.getByRole('region', { name: 'Attribution et partage' });
  await expect(panel).toBeVisible();
  await openPatient(page, p.patientNumber);
  await page.getByLabel('Type d’accès').selectOption('assigned');
  await page.getByRole('button', { name: 'Confirmer le partage' }).click();
  await expect(page.getByRole('list', { name: 'Accès actifs' })).toContainText(
    'Dentiste fictif — Accès attribué',
  );
  await page.getByRole('region', { name: 'Attribution et partage' }).screenshot({
    path: join(tmpdir(), 'clinic-access-desktop.png'),
  });
  page.once('dialog', (dialog) => dialog.accept());
  await page.getByRole('button', { name: 'Retirer Dentiste fictif' }).click();
  await expect(page.getByText('Aucun accès actif.', { exact: true })).toBeVisible();
  expect(page.url()).toBe('http://127.0.0.1:4173/');
  expect(await page.title()).toContain('Dentara');
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});
test('uncertain sharing reuses the command and stale removals require explicit reconciliation on mobile', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const p = await patient();
  await login(page);
  await openPatient(page, p.patientNumber);
  let once = true;
  await page.route(`**/api/patient-access/${p.id}/share`, async (route) => {
    if (once) {
      once = false;
      await route.fetch();
      await route.abort('failed');
    } else await route.continue();
  });
  await page.route('**/api/patient-access/candidates', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Échec fictif du chargement des comptes' }),
    }),
  );
  await page.getByRole('button', { name: 'Confirmer le partage' }).click();
  await expect(page.getByText('Résultat incertain.', { exact: false })).toBeVisible();
  await expect(
    page.getByText('Échec fictif du chargement des comptes', { exact: true }),
  ).toBeVisible({ timeout: 12000 });
  await expect(page.getByLabel('Médecin ou personnel autorisé')).toHaveValue(doctorId);
  await expect(page.getByRole('button', { name: /Choisir ce patient/ }).first()).toBeDisabled();
  await page.unroute('**/api/patient-access/candidates');
  await page.getByRole('button', { name: 'Réessayer la même commande' }).click();
  await expect(page.getByRole('list', { name: 'Accès actifs' })).toContainText('Dentiste fictif');
  expect((await manager.get(`/api/patient-access/${p.id}/history`)).body).toHaveLength(1);
  await page.getByRole('region', { name: 'Attribution et partage' }).screenshot({
    path: join(tmpdir(), 'clinic-access-mobile.png'),
  });
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});
test('a stale removal requires reloading and a new explicit confirmation', async ({ page }) => {
  const p = await patient();
  await login(page);
  await openPatient(page, p.patientNumber);
  await page.getByRole('button', { name: 'Confirmer le partage' }).click();
  await expect(page.getByRole('list', { name: 'Accès actifs' })).toContainText('Dentiste fictif');
  let once = true;
  await page.route(`**/api/patient-access/${p.id}/remove`, async (route) => {
    if (once) {
      once = false;
      await post(`patient-access/${p.id}/share`, {
        commandId: randomUUID(),
        revision: 1,
        accountId: doctorId,
        kind: 'assigned',
      });
    }
    await route.continue();
  });
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Retirer Dentiste fictif' }).click();
  await expect(
    page.getByText('Les accès ont changé. Rechargez et confirmez votre choix.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Recharger les accès et réconcilier' }).click();
  await expect(page.getByRole('list', { name: 'Accès actifs' })).toContainText('Accès attribué');
  page.once('dialog', (d) => d.accept());
  await page.getByRole('button', { name: 'Retirer Dentiste fictif' }).click();
  await expect(page.getByText('Aucun accès actif.', { exact: true })).toBeVisible();
});
test('another PC immediately invalidates the assigner patient list and eligible account choices', async ({
  page,
}) => {
  await login(page);
  const p = await patient();
  await expect(
    page.getByRole('button', { name: `Choisir ce patient n°${p.patientNumber}`, exact: true }),
  ).toBeVisible();
  await openPatient(page, p.patientNumber);
  const accounts = (await manager.get('/api/accounts')).body;
  const current = accounts.find((a: { id: string }) => a.id === doctorId);
  await post(`accounts/${doctorId}/permissions`, {
    revision: current.revision,
    currentPassword: password,
    permissions: [],
  });
  await expect(
    page
      .getByLabel('Médecin ou personnel autorisé')
      .locator('option', { hasText: 'Dentiste fictif' }),
  ).toHaveCount(0);
  await post(`accounts/${doctorId}/permissions`, {
    revision: current.revision + 1,
    currentPassword: password,
    permissions: ['clinical.read', 'notes.draft'],
  });
  await expect(
    page
      .getByLabel('Médecin ou personnel autorisé')
      .locator('option', { hasText: 'Dentiste fictif' }),
  ).toHaveCount(1);
});
