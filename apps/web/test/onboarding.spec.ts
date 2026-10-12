import request from 'supertest';
import { hash } from 'argon2';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { test, expect } from '@playwright/test';
import { createApplication } from '../../api/src/application.js';
import { openDatabase } from '../../api/src/database.js';
import { provisionClinic } from '../../api/src/modules/identity/index.js';
const operator = openDatabase(
  'postgresql://clinic_test:fictional-only@127.0.0.1:55437/clinic_issue7',
);
const runtime = openDatabase(
  'postgresql://clinic_runtime_test:fictional-runtime-only@127.0.0.1:55437/clinic_issue7',
);
const clinicCode = `browser-${randomUUID()}`.slice(0, 32);
const switchClinics = [
  `switch-${randomUUID()}`.slice(0, 32),
  `switch-${randomUUID()}`.slice(0, 32),
];
let token = '';
let server: Server;
test.beforeAll(async () => {
  await operator.connect();
  await runtime.connect();
  await runtime.assertRuntimeRole();
  await provisionClinic(operator, {
    clinicCode,
    email: `${clinicCode}@example.invalid`,
    clinicName: 'Clinique de démonstration',
    username: 'manager',
    displayName: 'Camille',
    temporaryPassword: 'Fictional-browser-initial-1',
  });
  const clinic = await operator.client.clinic.findUniqueOrThrow({
    where: { code: clinicCode },
  });
  // #8 owns promotion APIs. Fixture models an already configured promoted doctor.
  await operator.client.account.create({
    data: {
      clinicId: clinic.id,
      username: 'doctor',
      displayName: 'Docteur responsable',
      passwordHash: await hash('Fictional-doctor-browser-1'),
      isManager: true,
      verifiedEmail: `doctor-${clinicCode}@example.invalid`,
      recoveryEmail: `doctor-${clinicCode}@example.invalid`,
      codesSaved: true,
    },
  });
  const app = createApplication({
    database: runtime,
    sessionSecret: 'fictional-browser-session-secret-32-characters',
    origin: 'http://127.0.0.1:4173',
    secureCookies: false,
    mail: {
      async sendVerification(message) {
        token = message.token;
      },
    },
  });
  for (const code of switchClinics) {
    await provisionClinic(operator, {
      clinicCode: code,
      email: `${code}@example.invalid`,
      clinicName: 'Clinique fictive',
      username: 'manager',
      displayName: 'Responsable',
      temporaryPassword: 'Fictional-browser-initial-1',
    });
  }
  // Prepare B through the same public application boundary; no table assertions.
  const managerB = request.agent(app);
  let csrf = (await managerB.get('/api/session')).body.csrfToken;
  const post = (path: string, body: object) =>
    managerB
      .post(`/api/${path}`)
      .set('Origin', 'http://127.0.0.1:4173')
      .set('x-csrf-token', csrf)
      .send(body);
  csrf = (
    await post('sign-in', {
      method: 'email',
      email: `${switchClinics[1]}@example.invalid`,
      password: 'Fictional-browser-initial-1',
    })
  ).body.csrfToken;
  await post('onboarding/password', {
    password: 'Fictional-browser-replaced-2',
  });
  csrf = (await managerB.get('/api/session')).body.csrfToken;
  csrf = (
    await post('sign-in', {
      method: 'email',
      email: `${switchClinics[1]}@example.invalid`,
      password: 'Fictional-browser-replaced-2',
    })
  ).body.csrfToken;
  await post('onboarding/email', {
    email: `${switchClinics[1]}@example.invalid`,
  });
  expect((await post('onboarding/verify-email', { token })).status).toBe(200);
  server = await new Promise<Server>((resolve) => {
    const listener = app.listen(3000, '127.0.0.1', () => resolve(listener));
  });
});
test.afterAll(async () => {
  if (server)
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  await runtime.close();
  await operator.close();
});

test('French manager completes restricted setup and can sign in and out', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Connexion à votre clinique' })).toBeVisible();
  async function login(password: string) {
    await page.getByLabel('Adresse e-mail de connexion').fill(`${clinicCode}@example.invalid`);
    await page.getByLabel('Mot de passe', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Se connecter' }).click();
  }
  await login('wrong-password');
  await expect(page.getByRole('alert')).toContainText('Identifiants invalides.');
  await expect(page.getByRole('button', { name: 'Se connecter' })).toBeEnabled();
  await login('Fictional-browser-initial-1');
  await expect(page.getByRole('heading', { name: 'Votre mot de passe personnel' })).toBeVisible();
  await page.getByLabel('Nouveau mot de passe').fill('Fictional-browser-replaced-2');
  await page.getByRole('button', { name: 'Enregistrer le mot de passe' }).click();
  await expect(page.getByRole('heading', { name: 'Connexion à votre clinique' })).toBeVisible();
  await login('Fictional-browser-replaced-2');
  await expect(
    page.getByText('Utilisez une adresse e-mail réelle', { exact: false }),
  ).toBeVisible();
  await expect(page.getByLabel('Adresse e-mail de récupération')).toHaveValue(
    `${clinicCode}@example.invalid`,
  );
  await page.getByRole('button', { name: 'Envoyer le lien de vérification' }).click();
  await expect(page.getByRole('status')).toContainText('Message envoyé');
  await page.goto(`/#verification=${token}`);
  await expect(page.getByLabel('Code de vérification reçu')).toHaveValue(token);
  await expect(page).toHaveURL('http://127.0.0.1:4173/');
  await page.getByRole('button', { name: 'Vérifier mon adresse' }).click();
  await expect(page.getByRole('heading', { name: 'Gardez vos codes en lieu sûr' })).toBeVisible();
  await expect(page.locator('.codes li')).toHaveCount(10);
  await page.getByLabel('J’ai conservé ces codes dans un endroit sûr.').check();
  await page.getByRole('button', { name: 'Terminer la configuration' }).click();
  await expect(page.getByRole('heading', { name: 'Clinique de démonstration' })).toBeVisible();
  await page.reload();
  await expect(page.getByText('Configuration terminée', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await expect(page.getByRole('heading', { name: 'Connexion à votre clinique' })).toBeVisible();
  await login('Fictional-browser-replaced-2');
  await expect(page.getByText('Configuration terminée', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Se déconnecter' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole('heading', { name: 'Connexion à votre clinique' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({
    path: '../../.tools/issue7-sign-in-mobile.png',
    fullPage: true,
  });
});

test('shared PC never shows previous manager recovery codes after authentication is lost', async ({
  page,
  context,
}) => {
  await page.goto('/');
  async function login(clinic: string, password: string) {
    await page.getByLabel('Adresse e-mail de connexion').fill(`${clinic}@example.invalid`);
    await page.getByLabel('Mot de passe', { exact: true }).fill(password);
    await page.getByRole('button', { name: 'Se connecter' }).click();
  }
  await login(switchClinics[0], 'Fictional-browser-initial-1');
  await page.getByLabel('Nouveau mot de passe').fill('Fictional-browser-replaced-2');
  await page.getByRole('button', { name: 'Enregistrer le mot de passe' }).click();
  await expect(page.getByRole('heading', { name: 'Connexion à votre clinique' })).toBeVisible();
  await login(switchClinics[0], 'Fictional-browser-replaced-2');
  await expect(page.getByLabel('Adresse e-mail de récupération')).toHaveValue(
    `${switchClinics[0]}@example.invalid`,
  );
  await page.getByRole('button', { name: 'Envoyer le lien de vérification' }).click();
  await expect(page.getByRole('status')).toContainText('Message envoyé');
  await page.getByLabel('Code de vérification reçu').fill(token);
  await page.getByRole('button', { name: 'Vérifier mon adresse' }).click();
  await expect(page.locator('.codes li')).toHaveCount(10);
  const oldCodes = await page.locator('.codes li').allTextContents();
  await context.clearCookies();
  await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByRole('heading', { name: 'Connexion à votre clinique' })).toBeVisible();
  await login(switchClinics[1], 'Fictional-browser-replaced-2');
  await expect(page.getByRole('heading', { name: 'Gardez vos codes en lieu sûr' })).toBeVisible();
  await expect(page.locator('.codes li')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Remplacer mes codes' })).toBeVisible();
  for (const code of oldCodes) await expect(page.getByText(code, { exact: true })).toHaveCount(0);
});

test('promoted doctor signs in with clinic code and username, without a login email', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByLabel('Mode de connexion').selectOption('clinic_username');
  await expect(page.getByLabel('Adresse e-mail de connexion')).toHaveCount(0);
  await page.getByLabel('Code de la clinique').fill(clinicCode);
  await page.getByLabel('Identifiant', { exact: true }).fill(' DOCTOR ');
  await page.getByLabel('Mot de passe', { exact: true }).fill('Fictional-doctor-browser-1');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByText('Configuration terminée', { exact: true })).toBeVisible();
  await expect(page.getByText('Bonjour Docteur responsable.', { exact: false })).toBeVisible();
});
