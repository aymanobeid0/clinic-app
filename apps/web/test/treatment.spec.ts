import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {mkdtemp, rm} from 'node:fs/promises';
import {privateFileStore} from '../../api/src/modules/files/index.js';
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
let attachmentDirectory = '';
const createBrowserApp = () =>
  createApplication({
    database: runtime,
    sessionSecret: 'fictional-patient-browser-secret-long-enough',
    origin: 'http://127.0.0.1:4173',
    secureCookies: false,
    attachmentStore: privateFileStore(attachmentDirectory),
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
  attachmentDirectory = await mkdtemp(join(tmpdir(), 'clinic-issue55-browser-'));
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
    permissions: ['patients.create', 'catalog.manage'],
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
      'plans.finalize',
      'plans.accept',
      'acceptance.draft',
      'clinical.print',
      'prices.override',
      'discounts',
      'appointments.manage',
      'attachments.upload',
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
  page.on('dialog', (dialog) => dialog.accept());
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  server = createBrowserApp().listen(3000, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
});
test.afterEach(async ({ page }) => {
  const logout = page.getByRole('button', {name: 'Se déconnecter', exact: true});
  if (await logout.isVisible()) {
    await logout.click();
    await expect(page.getByRole('button', {name: 'Se connecter', exact: true})).toBeVisible();
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
  await rm(attachmentDirectory, {recursive:true, force:true});
});

test('separate lifecycle hook links uploaded signed evidence and doctor confirmation through the authenticated application', async ({page}) => {
  const {panel, p} = await openProposals(page);
  await fillProposal(panel);
  await panel.getByRole('button', {name:'Enregistrer le brouillon',exact:true}).click();
  await expect(panel.getByText('Brouillon enregistré',{exact:true}).first()).toBeVisible();
  await panel.getByRole('button',{name:/Soins proposés fictifs · MRU/}).click();
  await panel.getByRole('button',{name:'Présenter cette version',exact:true}).click();
  await expect(panel.getByText('État : Présentée',{exact:true})).toBeVisible();
  await page.goto(`/test/treatment-signed.harness.html?patient=${p.id}`);
  await page.getByRole('button',{name:'Téléverser la preuve fictive'}).click();
  await expect(page.getByTestId('uploaded')).not.toBeEmpty();
  const uploaded = await page.getByTestId('uploaded').textContent();
  await page.getByLabel('Personne',{exact:true}).fill('Patiente fictive');
  await page.getByLabel('Date accord').fill('2026-10-25T09:00');
  await page.getByLabel('Méthode').fill('Document signé');
  await page.getByRole('button',{name:'Lier la preuve'}).click();
  await expect(page.getByTestId('linked')).toHaveText(uploaded!);
  await page.getByRole('button',{name:'Relire la preuve liée'}).click();
  await page.getByRole('button',{name:'Confirmer',exact:true}).click();
  await expect(page.getByTestId('accepted')).toHaveText(uploaded!);
  await expect(page.getByRole('alert')).toHaveCount(0);
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

test('catalog refetch errors preserve the current-tab draft and denied reads remove it', async ({page}) => {
  await page.goto('/');
  await page.getByLabel('Adresse e-mail de connexion',{exact:true}).fill(email);
  await page.getByLabel('Mot de passe',{exact:true}).fill(password);
  await page.getByRole('button',{name:'Se connecter',exact:true}).click();
  const panel = page.getByRole('region',{name:'Catalogue des actes',exact:true});
  const name = panel.getByLabel('Nom de l’acte',{exact:true});
  await name.fill('Saisie catalogue conservée');
  let status = 503;
  await page.route('**/api/catalog', route => route.request().method() === 'GET'
    ? route.fulfill({status, json:{error: status === 503 ? 'Catalogue temporairement indisponible' : 'Catalogue refusé'}})
    : route.continue());
  const change = () => post('catalog', {commandId:randomUUID(), id:randomUUID(), revision:0, name:'Acte de rafraîchissement fictif', currency:'MRU', price:'100', durationMinutes:30, active:true});
  await change();
  await expect(panel.getByText('Catalogue temporairement indisponible',{exact:true})).toBeVisible();
  await expect(name).toHaveValue('Saisie catalogue conservée');
  status = 403;
  await change();
  await expect(panel.getByText('Catalogue refusé',{exact:true})).toBeVisible();
  await expect(name).toHaveCount(0);
});

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

async function openProposals(page: Page) {
  const p = await grant();
  await loginDoctor(page);
  await page
    .getByRole('button', {
      name: `Ouvrir le dossier n°${p.patientNumber} — ${p.name}`,
      exact: true,
    })
    .click();
  return {
    p,
    panel: page.getByRole('region', {
      name: 'Propositions de traitement',
      exact: true,
    }),
  };
}
async function fillProposal(panel: ReturnType<Page['getByRole']>) {
  await panel.getByLabel('Devise', { exact: true }).selectOption('MRU');
  await panel
    .getByLabel('Titre de la proposition')
    .fill('Soins proposés fictifs');
  await panel
    .getByLabel('Choisir un acte', { exact: true })
    .selectOption({ label: 'Restauration fictive · 100.00 MRU' });
  await panel
    .getByRole('button', { name: 'Ajouter un acte', exact: true })
    .click();
  await panel.getByLabel('Portée').selectOption('teeth');
  await panel.getByLabel('Positions FDI').fill('11 16');
  await panel.getByLabel('Prix · MRU').fill('90.00');
  await panel.getByLabel('Remise · MRU').fill('5.00');
  await panel.getByLabel('Motif de remise').fill('Tarif famille expliqué');
}
test('French proposal journey preserves exact prices and explicit duration suggestions across responsive layouts', async ({
  page,
}) => {
  const errors: string[] = [],
    logs: string[] = [];
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
  const { panel } = await openProposals(page);
  await fillProposal(panel);
  await panel
    .getByRole('button', { name: 'Enregistrer le brouillon', exact: true })
    .click();
  await expect(
    panel.getByText('Brouillon enregistré', { exact: true }).first(),
  ).toBeVisible();
  await expect(
    panel.getByText('version enregistrée 1', { exact: false }),
  ).toBeVisible();
  await panel
    .getByRole('button', { name: /Soins proposés fictifs · MRU/ })
    .click();
  await panel
    .getByRole('button', { name: 'Relire la version distante' })
    .count();
  await expect(panel.getByLabel('Prix · MRU')).toHaveValue('90.00');
  await expect(panel.getByLabel('Motif de remise')).toHaveValue(
    'Tarif famille expliqué',
  );
  await panel.locator('details').first().locator('summary').first().click();
  await expect(panel.getByText(/total 85.00 MRU/).first()).toBeVisible();
  await expect(page).toHaveTitle('Dentara · Connexion');
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(page.url()).toBe('http://127.0.0.1:4173/');
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await panel.scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    expect(
      await panel
        .locator('fieldset')
        .first()
        .evaluate((e) => getComputedStyle(e).maxHeight),
    ).toBe('none');
    await panel.screenshot({
      path: join(tmpdir(), `clinic-treatment-${width}.png`),
    });
  }
  await panel.getByLabel('Titre de la proposition').focus();
  await page.keyboard.press('Tab');
  expect(
    await page.evaluate(() => document.activeElement?.tagName),
  ).toBeTruthy();
  const suggestion = page.getByLabel('Suggestion du catalogue');
  await suggestion.selectOption({ label: 'Restauration fictive · 45 min' });
  const duration = page.getByLabel('Durée (minutes)', { exact: true });
  await duration.fill('35');
  await expect(duration).toHaveValue('35');
  await page
    .getByRole('button', { name: 'Appliquer cette durée', exact: true })
    .click();
  await expect(duration).toHaveValue('45');
  await duration.fill('50');
  await expect(duration).toHaveValue('50');
  expect(errors).toEqual([]);
  expect(logs).toEqual([]);
});
test('lost proposal response freezes form and same-command retry saves only one draft', async ({
  page,
}) => {
  const { panel, p } = await openProposals(page);
  await fillProposal(panel);
  let intercepted = false;
  await page.route(`**/api/treatment/${p.id}/plans`, async (route) => {
    if (route.request().method() === 'POST' && !intercepted) {
      intercepted = true;
      await route.fetch();
      await route.abort('failed');
    } else await route.continue();
  });
  await panel
    .getByRole('button', { name: 'Enregistrer le brouillon', exact: true })
    .click();
  await expect(
    panel.getByText('Réponse incertaine.', { exact: false }),
  ).toBeVisible();
  await expect(panel.getByLabel('Titre de la proposition')).toBeDisabled();
  await panel
    .getByRole('button', { name: 'Réessayer la même commande', exact: true })
    .click();
  await expect(
    panel.getByText('Brouillon enregistré', { exact: true }).first(),
  ).toBeVisible();
  await expect(
    panel.getByRole('button', { name: /Soins proposés fictifs · MRU/ }),
  ).toHaveCount(1);
  await expect(
    panel.getByText('version enregistrée 1', { exact: false }),
  ).toBeVisible();
});
test('remote proposal conflict preserves local input and failed reread is visible', async ({
  page,
}) => {
  const { panel, p } = await openProposals(page);
  await fillProposal(panel);
  await panel
    .getByRole('button', { name: 'Enregistrer le brouillon', exact: true })
    .click();
  await expect(
    panel.getByText('Brouillon enregistré', { exact: true }).first(),
  ).toBeVisible();
  const browser = request.agent('http://127.0.0.1:3000');
  let employeeCsrf = (await browser.get('/api/session')).body.csrfToken;
  const ep = (path: string, body: object) =>
    browser
      .post(`/api/${path}`)
      .set('Origin', 'http://127.0.0.1:4173')
      .set('x-csrf-token', employeeCsrf)
      .send(body);
  employeeCsrf = (
    await ep('sign-in', {
      method: 'clinic_username',
      clinicCode: code,
      username: 'doctor',
      password: 'Fictional-doctor-personal',
    })
  ).body.csrfToken;
  const saved = (await browser.get(`/api/treatment/${p.id}/plans`)).body[0];
  const item = saved.items[0];
  await ep(`treatment/${p.id}/plans`, {
    commandId: randomUUID(),
    id: saved.id,
    revision: 1,
    title: 'Titre distant',
    currency: 'MRU',
    items: [
      {
        id: item.id,
        procedureId: item.procedureId,
        catalogRevision: item.catalogRevision,
        scope: item.scope,
        teeth: item.teeth,
        price: '90',
        discount: '5',
        discountReason: item.discountReason,
      },
    ],
  });
  await panel
    .getByLabel('Titre de la proposition')
    .fill('Saisie locale conservée');
  await panel
    .getByRole('button', { name: 'Enregistrer le brouillon', exact: true })
    .click();
  await expect(
    panel.getByText('La proposition a changé.', { exact: false }),
  ).toBeVisible();
  await expect(panel.getByLabel('Titre de la proposition')).toHaveValue(
    'Saisie locale conservée',
  );
  await page.route(`**/api/treatment/${p.id}/plans`, (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Relecture provisoirement indisponible.',
          }),
        })
      : route.continue(),
  );
  await panel
    .getByRole('button', { name: 'Relire la version distante', exact: true })
    .click();
  await expect(
    panel.getByText('Relecture provisoirement indisponible.', { exact: true }),
  ).toBeVisible();
  await expect(panel.getByLabel('Titre de la proposition')).toHaveValue(
    'Saisie locale conservée',
  );
  await page.unroute(`**/api/treatment/${p.id}/plans`);
  await panel
    .getByRole('button', { name: 'Relire la version distante', exact: true })
    .click();
  await expect(
    panel.getByText('Version distante relue.', { exact: false }),
  ).toBeVisible();
  await panel
    .getByRole('button', { name: 'Enregistrer le brouillon', exact: true })
    .click();
  await expect(
    panel.getByText('version enregistrée 3', { exact: false }),
  ).toBeVisible();
});

test('catalog manager maintains default prices, enables another verified currency and retires an act in French', async ({
  page,
}) => {
  await page.goto('/');
  await page
    .getByLabel('Adresse e-mail de connexion', { exact: true })
    .fill(email);
  await page.getByLabel('Mot de passe', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  const panel = page.getByRole('region', {
    name: 'Catalogue des actes',
    exact: true,
  });
  await expect(panel).toBeVisible();
  await panel.getByText('Devises de la clinique', { exact: true }).click();
  await panel
    .getByLabel('Devise à activer', { exact: true })
    .selectOption('JPY');
  await panel
    .getByRole('button', { name: 'Activer la devise', exact: true })
    .click();
  await expect(
    panel.getByText('Devises actives : JPY, MRU', { exact: true }),
  ).toBeVisible();
  await panel
    .getByLabel('Nom de l’acte', { exact: true })
    .fill('Extraction fictive');
  await panel.getByLabel('Prix', { exact: true }).fill('250.25');
  await panel
    .getByLabel('Durée suggérée (minutes)', { exact: true })
    .fill('55');
  await panel
    .getByRole('button', { name: 'Enregistrer l’acte', exact: true })
    .click();
  await expect(
    panel.getByRole('button', {
      name: 'Extraction fictive · 250.25 MRU · 55 min · Disponible',
      exact: true,
    }),
  ).toBeVisible();
  await panel
    .getByRole('button', {
      name: 'Extraction fictive · 250.25 MRU · 55 min · Disponible',
      exact: true,
    })
    .click();
  await panel.getByLabel('Prix', { exact: true }).fill('260.50');
  await panel.getByLabel('Acte disponible', { exact: true }).uncheck();
  await panel
    .getByRole('button', { name: 'Enregistrer l’acte', exact: true })
    .click();
  await expect(
    panel.getByRole('button', {
      name: 'Extraction fictive · 260.50 MRU · 55 min · Retiré',
      exact: true,
    }),
  ).toBeVisible();
  await panel.screenshot({ path: join(tmpdir(), 'clinic-catalog-1440.png') });
});
test('sharing before selection appears through discovery and removing scope clears proposals immediately', async ({
  page,
}) => {
  await loginDoctor(page);
  const p = await grant();
  const open = page.getByRole('button', {
    name: `Ouvrir le dossier n°${p.patientNumber} — ${p.name}`,
    exact: true,
  });
  await expect(open).toBeVisible();
  await open.click();
  const panel = page.getByRole('region', {
    name: 'Propositions de traitement',
    exact: true,
  });
  await fillProposal(panel);
  await panel
    .getByRole('button', { name: 'Enregistrer le brouillon', exact: true })
    .click();
  await expect(
    panel.getByText('Brouillon enregistré', { exact: true }).first(),
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
  await expect(panel).toHaveCount(0);
  await expect(open).toHaveCount(0);
});

test('French presentation acceptance revision and retained-version print journey', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const logs: string[] = [];
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
  const { panel } = await openProposals(page);
  await fillProposal(panel);
  await panel
    .getByRole('button', { name: 'Enregistrer le brouillon', exact: true })
    .click();
  await expect(
    panel.getByText('Brouillon enregistré', { exact: true }).first(),
  ).toBeVisible();
  await panel
    .getByRole('button', { name: /Soins proposés fictifs · MRU/ })
    .click();
  await panel
    .getByRole('button', { name: 'Présenter cette version', exact: true })
    .click();
  await expect(
    panel.getByText('État : Présentée', { exact: true }),
  ).toBeVisible();
  await panel
    .getByLabel('Identité de la personne ayant accepté')
    .fill('Aminata, patiente fictive');
  await panel.getByLabel('Date et heure de l’accord').fill('2026-10-16T12:00');
  await panel.getByLabel('Méthode de l’accord').fill('Accord oral expliqué');
  await panel
    .getByRole('button', { name: 'Consigner l’accord', exact: true })
    .click();
  await expect(
    panel.getByText(/Accord consigné : Aminata/).first(),
  ).toBeVisible();
  await panel
    .getByRole('button', { name: 'Confirmer l’acceptation', exact: true })
    .click();
  await expect(
    panel.getByText('État : Acceptée', { exact: true }),
  ).toBeVisible();
  await panel
    .getByRole('button', { name: 'Aperçu imprimable', exact: true })
    .click();
  const preview = page.getByRole('dialog', { name: 'Proposition imprimable' });
  await expect(preview).toBeVisible();
  await expect(
    preview.getByText('Aminata, patiente fictive', { exact: false }),
  ).toBeVisible();
  await expect(preview.getByText(/85.00 MRU/).first()).toBeVisible();
  await page.emulateMedia({ media: 'print' });
  await expect(
    preview.getByRole('heading', { name: 'Proposition de traitement' }),
  ).toBeVisible();
  await page.screenshot({
    path: join(tmpdir(), 'clinic-14-print.png'),
    fullPage: true,
  });
  await page.emulateMedia({ media: 'screen' });
  await preview.getByRole('button', { name: 'Fermer l’aperçu' }).click();
  await panel
    .getByLabel('Notes de la proposition')
    .fill('Préférence de rendez-vous');
  await panel
    .getByRole('button', { name: 'Enregistrer le brouillon', exact: true })
    .click();
  await expect(
    panel.getByText('État : Acceptée', { exact: true }),
  ).toBeVisible();
  await panel
    .getByLabel('Libellé des frais supplémentaires · acte 1')
    .fill('Travail complémentaire');
  await panel
    .getByLabel('Montant des frais supplémentaires · acte 1')
    .fill('12.25');
  await panel
    .getByRole('button', { name: 'Ajouter les frais · acte 1' })
    .click();
  await panel
    .getByRole('button', { name: 'Enregistrer le brouillon', exact: true })
    .click();
  await expect(
    panel.getByText('État : Brouillon', { exact: true }),
  ).toBeVisible();
  await expect(
    panel.getByText(
      'Nouvelle acceptation requise après modification de la portée ou du prix.',
      { exact: true },
    ),
  ).toBeVisible();
  await panel.getByLabel('Version à imprimer').selectOption('4');
  await panel
    .getByRole('button', { name: 'Aperçu imprimable', exact: true })
    .click();
  await expect(preview.getByText(/version 4 · Acceptée/)).toBeVisible();
  await expect(
    preview.getByText('Total proposé : 85.00 MRU', { exact: true }),
  ).toBeVisible();
  await expect(
    preview.getByText('Travail complémentaire', { exact: false }),
  ).toHaveCount(0);
  await preview.getByRole('button', { name: 'Fermer l’aperçu' }).click();
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await panel.scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await panel.screenshot({ path: join(tmpdir(), `clinic-14-${width}.png`) });
  }
  await expect(page).toHaveTitle('Dentara · Connexion');
  expect(page.url()).toBe('http://127.0.0.1:4173/');
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(logs).toEqual([]);
});

test('lost lifecycle response retains agreement input and freezes actions until an idempotent retry succeeds', async ({
  page,
}) => {
  const { panel, p } = await openProposals(page);
  await fillProposal(panel);
  await panel
    .getByRole('button', { name: 'Enregistrer le brouillon', exact: true })
    .click();
  await expect(
    panel.getByText('Brouillon enregistré', { exact: true }).first(),
  ).toBeVisible();
  await panel
    .getByRole('button', { name: /Soins proposés fictifs · MRU/ })
    .click();
  await panel
    .getByRole('button', { name: 'Présenter cette version', exact: true })
    .click();
  await expect(
    panel.getByText('État : Présentée', { exact: true }),
  ).toBeVisible();
  await panel
    .getByLabel('Identité de la personne ayant accepté')
    .fill('Accord conservé fictif');
  await panel.getByLabel('Date et heure de l’accord').fill('2026-10-16T12:00');
  await panel.getByLabel('Méthode de l’accord').fill('Oral');
  let intercepted = false;
  await page.route(
    `**/api/treatment/${p.id}/plans/lifecycle`,
    async (route) => {
      if (!intercepted) {
        intercepted = true;
        await route.fetch();
        await route.abort('failed');
      } else await route.continue();
    },
  );
  await panel
    .getByRole('button', { name: 'Consigner l’accord', exact: true })
    .click();
  await expect(
    panel.getByText('Réponse incertaine.', { exact: false }),
  ).toBeVisible();
  await expect(
    panel.getByLabel('Identité de la personne ayant accepté'),
  ).toHaveValue('Accord conservé fictif');
  await expect(
    panel.getByRole('button', { name: 'Consigner l’accord', exact: true }),
  ).toBeDisabled();
  await panel
    .getByRole('button', { name: 'Réessayer la même commande', exact: true })
    .click();
  await expect(
    panel.getByText(/Accord consigné : Accord conservé fictif/),
  ).toBeVisible();
  await expect(
    panel.getByText('Actions sur la version 3', { exact: true }),
  ).toBeVisible();
});
