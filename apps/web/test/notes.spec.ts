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
      'notes.draft',
      'notes.finalize',
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

test('French note autosave retains newer input through an ambiguous response, reviews conflicts and preserves corrections', async ({
  page,
}) => {
  const errors: string[] = [],
    logs: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (
      ['error', 'warning'].includes(m.type()) &&
      !/status of (401|409)|ERR_FAILED/.test(m.text())
    )
      logs.push(m.text());
  });
  const { p, send, browser, planId } = await acceptedPatient();
  const plan = (await browser.get(`/api/treatment/${p.id}/plans`)).body[0];
  const visitId = randomUUID(),
    notePath = `clinical/${p.id}/notes/${visitId}`;
  expect(
    (
      await send(`treatment/${p.id}/visits`, {
        commandId: randomUUID(),
        id: visitId,
        appointmentId: null,
        procedures: [
          { planId, itemId: plan.items[0].id, planRevision: plan.revision },
        ],
      })
    ).status,
  ).toBe(200);
  await loginDoctor(page);
  const openPatient = page.getByRole('button', {
    name: `Ouvrir le dossier n°${p.patientNumber} — ${p.name}`,
    exact: true,
  });
  await openPatient.click();
  const notes = page.getByRole('region', {
    name: 'Notes de visite',
    exact: true,
  });
  await notes.getByRole('button', { name: /Rédiger la note/ }).click();
  const input = notes.getByLabel('Note libre');
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  let intercepted = false;
  await page.route(`**/api/${notePath}/draft`, async (route) => {
    if (!intercepted) {
      intercepted = true;
      await route.fetch();
      await gate;
      await route.abort();
    } else await route.continue();
  });
  await input.fill('Observation initiale.');
  await expect(
    notes.getByText('Enregistrement…', { exact: true }),
  ).toBeVisible();
  await input.fill('Observation complétée pendant l’enregistrement.');
  release();
  await expect(
    notes.getByText('Réponse incertaine.', { exact: false }),
  ).toBeVisible();
  await expect(input).toHaveValue(
    'Observation complétée pendant l’enregistrement.',
  );
  await expect(openPatient).toBeDisabled();
  await expect(
    notes.getByText('Enregistré sur le serveur.', { exact: true }),
  ).toHaveCount(0);
  await notes
    .getByRole('button', { name: 'Réessayer la même commande', exact: true })
    .click();
  await expect(
    notes.getByText('Enregistré sur le serveur.', { exact: true }),
  ).toBeVisible();
  const saved = (await browser.get(`/api/${notePath}`)).body;
  expect(saved.draft.content.text).toBe(
    'Observation complétée pendant l’enregistrement.',
  );
  expect(saved.events).toHaveLength(2);
  await page.unroute(`**/api/${notePath}/draft`);
  // A concurrent clinician saves while this tab has its own new text.
  let releaseStale: () => void = () => {};
  const staleGate = new Promise<void>((resolve) => {
    releaseStale = resolve;
  });
  let staleStarted: () => void = () => {};
  const staleRequest = new Promise<void>((resolve) => {
    staleStarted = resolve;
  });
  await page.route(`**/api/${notePath}/draft`, async (route) => {
    staleStarted();
    await staleGate;
    await route.continue();
  });
  await input.fill('Ma saisie à réconcilier.');
  await staleRequest;
  expect(
    (
      await send(`${notePath}/draft`, {
        commandId: randomUUID(),
        revision: 2,
        text: 'Version concurrente du serveur.',
      })
    ).status,
  ).toBe(200);
  releaseStale();
  await expect(
    notes.getByText(
      'Cette note a changé. Relisez les deux versions avant de choisir.',
      { exact: true },
    ),
  ).toBeVisible();
  await expect(input).toHaveValue('Ma saisie à réconcilier.');
  await notes
    .getByRole('button', { name: 'Comparer avec la version du serveur' })
    .click();
  await expect(
    notes
      .locator('.note-conflict')
      .getByText('Version concurrente du serveur.', { exact: true }),
  ).toBeVisible();
  await notes
    .locator('.note-editor')
    .screenshot({ path: join(tmpdir(), 'clinic-16-note-conflict.png') });
  await page.unroute(`**/api/${notePath}/draft`);
  await notes
    .getByRole('button', { name: 'J’ai comparé : conserver ma saisie' })
    .click();
  await expect(
    notes.getByText('Enregistré sur le serveur.', { exact: true }),
  ).toBeVisible();
  expect((await browser.get(`/api/${notePath}`)).body.draft.content.text).toBe(
    'Ma saisie à réconcilier.',
  );
  // Several ordinary pauses remain within the unchanged global IP limit.
  for (let i = 1; i <= 4; i++) {
    await input.fill(`Note libre enregistrée ${i}.`);
    await expect(
      notes.getByText('Enregistré sur le serveur.', { exact: true }),
    ).toBeVisible();
  }
  const visits = page.getByRole('region', {
    name: 'Visites et actes réalisés',
    exact: true,
  });
  await visits
    .getByRole('button', { name: 'Terminer la visite', exact: true })
    .click();
  await expect(
    notes.getByText('Note à finaliser — soins terminés', { exact: true }),
  ).toBeVisible();
  await notes
    .getByRole('button', { name: 'Finaliser la note', exact: true })
    .click();
  await expect(
    notes.getByText('Note à finaliser — soins terminés', { exact: true }),
  ).toHaveCount(0);
  await expect(
    notes.getByRole('button', { name: 'Rédiger une correction datée' }),
  ).toBeVisible();
  await notes
    .getByRole('button', { name: 'Rédiger une correction datée' })
    .click();
  await input.fill('Correction datée du compte rendu.');
  await expect(
    notes.getByText('Enregistré sur le serveur.', { exact: true }),
  ).toBeVisible();
  await notes
    .getByRole('button', { name: 'Finaliser la note', exact: true })
    .click();
  await notes
    .getByText('Historique essentiel de la note', { exact: true })
    .click();
  await expect(
    notes.getByText('Note libre enregistrée 4.', { exact: true }),
  ).toHaveCount(2);
  await expect(
    notes.getByText('Correction datée du compte rendu.', { exact: true }),
  ).toHaveCount(3);
  await notes
    .getByText('Historique essentiel de la note', { exact: true })
    .click();
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await notes
      .getByRole('heading', { name: 'Notes de visite', exact: true })
      .scrollIntoViewIfNeeded();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await notes.screenshot({
      path: join(tmpdir(), `clinic-16-notes-${width}.png`),
    });
  }
  expect(
    await page.evaluate(
      () =>
        Object.keys(localStorage).length + Object.keys(sessionStorage).length,
    ),
  ).toBe(0);
  await expect(page.locator('vite-error-overlay')).toHaveCount(0);
  await expect(page).toHaveTitle('Dentara · Connexion');
  expect(page.url()).toBe('http://127.0.0.1:4173/');
  expect(errors).toEqual([]);
  expect(logs).toEqual([]);
});

test('French staff draft survives network failure and care ending without a finalization control', async ({
  page,
}) => {
  const { p, send, browser, planId } = await acceptedPatient();
  const plan = (await browser.get(`/api/treatment/${p.id}/plans`)).body[0];
  const visitId = randomUUID(),
    notePath = `clinical/${p.id}/notes/${visitId}`;
  expect(
    (
      await send(`treatment/${p.id}/visits`, {
        commandId: randomUUID(),
        id: visitId,
        appointmentId: null,
        procedures: [
          { planId, itemId: plan.items[0].id, planRevision: plan.revision },
        ],
      })
    ).status,
  ).toBe(200);
  const staff = (
    await post('accounts', {
      username: 'notes-assistant',
      displayName: 'Assistante fictive',
      kind: 'staff',
      temporaryPassword: 'Fictional-assistant-temporary',
      currentPassword: password,
    })
  ).body;
  expect(
    (
      await post(`accounts/${staff.id}/permissions`, {
        revision: 0,
        currentPassword: password,
        permissions: ['clinical.read', 'notes.draft', 'notes.finalize'],
      })
    ).status,
  ).toBe(200);
  const staffBrowser = request.agent('http://127.0.0.1:3000');
  let staffCsrf = (await staffBrowser.get('/api/session')).body.csrfToken;
  const staffPost = (path: string, body: object) =>
    staffBrowser
      .post(`/api/${path}`)
      .set('Origin', 'http://127.0.0.1:4173')
      .set('x-csrf-token', staffCsrf)
      .send(body);
  staffCsrf = (
    await staffPost('sign-in', {
      method: 'clinic_username',
      clinicCode: code,
      username: 'notes-assistant',
      password: 'Fictional-assistant-temporary',
    })
  ).body.csrfToken;
  await staffPost('onboarding/password', {
    password: 'Fictional-assistant-personal',
  });
  expect(
    (
      await post(`patient-access/${p.id}/share`, {
        commandId: randomUUID(),
        revision: 1,
        accountId: staff.id,
        kind: 'shared',
      })
    ).status,
  ).toBe(200);
  // Reset only after fixture setup, before starting the authenticated UI journey.
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  server = createBrowserApp().listen(3000, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  await page.goto('/');
  await page.getByLabel('Mode de connexion').selectOption('clinic_username');
  await page.getByLabel('Code de la clinique').fill(code);
  await page.getByLabel('Identifiant', { exact: true }).fill('notes-assistant');
  await page
    .getByLabel('Mot de passe', { exact: true })
    .fill('Fictional-assistant-personal');
  await page.getByRole('button', { name: 'Se connecter' }).click();
  const open = page.getByRole('button', {
    name: `Ouvrir le dossier n°${p.patientNumber} — ${p.name}`,
    exact: true,
  });
  await open.click();
  const notes = page.getByRole('region', {
    name: 'Notes de visite',
    exact: true,
  });
  await notes.getByRole('button', { name: /Rédiger la note/ }).click();
  await page.route(`**/api/${notePath}/draft`, (route) => route.abort());
  await notes.getByLabel('Note libre').focus();
  await page.keyboard.type('Saisie assistante conservée.');
  await expect(
    notes.getByText('Réponse incertaine.', { exact: false }),
  ).toBeVisible();
  await expect(notes.getByLabel('Note libre')).toHaveValue(
    'Saisie assistante conservée.',
  );
  await expect(open).toBeDisabled();
  await expect(
    notes.getByRole('button', { name: 'Finaliser la note', exact: true }),
  ).toHaveCount(0);
  await expect(
    notes.getByText(
      'Enregistrement impossible. Saisie conservée dans cet onglet.',
      { exact: true },
    ),
  ).toBeVisible();
  await notes
    .locator('.note-editor')
    .screenshot({ path: join(tmpdir(), 'clinic-16-note-network-error.png') });
  await page.unroute(`**/api/${notePath}/draft`);
  await notes
    .getByRole('button', { name: 'Réessayer la même commande', exact: true })
    .focus();
  await page.keyboard.press('Enter');
  await expect(
    notes.getByText('Enregistré sur le serveur.', { exact: true }),
  ).toBeVisible();
  expect((await browser.get(`/api/${notePath}`)).body.draft.authorId).toBe(
    staff.id,
  );
  expect(
    (
      await send(`treatment/${p.id}/visits/actions`, {
        commandId: randomUUID(),
        id: visitId,
        revision: 1,
        action: 'end',
      })
    ).status,
  ).toBe(200);
  await expect(
    notes.getByText('Note à finaliser — soins terminés', { exact: true }),
  ).toBeVisible();
  await notes.screenshot({
    path: join(tmpdir(), 'clinic-16-note-pending.png'),
  });
  await page.reload();
  await open.click();
  await expect(
    notes.getByText('Note à finaliser — soins terminés', { exact: true }),
  ).toBeVisible();
  await notes.getByRole('button', { name: /Rédiger la note/ }).click();
  await expect(notes.getByLabel('Note libre')).toHaveValue(
    'Saisie assistante conservée.',
  );
  await expect(
    notes.getByRole('button', { name: 'Finaliser la note', exact: true }),
  ).toHaveCount(0);
});
