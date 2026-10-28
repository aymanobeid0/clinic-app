import { randomUUID } from "node:crypto";
import {
  test,
  expect,
  request,
  type APIRequestContext,
  type Page,
} from "@playwright/test";
import {
  openDatabase,
  type ClinicTransaction,
} from "../../api/src/database.js";
import { createApplication } from "../../api/src/application.js";
import { provisionClinic } from "../../api/src/modules/identity/index.js";

const origin = "http://127.0.0.1:4187";
const port = process.env.CLINIC_TEST_PORT;
if (port !== "55445")
  throw new Error("Issue107 disposable database on55445 required.");
const owner = openDatabase(
  `postgresql://clinic_test:fictional-only@127.0.0.1:${port}/clinic_issue7`,
);
const runtime = openDatabase(
  `postgresql://clinic_runtime_test:fictional-runtime-only@127.0.0.1:${port}/clinic_issue7`,
);
// Browser navigation can abort HTTP responses before their real transactions
// settle. Track the persistence boundary solely to drain it during teardown.
const transactions = new Set<Promise<unknown>>();
const database = {
  ...runtime,
  clinicTransaction<T>(
    clinicId: string,
    action: (tx: ClinicTransaction) => Promise<T>,
  ) {
    const result = runtime.clinicTransaction(clinicId, action);
    transactions.add(result);
    void result.finally(() => transactions.delete(result)).catch(() => {});
    return result;
  },
};
let verification = "";
const options = {
  database,
  origin,
  secureCookies: false,
  sessionSecret: "fictional-issue107-session-secret-long-enough",
  mail: {
    async sendVerification(message: { token: string }) {
      verification = message.token;
    },
  },
};
let server: ReturnType<ReturnType<typeof createApplication>["listen"]>;
test.beforeAll(async () => {
  await owner.connect();
  await runtime.connect();
});
test.beforeEach(async () => {
  const app = createApplication(options);
  server = app.listen(3187, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
});
test.afterEach(async () => {
  if (server)
    await new Promise<void>((resolve) => server.close(() => resolve()));
  while (transactions.size) await Promise.allSettled([...transactions]);
});
test.afterAll(async () => {
  await runtime.close();
  await owner.close();
});

async function client(context: APIRequestContext) {
  let csrf = (await (await context.get("/api/session")).json()).csrfToken;
  return async (path: string, data: object) => {
    const response = await context.post(`/api/${path}`, {
      headers: { Origin: origin, "x-csrf-token": csrf },
      data,
    });
    expect(response.ok(), await response.text()).toBe(true);
    const value = (await response.text()) ? await response.json() : undefined;
    if (value?.csrfToken) csrf = value.csrfToken;
    return value;
  };
}
async function setup(page: Page) {
  const code = `c107-${randomUUID()}`.slice(0, 32),
    email = `${code}@example.invalid`;
  const initial = "Fictional-initial-pass-1",
    password = "Fictional-personal-pass-2";
  await provisionClinic(owner, {
    clinicCode: code,
    clinicName: "Clinique fictive107",
    username: "manager",
    displayName: "Responsable",
    email,
    temporaryPassword: initial,
  });
  const manager = await request.newContext({
    baseURL: "http://127.0.0.1:3187",
  });
  let post = await client(manager);
  await post("sign-in", { method: "email", email, password: initial });
  await post("onboarding/password", { password });
  post = await client(manager);
  await post("sign-in", { method: "email", email, password });
  await post("onboarding/email", { email });
  const codes = await post("onboarding/verify-email", { token: verification });
  await post("onboarding/codes-saved", { batchId: codes.batchId, saved: true });
  const identity = await (await manager.get("/api/identity")).json();
  await post(`accounts/${identity.accountId}/permissions`, {
    revision: 0,
    currentPassword: password,
    permissions: ["patients.create", "catalog.manage"],
  });
  const { patient } = await post("patients", {
    commandId: randomUUID(),
    name: "Patient fictif107",
    phone: "70000000",
    contactKind: "patient",
    contactName: "",
  });
  const doctor = await post("accounts", {
    username: "doctor",
    displayName: "Dentiste fictif107",
    kind: "doctor",
    temporaryPassword: initial,
    currentPassword: password,
  });
  await post(`accounts/${doctor.id}/permissions`, {
    revision: doctor.revision,
    currentPassword: password,
    permissions: [
      "clinical.read",
      "clinical.history",
      "plans.draft",
      "plans.finalize",
      "plans.accept",
      "acceptance.draft",
      "procedures.start",
      "procedures.complete",
      "notes.draft",
      "notes.finalize",
      "billing.read",
      "billing.edit",
    ],
  });
  let doctorPost = await client(page.request);
  await doctorPost("sign-in", {
    method: "clinic_username",
    clinicCode: code,
    username: "doctor",
    password: initial,
  });
  await doctorPost("onboarding/password", { password });
  doctorPost = await client(page.request);
  await doctorPost("sign-in", {
    method: "clinic_username",
    clinicCode: code,
    username: "doctor",
    password,
  });
  // Registration and booking do not create active clinical authority.
  expect(
    (await page.request.get(`/api/consultations/${patient.id}`)).status(),
  ).toBe(403);
  await post(`patient-access/${patient.id}/share`, {
    commandId: randomUUID(),
    revision: 0,
    accountId: doctor.id,
    kind: "shared",
  });
  await post("catalog/currencies", { commandId: randomUUID(), code: "MRU" });
  await post("consultation-settings/price", {
    commandId: randomUUID(),
    revision: 0,
    currency: "MRU",
    price: "500",
  });
  await post("consultation-settings/remuneration", {
    commandId: randomUUID(),
    doctorId: doctor.id,
    revision: 0,
    mode: "percentage",
    rate: "40",
  });
  const method = randomUUID();
  await post("billing/payment-methods", {
    commandId: randomUUID(),
    id: method,
    revision: 0,
    name: "Espèces fictives",
    active: true,
  });
  return { manager, post, doctorPost, doctor, patient, method };
}

for (const sequence of ["payment-first", "entry-first"]) {
  test(`connected fictional ${sequence}:500/40%, retained rate, same encounter and pending note`, async ({
    page,
  }) => {
    const pending = new Set<import("@playwright/test").Request>();
    page.on("request", (req) => {
      if (req.url().includes("/api/") && !req.url().includes("/events"))
        pending.add(req);
    });
    page.on("requestfinished", (req) => pending.delete(req));
    page.on("requestfailed", (req) => pending.delete(req));
    const s = await setup(page);
    try {
      const procedureId = randomUUID(),
        planId = randomUUID(),
        itemId = randomUUID();
      await s.post("catalog", {
        commandId: randomUUID(),
        id: procedureId,
        revision: 0,
        name: "Acte fictif",
        currency: "MRU",
        price: "100",
        durationMinutes: 30,
        active: true,
      });
      const path = `treatment/${s.patient.id}/plans`;
      await s.doctorPost(path, {
        commandId: randomUUID(),
        id: planId,
        revision: 0,
        title: "Plan fictif",
        currency: "MRU",
        items: [
          {
            id: itemId,
            procedureId,
            catalogRevision: 1,
            scope: "whole_mouth",
            teeth: [],
            price: "100",
            discount: "0",
            discountReason: "",
          },
        ],
      });
      for (const [action, revision, extra] of [
        ["present", 1, {}],
        [
          "evidence",
          2,
          {
            acceptedBy: "Patient fictif",
            acceptedAt: new Date().toISOString(),
            method: "Oral",
          },
        ],
        ["accept", 3, {}],
      ] as const)
        await s.doctorPost(`${path}/lifecycle`, {
          commandId: randomUUID(),
          id: planId,
          revision,
          action,
          ...extra,
        });
      await page.goto(
        `/test/consultation-workflows.harness.html?live&care&patient=${s.patient.id}&plan=${planId}&item=${itemId}&revision=4`,
      );
      await expect(page.getByTestId("rows")).toHaveText("[]");
      await page.getByRole("button", { name: "Réserver", exact: true }).click();
      await expect(page.getByTestId("rows")).toContainText('"status":"booked"');
      await expect(page.getByTestId("day")).toContainText(s.patient.id);
      const pay = async () => {
        await page.getByLabel("Montant reçu").fill("500");
        await page.getByLabel("Méthode").fill(s.method);
        await page.getByRole("button", { name: "Payer", exact: true }).click();
        await expect(page.getByTestId("share")).toContainText(
          '"shareNumerator":"2000000"',
        );
      };
      const enter = async () => {
        await page.getByRole("button", { name: "Entrer", exact: true }).click();
        await expect(page.getByTestId("rows")).toContainText(
          '"status":"entered"',
        );
      };
      if (sequence === "payment-first") {
        await pay();
        await expect(page.getByTestId("billing")).toContainText(
          '"dueMinor":"0"',
        );
        const before = JSON.parse(
          await page.getByTestId("billing").innerText(),
        );
        expect(before.charges).toHaveLength(0);
        expect(before.creditSources).toHaveLength(0);
      } else {
        await enter();
        await expect(page.getByTestId("billing")).toContainText(
          '"dueMinor":"50000"',
        );
        await expect(page.getByTestId("share")).toContainText(
          '"shareNumerator":"0"',
        );
      }
      await s.post("consultation-settings/remuneration", {
        commandId: randomUUID(),
        doctorId: s.doctor.id,
        revision: 1,
        mode: "percentage",
        rate: "50",
      });
      if (sequence === "payment-first") await enter();
      else await pay();
      await expect(page.getByTestId("share")).toContainText('"rate":"40"');
      await expect(page.getByTestId("billing")).toContainText('"dueMinor":"0"');
      const billing = JSON.parse(await page.getByTestId("billing").innerText());
      expect(billing.settlements).toHaveLength(1);
      expect(billing.settlements[0].receiptNumber).toBeTruthy();
      const visitId = JSON.parse(await page.getByTestId("rows").innerText())[0]
        .visitId;
      await page.getByRole("button", { name: "Terminer consultation" }).click();
      await expect(page.getByTestId("rows")).toContainText(
        '"status":"completed"',
      );
      await page.getByRole("button", { name: "Ajouter traitement" }).click();
      await expect(page.getByTestId("visits")).toContainText(itemId);
      let visits = JSON.parse(await page.getByTestId("visits").innerText());
      expect(visits.visits).toHaveLength(1);
      expect(visits.visits[0].id).toBe(visitId);
      expect(visits.completions).toHaveLength(0);
      await page.getByRole("button", { name: "Terminer acte" }).click();
      await expect
        .poll(
          async () =>
            JSON.parse(await page.getByTestId("visits").innerText()).completions
              .length,
        )
        .toBe(1);
      await page
        .getByLabel("Note", { exact: true })
        .fill("Note fictive107 à terminer");
      await page.getByRole("button", { name: "Sauver note" }).click();
      await expect(page.getByTestId("note-data")).toContainText(
        "Note fictive107 à terminer",
      );
      await page.getByRole("button", { name: "Fin soins" }).click();
      await expect(page.getByTestId("visits")).toContainText(
        '"status":"ended"',
      );
      await expect(page.getByTestId("note-pending")).toHaveText("true");
      await page.getByRole("button", { name: "Finaliser note" }).click();
      await expect(page.getByTestId("note-pending")).toHaveText("false");
      visits = JSON.parse(await page.getByTestId("visits").innerText());
      expect(visits.starts).toHaveLength(1);
    } finally {
      // Finish authorized refreshes before closing their API/database. Navigating
      // away first aborts responses while their transactions may still be running.
      await expect.poll(() => pending.size).toBe(0);
      await page.goto("about:blank");
      await s.manager.dispose();
    }
  });
}
