import request from 'supertest';
import { hash } from 'argon2';
import { randomUUID } from 'node:crypto';
import type { Server } from 'node:http';
import { test, expect } from '@playwright/test';
import { createApplication } from '../../api/src/application.js';
import { openDatabase } from '../../api/src/database.js';
import { provisionClinic } from '../../api/src/modules/identity/index.js';
const operator = openDatabase(
  `postgresql://clinic_test:fictional-only@127.0.0.1:${process.env.CLINIC_TEST_PORT ?? "55437"}/clinic_issue7`,
);
const runtime = openDatabase(
  `postgresql://clinic_runtime_test:fictional-runtime-only@127.0.0.1:${process.env.CLINIC_TEST_PORT ?? "55437"}/clinic_issue7`,
);
const clinicCode = `browser-${randomUUID()}`.slice(0, 32);
const switchClinics = [
  `switch-${randomUUID()}`.slice(0, 32),
  `switch-${randomUUID()}`.slice(0, 32),
];
let token = '';
let server: Server;
let app: ReturnType<typeof createApplication>;
function createBrowserApplication() {
  return createApplication({
    database: runtime,
    sessionSecret: 'fictional-browser-session-secret-32-characters',
    origin: 'http://127.0.0.1:4173',
    secureCookies: false,
    mail: {
      async sendNotification() {},
      async sendVerification(message) {
        token = message.token;
      },
    },
  });
}
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
  app = createBrowserApplication();
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
});
test.beforeEach(async () => {
  if (server)
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  app = createBrowserApplication();
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
  await page.getByText('Renouveler mes codes de récupération', { exact: true }).click();
  const rotation = page
    .locator('details')
    .filter({ has: page.getByText('Renouveler mes codes de récupération', { exact: true }) });
  await rotation
    .getByLabel('Mot de passe actuel', { exact: true })
    .fill('Fictional-browser-replaced-2');
  await rotation.getByRole('button', { name: 'Remplacer mes codes' }).click();
  await expect(page.locator('.codes li')).toHaveCount(10);
  await expect(page.getByText('Configuration terminée', { exact: true })).toHaveCount(0);
  await page.getByLabel('J’ai conservé ces codes dans un endroit sûr.').check();
  await page.getByRole('button', { name: 'Terminer la configuration' }).click();
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

test('account drafts are discarded when the observed access scope changes', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Mode de connexion').selectOption('clinic_username');
  await page.getByLabel('Code de la clinique', { exact: true }).fill(clinicCode);
  await page.getByLabel('Identifiant', { exact: true }).fill('doctor');
  await page.getByLabel('Mot de passe', { exact: true }).fill('Fictional-doctor-browser-1');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('heading', { name: 'Comptes individuels' })).toBeVisible();
  await page.getByLabel('Nom affiché', { exact: true }).fill('Brouillon confidentiel');
  // Transport-level permission change models a change made on another PC.
  // Browser behavior, not hook internals, is the assertion surface.
  await page.route('**/api/identity', async route => {
    const response = await route.fetch();
    const actor = await response.json();
    await route.fulfill({ response, json: { ...actor, permissions: ['patients.read'] } });
  });
  await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
  await expect(page.getByLabel('Nom affiché', { exact: true })).toHaveValue('');
  await expect(page.getByRole('button', { name: 'Créer le compte', exact: true })).toBeEnabled();
});
test('French manager creates a staff account, changes its permissions and disables access from another PC', async ({
  page,
  browser,
}) => {
  await page.goto('/');
  await page.getByLabel('Mode de connexion').selectOption('clinic_username');
  await page.getByLabel('Code de la clinique', { exact: true }).fill(clinicCode);
  await page.getByLabel('Identifiant', { exact: true }).fill('doctor');
  await page.getByLabel('Mot de passe', { exact: true }).fill('Fictional-doctor-browser-1');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('heading', { name: 'Comptes individuels' })).toBeVisible();
  const creation = page
    .locator('form')
    .filter({ has: page.getByRole('heading', { name: 'Créer un compte' }) });
  await creation.getByLabel('Nom affiché').fill('Accueil fictif');
  await creation.getByLabel('Nouvel identifiant').fill('reception.browser');
  await creation.getByLabel('Profil').selectOption('staff');
  await creation
    .getByLabel('Mot de passe temporaire', { exact: true })
    .fill('Fictional-reception-temp');
  await creation.getByLabel('Votre mot de passe actuel').fill('wrong');
  await creation.getByRole('button', { name: 'Créer le compte' }).click();
  await expect(page.getByRole('alert')).toContainText('Mot de passe incorrect');
  await creation.getByLabel('Nom affiché').fill('Accueil fictif');
  await creation.getByLabel('Nouvel identifiant').fill('reception.browser');
  await creation
    .getByLabel('Mot de passe temporaire', { exact: true })
    .fill('Fictional-reception-temp');
  await creation.getByLabel('Votre mot de passe actuel').fill('Fictional-doctor-browser-1');
  await creation.getByRole('button', { name: 'Créer le compte' }).click();
  const editor = page.locator('form').filter({
    has: page.getByRole('heading', {
      name: 'Accueil fictif (reception.browser)',
    }),
  });
  await expect(editor).toBeVisible();
  await editor.getByLabel('Stock — Consulter', { exact: true }).check();
  await editor
    .getByLabel('Confirmez votre mot de passe pour reception.browser')
    .fill('Fictional-doctor-browser-1');
  await editor.getByRole('button', { name: 'Enregistrer pour reception.browser' }).click();
  await expect(editor.getByLabel('Stock — Consulter', { exact: true })).toBeChecked();
  const other = await browser.newContext();
  const staff = await other.newPage();
  await staff.goto('/');
  await staff.getByLabel('Mode de connexion').selectOption('clinic_username');
  await staff.getByLabel('Code de la clinique', { exact: true }).fill(clinicCode);
  await staff.getByLabel('Identifiant', { exact: true }).fill('RECEPTION.BROWSER');
  await staff.getByLabel('Mot de passe', { exact: true }).fill('Fictional-reception-temp');
  await staff.getByRole('button', { name: 'Se connecter' }).click();
  await staff
    .getByLabel('Nouveau mot de passe', { exact: true })
    .fill('Fictional-reception-personal');
  await staff.getByRole('button', { name: 'Enregistrer le mot de passe' }).click();
  await expect(staff.getByRole('heading', { name: 'Connexion à votre clinique' })).toBeVisible();
  await staff.getByLabel('Mode de connexion').selectOption('clinic_username');
  await staff.getByLabel('Code de la clinique', { exact: true }).fill(clinicCode);
  await staff.getByLabel('Identifiant', { exact: true }).fill('reception.browser');
  await staff.getByLabel('Mot de passe', { exact: true }).fill('Fictional-reception-personal');
  await staff.getByRole('button', { name: 'Se connecter' }).click();
  await expect(staff.getByText('Bonjour Accueil fictif.', { exact: false })).toBeVisible();
  await expect(staff.getByRole('heading', { name: 'Créer un compte' })).toHaveCount(0);
  await editor.getByLabel('Action pour reception.browser').selectOption('status');
  await editor.getByLabel('Nouvel état').selectOption('disabled');
  await editor
    .getByLabel('Confirmez votre mot de passe pour reception.browser')
    .fill('Fictional-doctor-browser-1');
  await editor.getByRole('button', { name: 'Enregistrer pour reception.browser' }).click();
  await staff.reload();
  await expect(staff.getByRole('heading', { name: 'Connexion à votre clinique' })).toBeVisible();
  await other.close();
});

test('offline recovery from the French sign-in screen replaces a lost primary mailbox and requires saving new codes', async ({
  page,
}) => {
  const code = `recover-${randomUUID()}`.slice(0, 32);
  const email = `${code}@example.invalid`;
  await provisionClinic(operator, {
    clinicCode: code,
    clinicName: 'Clinique récupération',
    username: 'manager',
    displayName: 'Responsable récupération',
    email,
    temporaryPassword: 'Fictional-recover-temp',
  });
  const setup = request.agent(app);
  let csrf = (await setup.get('/api/session')).body.csrfToken;
  const post = (path: string, body: object) =>
    setup
      .post(`/api${path}`)
      .set('Origin', 'http://127.0.0.1:4173')
      .set('x-csrf-token', csrf)
      .send(body);
  const login = async (password: string) => {
    csrf = (await setup.get('/api/session')).body.csrfToken;
    csrf = (await post('/sign-in', { method: 'email', email, password })).body.csrfToken;
  };
  await login('Fictional-recover-temp');
  await post('/onboarding/password', { password: 'Fictional-recover-personal' });
  await login('Fictional-recover-personal');
  await post('/onboarding/email', { email });
  const saved = await post('/onboarding/verify-email', { token });
  await post('/onboarding/codes-saved', { saved: true, batchId: saved.body.batchId });
  await page.goto('/');
  await page.getByText('Récupérer mon compte responsable', { exact: true }).click();
  await page.getByLabel('Adresse e-mail du compte', { exact: true }).fill(email);
  await page.getByLabel('Code de récupération', { exact: true }).fill(saved.body.codes[0]);
  await page.getByLabel('Nouveau mot de passe de récupération').fill('Fictional-recovered-browser');
  await page.getByRole('button', { name: 'Récupérer et vérifier mes coordonnées' }).click();
  const replacement = `new-${code}@example.invalid`;
  await expect(page.getByLabel('Adresse e-mail de récupération')).toBeEditable();
  await page.getByLabel('Adresse e-mail de récupération').fill(replacement);
  await page.getByRole('button', { name: 'Envoyer le lien de vérification' }).click();
  await expect(page.getByRole('status')).toContainText('Message envoyé');
  await page.getByLabel('Code de vérification reçu').fill(token);
  await page.getByRole('button', { name: 'Vérifier mon adresse' }).click();
  await expect(page.getByRole('heading', { name: 'Connexion à votre clinique' })).toBeVisible();
  await page.getByLabel('Adresse e-mail de connexion').fill(replacement);
  await page.getByLabel('Mot de passe', { exact: true }).fill('Fictional-recovered-browser');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page.getByRole('heading', { name: 'Gardez vos codes en lieu sûr' })).toBeVisible();
  await page.getByLabel('Mot de passe actuel', { exact: true }).fill('Fictional-recovered-browser');
  await page.getByRole('button', { name: 'Remplacer mes codes' }).click();
  await expect(page.locator('.codes li')).toHaveCount(10);
  await page.getByLabel('J’ai conservé ces codes dans un endroit sûr.').check();
  await page.getByRole('button', { name: 'Terminer la configuration' }).click();
  await expect(page.getByText('Configuration terminée', { exact: true })).toBeVisible();
});
test('concurrent manager permission edits keep the stale draft until explicit reconciliation', async ({
  page,
  browser,
}) => {
  const setup = request.agent(app);
  let csrf = (await setup.get('/api/session')).body.csrfToken;
  csrf = (
    await setup
      .post('/api/sign-in')
      .set('Origin', 'http://127.0.0.1:4173')
      .set('x-csrf-token', csrf)
      .send({
        method: 'clinic_username',
        clinicCode,
        username: 'doctor',
        password: 'Fictional-doctor-browser-1',
      })
  ).body.csrfToken;
  const username = `staff-${randomUUID().slice(0, 8)}`;
  await setup
    .post('/api/accounts')
    .set('Origin', 'http://127.0.0.1:4173')
    .set('x-csrf-token', csrf)
    .send({
      username,
      displayName: 'Conflit fictif',
      kind: 'staff',
      temporaryPassword: 'Fictional-stale-browser',
      currentPassword: 'Fictional-doctor-browser-1',
    });
  async function login(p: typeof page) {
    await p.goto('/');
    await p.getByLabel('Mode de connexion').selectOption('clinic_username');
    await p.getByLabel('Code de la clinique', { exact: true }).fill(clinicCode);
    await p.getByLabel('Identifiant', { exact: true }).fill('doctor');
    await p.getByLabel('Mot de passe', { exact: true }).fill('Fictional-doctor-browser-1');
    await p.getByRole('button', { name: 'Se connecter' }).click();
    await expect(p.getByRole('heading', { name: `Conflit fictif (${username})` })).toBeVisible();
  }
  await login(page);
  const other = await browser.newContext();
  const second = await other.newPage();
  await login(second);
  const editor = (p: typeof page) =>
    p
      .locator('form')
      .filter({ has: p.getByRole('heading', { name: `Conflit fictif (${username})` }) });
  await editor(page).getByLabel('Stock — Consulter', { exact: true }).check();
  await editor(second).getByLabel('Rendez-vous — Gérer', { exact: true }).check();
  await editor(second)
    .getByLabel(`Confirmez votre mot de passe pour ${username}`)
    .fill('Fictional-doctor-browser-1');
  await editor(second)
    .getByRole('button', { name: `Enregistrer pour ${username}` })
    .click();
  await expect(second.getByRole('status')).toContainText('Modification enregistrée');
  await page.bringToFront();
  await page.evaluate(() => window.dispatchEvent(new Event('visibilitychange')));
  await editor(page)
    .getByLabel(`Confirmez votre mot de passe pour ${username}`)
    .fill('Fictional-doctor-browser-1');
  await editor(page)
    .getByRole('button', { name: `Enregistrer pour ${username}` })
    .click();
  await expect(page.getByRole('alert')).toContainText('Ce compte a été modifié');
  await expect(editor(page).getByLabel('Stock — Consulter', { exact: true })).toBeChecked();
  await page
    .getByRole('button', { name: 'Recharger les comptes et abandonner mes modifications' })
    .click();
  await expect(editor(page).getByLabel('Stock — Consulter', { exact: true })).not.toBeChecked();
  await expect(editor(page).getByLabel('Rendez-vous — Gérer', { exact: true })).toBeChecked();
  await other.close();
});

async function readyManagerFixture() {
  const clinic = await operator.client.clinic.findUniqueOrThrow({ where: { code: clinicCode } });
  const username = `scope-${randomUUID().slice(0, 8)}`;
  const account = await operator.client.account.create({ data: {
    clinicId: clinic.id, username, displayName: 'Responsable fictif',
    passwordHash: await hash('Fictional-scope-manager-1'), isManager: true,
    verifiedEmail: `${username}@example.invalid`, recoveryEmail: `${username}@example.invalid`,
    codesSaved: true,
  } });
  return account;
}

test('a denied manager write reconciles demotion and removes confidential account drafts', async ({ page }) => {
  const account = await readyManagerFixture();
  await page.goto('/');
  await page.getByLabel('Mode de connexion').selectOption('clinic_username');
  await page.getByLabel('Code de la clinique', { exact: true }).fill(clinicCode);
  await page.getByLabel('Identifiant', { exact: true }).fill(account.username);
  await page.getByLabel('Mot de passe', { exact: true }).fill('Fictional-scope-manager-1');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.getByLabel('Nom affiché', { exact: true }).fill('Brouillon confidentiel');
  await page.getByLabel('Nouvel identifiant', { exact: true }).fill(`new-${randomUUID().slice(0, 8)}`);
  await page.getByLabel('Mot de passe temporaire', { exact: true }).fill('Fictional-new-account-1');
  await page.getByLabel('Votre mot de passe actuel', { exact: true }).fill('Fictional-scope-manager-1');

  // Hold an earlier identity response until the denied write. Otherwise live
  // SSE can legitimately reconcile demotion before the command is submitted.
  const observedIdentity = await (await page.request.get('/api/identity')).json();
  let deniedWrite = false;
  await page.route('**/api/identity', async route => {
    if (!deniedWrite) await route.fulfill({ json: observedIdentity });
    else await route.continue();
  });
  await page.route('**/api/accounts', async route => {
    const response = await route.fetch();
    if (route.request().method() === 'POST' && [401, 403].includes(response.status())) deniedWrite = true;
    await route.fulfill({ response });
  });

  const other = request.agent(app);
  let csrf = (await other.get('/api/session')).body.csrfToken;
  csrf = (await other.post('/api/sign-in').set('Origin', 'http://127.0.0.1:4173')
    .set('x-csrf-token', csrf).send({ method: 'clinic_username', clinicCode, username: 'doctor', password: 'Fictional-doctor-browser-1' })).body.csrfToken;
  const result = await other.post(`/api/accounts/${account.id}/manager`)
    .set('Origin', 'http://127.0.0.1:4173').set('x-csrf-token', csrf)
    .send({ revision: account.revision, isManager: false, currentPassword: 'Fictional-doctor-browser-1' });
  expect(result.status).toBe(200);
  const denied = page.waitForResponse(response => response.url().endsWith('/api/accounts') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Créer le compte', exact: true }).click();
  // Demotion may be observed as a revoked session or a permission denial;
  // both must remove the former manager's confidential workspace.
  expect([401, 403]).toContain((await denied).status());
  await expect(page.getByLabel('Nom affiché', { exact: true })).toHaveCount(0);
});

test('password change clears the workspace when the following session read loses the network', async ({ page }) => {
  const account = await readyManagerFixture();
  await page.goto('/');
  await page.getByLabel('Mode de connexion').selectOption('clinic_username');
  await page.getByLabel('Code de la clinique', { exact: true }).fill(clinicCode);
  await page.getByLabel('Identifiant', { exact: true }).fill(account.username);
  await page.getByLabel('Mot de passe', { exact: true }).fill('Fictional-scope-manager-1');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await page.getByLabel('Nom affiché', { exact: true }).fill('Brouillon confidentiel');
  await page.route('**/api/password', async route => {
    const response = await route.fetch();
    expect(response.status()).toBe(204);
    await page.route('**/api/session', route => route.abort());
    await route.fulfill({ response });
  });
  const passwordForm = page.locator('form').filter({ has: page.getByRole('heading', { name: 'Changer mon mot de passe', exact: true }) });
  await passwordForm.getByLabel('Mot de passe actuel', { exact: true }).fill('Fictional-scope-manager-1');
  await passwordForm.getByLabel('Nouveau mot de passe personnel', { exact: true }).fill('Fictional-scope-manager-2');
  await passwordForm.getByRole('button', { name: 'Changer mon mot de passe', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Connexion à votre clinique' })).toBeVisible();
  await expect(page.getByLabel('Nom affiché', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('alert')).toBeVisible();
});
