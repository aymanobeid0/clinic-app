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
  'postgresql://clinic_test:fictional-only@127.0.0.1:55437/clinic_issue7',
);
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
    permissions: [
      'clinical.read',
      'clinical.history',
      'history.draft',
      'history.finalize',
      'chart.draft',
      'chart.finalize',
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
});

test.beforeEach(async ({ page }) => {
  page.on('dialog', (dialog) => dialog.accept());
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
test('French clinician records allergies, confirms a mixed FDI chart and reads immutable history', async ({
  page,
}) => {
  const errors: string[] = [];
  const logs: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (
      ['error', 'warning'].includes(m.type()) &&
      !(
        m.text().includes('status of 401') &&
        new URL(m.location().url || 'http://localhost').pathname ===
          '/api/identity'
      )
    )
      logs.push(m.text());
  });
  const p = await grant();
  await loginDoctor(page);
  await page
    .getByRole('button', {
      name: `Ouvrir le dossier n°${p.patientNumber} — ${p.name}`,
      exact: true,
    })
    .click();
  const history = page.getByRole('form', {
    name: 'Antécédents et allergies',
    exact: true,
  });
  await history
    .getByLabel('Antécédents médicaux')
    .fill('Asthme déclaré par le patient');
  await history
    .getByLabel('Allergies', { exact: true })
    .fill('Pénicilline déclarée');
  await history
    .getByRole('button', { name: 'Enregistrer le brouillon' })
    .click();
  await expect(
    history.getByText('Version enregistrée.', { exact: true }),
  ).toContainText('Version enregistrée.');
  await history.getByRole('button', { name: /Confirmer la version/ }).click();
  await expect(
    page.getByText('Allergies : Pénicilline déclarée', { exact: true }).first(),
  ).toBeVisible();
  const chart = page.getByRole('form', {
    name: 'Schéma dentaire',
    exact: true,
  });
  await chart
    .getByLabel(
      'Autre — positions spéciales ou surnuméraires (sans code FDI inventé)',
    )
    .fill('Dent surnuméraire à décrire sans code inventé');
  await chart.getByLabel('Dentition', { exact: true }).selectOption('mixed');
  await chart
    .getByRole('button', { name: '11 Non évaluée', exact: true })
    .click();
  const tooth = chart.getByRole('region', { name: 'Dent 11', exact: true });
  await tooth.getByLabel('Présence', { exact: true }).selectOption('present');
  await tooth.getByLabel('Couronne', { exact: true }).check();
  await tooth.getByLabel('Traitement canalaire', { exact: true }).check();
  await tooth.getByRole('button', { name: 'Ajouter un constat' }).click();
  await tooth.getByLabel('Constat', { exact: true }).selectOption('decay');
  await tooth.getByLabel('Mésiale', { exact: true }).check();
  await chart
    .getByRole('button', { name: '51 Non évaluée', exact: true })
    .click();
  await chart
    .getByRole('region', { name: 'Dent 51', exact: true })
    .getByLabel('Présence', { exact: true })
    .selectOption('missing');
  await chart.getByRole('button', { name: 'Enregistrer le brouillon' }).click();
  await expect(
    chart.getByText('Version enregistrée.', { exact: true }),
  ).toContainText('Version enregistrée.');
  await chart.getByRole('button', { name: /Confirmer la version/ }).click();
  await expect(page.getByText('FDI · Dentition Mixte').first()).toBeVisible();
  const region = page.getByRole('region', {
    name: 'Schéma dentaire',
    exact: true,
  });
  await expect(region).toContainText('Couronne');
  await expect(region).toContainText('Traitement canalaire');
  await expect(region).toContainText('Carie · Mésiale');
  await history.getByLabel('Allergies', { exact: true }).fill('Latex déclaré');
  await history
    .getByRole('button', { name: 'Enregistrer le brouillon' })
    .click();
  await history.getByRole('button', { name: /Confirmer la version/ }).click();
  await page
    .getByText('Historique essentiel — Antécédents et allergies', {
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('region', { name: 'Antécédents et allergies', exact: true }),
  ).toContainText('Allergies : Pénicilline déclarée');
  await expect(
    page.getByRole('region', { name: 'Antécédents et allergies', exact: true }),
  ).toContainText('Allergies : Latex déclaré');
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await page
      .getByRole('region', { name: 'Dossiers cliniques', exact: true })
      .screenshot({ path: join(tmpdir(), `clinic-clinical-${width}.png`) });
    await chart
      .locator('.tooth-grid')
      .screenshot({ path: join(tmpdir(), `clinic-chart-grid-${width}.png`) });
    await history.screenshot({
      path: join(tmpdir(), `clinic-history-form-${width}.png`),
    });
    const sizes = await chart
      .locator('.tooth-grid button')
      .evaluateAll((nodes) =>
        nodes.map((n) => {
          const r = n.getBoundingClientRect();
          return { width: r.width, height: r.height };
        }),
      );
    expect(sizes.every((r) => r.width >= 44 && r.height >= 44)).toBe(true);
    await expect(history.locator('fieldset')).toHaveCSS('max-height', 'none');
  }
  await chart.getByRole('button', { name: '11 Présente', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(tooth).toBeVisible();
  expect(page.url()).toBe('http://127.0.0.1:4173/');
  expect(await page.title()).toContain('Dentara');
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(logs).toEqual([]);
});
test('network uncertainty retains tab input and replays exactly one clinical command', async ({
  page,
}) => {
  const p = await grant();
  await loginDoctor(page);
  await page
    .getByRole('button', {
      name: `Ouvrir le dossier n°${p.patientNumber} — ${p.name}`,
      exact: true,
    })
    .click();
  const history = page.getByRole('form', {
    name: 'Antécédents et allergies',
    exact: true,
  });
  await history
    .getByLabel('Allergies', { exact: true })
    .fill('Saisie conservée');
  let lost = true;
  const commands: string[] = [];
  await page.route(`**/api/clinical/${p.id}/history/draft`, async (route) => {
    commands.push(route.request().postDataJSON().commandId);
    if (lost) {
      lost = false;
      await route.fetch();
      await route.abort('failed');
    } else await route.continue();
  });
  await history
    .getByRole('button', { name: 'Enregistrer le brouillon' })
    .click();
  await expect(history.getByRole('alert')).toBeVisible();
  await expect(history.getByLabel('Allergies', { exact: true })).toHaveValue(
    'Saisie conservée',
  );
  await expect(
    page.getByRole('button', { name: /Ouvrir le dossier n°/ }).first(),
  ).toBeDisabled();
  await history
    .getByRole('button', { name: 'Réessayer la même sauvegarde' })
    .click();
  await expect(
    history.getByText('Version enregistrée.', { exact: true }),
  ).toBeVisible();
  await expect(
    history.getByRole('button', {
      name: 'Confirmer la version 1',
      exact: true,
    }),
  ).toBeEnabled();
  expect(commands).toHaveLength(2);
  expect(commands[0]).toBe(commands[1]);
  await page
    .getByText('Historique essentiel — Antécédents et allergies', {
      exact: true,
    })
    .click();
  await expect(
    page
      .getByText('Brouillon — à confirmer par un dentiste · version 1', {
        exact: true,
      })
      .first(),
  ).toBeVisible();
});
async function doctorPost(page: Page, path: string, body: object) {
  const csrf = (await (await page.request.get('/api/session')).json())
    .csrfToken;
  return page.request.post('/api/' + path, {
    headers: { Origin: 'http://127.0.0.1:4173', 'x-csrf-token': csrf },
    data: body,
  });
}
async function doctorPermissions(permissions: string[]) {
  const accounts = (await manager.get('/api/accounts')).body;
  const account = accounts.find((a: { id: string }) => a.id === doctorId);
  expect(
    (
      await post(`accounts/${doctorId}/permissions`, {
        revision: account.revision,
        currentPassword: password,
        permissions,
      })
    ).status,
  ).toBe(200);
}
const allClinical = [
  'clinical.read',
  'clinical.history',
  'history.draft',
  'history.finalize',
  'chart.draft',
  'chart.finalize',
];
test('finalize-only doctor retries a lost confirmation response without draft authority', async ({
  page,
}) => {
  await doctorPermissions(allClinical);
  const p = await grant();
  await loginDoctor(page);
  expect(
    (
      await doctorPost(page, `clinical/${p.id}/history/draft`, {
        commandId: randomUUID(),
        revision: 0,
        observedAt: '2026-10-14T09:00:00Z',
        content: {
          medicalHistory: 'Brouillon à relire',
          allergies: 'Latex déclaré',
        },
      })
    ).status(),
  ).toBe(200);
  await doctorPermissions([
    'clinical.read',
    'clinical.history',
    'history.finalize',
  ]);
  await page
    .getByRole('button', {
      name: `Ouvrir le dossier n°${p.patientNumber} — ${p.name}`,
      exact: true,
    })
    .click();
  const history = page.getByRole('form', {
    name: 'Antécédents et allergies',
    exact: true,
  });
  await expect(
    history.getByRole('button', { name: 'Enregistrer le brouillon' }),
  ).toHaveCount(0);
  let lost = true;
  const commands: string[] = [];
  await page.route(`**/api/clinical/${p.id}/history/confirm`, async (route) => {
    commands.push(route.request().postDataJSON().commandId);
    if (lost) {
      lost = false;
      await route.fetch();
      await route.abort('failed');
    } else await route.continue();
  });
  await history
    .getByRole('button', { name: 'Confirmer la version 1', exact: true })
    .click();
  await expect(history.getByRole('alert')).toBeVisible();
  await history
    .getByRole('button', { name: 'Réessayer la même sauvegarde' })
    .click();
  await expect(
    history.getByText('Version enregistrée.', { exact: true }),
  ).toBeVisible();
  expect(commands).toHaveLength(2);
  expect(commands[0]).toBe(commands[1]);
  const actual = await (await page.request.get(`/api/clinical/${p.id}`)).json();
  expect(actual.history.events).toHaveLength(2);
  expect(actual.history.current.status).toBe('final');
  await doctorPermissions(allClinical);
});
test('remote draft updates require explicit reconciliation and show the entire version before confirmation', async ({
  page,
}) => {
  await doctorPermissions(allClinical);
  const p = await grant();
  await loginDoctor(page);
  await page
    .getByRole('button', {
      name: `Ouvrir le dossier n°${p.patientNumber} — ${p.name}`,
      exact: true,
    })
    .click();
  const history = page.getByRole('form', {
    name: 'Antécédents et allergies',
    exact: true,
  });
  await history.getByLabel('Allergies', { exact: true }).fill('Saisie locale');
  await history
    .getByRole('button', { name: 'Enregistrer le brouillon' })
    .click();
  await expect(
    history.getByText('Version enregistrée.', { exact: true }),
  ).toBeVisible();
  expect(
    (
      await doctorPost(page, `clinical/${p.id}/history/draft`, {
        commandId: randomUUID(),
        revision: 1,
        observedAt: '2026-10-14T09:00:00Z',
        content: {
          medicalHistory: 'Information distante à relire',
          allergies: 'Allergie distante',
        },
      })
    ).status(),
  ).toBe(200);
  const region = page.getByRole('region', {
    name: 'Antécédents et allergies',
    exact: true,
  });
  await expect(
    region.getByText('Allergies : Allergie distante', { exact: true }).first(),
  ).toBeVisible();
  await expect(history.getByLabel('Allergies', { exact: true })).toHaveValue(
    'Saisie locale',
  );
  await expect(
    history.getByRole('button', {
      name: 'Confirmer la version 2',
      exact: true,
    }),
  ).toBeDisabled();
  await history
    .getByRole('button', { name: 'Recharger pour réconcilier' })
    .click();
  await expect(history.getByLabel('Allergies', { exact: true })).toHaveValue(
    'Saisie locale',
  );
  await history
    .getByRole('button', { name: 'Confirmer la version 2', exact: true })
    .click();
  await expect(
    region.getByText('Confirmé · version 3', { exact: true }).first(),
  ).toBeVisible();
  const actual = await (await page.request.get(`/api/clinical/${p.id}`)).json();
  expect(actual.history.current.content.allergies).toBe('Allergie distante');
  expect(actual.history.current.content.medicalHistory).toBe(
    'Information distante à relire',
  );
});
test('sharing appears before selecting a patient and removal closes the clinical record immediately', async ({
  page,
}) => {
  await doctorPermissions(allClinical);
  const p = await patient();
  await loginDoctor(page);
  const open = page.getByRole('button', {
    name: `Ouvrir le dossier n°${p.patientNumber} — ${p.name}`,
    exact: true,
  });
  await expect(open).toHaveCount(0);
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
  await expect(open).toBeVisible();
  await open.click();
  await expect(
    page.getByRole('form', { name: 'Antécédents et allergies', exact: true }),
  ).toBeVisible();
  expect(
    (
      await post(`patient-access/${p.id}/remove`, {
        commandId: randomUUID(),
        revision: 1,
        accountId: doctorId,
      })
    ).status,
  ).toBe(200);
  await expect(
    page.getByRole('form', { name: 'Antécédents et allergies', exact: true }),
  ).toHaveCount(0);
  await expect(open).toHaveCount(0);
  expect((await page.request.get(`/api/clinical/${p.id}`)).status()).toBe(403);
});
