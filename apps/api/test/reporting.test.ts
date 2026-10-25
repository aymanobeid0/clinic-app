import { randomUUID } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { createApplication } from "../src/application.js";
import { openDatabase } from "../src/database.js";
import { provisionClinic } from "../src/modules/identity/index.js";
const owner = openDatabase(
  `postgresql://clinic_test:fictional-only@127.0.0.1:${process.env.CLINIC_TEST_PORT ?? "55437"}/clinic_issue7`,
);
const runtime = openDatabase(
  `postgresql://clinic_runtime_test:fictional-runtime-only@127.0.0.1:${process.env.CLINIC_TEST_PORT ?? "55437"}/clinic_issue7`,
);
const origin = "http://localhost:4173";
let time = Date.now();
let token = "";
const options = {
  now: () => time,
  database: runtime,
  origin,
  secureCookies: false,
  sessionSecret: "fictional-session-secret-at-least-32-characters",
  mail: {
    async sendVerification(message: { token: string }) {
      token = message.token;
    },
  },
};
let app = createApplication(options);
beforeEach(() => {
  time = Date.now();
  app = createApplication(options);
});
beforeAll(async () => {
  await owner.connect();
  await runtime.connect();
});
afterAll(async () => {
  await runtime.close();
  await owner.close();
});
async function manager() {
  const code = `test-${randomUUID()}`.slice(0, 32);
  const email = `${code}@example.invalid`;
  await provisionClinic(owner, {
    clinicCode: code,
    clinicName: "Clinique fictive",
    username: "manager",
    displayName: "Responsable",
    email,
    temporaryPassword: "Fictional-initial-pass-1",
  });
  const browser = request.agent(app);
  let csrf = "";
  const post = async (
    path: string,
    body: Record<string, unknown> & { revision?: number },
  ) => {
    let payload = body;
    const id = /^\/accounts\/([^/]+)\//.exec(path)?.[1];
    if (id && body.revision === undefined) {
      const list = await browser.get("/api/accounts");
      const account = Array.isArray(list.body)
        ? list.body.find((a: { id: string }) => a.id === id)
        : undefined;
      payload = { ...body, revision: account?.revision ?? 0 };
    }
    return browser
      .post(`/api${path}`)
      .set("Origin", origin)
      .set("x-csrf-token", csrf)
      .send(payload);
  };
  const login = async (password: string) => {
    csrf = (await browser.get("/api/session")).body.csrfToken;
    const result = await post("/sign-in", { method: "email", email, password });
    csrf = result.body.csrfToken;
    return result;
  };
  await login("Fictional-initial-pass-1");
  await post("/onboarding/password", { password: "Fictional-manager-pass-2" });
  await login("Fictional-manager-pass-2");
  await post("/onboarding/email", { email });
  const batch = await post("/onboarding/verify-email", { token });
  await post("/onboarding/codes-saved", {
    batchId: batch.body.batchId,
    saved: true,
  });
  return {
    browser,
    post,
    code,
    email,
    login,
    codes: batch.body.codes as string[],
  };
}

async function activateEmployee(code: string, username: string) {
  const browser = request.agent(app);
  let csrf = (await browser.get("/api/session")).body.csrfToken;
  const post = (path: string, body: object) =>
    browser
      .post(`/api${path}`)
      .set("Origin", origin)
      .set("x-csrf-token", csrf)
      .send(body);
  const signIn = async (password: string) => {
    const result = await post("/sign-in", {
      method: "clinic_username",
      clinicCode: code,
      username,
      password,
    });
    csrf = result.body.csrfToken;
    return result;
  };
  await signIn("Fictional-initial-pass-1");
  await post("/onboarding/password", { password: "Fictional-employee-pass-2" });
  csrf = (await browser.get("/api/session")).body.csrfToken;
  expect((await signIn("Fictional-employee-pass-2")).status).toBe(200);
  const identity = (await browser.get("/api/identity")).body;
  return { browser, post, identity, signIn };
}

it("operational reports require authentication and return an empty daily projection for authorized accounts", async () => {
  expect(
    (await request(app).get("/api/reports/appointments?date=2026-10-22"))
      .status,
  ).toBe(401);
  const m = await manager();
  expect(
    (await m.browser.get("/api/reports/appointments?date=2026-10-22")).status,
  ).toBe(403);
  const id = (await m.browser.get("/api/identity")).body.accountId;
  await m.post(`/accounts/${id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: ["reports.operational"],
  });
  const result = await m.browser.get(
    "/api/reports/appointments?date=2026-10-22",
  );
  expect(result.status).toBe(200);
  expect(result.body).toEqual({ date: "2026-10-22", appointments: [] });
});
async function scenario(_now?: number) {
  const m = await manager();

  const ownId = (await m.browser.get("/api/identity")).body.accountId;

  await m.post(`/accounts/${ownId}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",

    permissions: ["patients.create"],
  });

  const patient = (
    await m.post("/patients", {
      commandId: randomUUID(),

      name: "Patient confidentiel fictif",

      phone: "70000000",

      contactKind: "patient",

      contactName: "",
    })
  ).body.patient;

  const create = async (
    username: string,

    kind = "doctor",

    permissions = ["clinical.read", "notes.draft"],
  ) => {
    const account = (
      await m.post("/accounts", {
        username,

        displayName: username,

        kind,

        temporaryPassword: "Fictional-initial-pass-1",

        currentPassword: "Fictional-manager-pass-2",
      })
    ).body;

    await m.post(`/accounts/${account.id}/permissions`, {
      currentPassword: "Fictional-manager-pass-2",

      permissions,
    });

    const employee = await activateEmployee(m.code, username);

    return { ...employee, id: account.id };
  };

  return { m, patient, create };
}

async function treatmentScenario(currency = "MRU", now?: number) {
  const { m, patient, create } = await scenario(now);
  const own = (await m.browser.get("/api/identity")).body.accountId;
  await m.post(`/accounts/${own}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: ["patients.create", "catalog.manage"],
  });
  await m.post("/catalog/currencies", {
    commandId: randomUUID(),
    code: currency,
  });
  const procedureId = randomUUID();
  const catalog = {
    id: procedureId,
    revision: 0,
    name: "Acte fictif",
    currency,
    price: "100",
    durationMinutes: 40,
    active: true,
  };
  expect(
    (await m.post("/catalog", { ...catalog, commandId: randomUUID() })).status,
  ).toBe(200);
  const doctor = await create("doctor", "doctor", [
    "clinical.read",
    "clinical.history",
    "plans.draft",
  ]);
  await m.post(`/patient-access/${patient.id}/share`, {
    commandId: randomUUID(),
    revision: 0,
    accountId: doctor.id,
    kind: "shared",
  });
  const command = {
    commandId: randomUUID(),
    id: randomUUID(),
    revision: 0,
    title: "Proposition fictive",
    currency,
    items: [
      {
        id: randomUUID(),
        procedureId,
        catalogRevision: 1,
        scope: "whole_mouth",
        teeth: [] as string[],
        price: "100",
        discount: "0",
        discountReason: "",
      },
    ],
  };
  return {
    m,
    patient,
    create,
    doctor,
    catalog,
    command,
    path: `/treatment/${patient.id}/plans`,
  };
}

async function visitScenario(currency = "MRU", now?: number, count = 2) {
  const s = await treatmentScenario(currency, now);
  await s.m.post(`/accounts/${s.doctor.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: [
      "clinical.read",
      "clinical.history",
      "plans.draft",
      "plans.finalize",
      "plans.accept",
      "acceptance.draft",
      "procedures.start",
      "procedures.complete",
    ],
  });
  const items = Array.from({ length: count }, () => ({
    ...s.command.items[0]!,
    id: randomUUID(),
  }));
  await s.doctor.post(s.path, { ...s.command, items });
  const change = (action: string, revision: number, extra: object = {}) =>
    s.doctor.post(`${s.path}/lifecycle`, {
      commandId: randomUUID(),
      id: s.command.id,
      revision,
      action,
      ...extra,
    });
  await change("present", 1);
  await change("evidence", 2, {
    acceptedBy: "Patient fictif",
    acceptedAt: "2026-10-16T12:00:00.000Z",
    method: "Oral",
  });
  expect((await change("accept", 3)).status).toBe(200);
  const selections = items.map((i) => ({
    planId: s.command.id,
    itemId: i.id,
    planRevision: 4,
  }));
  const path = `/treatment/${s.patient.id}/visits`;
  const start = {
    commandId: randomUUID(),
    id: randomUUID(),
    appointmentId: null,
    procedures: selections,
  };
  return { ...s, path, selections, start };
}

it("financial report reconciles new receipts, applied credit, opening debt and adjustments without charging future care", async () => {
  const s = await visitScenario();
  const before = await s.m.browser.get(
    "/api/reports/financial?date=" + new Date(time).toISOString().slice(0, 10),
  );
  expect(before.status).toBe(200);
  expect(before.body.totals).toMatchObject([
    {
      currency: "MRU",
      dueMinor: "0",
      plannedMinor: "20000",
      newMoneyMinor: "0",
    },
  ]);
  expect(
    (
      await s.doctor.post(s.path, {
        ...s.start,
        procedures: s.selections.slice(0, 1),
      })
    ).status,
  ).toBe(200);
  const base = "/billing/" + s.patient.id;
  const charge = (await s.m.browser.get("/api" + base)).body.charges[0];
  await s.m.post(base + "/opening-balances", {
    commandId: randomUUID(),
    id: randomUUID(),
    currency: "MRU",
    amount: "12",
    provenance: "Legacy register",
    asOf: "2026-10-01T00:00:00.000Z",
  });
  const method = await s.m.post("/billing/payment-methods", {
    commandId: randomUUID(),
    id: randomUUID(),
    revision: 0,
    name: "Cash",
    active: true,
  });
  expect(
    (
      await s.m.post(base + "/settlements", {
        commandId: randomUUID(),
        currency: "MRU",
        methodId: method.body.id,
        newMoney: "30",
        deposit: "30",
        allocations: [],
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await s.m.post(base + "/settlements", {
        commandId: randomUUID(),
        currency: "MRU",
        methodId: method.body.id,
        newMoney: "50",
        deposit: "0",
        allocations: [{ chargeId: charge.id, newMoney: "50", credit: "30" }],
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await s.m.post(base + "/credits", {
        commandId: randomUUID(),
        chargeId: charge.id,
        revision: 0,
        finalCharge: "90",
        reason: "Approved reduction",
      })
    ).status,
  ).toBe(200);
  const r = await s.m.browser.get(
    "/api/reports/financial?date=" + new Date(time).toISOString().slice(0, 10),
  );
  expect(r.status).toBe(200);
  expect(r.body.totals).toEqual([
    {
      currency: "MRU",
      newMoneyMinor: "8000",
      appliedCreditMinor: "3000",
      openingMinor: "1200",
      adjustmentMinor: "-1000",
      refundMinor: "0",
      reversedMoneyMinor: "0",
      invoiceMinor: "0",
      dueMinor: "2200",
      creditMinor: "0",
      plannedMinor: "10000",
    },
  ]);
});

it("stock report uses current movement balances and configured UTC expiry warnings without exposing another clinic", async () => {
  const m = await manager();
  const id = (await m.browser.get("/api/identity")).body.accountId;
  await m.post(`/accounts/${id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: [
      "reports.operational",
      "inventory.read",
      "inventory.receive",
      "inventory.consume",
    ],
  });
  await m.post("/catalog/currencies", { commandId: randomUUID(), code: "MRU" });
  const supplier = (
    await m.post("/inventory/suppliers", {
      commandId: randomUUID(),
      name: "Fictif",
      active: true,
    })
  ).body;
  const item = (
    await m.post("/inventory/items", {
      commandId: randomUUID(),
      name: "Gants",
      lowStockThreshold: 2,
      expiryRequired: true,
      active: true,
    })
  ).body;
  const batch = (
    await m.post("/inventory/receiving", {
      commandId: randomUUID(),
      itemId: item.id,
      supplierId: supplier.id,
      batchNumber: "REPORT-1",
      quantityPacks: 3,
      totalCostMinor: "100",
      currency: "MRU",
      expiresOn: new Date(time + 86400000).toISOString().slice(0, 10),
    })
  ).body;
  expect(
    (
      await m.post("/inventory/consume", {
        commandId: randomUUID(),
        batchId: batch.id,
        quantityPacks: 1,
      })
    ).status,
  ).toBe(200);
  const report = await m.browser.get("/api/reports/stock");
  expect(report.status).toBe(200);
  expect(report.body.lowStock).toMatchObject([
    { id: item.id, availablePacks: 2 },
  ]);
  expect(report.body.expiring).toMatchObject([
    { id: batch.id, remainingPacks: 2 },
  ]);
  const other = await manager();
  const otherId = (await other.browser.get("/api/identity")).body.accountId;
  await other.post(`/accounts/${otherId}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: ["reports.operational", "inventory.read"],
  });
  expect((await other.browser.get("/api/reports/stock")).body.lowStock).toEqual(
    [],
  );
});

it("follow-up commands survive concurrent retries, reject stale edits and prepare manual content without sending", async () => {
  const s = await scenario();
  const id = (await s.m.browser.get("/api/identity")).body.accountId;
  await s.m.post(`/accounts/${id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: ["reports.operational"],
  });
  const command = {
    commandId: randomUUID(),
    patientId: s.patient.id,
    dueOn: "2026-10-23",
  };
  const created = await Promise.all([
    s.m.post("/follow-ups", command),
    s.m.post("/follow-ups", command),
  ]);
  expect(created.map((r) => r.status)).toEqual([200, 200]);
  expect(created[0].body).toEqual(created[1].body);
  const task = created[0].body;
  expect((await s.m.browser.get("/api/follow-ups")).body.tasks).toMatchObject([
    { id: task.id, status: "open", revision: 1 },
  ]);
  expect(
    (await s.m.post("/follow-ups", { ...command, dueOn: "2026-10-24" })).status,
  ).toBe(409);
  const change = { commandId: randomUUID(), revision: 1, status: "completed" };
  const otherChange = { ...change, commandId: randomUUID(), status: "open" };
  const updates = await Promise.all([
    s.m.post("/follow-ups/" + task.id, change),
    s.m.post("/follow-ups/" + task.id, otherChange),
  ]);
  expect(updates.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(
    (
      await s.m.post(
        "/follow-ups/" + task.id,
        updates[0]!.status === 200 ? change : otherChange,
      )
    ).status,
  ).toBe(200);
  const share = await s.m.browser.get("/api/follow-ups/" + task.id + "/share");
  expect(share.status).toBe(200);
  expect(share.body).toMatchObject({
    delivery: "manual",
    text: "Bonjour Patient confidentiel fictif, merci de contacter Clinique fictive.",
  });
  const other = await manager();
  const otherId = (await other.browser.get("/api/identity")).body.accountId;
  await other.post(`/accounts/${otherId}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: ["reports.operational"],
  });
  expect(
    (await other.browser.get("/api/follow-ups/" + task.id + "/share")).status,
  ).toBe(404);
  expect((await other.post("/follow-ups", command)).status).toBe(404);
  expect((await s.m.browser.get("/api/follow-ups")).body.tasks).toHaveLength(1);
});

it("pending-note tasks follow finalization and corrections while excluding nonclinical managers", async () => {
  const s = await visitScenario();
  await s.doctor.post(s.path, s.start);
  expect(
    (
      await s.doctor.post(s.path + "/actions", {
        commandId: randomUUID(),
        id: s.start.id,
        revision: 1,
        action: "end",
      })
    ).status,
  ).toBe(200);
  await s.m.post(`/accounts/${s.doctor.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: [
      "clinical.read",
      "notes.draft",
      "notes.finalize",
      "reports.operational",
    ],
  });
  const tasks = "/api/follow-ups";
  expect((await s.doctor.browser.get(tasks)).body.pendingNotes).toMatchObject([
    { visitId: s.start.id, patientId: s.patient.id, kind: "pending_note" },
  ]);
  const note = "/clinical/" + s.patient.id + "/notes/" + s.start.id;
  expect(
    (
      await s.doctor.post(note + "/draft", {
        commandId: randomUUID(),
        revision: 0,
        text: "Secret clinique",
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await s.doctor.post(note + "/finalize", {
        commandId: randomUUID(),
        revision: 1,
      })
    ).status,
  ).toBe(200);
  expect((await s.doctor.browser.get(tasks)).body.pendingNotes).toEqual([]);
  expect(
    (
      await s.doctor.post(note + "/draft", {
        commandId: randomUUID(),
        revision: 2,
        text: "Correction secrète",
      })
    ).status,
  ).toBe(200);
  expect((await s.doctor.browser.get(tasks)).body.pendingNotes).toHaveLength(1);
  const id = (await s.m.browser.get("/api/identity")).body.accountId;
  await s.m.post(`/accounts/${id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: ["reports.operational"],
  });
  expect((await s.m.browser.get(tasks)).body.pendingNotes).toEqual([]);
  expect(
    JSON.stringify((await s.doctor.browser.get(tasks)).body),
  ).not.toContain("secr");
});

it("financial activity lists payments and invoices in their original currencies without creating debt from invoices", async () => {
  const s = await visitScenario();
  await s.doctor.post(s.path, s.start);
  for (const [i, p] of s.selections.entries())
    expect(
      (
        await s.doctor.post(s.path + "/actions", {
          commandId: randomUUID(),
          id: s.start.id,
          revision: i + 1,
          action: "complete",
          planId: p.planId,
          itemId: p.itemId,
        })
      ).status,
    ).toBe(200);
  const base = "/billing/" + s.patient.id;
  const charges = (await s.m.browser.get("/api" + base)).body.charges as {
    id: string;
  }[];
  const method = await s.m.post("/billing/payment-methods", {
    commandId: randomUUID(),
    id: randomUUID(),
    revision: 0,
    name: "Cash",
    active: true,
  });
  const receipt = await s.m.post(base + "/settlements", {
    commandId: randomUUID(),
    currency: "MRU",
    methodId: method.body.id,
    newMoney: "200",
    deposit: "0",
    allocations: charges.map((ch) => ({
      chargeId: ch.id,
      newMoney: "100",
      credit: "0",
    })),
  });
  expect(receipt.status).toBe(200);
  const invoice = await s.m.post(base + "/invoices", {
    commandId: randomUUID(),
    chargeIds: charges.map((ch) => ch.id),
  });
  expect(invoice.status).toBe(200);
  const report = await s.m.browser.get(
    "/api/reports/financial?date=" + new Date(time).toISOString().slice(0, 10),
  );
  expect(report.body.patients[0].payments).toMatchObject([
    {
      id: receipt.body.id,
      receiptNumber: receipt.body.receiptNumber,
      currency: "MRU",
      newMoneyMinor: "20000",
      appliedCreditMinor: "0",
    },
  ]);
  expect(report.body.patients[0].invoices).toMatchObject([
    { id: invoice.body.id, totalMinor: "20000" },
  ]);
  expect(report.body.totals[0]).toMatchObject({
    newMoneyMinor: "20000",
    invoiceMinor: "20000",
    dueMinor: "0",
  });
});
async function mixedCorrectionScenario() {
  const s = await visitScenario();
  expect(
    (
      await s.doctor.post(s.path, {
        ...s.start,
        procedures: s.selections.slice(0, 1),
      })
    ).status,
  ).toBe(200);
  const other = await s.create("other-correction-doctor", "doctor", [
    "clinical.read",
    "procedures.start",
    "plans.finalize",
    "billing.read",
    "billing.edit",
    "refunds",
    "discounts",
  ]);
  expect(
    (
      await s.m.post(`/patient-access/${s.patient.id}/share`, {
        commandId: randomUUID(),
        revision: 1,
        accountId: other.id,
        kind: "shared",
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await other.post(s.path, {
        ...s.start,
        commandId: randomUUID(),
        id: randomUUID(),
        procedures: [{ ...s.selections[1], planRevision: 5 }],
      })
    ).status,
  ).toBe(200);
  const base = "/billing/" + s.patient.id;
  const charges = (await s.m.browser.get("/api" + base)).body.charges as {
    id: string;
    performedBy: string;
  }[];
  const own = charges.find((ch) => ch.performedBy === s.doctor.id)!;
  const foreign = charges.find((ch) => ch.performedBy === other.id)!;
  const methodId = randomUUID();
  expect(
    (
      await s.m.post("/billing/payment-methods", {
        commandId: randomUUID(),
        id: methodId,
        revision: 0,
        name: "Cash",
        active: true,
      })
    ).status,
  ).toBe(200);
  return { ...s, base, charges, own, foreign, other, methodId };
}

it("doctor financial totals split mixed receipts by performed work and lose patient access immediately", async () => {
  const s = await mixedCorrectionScenario();
  await s.m.post(`/accounts/${s.doctor.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: ["billing.read", "reports.financial", "reports.operational"],
  });
  const receipt = await s.m.post(s.base + "/settlements", {
    commandId: randomUUID(),
    currency: "MRU",
    methodId: s.methodId,
    newMoney: "100",
    deposit: "0",
    allocations: [
      { chargeId: s.own.id, newMoney: "30", credit: "0" },
      { chargeId: s.foreign.id, newMoney: "70", credit: "0" },
    ],
  });
  expect(receipt.status).toBe(200);
  const path =
    "/api/reports/financial?date=" + new Date(time).toISOString().slice(0, 10);
  const own = await s.doctor.browser.get(path);
  expect(own.status).toBe(200);
  expect(own.body.totals[0]).toMatchObject({
    newMoneyMinor: "3000",
    dueMinor: "7000",
    openingMinor: "0",
  });
  expect(own.body.patients[0].payments[0]).toMatchObject({
    newMoneyMinor: "3000",
  });
  expect(JSON.stringify(own.body)).not.toContain(s.foreign.id);
  const staff = await s.create("finance-report", "staff", [
    "reports.financial",
    "billing.read",
  ]);
  expect((await staff.browser.get(path)).body.totals[0]).toMatchObject({
    newMoneyMinor: "10000",
    dueMinor: "10000",
  });
  expect(JSON.stringify((await staff.browser.get(path)).body)).not.toContain(
    "Acte fictif",
  );
  const denied = await s.create("report-only", "staff", ["reports.financial"]);
  expect((await denied.browser.get(path)).status).toBe(403);
  expect(
    (
      await s.m.post(`/patient-access/${s.patient.id}/remove`, {
        commandId: randomUUID(),
        revision: 2,
        accountId: s.doctor.id,
      })
    ).status,
  ).toBe(200);
  expect((await s.doctor.browser.get(path)).body).toMatchObject({
    totals: [],
    patients: [],
  });
  expect(
    (
      await s.doctor.post("/follow-ups", {
        commandId: randomUUID(),
        patientId: s.patient.id,
        dueOn: "2026-10-23",
      })
    ).status,
  ).toBe(404);
  const foreignClinic = await manager();
  expect((await foreignClinic.browser.get(path)).body.patients).toEqual([]);
});
it("database failures leave no follow-up event and identical retry succeeds without leaking database errors", async () => {
  const s = await scenario();
  const id = (await s.m.browser.get("/api/identity")).body.accountId;
  await s.m.post(`/accounts/${id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: ["reports.operational"],
  });
  const clinicId = (await s.m.browser.get("/api/identity")).body.clinicId;
  await owner.pool.query(
    `CREATE FUNCTION reporting_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."clinicId"::text = '${clinicId}' THEN RAISE EXCEPTION 'FICTIONAL_TASK_FAILURE'; END IF; RETURN NEW; END $$`,
  );
  await owner.pool.query(
    'CREATE TRIGGER reporting_test_failure BEFORE INSERT ON "FollowUpEvent" FOR EACH ROW EXECUTE FUNCTION reporting_test_failure()',
  );
  const command = {
    commandId: randomUUID(),
    patientId: s.patient.id,
    dueOn: "2026-10-23",
  };
  try {
    const result = await s.m.post("/follow-ups", command);
    expect(result.status).toBe(500);
    expect(JSON.stringify(result.body)).not.toContain("FICTIONAL_TASK_FAILURE");
    expect((await s.m.browser.get("/api/follow-ups")).body.tasks).toEqual([]);
  } finally {
    await owner.pool.query(
      'DROP TRIGGER reporting_test_failure ON "FollowUpEvent"',
    );
    await owner.pool.query("DROP FUNCTION reporting_test_failure()");
  }
  const success = await s.m.post("/follow-ups", command);
  expect(success.status).toBe(200);
  expect((await s.m.post("/follow-ups", command)).body).toEqual(success.body);
  expect(
    (await s.m.browser.get("/api/follow-ups/" + success.body.id + "/history"))
      .body.events,
  ).toHaveLength(1);
});
it("daily appointment reports validate UTC dates, include overlapping visits and filter doctors to active patients", async () => {
  const s = await scenario();
  const id = (await s.m.browser.get("/api/identity")).body.accountId;
  await s.m.post(`/accounts/${id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: [
      "reports.operational",
      "appointments.manage",
      "patients.create",
    ],
  });
  const d = await s.create("agenda", "doctor", [
    "reports.operational",
    "clinical.read",
  ]);
  const hidden = (
    await s.m.post("/patients", {
      commandId: randomUUID(),
      name: "Hidden patient",
      phone: "70000001",
      contactKind: "patient",
      contactName: "",
    })
  ).body.patient;
  for (const [i, p] of [s.patient, hidden].entries())
    expect(
      (
        await s.m.post("/appointments", {
          commandId: randomUUID(),
          patientId: p.id,
          dentistId: d.id,
          chairId: null,
          startsAt: i === 0 ? "2026-10-21T23:45:00Z" : "2026-10-22T10:00:00Z",
          durationMinutes: 30,
        })
      ).status,
    ).toBe(201);
  expect(
    (
      await s.m.post(`/patient-access/${s.patient.id}/share`, {
        commandId: randomUUID(),
        revision: 0,
        accountId: d.id,
        kind: "shared",
      })
    ).status,
  ).toBe(200);
  const path = "/api/reports/appointments?date=2026-10-22";
  expect((await s.m.browser.get(path)).body.appointments).toHaveLength(2);
  const own = await d.browser.get(path);
  expect(own.body.appointments).toMatchObject([{ patientId: s.patient.id }]);
  expect(JSON.stringify(own.body)).not.toContain(hidden.id);
  for (const suffix of [
    "?date=2026-02-30",
    "?date=wrong",
    "?date=2026-10-22&clinicId=" + randomUUID(),
  ])
    expect(
      (await s.m.browser.get("/api/reports/appointments" + suffix)).status,
    ).toBe(400);
  expect(
    (
      await s.m.browser.post("/api/follow-ups").set("Origin", origin).send({
        commandId: randomUUID(),
        patientId: s.patient.id,
        dueOn: "2026-10-23",
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await s.m.post("/follow-ups", {
        commandId: randomUUID(),
        patientId: s.patient.id,
        dueOn: "2026-10-23",
        clinicId: randomUUID(),
      })
    ).status,
  ).toBe(400);
  await s.m.post(`/accounts/${d.id}/status`, {
    currentPassword: "Fictional-manager-pass-2",
    status: "historical",
  });
  expect((await d.browser.get(path)).status).toBe(401);
});

it("financial corrections reconcile refunds and reversals separately and never combine currencies", async () => {
  const s = await treatmentScenario();
  const base = "/billing/" + s.patient.id;
  const method = (
    await s.m.post("/billing/payment-methods", {
      commandId: randomUUID(),
      id: randomUUID(),
      revision: 0,
      name: "Cash",
      active: true,
    })
  ).body;
  const deposit = (amount: string, currency = "MRU") =>
    s.m.post(base + "/settlements", {
      commandId: randomUUID(),
      currency,
      methodId: method.id,
      newMoney: amount,
      deposit: amount,
      allocations: [],
    });
  const wrong = await deposit("100");
  expect(wrong.status).toBe(200);
  expect(
    (
      await s.m.post(base + "/reversals", {
        commandId: randomUUID(),
        settlementId: wrong.body.id,
        reason: "Mistaken entry",
      })
    ).status,
  ).toBe(200);
  const funds = await deposit("50");
  expect(funds.status).toBe(200);
  const refund = await s.m.post(base + "/refund-requests", {
    commandId: randomUUID(),
    sourceId: funds.body.id,
    amount: "20",
    reason: "Return deposit",
  });
  expect(refund.status).toBe(200);
  expect(
    (
      await s.m.post(base + "/refund-approvals", {
        commandId: randomUUID(),
        requestId: refund.body.id,
        reason: "Approved",
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await s.m.post(base + "/refunds", {
        commandId: randomUUID(),
        requestId: refund.body.id,
        reason: "Returned",
      })
    ).status,
  ).toBe(200);
  await s.m.post("/catalog/currencies", {
    commandId: randomUUID(),
    code: "EUR",
  });
  expect((await deposit("7", "EUR")).status).toBe(200);
  const r = await s.m.browser.get(
    "/api/reports/financial?date=" + new Date(time).toISOString().slice(0, 10),
  );
  expect(r.body.totals).toMatchObject([
    {
      currency: "EUR",
      newMoneyMinor: "700",
      creditMinor: "700",
      dueMinor: "0",
    },
    {
      currency: "MRU",
      newMoneyMinor: "15000",
      refundMinor: "2000",
      reversedMoneyMinor: "10000",
      creditMinor: "3000",
      dueMinor: "0",
    },
  ]);
  const yesterday = await s.m.browser.get(
    "/api/reports/financial?date=" +
      new Date(time - 86400000).toISOString().slice(0, 10),
  );
  expect(yesterday.body.totals).toMatchObject([
    { currency: "EUR", newMoneyMinor: "0", creditMinor: "700" },
    {
      currency: "MRU",
      newMoneyMinor: "0",
      refundMinor: "0",
      reversedMoneyMinor: "0",
      creditMinor: "3000",
    },
  ]);
});

it("doctor reports reconcile their allocation when a manager reverses a mixed-doctor receipt", async () => {
  const s = await mixedCorrectionScenario();
  await s.m.post(`/accounts/${s.doctor.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: ["billing.read", "reports.financial"],
  });
  const payment = await s.m.post(s.base + "/settlements", {
    commandId: randomUUID(),
    currency: "MRU",
    methodId: s.methodId,
    newMoney: "100",
    deposit: "0",
    allocations: [
      { chargeId: s.own.id, newMoney: "30", credit: "0" },
      { chargeId: s.foreign.id, newMoney: "70", credit: "0" },
    ],
  });
  expect(payment.status).toBe(200);
  expect(
    (
      await s.m.post(s.base + "/reversals", {
        commandId: randomUUID(),
        settlementId: payment.body.id,
        reason: "Mistaken mixed receipt",
      })
    ).status,
  ).toBe(200);
  const r = await s.doctor.browser.get(
    "/api/reports/financial?date=" + new Date(time).toISOString().slice(0, 10),
  );
  expect(r.status).toBe(200);
  expect(r.body.totals).toMatchObject([
    {
      currency: "MRU",
      newMoneyMinor: "3000",
      reversedMoneyMinor: "3000",
      dueMinor: "10000",
    },
  ]);
  expect(JSON.stringify(r.body)).not.toContain(s.foreign.id);
});

it("report-only SSE delivers neutral pending-note invalidations and closes after capability revocation", async () => {
  const s = await visitScenario();
  await s.doctor.post(s.path, s.start);
  await s.doctor.post(s.path + "/actions", {
    commandId: randomUUID(),
    id: s.start.id,
    revision: 1,
    action: "end",
  });
  await s.m.post(`/accounts/${s.doctor.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: ["reports.operational", "clinical.read", "notes.draft"],
  });
  const login = await s.doctor.signIn("Fictional-employee-pass-2");
  const cookie = (login.headers["set-cookie"] as unknown as string[])
    .map((v) => v.split(";")[0])
    .join("; ");
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const port = (server.address() as { port: number }).port;
  const abort = new AbortController();
  try {
    const response = await fetch(
      `http://127.0.0.1:${port}/api/reports/events?category=operational`,
      { headers: { Cookie: cookie }, signal: abort.signal },
    );
    expect(response.status).toBe(200);
    const reader = response.body!.getReader();
    await reader.read();
    await s.doctor.post(
      "/clinical/" + s.patient.id + "/notes/" + s.start.id + "/draft",
      { commandId: randomUUID(), revision: 0, text: "Private note contents" },
    );
    let signal = "";
    for (let i = 0; i < 5 && !signal.includes("event: invalidate"); i++)
      signal += new TextDecoder().decode((await reader.read()).value);
    expect(signal).toContain("event: invalidate");
    expect(signal).not.toContain(s.patient.id);
    expect(signal).not.toContain("Private");
    expect(signal).toContain("data: {}");
    await s.m.post(`/accounts/${s.doctor.id}/permissions`, {
      currentPassword: "Fictional-manager-pass-2",
      permissions: ["clinical.read", "notes.draft"],
    });
    let closed = false;
    for (let i = 0; i < 5; i++)
      if ((await reader.read()).done) {
        closed = true;
        break;
      }
    expect(closed).toBe(true);
  } finally {
    abort.abort();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  expect(
    (await s.doctor.browser.get("/api/reports/events?category=operational"))
      .status,
  ).toBe(403);
  expect(
    (await request(app).get("/api/reports/events?category=financial")).status,
  ).toBe(401);
});
