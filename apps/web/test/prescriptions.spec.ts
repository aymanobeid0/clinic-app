import { randomUUID } from "node:crypto";
import type { Server } from "node:http";
import request from "supertest";
import { test, expect, type Page } from "@playwright/test";
import { openDatabase } from "../../api/src/database.js";
import { createApplication } from "../../api/src/application.js";
import { provisionClinic } from "../../api/src/modules/identity/index.js";
const owner = openDatabase(
  "postgresql://clinic_test:fictional-only@127.0.0.1:55437/clinic_issue7",
);
const runtime = openDatabase(
  "postgresql://clinic_runtime_test:fictional-runtime-only@127.0.0.1:55437/clinic_issue7",
);
const code = `patients-${randomUUID()}`.slice(0, 32);
const email = `${code}@example.invalid`;
const password = "Fictional-patients-personal";
let server: Server;
let token = "";
let manager: ReturnType<typeof request.agent>;
let csrf = "";
let requestCounts = new Map<string, number>();
let doctorId = "";
const createBrowserApp = () =>
  createApplication({
    database: runtime,
    sessionSecret: "fictional-patient-browser-secret-long-enough",
    origin: "http://127.0.0.1:4173",
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
    .set("Origin", "http://127.0.0.1:4173")
    .set("x-csrf-token", csrf)
    .send(body);
test.beforeAll(async () => {
  await owner.connect();
  await runtime.connect();
  await provisionClinic(owner, {
    clinicCode: code,
    clinicName: "Clinique patients fictifs",
    username: "manager",
    displayName: "Accueil",
    email,
    temporaryPassword: "Fictional-patients-initial",
  });
  server = createBrowserApp().listen(3000, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  manager = request.agent("http://127.0.0.1:3000");
  csrf = (await manager.get("/api/session")).body.csrfToken;
  csrf = (
    await post("sign-in", {
      method: "email",
      email,
      password: "Fictional-patients-initial",
    })
  ).body.csrfToken;
  await post("onboarding/password", { password });
  csrf = (await manager.get("/api/session")).body.csrfToken;
  csrf = (await post("sign-in", { method: "email", email, password })).body
    .csrfToken;
  await post("onboarding/email", { email });
  const codes = await post("onboarding/verify-email", { token });
  await post("onboarding/codes-saved", {
    batchId: codes.body.batchId,
    saved: true,
  });
  const identity = (await manager.get("/api/identity")).body;
  await post(`accounts/${identity.accountId}/permissions`, {
    revision: 0,
    currentPassword: password,
    permissions: ["patients.create", "catalog.manage", "appointments.manage"],
  });
  const account = (
    await post("accounts", {
      username: "doctor",
      displayName: "Dentiste fictif",
      kind: "doctor",
      temporaryPassword: "Fictional-doctor-temporary",
      currentPassword: password,
    })
  ).body;
  doctorId = account.id;
  await post(`accounts/${doctorId}/permissions`, {
    revision: 0,
    currentPassword: password,
    permissions: [
      "clinical.read",
      "clinical.history",
      "prescriptions.draft",
      "prescriptions.sign",
      "notes.draft",
      "notes.finalize",
      "history.draft",
      "history.finalize",
      "chart.draft",
      "chart.finalize",
      "plans.draft",
      "procedures.start",
      "procedures.complete",
      "plans.finalize",
      "plans.accept",
      "acceptance.draft",
      "clinical.print",
      "prices.override",
      "discounts",
    ],
  });
  const employee = request.agent("http://127.0.0.1:3000");
  let employeeCsrf = (await employee.get("/api/session")).body.csrfToken;
  const employeePost = (path: string, body: object) =>
    employee
      .post(`/api/${path}`)
      .set("Origin", "http://127.0.0.1:4173")
      .set("x-csrf-token", employeeCsrf)
      .send(body);
  employeeCsrf = (
    await employeePost("sign-in", {
      method: "clinic_username",
      clinicCode: code,
      username: "doctor",
      password: "Fictional-doctor-temporary",
    })
  ).body.csrfToken;
  await employeePost("onboarding/password", {
    password: "Fictional-doctor-personal",
  });
  await post("catalog/currencies", { commandId: randomUUID(), code: "MRU" });
  await post("catalog", {
    commandId: randomUUID(),
    id: randomUUID(),
    revision: 0,
    name: "Restauration fictive",
    currency: "MRU",
    price: "100.00",
    durationMinutes: 45,
    active: true,
  });
});

test.beforeEach(async ({ page }) => {
  requestCounts = new Map();
  page.on("request", (r) => {
    const path = new URL(r.url()).pathname;
    if (path.startsWith("/api"))
      requestCounts.set(path, (requestCounts.get(path) ?? 0) + 1);
  });
  page.on("dialog", (dialog) => dialog.accept());
  server.closeAllConnections();
  await new Promise<void>((resolve) => server.close(() => resolve()));
  server = createBrowserApp().listen(3000, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
});
test.afterEach(async ({ page }) => {
  console.log("REQUEST COUNTS", Object.fromEntries(requestCounts));
  const logout = page.getByRole("button", {
    name: "Se déconnecter",
    exact: true,
  });
  if (await logout.isVisible()) {
    await logout.click();
    await expect(
      page.getByRole("button", { name: "Se connecter", exact: true }),
    ).toBeVisible();
  }
  await page.goto("about:blank");
  // Complete an authenticated DB round trip after the page closes its SSE stream.
  await manager.get("/api/clinic");
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
    await post("patients", {
      commandId: randomUUID(),
      name: `Patient accès ${randomUUID().slice(0, 6)}`,
      phone: "70000000",
      contactKind: "patient",
      contactName: "",
    })
  ).body.patient;
}

async function loginDoctor(page: Page) {
  await page.goto("/");
  await page.getByLabel("Mode de connexion").selectOption("clinic_username");
  await page.getByLabel("Code de la clinique").fill(code);
  await page.getByLabel("Identifiant", { exact: true }).fill("doctor");
  await page
    .getByLabel("Mot de passe", { exact: true })
    .fill("Fictional-doctor-personal");
  await page.getByRole("button", { name: "Se connecter" }).click();
  await expect(
    page.getByRole("heading", { name: "Clinique patients fictifs" }),
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
        kind: "assigned",
      })
    ).status,
  ).toBe(200);
  return p;
}

test("French medication autocomplete, independent manual retry, issuance, retained correction and print", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  const p = await grant();
  const reference = {
    commandId: randomUUID(),
    id: randomUUID(),
    revision: 0,
    name: "Référence fictive",
    strength: "10 unités",
    form: "forme témoin",
    active: true,
  };
  expect((await post("medications", reference)).status).toBe(200);
  await loginDoctor(page);
  await page
    .getByRole("button", {
      name: `Ouvrir le dossier n°${p.patientNumber} — ${p.name}`,
    })
    .click();
  const section = page.getByRole("region", {
    name: "Ordonnances",
    exact: true,
  });
  await section
    .getByRole("button", { name: "Nouvelle ordonnance", exact: true })
    .click();
  await section.getByLabel("Médicament", { exact: true }).fill("Référence");
  await section
    .getByRole("button", {
      name: "Choisir Référence fictive · 10 unités · forme témoin",
    })
    .click();
  await expect(section.getByLabel("Dosage descriptif")).toHaveValue(
    "10 unités",
  );
  for (const label of ["Dose prescrite", "Voie", "Fréquence", "Durée"])
    await section
      .getByLabel(label, { exact: true })
      .fill("Valeur manuelle fictive");
  await section.getByLabel("Instructions générales").fill("Consigne originale");
  await expect(
    section.getByText("Brouillon enregistré", { exact: true }),
  ).toBeVisible();
  // Catalog network failure preserves values and cannot block prescription autosave.
  await page.route("**/api/medications?*", (r) =>
    r.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "Panne simulée de la liste" }),
    }),
  );
  await section
    .getByLabel("Médicament", { exact: true })
    .fill("Entrée manuelle autonome");
  await expect(
    section.getByText(
      "Recherche indisponible. La saisie manuelle reste disponible.",
    ),
  ).toBeVisible();
  await expect(
    section.getByText("Brouillon enregistré", { exact: true }),
  ).toBeVisible();
  let loseReference = true;
  await page.route("**/api/medications", async (r) => {
    if (r.request().method() === "POST" && loseReference) {
      loseReference = false;
      await r.fetch();
      await r.abort();
    } else await r.continue();
  });
  await section
    .getByRole("button", { name: "Ajouter explicitement à la liste" })
    .click();
  await expect(
    section.getByText(
      "Référence enregistrée dans la liste. Ordonnance à enregistrer séparément.",
    ),
  ).toHaveCount(0);
  await expect(section.getByLabel("Médicament", { exact: true })).toHaveValue(
    "Entrée manuelle autonome",
  );
  await section
    .getByRole("button", { name: "Réessayer la même commande", exact: true })
    .click();
  await expect(
    section.getByText(
      "Référence enregistrée dans la liste. Ordonnance à enregistrer séparément.",
    ),
  ).toBeVisible();
  await section
    .getByRole("button", { name: "Signer et émettre", exact: true })
    .click();
  await expect(
    section.getByText(/Signataire : Dentiste fictif/).first(),
  ).toBeVisible();
  await section
    .getByRole("button", { name: /Imprimer cette version/ })
    .last()
    .click();
  await expect(section.locator(".prescription-print")).toContainText(
    "Entrée manuelle autonome",
  );
  await page.evaluate(() => {
    window.print = () => {
      document.documentElement.dataset.printCalled = "true";
    };
  });
  await section
    .getByRole("button", { name: "Imprimer l’ordonnance affichée" })
    .click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-print-called",
    "true",
  );
  await section.getByLabel("Motif de correction").fill("Correction documentée");
  await section.getByLabel("Instructions générales").fill("Consigne corrigée");
  await expect(
    section.getByText("Brouillon enregistré", { exact: true }),
  ).toBeVisible();
  await section
    .getByRole("button", { name: "Signer et émettre", exact: true })
    .click();
  await expect(section.getByText(/Remplace la version/).first()).toBeVisible();
  await section.getByText("Versions conservées", { exact: true }).click();
  await expect(
    section.getByText(/REMPLACÉE — version conservée/).first(),
  ).toBeVisible();
  const preview=section.locator('.prescription-print').first();
  await preview.evaluate(el=>{el.classList.add('printing');document.body.classList.add('printing-prescription');});
  await page.emulateMedia({media:'print'});
  expect(await preview.evaluate(el=>getComputedStyle(el).visibility)).toBe('visible');
  expect(await page.getByRole('heading',{name:'Clinique patients fictifs'}).evaluate(el=>getComputedStyle(el).visibility)).toBe('hidden');
  await preview.screenshot({path:test.info().outputPath('prescription-print.png')});
  await page.emulateMedia({media:'screen'});
  await preview.evaluate(el=>{el.classList.remove('printing');document.body.classList.remove('printing-prescription');});
  for (const width of [320, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await expect(
      section.getByLabel("Médicament", { exact: true }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  }
  expect(errors).toEqual([]);
});
async function acceptedPatient() {
  const p = await grant();
  const browser = request.agent("http://127.0.0.1:3000");
  let token = (await browser.get("/api/session")).body.csrfToken;
  const send = (path: string, body: object) =>
    browser
      .post(`/api/${path}`)
      .set("Origin", "http://127.0.0.1:4173")
      .set("x-csrf-token", token)
      .send(body);
  token = (
    await send("sign-in", {
      method: "clinic_username",
      clinicCode: code,
      username: "doctor",
      password: "Fictional-doctor-personal",
    })
  ).body.csrfToken;
  const catalog = (await browser.get("/api/catalog")).body.entries[0];
  const planId = randomUUID();
  const planPath = `treatment/${p.id}/plans`;
  expect(
    (
      await send(planPath, {
        commandId: randomUUID(),
        id: planId,
        revision: 0,
        title: "Soins fictifs acceptés",
        currency: "MRU",
        items: [1, 2].map(() => ({
          id: randomUUID(),
          procedureId: catalog.id,
          catalogRevision: catalog.revision,
          scope: "whole_mouth",
          teeth: [],
          price: "90",
          discount: "5",
          discountReason: "Tarif famille",
        })),
      })
    ).status,
  ).toBe(200);
  for (const [action, revision, extra] of [
    ["present", 1, {}],
    [
      "evidence",
      2,
      {
        acceptedBy: "Patient fictif",
        acceptedAt: "2026-10-16T12:00:00.000Z",
        method: "Oral",
      },
    ],
    ["accept", 3, {}],
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
  server = createBrowserApp().listen(3000, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  return { p, send, planId, browser };
}

test("French chart suggestion requires explicit valid FDI confirmation and supports dismissal", async ({
  page,
}) => {
  const catalog = (await manager.get("/api/catalog")).body.entries[0];
  expect(
    (
      await post("catalog", {
        commandId: randomUUID(),
        id: catalog.id,
        revision: catalog.revision,
        name: catalog.name,
        currency: "MRU",
        price: "100.00",
        durationMinutes: 45,
        active: true,
        chartCategory: "restoration",
      })
    ).status,
  ).toBe(200);
  const { p, send, browser, planId } = await acceptedPatient();
  const plan = (await browser.get(`/api/treatment/${p.id}/plans`)).body[0],
    id = randomUUID(),
    path = `treatment/${p.id}/visits`;
  expect(
    (
      await send(path, {
        commandId: randomUUID(),
        id,
        appointmentId: null,
        procedures: plan.items.map((i: { id: string }) => ({
          planId,
          itemId: i.id,
          planRevision: plan.revision,
        })),
      })
    ).status,
  ).toBe(200);
  for (const [index, item] of plan.items.entries())
    expect(
      (
        await send(path + "/actions", {
          commandId: randomUUID(),
          id,
          revision: index + 1,
          action: "complete",
          planId,
          itemId: item.id,
        })
      ).status,
    ).toBe(200);
  await loginDoctor(page);
  await page
    .getByRole("button", {
      name: `Ouvrir le dossier n°${p.patientNumber} — ${p.name}`,
    })
    .click();
  const panel = page.getByRole("region", {
    name: "Suggestions du schéma",
    exact: true,
  });
  const forms = panel.locator("form");
  await forms.first().getByLabel("Dents FDI séparées par virgules").fill("16");
  await forms
    .first()
    .getByLabel(/Surfaces/)
    .fill("mesial");
  await forms
    .first()
    .getByRole("button", { name: "Confirmer la suggestion" })
    .click();
  await expect(panel.getByText(/Confirmée/)).toBeVisible();
  await forms
    .last()
    .getByRole("button", { name: "Ignorer la suggestion" })
    .click();
  await expect(panel.getByText(/Ignorée/)).toBeVisible();
});
