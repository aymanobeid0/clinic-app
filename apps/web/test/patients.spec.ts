import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { Server } from 'node:http';
import request from 'supertest';
import { test, expect, type Page } from '@playwright/test';
import { openDatabase } from '../../api/src/database.js';
import { createApplication } from '../../api/src/application.js';
import { provisionClinic } from '../../api/src/modules/identity/index.js';
const owner = openDatabase(`postgresql://clinic_test:fictional-only@127.0.0.1:${process.env.CLINIC_TEST_PORT ?? "55437"}/clinic_issue7`);
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
    permissions: ['patients.read', 'patients.create', 'patients.edit', 'patients.archive'],
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
test('French guardian registration, shared phone warning, search, conflict reconciliation, archive and reactivation', async ({
  page,
  browser,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await login(page);
  const patients = page.getByRole('region', { name: 'Patients' });
  await expect(patients).toBeVisible();
  const registration = patients.getByRole('form', { name: 'Nouveau patient' });
  await registration.getByLabel('Nom du patient').fill('Enfant fictif');
  await registration.getByLabel('Téléphone de contact').fill('+223 70 00 00 00');
  await registration.getByLabel('Titulaire du numéro').selectOption('guardian');
  await registration.getByLabel('Nom du parent ou contact').fill('Parent fictif');
  await registration.getByRole('button', { name: 'Enregistrer le patient' }).click();
  await expect(patients.getByText('Patient enregistré : n°1.', { exact: true })).toBeVisible();
  await registration.getByLabel('Nom du patient').fill('Autre enfant fictif');
  await registration.getByLabel('Téléphone de contact').fill('+22370000000');
  await registration.getByRole('button', { name: 'Enregistrer le patient' }).click();
  await expect(
    patients.getByText(
      'Doublon possible : vérifiez les dossiers. Un numéro familial partagé est autorisé.',
    ),
  ).toBeVisible();
  await patients.getByLabel('Rechercher un patient').fill('Parent');
  await expect(patients.getByRole('button', { name: 'Ouvrir n°1 — Enfant fictif' })).toBeVisible();
  await patients.getByRole('button', { name: 'Ouvrir n°1 — Enfant fictif' }).click();
  const edit = patients.getByRole('form', { name: 'Coordonnées du patient' });
  await edit.getByLabel('Nom du patient').fill('Saisie conservée');
  const list = await manager.get('/api/patients');
  const p = list.body.patients.find((p: { patientNumber: number }) => p.patientNumber === 1);
  await post(`patients/${p.id}/contact`, {
    name: 'Autre poste',
    phone: p.phone,
    contactKind: p.contactKind,
    contactName: p.contactName,
    revision: 0,
    commandId: randomUUID(),
  });
  await edit.getByRole('button', { name: 'Enregistrer les coordonnées' }).click();
  await expect(patients.getByRole('alert')).toContainText('Ce dossier a changé');
  await expect(edit.getByLabel('Nom du patient')).toHaveValue('Saisie conservée');
  await patients.getByRole('button', { name: 'Recharger la version actuelle' }).click();
  await expect(patients.getByText('Version actuelle : Autre poste')).toBeVisible();
  await edit.getByRole('button', { name: 'Enregistrer les coordonnées' }).click();
  await expect(patients.getByText('Coordonnées enregistrées.')).toBeVisible();
  await expect(patients.getByRole('heading', { name: 'n°1 — Saisie conservée' })).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await patients.getByRole('button', { name: 'Archiver le patient' }).click();
  await expect(patients.getByText('Patient archivé.')).toBeVisible();
  await patients.getByLabel('Afficher les patients archivés').check();
  await patients.getByLabel('Rechercher un patient').fill('Saisie');
  await patients.getByRole('button', { name: 'Ouvrir n°1 — Saisie conservée' }).click();
  await expect(patients.getByRole('heading', { name: 'Historique du dossier' })).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await patients.getByRole('button', { name: 'Réactiver le patient' }).click();
  await expect(patients.getByText('Patient réactivé.')).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({
    path: join(tmpdir(), 'clinic-patients-mobile.png'),
    fullPage: true,
  });
  expect(errors).toEqual([]);
  const secondContext = await browser.newContext();
  const second = await secondContext.newPage();
  await login(second);
  const otherPatients = second.getByRole('region', { name: 'Patients' });
  const data = {
    commandId: randomUUID(),
    name: 'Nouveau poste',
    phone: '70000111',
    contactKind: 'patient',
    contactName: '',
  };
  await post('patients', data);
  await expect(
    otherPatients.getByRole('button', { name: 'Ouvrir n°3 — Nouveau poste' }),
  ).toBeVisible();
  await second.screenshot({
    path: join(tmpdir(), 'clinic-patients-desktop.png'),
    fullPage: false,
  });
  await secondContext.close();
});
test('lost registration and contact responses retain tab drafts, retry once and reconcile stale archive commands', async ({
  page,
}) => {
  await login(page);
  const patients = page.getByRole('region', { name: 'Patients' });
  const registration = patients.getByRole('form', { name: 'Nouveau patient' });
  await registration.getByLabel('Nom du patient').fill('Réponse perdue fictive');
  await registration.getByLabel('Téléphone de contact').fill('70000222');
  await page.route(
    '**/api/patients',
    async (route) => {
      await route.fetch();
      await route.abort('failed');
    },
    { times: 1 },
  );
  await registration.getByRole('button', { name: 'Enregistrer le patient' }).click();
  await expect(registration.getByText('Résultat inconnu.', { exact: false })).toBeVisible();
  await expect(registration.getByLabel('Nom du patient')).toHaveValue('Réponse perdue fictive');
  await registration.getByRole('button', { name: 'Réessayer la même demande' }).click();
  await expect(patients.getByText('Patient enregistré : n°4.', { exact: true })).toBeVisible();
  const all = await manager.get('/api/patients');
  const created = all.body.patients.filter(
    (p: { name: string }) => p.name === 'Réponse perdue fictive',
  );
  expect(created).toHaveLength(1);
  const p = created[0];
  await patients.getByRole('button', { name: 'Ouvrir n°4 — Réponse perdue fictive' }).click();
  const edit = patients.getByRole('form', { name: 'Coordonnées du patient' });
  await edit.getByLabel('Nom du patient').fill('Modification récupérée');
  await page.route(
    `**/api/patients/${p.id}/contact`,
    async (route) => {
      await route.fetch();
      await route.abort('failed');
    },
    { times: 1 },
  );
  await edit.getByRole('button', { name: 'Enregistrer les coordonnées' }).click();
  await expect(edit.getByText('Résultat inconnu.', { exact: false })).toBeVisible();
  await patients.getByRole('button', { name: 'Recharger la version actuelle' }).click();
  await expect(patients.getByText('Version actuelle : Modification récupérée')).toBeVisible();
  await edit.getByRole('button', { name: 'Réessayer la même demande' }).click();
  await expect(patients.getByText('Coordonnées enregistrées.')).toBeVisible();
  const history = await manager.get(`/api/patients/${p.id}/history`);
  expect(history.body.filter((e: { action: string }) => e.action === 'contact')).toHaveLength(1);
  await page.route(
    `**/api/patients/${p.id}/archive`,
    async (route) => {
      const current = (await manager.get(`/api/patients/${p.id}`)).body;
      await post(`patients/${p.id}/contact`, {
        name: 'Version distante',
        phone: current.phone,
        contactKind: current.contactKind,
        contactName: current.contactName,
        commandId: randomUUID(),
        revision: current.revision,
      });
      await route.continue();
    },
    { times: 1 },
  );
  page.once('dialog', (dialog) => dialog.accept());
  await patients.getByRole('button', { name: 'Archiver le patient' }).click();
  await expect(patients.getByRole('alert')).toContainText('Ce dossier a changé');
  await expect(patients.getByRole('heading', { name: 'n°4 — Version distante' })).toBeVisible();
  page.once('dialog', (dialog) => dialog.accept());
  await patients.getByRole('button', { name: 'Archiver le patient' }).click();
  await expect(patients.getByText('Patient archivé.')).toBeVisible();
});
test('background archive preserves an open contact draft until reactivation and reconciliation', async ({
  page,
}) => {
  const p = (
    await post('patients', {
      name: 'Dossier partagé',
      phone: '70000333',
      contactKind: 'patient',
      contactName: '',
      commandId: randomUUID(),
    })
  ).body.patient;
  await login(page);
  const patients = page.getByRole('region', { name: 'Patients' });
  await patients
    .getByRole('button', { name: `Ouvrir n°${p.patientNumber} — Dossier partagé` })
    .click();
  const edit = patients.getByRole('form', { name: 'Coordonnées du patient' });
  await edit.getByLabel('Nom du patient').fill('Brouillon conservé');
  await post(`patients/${p.id}/archive`, { revision: 0, commandId: randomUUID() });
  await expect(
    edit.getByText('Patient archivé : votre saisie reste conservée.', { exact: false }),
  ).toBeVisible();
  await expect(edit.getByLabel('Nom du patient')).toHaveValue('Brouillon conservé');
  await expect(edit.getByRole('button', { name: 'Enregistrer les coordonnées' })).toBeDisabled();
  await post(`patients/${p.id}/reactivate`, { revision: 1, commandId: randomUUID() });
  await expect(edit.getByRole('button', { name: 'Enregistrer les coordonnées' })).toBeEnabled();
  await expect(edit.getByLabel('Nom du patient')).toHaveValue('Brouillon conservé');
  await patients.getByRole('button', { name: 'Recharger la version actuelle' }).click();
  await edit.getByRole('button', { name: 'Enregistrer les coordonnées' }).click();
  await expect(patients.getByText('Coordonnées enregistrées.')).toBeVisible();
});
