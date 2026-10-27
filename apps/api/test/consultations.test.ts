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

let token = "";

const options = {
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

async function scenario() {
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

async function treatmentScenario(currency = "MRU") {
  const { m, patient, create } = await scenario();
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

async function visitScenario(currency = "MRU") {
  const s = await treatmentScenario(currency);
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
  const items = [
    s.command.items[0]!,
    { ...s.command.items[0]!, id: randomUUID() },
  ];
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
it("recognizes provided treatment installments once at its first-start rate", async () => {
  const s = await visitScenario();
  await s.m.post(`/accounts/${s.doctor.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: [
      "clinical.read",
      "procedures.start",
      "billing.read",
      "billing.edit",
    ],
  });
  const setting = {
    commandId: randomUUID(),
    doctorId: s.doctor.id,
    revision: 0,
    mode: "percentage",
    rate: "40",
  };
  expect(
    (await s.m.post("/consultation-settings/remuneration", setting)).status,
  ).toBe(200);
  expect((await s.doctor.post(s.path, s.start)).status).toBe(200);
  const state = (await s.doctor.browser.get(`/api${s.path}`)).body;
  const start = state.starts[0];
  const sharePath = `/api/treatment/${s.patient.id}/starts/${start.id}/remuneration`;
  const initial = await s.doctor.browser.get(sharePath);
  expect(initial.status).toBe(200);
  expect(initial.body).toMatchObject({
    status: "configured",
    remuneration: { rate: "40" },
    recognizedBaseMinor: "0",
    shareNumerator: "0",
    shareDenominator: "100",
  });
  await s.m.post("/consultation-settings/remuneration", {
    ...setting,
    commandId: randomUUID(),
    revision: 1,
    rate: "50",
  });
  const methodId = randomUUID();
  await s.m.post("/billing/payment-methods", {
    commandId: randomUUID(),
    id: methodId,
    revision: 0,
    name: "Espèces",
    active: true,
  });
  const billing = `/billing/${s.patient.id}`;
  const deposit = await s.m.post(`${billing}/settlements`, {
    commandId: randomUUID(),
    currency: "MRU",
    methodId,
    newMoney: "30",
    deposit: "30",
    allocations: [],
  });
  expect(deposit.status).toBe(200);
  expect((await s.m.browser.get(sharePath)).body.recognizedBaseMinor).toBe("0");
  const paid = await s.m.post(`${billing}/settlements`, {
    commandId: randomUUID(),
    currency: "MRU",
    methodId,
    newMoney: "50",
    deposit: "0",
    allocations: [{ chargeId: start.id, newMoney: "50", credit: "30" }],
  });
  expect(paid.status).toBe(200);
  expect((await s.doctor.browser.get(sharePath)).body).toMatchObject({
    recognizedBaseMinor: "8000",
    shareNumerator: "320000",
    shareDenominator: "100",
    remuneration: { rate: "40" },
  });
  expect(JSON.stringify(state)).not.toContain("remuneration");
  expect(
    JSON.stringify((await s.m.browser.get(`/api${billing}`)).body),
  ).not.toContain("remuneration");
  expect((await s.doctor.browser.get(sharePath)).body.allocations).toEqual([
    expect.objectContaining({
      settlementId: paid.body.id,
      newMoneyMinor: "5000",
      creditMinor: "3000",
      sources: [{ settlementId: deposit.body.id, amountMinor: "3000" }],
    }),
  ]);
  expect(
    (
      await s.doctor.post(`${s.path}/actions`, {
        commandId: randomUUID(),
        id: s.start.id,
        revision: 1,
        action: "end",
      })
    ).status,
  ).toBe(200);
  const next = {
    ...s.start,
    commandId: randomUUID(),
    id: randomUUID(),
    procedures: s.selections.map((p) => ({ ...p, planRevision: 5 })),
  };
  expect((await s.doctor.post(s.path, next)).status).toBe(200);
  expect((await s.doctor.post(s.path, next)).status).toBe(200);
  expect(
    (await s.doctor.browser.get(`/api${s.path}`)).body.starts,
  ).toHaveLength(2);
  const final = await s.doctor.post(`${billing}/settlements`, {
    commandId: randomUUID(),
    currency: "MRU",
    methodId,
    newMoney: "20",
    deposit: "0",
    allocations: [{ chargeId: start.id, newMoney: "20", credit: "0" }],
  });
  expect(final.status).toBe(200);
  expect((await s.doctor.browser.get(sharePath)).body).toMatchObject({
    recognizedBaseMinor: "10000",
    shareNumerator: "400000",
    remuneration: { revision: 1, rate: "40" },
  });
});

async function treatmentShareScenario(
  rate = "40",
  currency = "MRU",
  mode = "percentage",
) {
  const s = await visitScenario(currency);
  await s.m.post(`/accounts/${s.doctor.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: [
      "clinical.read",
      "procedures.start",
      "billing.read",
      "billing.edit",
      "refunds",
      "reversals",
    ],
  });
  expect(
    (
      await s.m.post("/consultation-settings/remuneration", {
        commandId: randomUUID(),
        doctorId: s.doctor.id,
        revision: 0,
        mode,
        rate: mode === "salary" ? null : rate,
      })
    ).status,
  ).toBe(200);
  expect((await s.doctor.post(s.path, s.start)).status).toBe(200);
  const starts = (await s.doctor.browser.get(`/api${s.path}`)).body.starts;
  const start = starts[0];
  const billing = `/billing/${s.patient.id}`;
  const sharePath = `/api/treatment/${s.patient.id}/starts/${start.id}/remuneration`;
  const methodId = randomUUID();
  expect(
    (
      await s.m.post("/billing/payment-methods", {
        commandId: randomUUID(),
        id: methodId,
        revision: 0,
        name: "Espèces",
        active: true,
      })
    ).status,
  ).toBe(200);
  const settle = (amount: string) =>
    s.doctor.post(`${billing}/settlements`, {
      commandId: randomUUID(),
      currency,
      methodId,
      newMoney: amount,
      deposit: "0",
      allocations: [{ chargeId: start.id, newMoney: amount, credit: "0" }],
    });
  return { ...s, starts, start, billing, sharePath, methodId, settle };
}
it("keeps treatment currency precision exact and salary work outside percentage share", async () => {
  const s = await treatmentShareScenario("12.5", "KWD");
  expect((await s.settle("0.001")).status).toBe(200);
  expect((await s.doctor.browser.get(s.sharePath)).body).toMatchObject({
    currency: "KWD",
    recognizedBaseMinor: "1",
    shareNumerator: "125",
    shareDenominator: "1000",
  });
  await s.m.post("/catalog/currencies", {
    commandId: randomUUID(),
    code: "MRU",
  });
  const wrong = await s.m.post(`${s.billing}/settlements`, {
    commandId: randomUUID(),
    currency: "MRU",
    methodId: s.methodId,
    newMoney: "1",
    deposit: "0",
    allocations: [{ chargeId: s.start.id, newMoney: "1", credit: "0" }],
  });
  expect(wrong.status).toBe(400);
  const salary = await treatmentShareScenario("40", "MRU", "salary");
  expect((await salary.settle("10")).status).toBe(200);
  expect((await salary.m.browser.get(salary.sharePath)).body).toMatchObject({
    status: "configured",
    remuneration: { mode: "salary", rate: null },
    recognizedBaseMinor: "1000",
    shareNumerator: null,
    shareDenominator: null,
  });
});
it("retains treatment correction sources at the frozen rate through release refund reallocation and reversal", async () => {
  const s = await treatmentShareScenario("12.345678");
  const paid = await s.settle("100");
  expect(paid.status).toBe(200);
  await s.m.post("/consultation-settings/remuneration", {
    commandId: randomUUID(),
    doctorId: s.doctor.id,
    revision: 1,
    mode: "percentage",
    rate: "50",
  });
  expect((await s.doctor.browser.get(s.sharePath)).body).toMatchObject({
    shareNumerator: "123456780000",
    shareDenominator: "100000000",
  });
  const release = {
    commandId: randomUUID(),
    chargeId: s.start.id,
    settlementId: paid.body.id,
    amount: "40",
    reason: "Libération fictive",
  };
  expect(
    (await s.doctor.post(`${s.billing}/allocation-releases`, release)).status,
  ).toBe(200);
  expect(
    (await s.doctor.post(`${s.billing}/allocation-releases`, release)).status,
  ).toBe(200);
  const credit = (await s.doctor.browser.get(`/api${s.billing}`)).body
    .creditSources[0];
  const req = await s.doctor.post(`${s.billing}/refund-requests`, {
    commandId: randomUUID(),
    sourceId: credit.id,
    amount: "20",
    reason: "Retour fictif",
  });
  expect(req.status).toBe(200);
  const approve = {
    commandId: randomUUID(),
    requestId: req.body.id,
    reason: "Approuvé",
  };
  expect(
    (await s.doctor.post(`${s.billing}/refund-approvals`, approve)).status,
  ).toBe(200);
  expect(
    (
      await s.doctor.post(`${s.billing}/refunds`, {
        ...approve,
        commandId: randomUUID(),
      })
    ).status,
  ).toBe(200);
  expect((await s.doctor.browser.get(s.sharePath)).body).toMatchObject({
    recognizedBaseMinor: "6000",
    shareNumerator: "74074068000",
  });
  const reapply = await s.doctor.post(`${s.billing}/settlements`, {
    commandId: randomUUID(),
    currency: "MRU",
    methodId: null,
    newMoney: "0",
    deposit: "0",
    allocations: [{ chargeId: s.start.id, newMoney: "0", credit: "20" }],
  });
  expect(reapply.status).toBe(200);
  expect(reapply.body.receiptNumber).toBeNull();
  expect((await s.doctor.browser.get(s.sharePath)).body).toMatchObject({
    recognizedBaseMinor: "8000",
    shareNumerator: "98765424000",
  });
  const installment = await s.settle("20");
  expect(installment.status).toBe(200);
  const reversal = {
    commandId: randomUUID(),
    settlementId: installment.body.id,
    reason: "Saisie erronée fictive",
  };
  expect((await s.doctor.post(`${s.billing}/reversals`, reversal)).status).toBe(
    200,
  );
  expect((await s.doctor.post(`${s.billing}/reversals`, reversal)).status).toBe(
    200,
  );
  expect((await s.doctor.browser.get(s.sharePath)).body).toMatchObject({
    recognizedBaseMinor: "8000",
    remuneration: { rate: "12.345678" },
  });
  const adjustment = {
    commandId: randomUUID(),
    chargeId: s.start.id,
    revision: 0,
    finalCharge: "60",
    reason: "Réduction approuvée fictive",
  };
  expect((await s.m.post(`${s.billing}/credits`, adjustment)).status).toBe(200);
  expect((await s.m.post(`${s.billing}/credits`, adjustment)).status).toBe(200);
  expect((await s.doctor.browser.get(s.sharePath)).body).toMatchObject({
    recognizedBaseMinor: "6000",
    shareNumerator: "74074068000",
  });
});

it("protects treatment shares from other doctors staff exports and retained cutoff snapshots", async () => {
  const s = await treatmentShareScenario();
  expect((await s.settle("50")).status).toBe(200);
  const other = await s.create("other", "doctor", [
    "clinical.read",
    "procedures.start",
    "billing.read",
  ]);
  await s.m.post(`/patient-access/${s.patient.id}/share`, {
    commandId: randomUUID(),
    revision: 0,
    accountId: other.id,
    kind: "shared",
  });
  expect((await other.browser.get(s.sharePath)).status).toBe(403);
  const staff = await s.create("staff", "staff", ["billing.read"]);
  expect((await staff.browser.get(s.sharePath)).status).toBe(403);
  const foreign = await manager();
  expect((await foreign.browser.get(s.sharePath)).status).toBe(404);
  const exported = await s.m.post("/exports", {
    commandId: randomUUID(),
    category: "financial",
    patientId: s.patient.id,
    format: "json",
  });
  expect(exported.status).toBe(201);
  expect(
    JSON.stringify(
      (await s.m.browser.get(`/api/exports/${exported.body.id}/content`)).body,
    ),
  ).not.toContain("remuneration");
  const base = `/patient-access/${s.patient.id}`;
  expect(
    (
      await s.m.post(`${base}/remove`, {
        commandId: randomUUID(),
        revision: 1,
        accountId: s.doctor.id,
      })
    ).status,
  ).toBe(200);
  const removalId = (await s.m.browser.get(`/api${base}/history`)).body.at(
    -1,
  ).id;
  expect(
    (
      await s.m.post(`${base}/historical`, {
        commandId: randomUUID(),
        revision: 2,
        accountId: s.doctor.id,
        removalId,
      })
    ).status,
  ).toBe(200);
  expect((await s.doctor.browser.get(s.sharePath)).status).toBe(403);
  expect((await s.settle("20")).status).toBe(403);
  const history = await s.doctor.browser.get(`/api/historical/${s.patient.id}`);
  expect(history.status).toBe(200);
  expect(
    history.body.financial.charges.find(
      (c: { id: string }) => c.id === s.start.id,
    ).paidMinor,
  ).toBe("5000");
  expect(JSON.stringify(history.body)).not.toContain("remuneration");
  const correction = await s.m.post(`${s.billing}/reversals`, {
    commandId: randomUUID(),
    settlementId: (await s.m.browser.get(`/api${s.billing}`)).body
      .settlements[0].id,
    reason: "Après retrait",
  });
  expect(correction.status).toBe(200);
  expect(
    (await s.doctor.browser.get(`/api/historical/${s.patient.id}`)).body,
  ).toEqual(history.body);
  expect((await s.m.browser.get(s.sharePath)).body.recognizedBaseMinor).toBe(
    "0",
  );
});

it("keeps missing and legacy treatment configuration explicit without applying a later rate", async () => {
  const s = await visitScenario();
  expect((await s.doctor.post(s.path, s.start)).status).toBe(200);
  const start = (await s.doctor.browser.get(`/api${s.path}`)).body.starts[0];
  const path = `/api/treatment/${s.patient.id}/starts/${start.id}/remuneration`;
  expect((await s.m.browser.get(path)).body).toMatchObject({
    status: "missing_configuration",
    remuneration: null,
    shareNumerator: null,
    shareDenominator: null,
  });
  await s.m.post("/consultation-settings/remuneration", {
    commandId: randomUUID(),
    doctorId: s.doctor.id,
    revision: 0,
    mode: "percentage",
    rate: "40",
  });
  expect((await s.m.browser.get(path)).body.status).toBe(
    "missing_configuration",
  );
  // Fixture represents a pre-A3 immutable start with no snapshot property.
  await owner.pool.query(
    `UPDATE "ProcedureStart" SET snapshot = snapshot - 'remuneration' WHERE id = $1`,
    [start.id],
  );
  expect((await s.m.browser.get(path)).body).toMatchObject({
    status: "legacy_unsnapshotted",
    remuneration: null,
    shareNumerator: null,
  });
});
it("books without debt then explicitly enters once with a frozen rate and no treatment plan", async () => {
  const s = await treatmentScenario();
  await s.m.post(`/accounts/${s.doctor.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: ["clinical.read", "procedures.start", "billing.read"],
  });
  const rate = {
    commandId: randomUUID(),
    doctorId: s.doctor.id,
    revision: 0,
    mode: "percentage",
    rate: "40",
  };
  expect(
    (await s.m.post("/consultation-settings/remuneration", rate)).status,
  ).toBe(200);
  expect(
    (
      await s.m.post("/consultation-settings/price", {
        commandId: randomUUID(),
        revision: 0,
        currency: "MRU",
        price: "500",
      })
    ).status,
  ).toBe(200);
  const path = `/consultations/${s.patient.id}`;
  const booking = {
    commandId: randomUUID(),
    id: randomUUID(),
    doctorId: s.doctor.id,
    appointmentId: null,
    date: new Date().toISOString().slice(0, 10),
  };
  const booked = await s.doctor.post(path, booking);
  expect(booked.status).toBe(200);
  expect(booked.body).toMatchObject({
    status: "booked",
    priceMinor: "50000",
    visitId: null,
  });
  expect(JSON.stringify(booked.body)).not.toContain("rate");
  expect(
    (await s.m.browser.get(`/api/billing/${s.patient.id}`)).body.charges,
  ).toEqual([]);
  const entry = {
    commandId: randomUUID(),
    id: booking.id,
    revision: 1,
    visitId: randomUUID(),
  };
  const entered = await Promise.all([
    s.doctor.post(`${path}/entry`, entry),
    s.doctor.post(`${path}/entry`, entry),
  ]);
  expect(entered.map((r) => r.status)).toEqual([200, 200]);
  expect(
    (await s.m.browser.get(`/api/billing/${s.patient.id}`)).body.charges,
  ).toEqual([
    expect.objectContaining({
      sourceKind: "consultation",
      consultationId: booking.id,
      planId: null,
      itemId: null,
      dueMinor: "50000",
      paidMinor: "0",
    }),
  ]);
  expect(
    (await s.doctor.browser.get(`/api/treatment/${s.patient.id}/visits`)).body
      .visits,
  ).toEqual([expect.objectContaining({ id: entry.visitId, procedures: [] })]);
  expect(
    (
      await s.m.post("/consultation-settings/remuneration", {
        ...rate,
        commandId: randomUUID(),
        revision: 1,
        rate: "50",
      })
    ).status,
  ).toBe(200);
  const retained = await s.m.browser.get(
    `/api/consultation-settings/remuneration/${s.doctor.id}`,
  );
  expect(
    retained.body.history.map((v: { rate: string | null }) => v.rate),
  ).toEqual(["40", "50"]);
  const frozen = await s.doctor.browser.get(
    `/api${path}/${booking.id}/remuneration`,
  );
  expect(frozen.body).toMatchObject({
    mode: "percentage",
    rate: "40",
    recognizedBaseMinor: "0",
    shareNumerator: "0",
    shareDenominator: "100",
  });
});

async function consultationScenario(accepted = false) {
  const s = accepted ? await visitScenario() : await treatmentScenario();
  await s.m.post(`/accounts/${s.doctor.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: [
      "clinical.read",
      "clinical.history",
      "procedures.start",
      "procedures.complete",
      "notes.draft",
      "notes.finalize",
      "billing.read",
      "reports.financial",
      "clinical.download",
      "exports.patients",
    ],
  });
  expect(
    (
      await s.m.post("/consultation-settings/price", {
        commandId: randomUUID(),
        revision: 0,
        currency: "MRU",
        price: "500",
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await s.m.post("/consultation-settings/remuneration", {
        commandId: randomUUID(),
        doctorId: s.doctor.id,
        revision: 0,
        mode: "percentage",
        rate: "40",
      })
    ).status,
  ).toBe(200);
  const base = `/consultations/${s.patient.id}`;
  const booking = {
    commandId: randomUUID(),
    id: randomUUID(),
    doctorId: s.doctor.id,
    appointmentId: null,
    date: new Date().toISOString().slice(0, 10),
  };
  expect((await s.doctor.post(base, booking)).status).toBe(200);
  const entry = {
    commandId: randomUUID(),
    id: booking.id,
    revision: 1,
    visitId: randomUUID(),
  };
  return { ...s, base, booking, entry };
}

it("reserves a full pre-entry payment and recognizes share once at the payment rate", async () => {
  const s = await consultationScenario();
  const methodId = randomUUID();
  expect(
    (
      await s.m.post("/billing/payment-methods", {
        commandId: randomUUID(),
        id: methodId,
        revision: 0,
        name: "Espèces",
        active: true,
      })
    ).status,
  ).toBe(200);
  const path = `/billing/${s.patient.id}/consultations/${s.booking.id}/payment`;
  const payment = {
    commandId: randomUUID(),
    revision: 1,
    currency: "MRU",
    amount: "500",
    methodId,
  };
  const paid = await s.m.post(path, payment);
  expect(paid.status).toBe(200);
  expect(paid.body).toMatchObject({
    newMoneyMinor: "50000",
    depositMinor: "0",
    receiptNumber: expect.any(String),
  });
  expect((await s.m.post(path, payment)).body).toEqual(paid.body);
  const sharePath = `/api${s.base}/${s.booking.id}/remuneration`;
  expect((await s.doctor.browser.get(sharePath)).body).toMatchObject({
    rate: "40",
    recognizedBaseMinor: "50000",
    shareNumerator: "2000000",
    shareDenominator: "100",
  });
  const before = (await s.m.browser.get(`/api/billing/${s.patient.id}`)).body;
  expect(before.charges).toEqual([]);
  expect(before.totals).toEqual([
    expect.objectContaining({ dueMinor: "0", creditMinor: "0" }),
  ]);
  expect(before.creditSources).toEqual([]);
  await s.m.post("/consultation-settings/remuneration", {
    commandId: randomUUID(),
    doctorId: s.doctor.id,
    revision: 1,
    mode: "percentage",
    rate: "50",
  });
  expect(
    (await s.doctor.post(`${s.base}/entry`, { ...s.entry, revision: 2 }))
      .status,
  ).toBe(200);
  const after = (await s.m.browser.get(`/api/billing/${s.patient.id}`)).body;
  expect(after.charges).toEqual([
    expect.objectContaining({ dueMinor: "0", paidMinor: "50000" }),
  ]);
  expect(after.settlements).toHaveLength(1);
  expect((await s.doctor.browser.get(sharePath)).body).toMatchObject({
    rate: "40",
    recognizedBaseMinor: "50000",
    shareNumerator: "2000000",
  });
});

async function paymentScenario(accepted = false) {
  const s = await consultationScenario(accepted);
  await s.m.post(`/accounts/${s.doctor.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: [
      "clinical.read",
      "procedures.start",
      "billing.read",
      "billing.edit",
      "refunds",
      "reversals",
      "financial.print",
      "reports.financial",
    ],
  });
  const methodId = randomUUID();
  await s.m.post("/billing/payment-methods", {
    commandId: randomUUID(),
    id: methodId,
    revision: 0,
    name: "Espèces",
    active: true,
  });
  return {
    ...s,
    paymentPath: `/billing/${s.patient.id}/consultations/${s.booking.id}/payment`,
    payment: {
      commandId: randomUUID(),
      revision: 1,
      currency: "MRU",
      amount: "500",
      methodId,
    },
    billingPath: `/billing/${s.patient.id}`,
    sharePath: `/api${s.base}/${s.booking.id}/remuneration`,
  };
}

it("settles entry-first debt at its frozen rate and rejects installments, currency mismatch and duplicate races", async () => {
  const s = await paymentScenario();
  expect((await s.doctor.post(`${s.base}/entry`, s.entry)).status).toBe(200);
  expect(
    (await s.doctor.browser.get(s.sharePath)).body.recognizedBaseMinor,
  ).toBe("0");
  await s.m.post("/consultation-settings/remuneration", {
    commandId: randomUUID(),
    doctorId: s.doctor.id,
    revision: 1,
    mode: "percentage",
    rate: "50",
  });
  for (const patch of [
    { amount: "250" },
    { amount: "500.001" },
    { currency: "USD" },
  ])
    expect(
      (
        await s.doctor.post(s.paymentPath, {
          ...s.payment,
          revision: 2,
          ...patch,
        })
      ).status,
    ).toBeGreaterThanOrEqual(400);
  const p = { ...s.payment, revision: 2 };
  const race = await Promise.all([
    s.doctor.post(s.paymentPath, p),
    s.doctor.post(s.paymentPath, p),
    s.doctor.post(s.paymentPath, { ...p, commandId: randomUUID() }),
  ]);
  expect(race.map((r) => r.status).sort()).toEqual([200, 200, 409]);
  expect(
    (await s.m.browser.get(`/api${s.billingPath}`)).body.charges[0],
  ).toMatchObject({ dueMinor: "0", paidMinor: "50000" });
  expect((await s.doctor.browser.get(s.sharePath)).body).toMatchObject({
    rate: "40",
    shareNumerator: "2000000",
    recognizedBaseMinor: "50000",
  });
  expect(
    (await s.doctor.post(s.paymentPath, { ...p, amount: "499" })).status,
  ).toBe(409);
});

it("uses ordinary release and approved refund for reserved funds without freeing credit or subtracting share twice", async () => {
  const s = await paymentScenario();
  const paid = await s.doctor.post(s.paymentPath, s.payment);
  expect(paid.status).toBe(200);
  const release = {
    commandId: randomUUID(),
    chargeId: paid.body.allocations[0].chargeId,
    settlementId: paid.body.id,
    amount: "100",
    reason: "Correction fictive",
  };
  const released = await s.doctor.post(
    `${s.billingPath}/allocation-releases`,
    release,
  );
  expect(released.status).toBe(200);
  expect(
    (await s.doctor.post(`${s.billingPath}/allocation-releases`, release)).body,
  ).toEqual(released.body);
  const state = (await s.doctor.browser.get(`/api${s.billingPath}`)).body;
  expect(state.totals[0]).toMatchObject({ creditMinor: "0", dueMinor: "0" });
  expect(state.creditSources[0]).toMatchObject({
    availableMinor: "10000",
    reservedConsultationId: s.booking.id,
  });
  const request = await s.doctor.post(`${s.billingPath}/refund-requests`, {
    commandId: randomUUID(),
    sourceId: state.creditSources[0].id,
    amount: "100",
    reason: "Retour fictif",
  });
  expect(request.status).toBe(200);
  const action = {
    commandId: randomUUID(),
    requestId: request.body.id,
    reason: "Approbation fictive",
  };
  expect((await s.doctor.post(`${s.billingPath}/refunds`, action)).status).toBe(
    409,
  );
  expect(
    (await s.doctor.post(`${s.billingPath}/refund-approvals`, action)).status,
  ).toBe(200);
  const refund = { ...action, commandId: randomUUID() };
  expect((await s.doctor.post(`${s.billingPath}/refunds`, refund)).status).toBe(
    200,
  );
  expect((await s.doctor.post(`${s.billingPath}/refunds`, refund)).status).toBe(
    200,
  );
  expect((await s.doctor.browser.get(s.sharePath)).body).toMatchObject({
    recognizedBaseMinor: "40000",
    shareNumerator: "1600000",
  });
  expect(
    (await s.doctor.post(`${s.base}/entry`, { ...s.entry, revision: 2 }))
      .status,
  ).toBe(200);
  expect(
    (await s.doctor.browser.get(`/api${s.billingPath}`)).body.charges[0]
      .dueMinor,
  ).toBe("10000");
  expect(
    (
      await s.doctor.post(`${s.billingPath}/reversals`, {
        commandId: randomUUID(),
        settlementId: paid.body.id,
        reason: "Erreur fictive",
      })
    ).status,
  ).toBe(409);
});

it("reverses a pre-entry receipt once, retaining its rate and source for replacement payment", async () => {
  const s = await paymentScenario();
  const paid = await s.doctor.post(s.paymentPath, s.payment);
  const reversal = {
    commandId: randomUUID(),
    settlementId: paid.body.id,
    reason: "Saisie fictive erronée",
  };
  const race = await Promise.all([
    s.doctor.post(`${s.billingPath}/reversals`, reversal),
    s.doctor.post(`${s.billingPath}/reversals`, reversal),
  ]);
  expect(race.map((r) => r.status)).toEqual([200, 200]);
  expect(
    (await s.doctor.browser.get(s.sharePath)).body.recognizedBaseMinor,
  ).toBe("0");
  await s.m.post("/consultation-settings/remuneration", {
    commandId: randomUUID(),
    doctorId: s.doctor.id,
    revision: 1,
    mode: "percentage",
    rate: "50",
  });
  expect(
    (
      await s.doctor.post(s.paymentPath, {
        ...s.payment,
        commandId: randomUUID(),
        revision: 2,
      })
    ).status,
  ).toBe(200);
  expect((await s.doctor.browser.get(s.sharePath)).body).toMatchObject({
    rate: "40",
    recognizedBaseMinor: "50000",
  });
});

it("honors pre-entry financial scope, protects exact shares and keeps payment separate from clinical access", async () => {
  const s = await paymentScenario();
  const staff = await s.create("cashier", "staff", [
    "billing.read",
    "billing.edit",
    "reports.financial",
    "financial.print",
    "financial.download",
    "exports.financial",
    "financial.history",
    "exports.patients",
  ]);
  const other = await s.create("other-cashier", "doctor", [
    "clinical.read",
    "billing.read",
    "billing.edit",
    "reports.financial",
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
  expect((await other.post(s.paymentPath, s.payment)).status).toBe(403);
  expect(
    (
      await s.doctor.post(`${s.billingPath}/settlements`, {
        commandId: randomUUID(),
        currency: "MRU",
        methodId: s.payment.methodId,
        newMoney: "500",
        deposit: "500",
        allocations: [],
      })
    ).status,
  ).toBe(403);
  const paid = await staff.post(s.paymentPath, s.payment);
  expect(paid.status).toBe(200);
  for (const actor of [staff, other])
    expect((await actor.browser.get(s.sharePath)).status).toBe(403);
  expect(
    (await other.browser.get(`/api${s.billingPath}`)).body.settlements,
  ).toEqual([]);
  const receipt = await staff.browser.get(
    `/api${s.billingPath}/settlements/${paid.body.id}/print`,
  );
  expect(receipt.status).toBe(200);
  expect(JSON.stringify(receipt.body)).not.toMatch(
    /shareNumerator|remuneration|recognizedBaseMinor|"rate"/,
  );
  const report = await s.doctor.browser
    .get("/api/reports/financial")
    .query({ date: s.booking.date });
  expect(report.status).toBe(200);
  expect(report.body.totals).toEqual([
    expect.objectContaining({
      newMoneyMinor: "50000",
      dueMinor: "0",
      creditMinor: "0",
    }),
  ]);
  const staffReport = await staff.browser
    .get("/api/reports/financial")
    .query({ date: s.booking.date });
  expect(JSON.stringify(staffReport.body)).not.toMatch(
    /shareNumerator|remuneration|recognizedBaseMinor|"rate"/,
  );
  const exported = await staff.post("/exports", {
    commandId: randomUUID(),
    category: "financial",
    patientId: s.patient.id,
    format: "json",
  });
  expect(exported.status).toBe(201);
  const content = await staff.browser.get(
    `/api/exports/${exported.body.id}/content`,
  );
  expect(content.status).toBe(200);
  expect(JSON.stringify(content.body)).toContain(s.booking.id);
  expect(JSON.stringify(content.body)).not.toMatch(
    /shareNumerator|remuneration|recognizedBaseMinor|"rate"/,
  );
  expect(
    (await staff.browser.get(`/api/clinical/${s.patient.id}/notes`)).status,
  ).toBe(403);
  const isolated = await consultationScenario();
  expect((await isolated.m.post(s.paymentPath, s.payment)).status).toBe(404);
  // Removing care captures only the existing financial snapshot; later entry/payment cannot advance it.
  const base = `/patient-access/${s.patient.id}`;
  expect(
    (
      await s.m.post(`${base}/remove`, {
        commandId: randomUUID(),
        revision: 2,
        accountId: s.doctor.id,
      })
    ).status,
  ).toBe(200);
  const removalId = (await s.m.browser.get(`/api${base}/history`)).body.at(
    -1,
  ).id;
  expect(
    (
      await s.m.post(`${base}/historical`, {
        commandId: randomUUID(),
        revision: 3,
        accountId: s.doctor.id,
        removalId,
      })
    ).status,
  ).toBe(200);
  const history = await s.doctor.browser.get(`/api/historical/${s.patient.id}`);
  expect(history.status).toBe(200);
  expect(history.body.financial.settlements).toHaveLength(1);
  expect(history.body.financial.charges).toEqual([]);
  expect(JSON.stringify(history.body)).not.toMatch(
    /shareNumerator|remuneration|recognizedBaseMinor|"rate"/,
  );
  expect((await s.doctor.browser.get(s.sharePath)).status).toBe(403);
  expect(
    (
      await s.doctor.post(s.paymentPath, {
        ...s.payment,
        commandId: randomUUID(),
        revision: 2,
      })
    ).status,
  ).toBe(403);
});

it("serializes payment against room entry with truthful conflicts and preserves exact fractional rates", async () => {
  const s = await paymentScenario();
  await s.m.post("/consultation-settings/remuneration", {
    commandId: randomUUID(),
    doctorId: s.doctor.id,
    revision: 1,
    mode: "percentage",
    rate: "12.345678",
  });
  const [pay, entry] = await Promise.all([
    s.doctor.post(s.paymentPath, s.payment),
    s.doctor.post(`${s.base}/entry`, s.entry),
  ]);
  expect([pay.status, entry.status].sort()).toEqual([200, 409]);
  if (pay.status === 409)
    expect(
      (await s.doctor.post(s.paymentPath, { ...s.payment, revision: 2 }))
        .status,
    ).toBe(200);
  else
    expect(
      (await s.doctor.post(`${s.base}/entry`, { ...s.entry, revision: 2 }))
        .status,
    ).toBe(200);
  const state = (await s.doctor.browser.get(`/api${s.billingPath}`)).body;
  expect(state.charges).toEqual([
    expect.objectContaining({ paidMinor: "50000", dueMinor: "0" }),
  ]);
  expect(state.settlements).toHaveLength(1);
  expect((await s.doctor.browser.get(s.sharePath)).body).toMatchObject({
    recognizedBaseMinor: "50000",
    shareNumerator: "617283900000",
    shareDenominator: "100000000",
    currency: "MRU",
    consultationId: s.booking.id,
  });
});

it("cannot spend released consultation funds on treatment while ordinary installments still work", async () => {
  const s = await paymentScenario(true);
  const paid = await s.doctor.post(s.paymentPath, s.payment);
  expect(
    (
      await s.doctor.post(`${s.billingPath}/allocation-releases`, {
        commandId: randomUUID(),
        chargeId: paid.body.allocations[0].chargeId,
        settlementId: paid.body.id,
        amount: "100",
        reason: "Libération fictive",
      })
    ).status,
  ).toBe(200);
  expect(
    (await s.doctor.post(`${s.base}/entry`, { ...s.entry, revision: 2 }))
      .status,
  ).toBe(200);
  expect(
    (
      await s.doctor.post(`/treatment/${s.patient.id}/visits/procedures`, {
        commandId: randomUUID(),
        id: s.entry.visitId,
        revision: 1,
        procedures: s.command.items.map((i) => ({
          planId: s.command.id,
          itemId: i.id,
          planRevision: 4,
        })),
      })
    ).status,
  ).toBe(200);
  const state = (await s.m.browser.get(`/api${s.billingPath}`)).body;
  const charge = state.charges.find(
    (ch: { sourceKind?: string }) => ch.sourceKind !== "consultation",
  );
  const settle = {
    commandId: randomUUID(),
    currency: "MRU",
    methodId: null,
    newMoney: "0",
    deposit: "0",
    allocations: [{ chargeId: charge.id, newMoney: "0", credit: "100" }],
  };
  expect((await s.m.post(`${s.billingPath}/settlements`, settle)).status).toBe(
    409,
  );
  expect(
    (
      await s.doctor.post(`${s.billingPath}/settlements`, {
        ...settle,
        commandId: randomUUID(),
        methodId: s.payment.methodId,
        newMoney: "50",
        allocations: [{ chargeId: charge.id, newMoney: "50", credit: "0" }],
      })
    ).status,
  ).toBe(200);
  expect(
    (await s.doctor.browser.get(s.sharePath)).body.recognizedBaseMinor,
  ).toBe("40000");
});

it("keeps identical client consultation IDs isolated between clinics", async () => {
  const a = await paymentScenario(),
    b = await paymentScenario();
  const booked = await b.doctor.post(b.base, {
    ...b.booking,
    id: a.booking.id,
    commandId: randomUUID(),
  });
  expect(booked.status).toBe(200);
  const payA = await a.doctor.post(a.paymentPath, a.payment);
  const payB = await b.doctor.post(
    `/billing/${b.patient.id}/consultations/${a.booking.id}/payment`,
    b.payment,
  );
  expect(payA.status).toBe(200);
  expect(payB.status).toBe(200);
  expect(payA.body.allocations[0].chargeId).not.toBe(
    payB.body.allocations[0].chargeId,
  );
  expect(
    (await a.doctor.post(`${a.base}/entry`, { ...a.entry, revision: 2 }))
      .status,
  ).toBe(200);
  expect(
    (
      await b.doctor.post(`${b.base}/entry`, {
        ...b.entry,
        id: a.booking.id,
        revision: 2,
      })
    ).status,
  ).toBe(200);
  for (const s of [a, b])
    expect(
      (await s.doctor.browser.get(`/api${s.billingPath}`)).body.charges[0],
    ).toMatchObject({ paidMinor: "50000", dueMinor: "0" });
});

it("fully settles corrected debt and reapplies same-consultation credit without a new receipt or duplicate share", async () => {
  const s = await paymentScenario();
  expect((await s.doctor.post(`${s.base}/entry`, s.entry)).status).toBe(200);
  const charge = (await s.m.browser.get(`/api${s.billingPath}`)).body
    .charges[0];
  expect(
    (
      await s.m.post(`${s.billingPath}/credits`, {
        commandId: randomUUID(),
        chargeId: charge.id,
        revision: 0,
        finalCharge: "400",
        reason: "Correction fictive du prix",
      })
    ).status,
  ).toBe(200);
  const paid = await s.m.post(s.paymentPath, {
    ...s.payment,
    revision: 2,
    amount: "400",
  });
  expect(paid.status).toBe(200);
  expect(
    (
      await s.m.post(`${s.billingPath}/allocation-releases`, {
        commandId: randomUUID(),
        chargeId: charge.id,
        settlementId: paid.body.id,
        amount: "100",
        reason: "Réaffectation fictive",
      })
    ).status,
  ).toBe(200);
  const reapplied = await s.doctor.post(s.paymentPath, {
    ...s.payment,
    commandId: randomUUID(),
    revision: 3,
    amount: "100",
    credit: "100",
    methodId: null,
  });
  expect(reapplied.status).toBe(200);
  expect(reapplied.body).toMatchObject({
    receiptNumber: null,
    newMoneyMinor: "0",
    creditUsedMinor: "10000",
  });
  expect(
    (await s.doctor.browser.get(`/api${s.billingPath}`)).body.charges[0],
  ).toMatchObject({ dueMinor: "0", paidMinor: "40000" });
  expect((await s.doctor.browser.get(s.sharePath)).body).toMatchObject({
    recognizedBaseMinor: "40000",
    shareNumerator: "1600000",
    rate: "40",
  });
});

it("counts old credit and new money once and retains reservation when original deposit funds are released", async () => {
  const s = await paymentScenario();
  const deposit = await s.m.post(`${s.billingPath}/settlements`, {
    commandId: randomUUID(),
    currency: "MRU",
    methodId: s.payment.methodId,
    newMoney: "200",
    deposit: "200",
    allocations: [],
  });
  expect(deposit.status).toBe(200);
  const paid = await s.m.post(s.paymentPath, { ...s.payment, credit: "200" });
  expect(paid.status).toBe(200);
  expect(paid.body).toMatchObject({
    newMoneyMinor: "30000",
    creditUsedMinor: "20000",
    receiptNumber: expect.any(String),
  });
  expect((await s.doctor.browser.get(s.sharePath)).body).toMatchObject({
    recognizedBaseMinor: "50000",
    shareNumerator: "2000000",
  });
  const chargeId = paid.body.allocations[0].chargeId;
  expect(
    (
      await s.m.post(`${s.billingPath}/allocation-releases`, {
        commandId: randomUUID(),
        chargeId,
        settlementId: paid.body.id,
        amount: "400",
        reason: "Réaffectation fictive de fonds mixtes",
      })
    ).status,
  ).toBe(200);
  const state = (await s.m.browser.get(`/api${s.billingPath}`)).body;
  expect(state.totals[0].creditMinor).toBe("0");
  const positive = state.creditSources.filter(
    (l: { availableMinor: string }) => BigInt(l.availableMinor) > 0n,
  );
  expect(positive).toHaveLength(2);
  expect(positive).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        rootSettlementId: deposit.body.id,
        availableMinor: "10000",
        reservedConsultationId: s.booking.id,
      }),
    ]),
  );
  expect(
    positive.every(
      (l: { reservedConsultationId: string }) =>
        l.reservedConsultationId === s.booking.id,
    ),
  ).toBe(true);
  const reapplied = await s.m.post(s.paymentPath, {
    ...s.payment,
    commandId: randomUUID(),
    revision: 2,
    amount: "400",
    credit: "400",
    methodId: null,
  });
  expect(reapplied.status).toBe(200);
  expect(reapplied.body.receiptNumber).toBeNull();
  expect((await s.doctor.browser.get(s.sharePath)).body).toMatchObject({
    recognizedBaseMinor: "50000",
    shareNumerator: "2000000",
  });
  const report = await s.m.browser
    .get("/api/reports/financial")
    .query({ date: s.booking.date });
  expect(report.body.totals[0].newMoneyMinor).toBe("50000");
});
it("continues accepted treatment in the consultation encounter and leaves one pending note when care ends", async () => {
  const s = await consultationScenario(true);
  expect((await s.doctor.post(`${s.base}/entry`, s.entry)).status).toBe(200);
  const selections = s.command.items.map((i) => ({
    planId: s.command.id,
    itemId: i.id,
    planRevision: 4,
  }));
  const add = {
    commandId: randomUUID(),
    id: s.entry.visitId,
    revision: 1,
    procedures: selections,
  };
  const path = `/treatment/${s.patient.id}/visits`;
  const results = await Promise.all([
    s.doctor.post(`${path}/procedures`, add),
    s.doctor.post(`${path}/procedures`, add),
  ]);
  expect(results.map((r) => r.status)).toEqual([200, 200]);
  expect((await s.doctor.browser.get(`/api${path}`)).body.visits).toHaveLength(
    1,
  );
  expect(
    (await s.m.browser.get(`/api/billing/${s.patient.id}`)).body.charges,
  ).toHaveLength(2);
  expect(
    (
      await s.doctor.post(`${path}/procedures`, {
        ...add,
        commandId: randomUUID(),
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await s.doctor.post(`${s.base}/complete`, {
        commandId: randomUUID(),
        id: s.booking.id,
        revision: 2,
      })
    ).status,
  ).toBe(200);
  expect(
    (await s.doctor.browser.get(`/api${path}`)).body.visits[0].status,
  ).toBe("draft");
  const notePath = `/clinical/${s.patient.id}/notes/${s.entry.visitId}`;
  expect(
    (
      await s.doctor.post(`${notePath}/draft`, {
        commandId: randomUUID(),
        revision: 0,
        text: "Examen fictif incomplet",
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await s.doctor.post(`${path}/actions`, {
        commandId: randomUUID(),
        id: s.entry.visitId,
        revision: 2,
        action: "end",
      })
    ).status,
  ).toBe(200);
  const notes = await s.doctor.browser.get(
    `/api/clinical/${s.patient.id}/notes`,
  );
  expect(notes.body).toHaveLength(1);
  expect(notes.body[0].pending).toBe(true);
  expect(
    (
      await s.doctor.post(`${notePath}/finalize`, {
        commandId: randomUUID(),
        revision: 1,
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await s.doctor.post(`${notePath}/draft`, {
        commandId: randomUUID(),
        revision: 2,
        text: "Correction de l’examen fictif",
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await s.doctor.post(`${notePath}/finalize`, {
        commandId: randomUUID(),
        revision: 3,
      })
    ).status,
  ).toBe(200);
  expect(
    (await s.doctor.browser.get(`/api${notePath}`)).body.events.filter(
      (e: { status: string }) => e.status === "final",
    ),
  ).toHaveLength(2);
});
it("keeps reception booking separate from clinical access and protects doctor remuneration and price overrides", async () => {
  const s = await consultationScenario();
  const staff = await s.create("reception", "staff", [
    "appointments.manage",
    "billing.read",
  ]);
  const other = await s.create("other-doctor", "doctor", [
    "clinical.read",
    "procedures.start",
  ]);
  const booked = await staff.post(s.base, {
    ...s.booking,
    commandId: randomUUID(),
    id: randomUUID(),
  });
  expect(booked.status).toBe(200);
  expect(
    (
      await staff.post(`${s.base}/entry`, {
        ...s.entry,
        commandId: randomUUID(),
        id: booked.body.id,
      })
    ).status,
  ).toBe(403);
  expect(
    (await staff.browser.get(`/api/clinical/${s.patient.id}/notes`)).status,
  ).toBe(403);
  expect(
    (await staff.browser.get(`/api${s.base}/${s.booking.id}/remuneration`))
      .status,
  ).toBe(403);
  expect((await other.browser.get(`/api${s.base}`)).status).toBe(403);
  expect((await s.m.post(`${s.base}/entry`, s.entry)).status).toBe(403);
  expect(
    (
      await s.doctor.post(s.base, {
        ...s.booking,
        commandId: randomUUID(),
        id: randomUUID(),
        price: "1",
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await staff.post("/consultation-settings/remuneration", {
        commandId: randomUUID(),
        doctorId: s.doctor.id,
        revision: 1,
        mode: "percentage",
        rate: "50",
      })
    ).status,
  ).toBe(403);
  const unassigned = (
    await s.m.post("/patients", {
      commandId: randomUUID(),
      name: "Nouveau patient fictif",
      phone: "70000001",
      contactKind: "patient",
      contactName: "",
    })
  ).body.patient;
  expect(
    (
      await staff.post(`/consultations/${unassigned.id}`, {
        ...s.booking,
        commandId: randomUUID(),
        id: randomUUID(),
      })
    ).status,
  ).toBe(200);
  expect(
    (await s.doctor.browser.get(`/api/consultations/${unassigned.id}`)).status,
  ).toBe(403);
});
it("rejects stale and changed retries, missing remuneration and unrelated appointments without partial care", async () => {
  const s = await consultationScenario();
  expect(
    (await s.doctor.post(s.base, { ...s.booking, date: "2026-10-28" })).status,
  ).toBe(409);
  expect(
    (await s.doctor.post(`${s.base}/entry`, { ...s.entry, revision: 2 }))
      .status,
  ).toBe(409);
  expect(
    (
      await s.doctor.post(s.base, {
        ...s.booking,
        commandId: randomUUID(),
        id: randomUUID(),
        appointmentId: randomUUID(),
      })
    ).status,
  ).toBe(404);
  const noRate = await s.create("no-rate", "doctor", [
    "clinical.read",
    "procedures.start",
  ]);
  await s.m.post(`/patient-access/${s.patient.id}/share`, {
    commandId: randomUUID(),
    revision: 1,
    accountId: noRate.id,
    kind: "shared",
  });
  const booking = {
    ...s.booking,
    commandId: randomUUID(),
    id: randomUUID(),
    doctorId: noRate.id,
  };
  expect((await noRate.post(s.base, booking)).status).toBe(200);
  expect(
    (
      await noRate.post(`${s.base}/entry`, {
        ...s.entry,
        commandId: randomUUID(),
        id: booking.id,
      })
    ).status,
  ).toBe(409);
  expect(
    (await s.m.browser.get(`/api/billing/${s.patient.id}`)).body.charges,
  ).toEqual([]);
  expect(
    (await s.doctor.browser.get(`/api/treatment/${s.patient.id}/visits`)).body
      .visits,
  ).toEqual([]);
});
it("retains cutoff-bound consultation history and reports debt without leaking rates to billing or exports", async () => {
  const s = await consultationScenario();
  expect((await s.doctor.post(`${s.base}/entry`, s.entry)).status).toBe(200);
  const billing = await s.m.browser.get(`/api/billing/${s.patient.id}`);
  expect(JSON.stringify(billing.body)).not.toContain("remuneration");
  const report = await s.m.browser
    .get("/api/reports/financial")
    .query({ date: s.booking.date });
  expect(report.status).toBe(200);
  expect(JSON.stringify(report.body)).toContain("50000");
  expect(JSON.stringify(report.body)).not.toContain("rate");
  const exported = await s.m.post("/exports", {
    commandId: randomUUID(),
    category: "financial",
    patientId: s.patient.id,
    format: "json",
  });
  expect(exported.status).toBe(201);
  const content = await s.m.browser.get(
    `/api/exports/${exported.body.id}/content`,
  );
  expect(content.status).toBe(200);
  expect(JSON.stringify(content.body)).toContain(s.booking.id);
  expect(JSON.stringify(content.body)).not.toContain("remuneration");
  const base = `/patient-access/${s.patient.id}`;
  expect(
    (
      await s.m.post(`${base}/remove`, {
        commandId: randomUUID(),
        revision: 1,
        accountId: s.doctor.id,
      })
    ).status,
  ).toBe(200);
  const removalId = (await s.m.browser.get(`/api${base}/history`)).body.at(
    -1,
  ).id;
  expect(
    (
      await s.m.post(`${base}/historical`, {
        commandId: randomUUID(),
        revision: 2,
        accountId: s.doctor.id,
        removalId,
      })
    ).status,
  ).toBe(200);
  expect((await s.doctor.browser.get(`/api${s.base}`)).status).toBe(403);
  const history = await s.doctor.browser.get(`/api/historical/${s.patient.id}`);
  expect(history.status).toBe(200);
  expect(history.body.consultations).toEqual([
    expect.objectContaining({ id: s.booking.id, status: "entered" }),
  ]);
  expect(history.body.financial.charges).toEqual([
    expect.objectContaining({
      consultationId: s.booking.id,
      dueMinor: "50000",
    }),
  ]);
  expect(JSON.stringify(history.body)).not.toContain("remuneration");
});

it("keeps the linked appointment in care after consultation completion until the encounter ends", async () => {
  const s = await consultationScenario();
  const managerId = (await s.m.browser.get("/api/identity")).body.accountId;
  await s.m.post(`/accounts/${managerId}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: ["patients.create", "catalog.manage", "appointments.manage"],
  });
  const appointment = await s.m.post("/appointments", {
    commandId: randomUUID(),
    patientId: s.patient.id,
    dentistId: s.doctor.id,
    chairId: null,
    startsAt: s.booking.date + "T10:00:00.000Z",
    durationMinutes: 30,
  });
  expect(appointment.status).toBe(201);
  const booking = {
    ...s.booking,
    commandId: randomUUID(),
    id: randomUUID(),
    appointmentId: appointment.body.id,
  };
  expect((await s.doctor.post(s.base, booking)).status).toBe(200);
  const entry = { ...s.entry, commandId: randomUUID(), id: booking.id };
  expect((await s.doctor.post(`${s.base}/entry`, entry)).status).toBe(200);
  expect(
    (
      await s.doctor.post(`${s.base}/complete`, {
        commandId: randomUUID(),
        id: booking.id,
        revision: 2,
      })
    ).status,
  ).toBe(200);
  const agenda = await s.m.browser
    .get("/api/appointments")
    .query({ date: s.booking.date });
  expect(agenda.body.appointments[0].status).toBe("in_care");
  expect(
    (
      await s.doctor.post(`/treatment/${s.patient.id}/visits/actions`, {
        commandId: randomUUID(),
        id: entry.visitId,
        revision: 1,
        action: "end",
      })
    ).status,
  ).toBe(200);
  expect(
    (await s.m.browser.get("/api/appointments").query({ date: s.booking.date }))
      .body.appointments[0].status,
  ).toBe("completed");
  expect(
    (
      await s.doctor.browser
        .get("/api/consultations")
        .query({ date: s.booking.date })
    ).body,
  ).toHaveLength(2);
});

it("canonicalizes UUID casing before booking, room entry, own lists and safe command replay", async () => {
  const s = await consultationScenario(true);
  const booking = {
    ...s.booking,
    commandId: randomUUID().toUpperCase(),
    id: randomUUID().toUpperCase(),
    doctorId: s.doctor.id.toUpperCase(),
  };
  const path = `/consultations/${s.patient.id.toUpperCase()}`;
  const booked = await s.doctor.post(path, booking);
  expect(booked.status).toBe(200);
  expect(booked.body.doctorId).toBe(s.doctor.id);
  const entry = {
    commandId: randomUUID().toUpperCase(),
    id: booking.id,
    revision: 1,
    visitId: randomUUID().toUpperCase(),
  };
  expect((await s.doctor.post(`${path}/entry`, entry)).status).toBe(200);
  expect(
    (
      await s.doctor.post(`${path}/entry`, {
        ...entry,
        commandId: entry.commandId.toLowerCase(),
        id: entry.id.toLowerCase(),
        visitId: entry.visitId.toLowerCase(),
      })
    ).status,
  ).toBe(200);
  const list = await s.doctor.browser.get(`/api${path}`);
  expect(
    list.body.find((v: { id: string }) => v.id === booking.id.toLowerCase()),
  ).toMatchObject({ status: "entered", doctorId: s.doctor.id });
  const visit = (
    await s.doctor.browser.get(`/api/treatment/${s.patient.id}/visits`)
  ).body.visits[0];
  expect(visit.id).toBe(entry.visitId.toLowerCase());
  const add = await s.doctor.post(
    `/treatment/${s.patient.id.toUpperCase()}/visits/procedures`,
    {
      commandId: randomUUID().toUpperCase(),
      id: entry.visitId,
      revision: 1,
      procedures: s.command.items.map((i) => ({
        planId: s.command.id.toUpperCase(),
        itemId: i.id.toUpperCase(),
        planRevision: 4,
      })),
    },
  );
  expect(add.status).toBe(200);
  expect(add.body.id).toBe(entry.visitId.toLowerCase());
  expect(add.body.procedures).toHaveLength(1);
});

it("lets appointment-only reception book while redacting patient prices on create, replay and day lists", async () => {
  const s = await consultationScenario();
  const staff = await s.create("scheduling-only", "staff", [
    "appointments.manage",
  ]);
  const booking = { ...s.booking, commandId: randomUUID(), id: randomUUID() };
  const response = await staff.post(s.base, booking);
  expect(response.status).toBe(200);
  expect(response.body).not.toHaveProperty("priceMinor");
  expect(response.body).not.toHaveProperty("currency");
  expect((await staff.post(s.base, booking)).body).not.toHaveProperty(
    "priceMinor",
  );
  const list = await staff.browser
    .get("/api/consultations")
    .query({ date: s.booking.date });
  expect(list.status).toBe(200);
  expect(JSON.stringify(list.body)).not.toMatch(
    /priceMinor|currency|remuneration/,
  );
  expect(
    (await staff.browser.get("/api/consultation-settings/price")).status,
  ).toBe(403);
  expect(
    (await staff.browser.get(`/api${s.base}/${s.booking.id}/remuneration`))
      .status,
  ).toBe(403);
  const manager = await s.m.browser.get(`/api${s.base}`);
  expect(
    manager.body.find((v: { id: string }) => v.id === booking.id).priceMinor,
  ).toBe("50000");
});
