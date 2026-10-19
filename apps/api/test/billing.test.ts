import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

import request from "supertest";

import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";

import { createApplication } from "../src/application.js";

import { openDatabase } from "../src/database.js";

import { provisionClinic } from "../src/modules/identity/index.js";

const owner = openDatabase(
  "postgresql://clinic_test:fictional-only@127.0.0.1:55437/clinic_issue7",
);

const runtime = openDatabase(
  "postgresql://clinic_runtime_test:fictional-runtime-only@127.0.0.1:55437/clinic_issue7",
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

it("large accepted extra-work amounts survive starts, explicit reconciliation and retained-start migration without narrowing", async () => {
  const s = await treatmentScenario("KWD");
  await s.m.post(`/accounts/${s.doctor.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: [
      "clinical.read",
      "plans.draft",
      "plans.finalize",
      "plans.accept",
      "acceptance.draft",
      "procedures.start",
      "prices.override",
      "billing.edit",
    ],
  });
  const item = {
    ...s.command.items[0]!,
    price: "999999999999999.999",
    extras: Array.from({ length: 50 }, () => ({
      id: randomUUID(),
      label: "Accepted extra work",
      amount: "999999999999999.999",
    })),
  };
  expect(
    (await s.doctor.post(s.path, { ...s.command, items: [item] })).status,
  ).toBe(200);
  const accept = async (first: number) => {
    for (const [action, revision, extra] of [
      ["present", first, {}],
      [
        "evidence",
        first + 1,
        {
          acceptedBy: "Patient fictif",
          acceptedAt: "2026-10-16T12:00:00.000Z",
          method: "Oral",
        },
      ],
      ["accept", first + 2, {}],
    ] as const)
      expect(
        (
          await s.doctor.post(s.path + "/lifecycle", {
            commandId: randomUUID(),
            id: s.command.id,
            action,
            revision,
            ...extra,
          })
        ).status,
      ).toBe(200);
  };
  await accept(1);
  const visitPath = `/treatment/${s.patient.id}/visits`;
  expect(
    (
      await s.doctor.post(visitPath, {
        commandId: randomUUID(),
        id: randomUUID(),
        appointmentId: null,
        procedures: [
          { planId: s.command.id, itemId: item.id, planRevision: 4 },
        ],
      })
    ).status,
  ).toBe(200);
  const charge = (await s.m.browser.get("/api/billing/" + s.patient.id)).body
    .charges[0];
  expect(charge.originalMinor).toBe("50999999999999999949");
  expect(
    (
      await s.doctor.post(s.path, {
        ...s.command,
        commandId: randomUUID(),
        revision: 5,
        items: [{ ...item, price: "100", extras: [] }],
      })
    ).status,
  ).toBe(200);
  await accept(6);
  const adjustment = await s.doctor.post(
    "/billing/" + s.patient.id + "/reconcile",
    {
      commandId: randomUUID(),
      chargeId: charge.id,
      revision: 0,
      acceptedRevision: 9,
      reason: "Renewed exact price",
    },
  );
  expect(adjustment.status).toBe(200);
  expect(adjustment.body.amountMinor).toBe("-50999999999999899949");
  expect(
    (await s.m.browser.get("/api/billing/" + s.patient.id)).body.totals[0]
      .dueMinor,
  ).toBe("100000");

  // Execute the shipped migration in a rollback-only scratch schema with a real retained start.
  // SQL assertions here verify the migration's public persistence contract, not service internals.
  const connection = await owner.pool.connect();
  const schema = "billing_upgrade_" + randomUUID().replaceAll("-", "");
  try {
    await connection.query("BEGIN");
    await connection.query(`CREATE SCHEMA ${schema}`);
    await connection.query(`SET LOCAL search_path TO ${schema},public`);
    await connection.query(
      'CREATE TABLE "ProcedureStart" (LIKE public."ProcedureStart" INCLUDING ALL)',
    );
    await connection.query(
      'INSERT INTO "ProcedureStart" SELECT * FROM public."ProcedureStart" WHERE id=$1',
      [charge.id],
    );
    await connection.query(
      await readFile(
        new URL(
          "../prisma/migrations/202610190001_billing/migration.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    );
    const migrated = await connection.query(
      'SELECT "amountMinor"::text FROM "BillingEntry" WHERE id=$1',
      [charge.id],
    );
    expect(migrated.rows).toEqual([{ amountMinor: "50999999999999999949" }]);
  } finally {
    await connection.query("ROLLBACK");
    connection.release();
  }
});

async function manager(now?: number) {
  const code = `test-${randomUUID()}`.slice(0, 32);

  const email = `${code}@example.invalid`;

  await provisionClinic(
    owner,
    {
      clinicCode: code,

      clinicName: "Clinique fictive",

      username: "manager",

      displayName: "Responsable",

      email,

      temporaryPassword: "Fictional-initial-pass-1",
    },
    now,
  );

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

async function scenario(now?: number) {
  const m = await manager(now);

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

async function visitScenario() {
  const s = await treatmentScenario();
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

it("accepted unstarted care is planned and concurrent starts create one full charge per procedure", async () => {
  const s = await visitScenario();
  const path = "/api/billing/" + s.patient.id;
  const before = await s.m.browser.get(path);
  expect(before.status).toBe(200);
  expect(before.body.totals).toEqual([
    { currency: "MRU", plannedMinor: "20000", dueMinor: "0", creditMinor: "0" },
  ]);
  const results = await Promise.all([
    s.doctor.post(s.path, s.start),
    s.doctor.post(s.path, s.start),
  ]);
  expect(results.map((r) => r.status)).toEqual([200, 200]);
  const after = await s.m.browser.get(path);
  expect(after.body.charges).toHaveLength(2);
  expect(after.body.charges[0]).toMatchObject({
    originalMinor: "10000",
    dueMinor: "10000",
    performedBy: s.doctor.id,
  });
  expect(after.body.totals).toEqual([
    { currency: "MRU", plannedMinor: "0", dueMinor: "20000", creditMinor: "0" },
  ]);
});

it("documented opening debt requires provenance, exact enabled currency and records one source under retries", async () => {
  const s = await visitScenario(),
    path = "/billing/" + s.patient.id + "/opening-balances";
  const body = {
    commandId: randomUUID(),
    id: randomUUID(),
    currency: "MRU",
    amount: "12.34",
    provenance: "Signed legacy balance 2026-10-01, register 7",
    asOf: "2026-10-01T00:00:00.000Z",
  };
  expect((await s.m.post(path, { ...body, provenance: " " })).status).toBe(400);
  expect((await s.m.post(path, { ...body, amount: "12.345" })).status).toBe(
    400,
  );
  expect((await s.m.post(path, { ...body, currency: "EUR" })).status).toBe(400);
  const results = await Promise.all([
    s.m.post(path, body),
    s.m.post(path, body),
  ]);
  expect(results.map((r) => r.status)).toEqual([200, 200]);
  expect(results[0].body).toMatchObject({
    amountMinor: "1234",
    provenance: body.provenance,
    asOf: body.asOf,
  });
  expect((await s.m.post(path, { ...body, amount: "13" })).status).toBe(409);
  const state = (await s.m.browser.get("/api/billing/" + s.patient.id)).body;
  expect(state.openingBalances).toHaveLength(1);
  expect(state.charges).toEqual([]);
  expect(state.totals).toEqual([
    {
      currency: "MRU",
      plannedMinor: "20000",
      dueMinor: "1234",
      creditMinor: "0",
    },
  ]);
});

it("renewed price acceptance leaves original debt intact until an explicit retry-safe reconciliation", async () => {
  const s = await visitScenario();
  expect((await s.doctor.post(s.path, s.start)).status).toBe(200);
  const permissions = [
    "clinical.read",
    "plans.draft",
    "plans.finalize",
    "plans.accept",
    "acceptance.draft",
    "procedures.start",
    "prices.override",
    "discounts",
    "billing.read",
    "billing.edit",
  ];
  await s.m.post("/accounts/" + s.doctor.id + "/permissions", {
    currentPassword: "Fictional-manager-pass-2",
    permissions,
  });
  const path = "/treatment/" + s.patient.id + "/plans";
  const revised = {
    ...s.command,
    commandId: randomUUID(),
    revision: 5,
    items: s.selections.map((p) => ({
      ...s.command.items[0],
      id: p.itemId,
      price: "90",
    })),
  };
  const addedItem = { ...revised.items[0]!, id: randomUUID() };
  revised.items.push(addedItem);
  const saved = await s.doctor.post(path, revised);
  expect(saved.status).toBe(200);
  expect(saved.body).toMatchObject({ status: "draft", revision: 6 });
  const get = async () =>
    (await s.m.browser.get("/api/billing/" + s.patient.id)).body;
  expect((await get()).totals[0].dueMinor).toBe("20000");
  for (const [action, revision, extra] of [
    ["present", 6, {}],
    [
      "evidence",
      7,
      {
        acceptedBy: "Patient fictif",
        acceptedAt: "2026-10-16T12:00:00.000Z",
        method: "Oral",
      },
    ],
    ["accept", 8, {}],
  ] as const) {
    expect(
      (
        await s.doctor.post(path + "/lifecycle", {
          commandId: randomUUID(),
          id: s.command.id,
          action,
          revision,
          ...extra,
        })
      ).status,
    ).toBe(200);
  }
  const accepted = await get();
  expect(accepted.charges[0]).toMatchObject({
    originalMinor: "10000",
    dueMinor: "10000",
    acceptedMinor: "9000",
    reconciliationRequired: true,
  });
  const command = {
    commandId: randomUUID(),
    chargeId: accepted.charges[0].id,
    revision: 0,
    acceptedRevision: 9,
    reason: "Renewed patient agreement",
  };
  const responses = await Promise.all([
    s.doctor.post("/billing/" + s.patient.id + "/reconcile", command),
    s.doctor.post("/billing/" + s.patient.id + "/reconcile", command),
  ]);
  expect(responses.map((r) => r.status)).toEqual([200, 200]);
  const after = await get();
  expect(after.charges[0]).toMatchObject({
    originalMinor: "10000",
    dueMinor: "9000",
    revision: 1,
    reconciliationRequired: false,
  });
  expect(after.charges[0].adjustments).toHaveLength(1);
  expect(after.charges[0].adjustments[0]).toMatchObject({
    amountMinor: "-1000",
    targetMinor: "9000",
    reason: command.reason,
    acceptedRevision: 9,
  });
  expect(after.totals[0].dueMinor).toBe("19000");
  expect(
    (
      await s.doctor.post("/billing/" + s.patient.id + "/reconcile", {
        ...command,
        commandId: randomUUID(),
      })
    ).status,
  ).toBe(409);
  expect((await get()).totals[0].plannedMinor).toBe("9000");
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
  expect(
    (
      await s.doctor.post(s.path, {
        commandId: randomUUID(),
        id: randomUUID(),
        appointmentId: null,
        procedures: [
          { planId: s.command.id, itemId: addedItem.id, planRevision: 9 },
        ],
      })
    ).status,
  ).toBe(200);
  const starts = (await s.doctor.browser.get("/api" + s.path)).body.starts;
  expect(
    starts.find((start: { itemId: string }) => start.itemId === addedItem.id),
  ).toMatchObject({ acceptedRevision: 9, agreedMinor: "9000" });
});

it("financial reads enforce manager authority, restricted staff fields and current doctor own-work scope", async () => {
  const s = await visitScenario(),
    path = "/api/billing/" + s.patient.id;
  expect((await request(app).get(path)).status).toBe(401);
  expect((await s.doctor.browser.get(path)).status).toBe(403);
  const staff = await s.create("billing-staff", "staff", [
    "billing.read",
    "billing.edit",
  ]);
  const otherDoctor = await s.create("billing-doctor", "doctor", [
    "clinical.read",
    "billing.read",
    "billing.edit",
  ]);
  expect((await otherDoctor.browser.get(path)).status).toBe(403);
  await s.m.post("/patient-access/" + s.patient.id + "/share", {
    commandId: randomUUID(),
    revision: 1,
    accountId: otherDoctor.id,
    kind: "shared",
  });
  expect((await otherDoctor.browser.get(path)).body.charges).toEqual([]);
  expect((await s.doctor.post(s.path, s.start)).status).toBe(200);
  const managerState = (await s.m.browser.get(path)).body;
  expect(managerState.charges[0].name).toBe("Acte fictif");
  const restricted = (await staff.browser.get(path)).body;
  expect(restricted.charges).toHaveLength(2);
  expect(restricted.charges[0].name).toBeUndefined();
  expect(restricted.charges[0].teeth).toBeUndefined();
  const own = (await otherDoctor.browser.get(path)).body;
  expect(own.charges).toEqual([]);
  expect(own.planned).toEqual([]);
  expect(own.totals).toEqual([]);
  const other = await scenario();
  expect((await other.m.browser.get(path)).status).toBe(404);
  const opening = {
    commandId: randomUUID(),
    id: randomUUID(),
    currency: "MRU",
    amount: "10",
    provenance: "Legacy register 8",
    asOf: "2026-10-01T00:00:00.000Z",
  };
  expect(
    (
      await otherDoctor.post(
        "/billing/" + s.patient.id + "/opening-balances",
        opening,
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await staff.post(
        "/billing/" + s.patient.id + "/opening-balances",
        opening,
      )
    ).status,
  ).toBe(200);
  await s.m.post("/accounts/" + s.doctor.id + "/permissions", {
    currentPassword: "Fictional-manager-pass-2",
    permissions: ["billing.read", "billing.edit"],
  });
  const performer = (await s.doctor.browser.get(path)).body;
  expect(performer.charges).toHaveLength(2);
  expect(performer.openingBalances).toEqual([]);
  expect(performer.totals).toEqual([
    { currency: "MRU", plannedMinor: "0", dueMinor: "20000", creditMinor: "0" },
  ]);
  await s.m.post("/accounts/" + staff.id + "/permissions", {
    currentPassword: "Fictional-manager-pass-2",
    permissions: [],
  });
  expect((await staff.browser.get(path)).status).toBe(403);
  expect(
    (
      await staff.post(
        "/billing/" + s.patient.id + "/opening-balances",
        opening,
      )
    ).status,
  ).toBe(403);
  await s.m.post("/patient-access/" + s.patient.id + "/remove", {
    commandId: randomUUID(),
    revision: 2,
    accountId: s.doctor.id,
  });
  expect((await s.doctor.browser.get(path)).status).toBe(403);
});

it("a financial persistence failure rolls back visit, starts, charges and progress, then the same command succeeds", async () => {
  const s = await visitScenario();
  const functionName = "billing_failure_" + randomUUID().replaceAll("-", "");
  await owner.pool.query(
    `CREATE FUNCTION ${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.snapshot->'item'->>'id' = '${s.selections[1]!.itemId}' THEN RAISE EXCEPTION 'fictional billing write failure'; END IF; RETURN NEW; END $$`,
  );
  await owner.pool.query(
    "CREATE TRIGGER " +
      functionName +
      ' BEFORE INSERT ON "BillingEntry" FOR EACH ROW EXECUTE FUNCTION ' +
      functionName +
      "()",
  );
  try {
    expect((await s.doctor.post(s.path, s.start)).status).toBe(500);
    const visits = (await s.doctor.browser.get("/api" + s.path)).body;
    expect(visits.visits).toEqual([]);
    expect(visits.starts).toEqual([]);
    const billing = (await s.m.browser.get("/api/billing/" + s.patient.id))
      .body;
    expect(billing.charges).toEqual([]);
    expect(billing.totals).toEqual([
      {
        currency: "MRU",
        plannedMinor: "20000",
        dueMinor: "0",
        creditMinor: "0",
      },
    ]);
  } finally {
    await owner.pool.query(
      "DROP TRIGGER " + functionName + ' ON "BillingEntry"',
    );
    await owner.pool.query("DROP FUNCTION " + functionName + "()");
  }
  expect((await s.doctor.post(s.path, s.start)).status).toBe(200);
  expect(
    (await s.m.browser.get("/api/billing/" + s.patient.id)).body.charges,
  ).toHaveLength(2);
});

it("opening amounts preserve enabled zero- and three-decimal currencies separately without conversion", async () => {
  const s = await visitScenario();
  for (const code of ["JPY", "KWD"])
    expect(
      (await s.m.post("/catalog/currencies", { commandId: randomUUID(), code }))
        .status,
    ).toBe(200);
  const path = "/billing/" + s.patient.id + "/opening-balances";
  for (const [currency, amount, minor] of [
    ["JPY", "123", "123"],
    ["KWD", "1.234", "1234"],
  ] as const) {
    const body = {
      commandId: randomUUID(),
      id: randomUUID(),
      currency,
      amount,
      provenance: "Legacy register by currency",
      asOf: "2026-10-01T00:00:00.000Z",
    };
    expect((await s.m.post(path, body)).body.amountMinor).toBe(minor);
    expect(
      (
        await s.m.post(path, {
          ...body,
          commandId: randomUUID(),
          id: randomUUID(),
          amount: amount + ".1",
        })
      ).status,
    ).toBe(400);
  }
  const state = (await s.m.browser.get("/api/billing/" + s.patient.id)).body;
  expect(state.totals).toEqual([
    { currency: "JPY", plannedMinor: "0", dueMinor: "123", creditMinor: "0" },
    { currency: "KWD", plannedMinor: "0", dueMinor: "1234", creditMinor: "0" },
    { currency: "MRU", plannedMinor: "20000", dueMinor: "0", creditMinor: "0" },
  ]);
});

it("manager configures a payment method and records one explicit deposit receipt under concurrent retries", async () => {
  const s = await treatmentScenario();
  const method = {
    commandId: randomUUID(),
    id: randomUUID(),
    revision: 0,
    name: "Espèces",
    active: true,
  };
  expect((await s.m.post("/billing/payment-methods", method)).status).toBe(200);
  const path = `/billing/${s.patient.id}/settlements`;
  const command = {
    commandId: randomUUID(),
    currency: "MRU",
    methodId: method.id,
    newMoney: "120",
    deposit: "120",
    allocations: [],
  };
  const results = await Promise.all([
    s.m.post(path, command),
    s.m.post(path, command),
  ]);
  expect(results.map((r) => r.status)).toEqual([200, 200]);
  expect(results[0].body).toEqual(results[1].body);
  expect(results[0].body).toMatchObject({
    newMoneyMinor: "12000",
    depositMinor: "12000",
    creditUsedMinor: "0",
    methodName: "Espèces",
  });
  expect(results[0].body.receiptNumber).toMatch(/^REC-\d{4}-000001$/);
  const state = (await s.m.browser.get(`/api/billing/${s.patient.id}`)).body;
  expect(state.settlements).toHaveLength(1);
  expect(state.deposits).toEqual([
    {
      settlementId: results[0].body.id,
      currency: "MRU",
      amountMinor: "12000",
      availableMinor: "12000",
    },
  ]);
  expect(state.totals).toEqual([
    { currency: "MRU", plannedMinor: "0", dueMinor: "0", creditMinor: "12000" },
  ]);
});

it("mixed and credit-only settlements preserve old funds, reconcile excess and cannot overspend under races", async () => {
  const s = await visitScenario();
  await s.doctor.post(s.path, s.start);
  const base = `/billing/${s.patient.id}`;
  const method = {
    commandId: randomUUID(),
    id: randomUUID(),
    revision: 0,
    name: "Virement",
    active: true,
  };
  await s.m.post("/billing/payment-methods", method);
  const deposit = await s.m.post(base + "/settlements", {
    commandId: randomUUID(),
    currency: "MRU",
    methodId: method.id,
    newMoney: "120",
    deposit: "120",
    allocations: [],
  });
  const state = (await s.m.browser.get("/api" + base)).body;
  const first = state.charges[0].id,
    second = state.charges[1].id;
  const command = {
    commandId: randomUUID(),
    currency: "MRU",
    methodId: method.id,
    newMoney: "80",
    deposit: "10",
    allocations: [{ chargeId: first, newMoney: "70", credit: "30" }],
  };
  const mixed = await s.m.post(base + "/settlements", command);
  expect(mixed.status).toBe(200);
  expect(mixed.body).toMatchObject({
    newMoneyMinor: "8000",
    depositMinor: "1000",
    creditUsedMinor: "3000",
    receiptNumber: `REC-${new Date().getUTCFullYear()}-000002`,
  });
  expect(mixed.body.allocations[0].sources).toEqual([
    { settlementId: deposit.body.id, amountMinor: "3000" },
  ]);
  const credit = {
    commandId: randomUUID(),
    currency: "MRU",
    methodId: null,
    newMoney: "0",
    deposit: "0",
    allocations: [{ chargeId: second, newMoney: "0", credit: "60" }],
  };
  const race = await Promise.all([
    s.m.post(base + "/settlements", credit),
    s.m.post(base + "/settlements", { ...credit, commandId: randomUUID() }),
  ]);
  expect(race.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(race.find((r) => r.status === 200)!.body.receiptNumber).toBeNull();
  const after = (await s.m.browser.get("/api" + base)).body;
  expect(after.totals).toEqual([
    {
      currency: "MRU",
      plannedMinor: "0",
      dueMinor: "4000",
      creditMinor: "4000",
    },
  ]);
  expect(
    after.charges.find((c: { id: string }) => c.id === first),
  ).toMatchObject({
    paidMinor: "10000",
    dueMinor: "0",
    reconciliationRequired: false,
  });
  expect(
    (await s.m.post(base + "/settlements", { ...command, newMoney: "81" }))
      .status,
  ).toBe(409);
  const retained = await s.m.browser.get(
    `/api${base}/settlements/${mixed.body.id}`,
  );
  expect(retained.status).toBe(200);
  expect(retained.body).toEqual(mixed.body);
});

it("settlements enforce method revisions, exact currency, explicit excess and patient-scoped credit", async () => {
  const s = await visitScenario();
  await s.doctor.post(s.path, s.start);
  const base = `/billing/${s.patient.id}`;
  const method = {
    commandId: randomUUID(),
    id: randomUUID(),
    revision: 0,
    name: "Original",
    active: true,
  };
  expect((await s.m.post("/billing/payment-methods", method)).status).toBe(200);
  const deposit = {
    commandId: randomUUID(),
    currency: "MRU",
    methodId: method.id,
    newMoney: "150",
    deposit: "150",
    allocations: [],
  };
  const received = await s.m.post(base + "/settlements", deposit);
  expect(received.status).toBe(200);
  const changed = {
    ...method,
    commandId: randomUUID(),
    revision: 1,
    name: "Renamed",
    active: false,
  };
  expect((await s.m.post("/billing/payment-methods", changed)).status).toBe(
    200,
  );
  expect(
    (
      await s.m.post("/billing/payment-methods", {
        ...changed,
        commandId: randomUUID(),
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await s.m.post(base + "/settlements", {
        ...deposit,
        commandId: randomUUID(),
      })
    ).status,
  ).toBe(400);
  expect((await s.m.post(base + "/settlements", deposit)).body).toEqual(
    received.body,
  );
  expect(
    (await s.m.browser.get("/api" + base + "/settlements/" + received.body.id))
      .body.methodName,
  ).toBe("Original");
  await s.m.post("/billing/payment-methods", {
    ...changed,
    commandId: randomUUID(),
    revision: 2,
    active: true,
  });
  const chargeId = (await s.m.browser.get("/api" + base)).body.charges[0].id;
  const pay = {
    ...deposit,
    commandId: randomUUID(),
    newMoney: "120",
    deposit: "0",
    allocations: [{ chargeId, newMoney: "100", credit: "0" }],
  };
  expect((await s.m.post(base + "/settlements", pay)).status).toBe(400);
  expect(
    (await s.m.post(base + "/settlements", { ...pay, newMoney: "100.001" }))
      .status,
  ).toBe(400);
  expect(
    (
      await s.m.post(base + "/settlements", {
        ...pay,
        newMoney: "100",
        allocations: [pay.allocations[0], pay.allocations[0]],
      })
    ).status,
  ).toBe(400);
  for (const code of ["JPY", "KWD"])
    await s.m.post("/catalog/currencies", { commandId: randomUUID(), code });
  expect(
    (
      await s.m.post(base + "/settlements", {
        ...deposit,
        commandId: randomUUID(),
        currency: "JPY",
        newMoney: "1.1",
        deposit: "1.1",
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await s.m.post(base + "/settlements", {
        ...pay,
        newMoney: "100",
        currency: "JPY",
      })
    ).status,
  ).toBe(400);
  for (const [currency, amount] of [
    ["JPY", "123"],
    ["KWD", "1.234"],
  ])
    expect(
      (
        await s.m.post(base + "/settlements", {
          ...deposit,
          commandId: randomUUID(),
          currency,
          newMoney: amount,
          deposit: amount,
        })
      ).status,
    ).toBe(200);
  const otherPatient = (
    await s.m.post("/patients", {
      commandId: randomUUID(),
      name: "Autre fictif",
      phone: "71111111",
      contactKind: "patient",
      contactName: "",
    })
  ).body.patient;
  expect(
    (
      await s.m.post(`/billing/${otherPatient.id}/settlements`, {
        ...deposit,
        commandId: randomUUID(),
        newMoney: "0",
        deposit: "0",
        methodId: null,
        allocations: [{ chargeId, newMoney: "0", credit: "100" }],
      })
    ).status,
  ).toBe(404);
  expect(
    (
      await s.m.browser.get(
        `/api/billing/${otherPatient.id}/settlements/${received.body.id}`,
      )
    ).status,
  ).toBe(404);
  expect((await s.m.browser.get("/api" + base)).body.totals).toEqual([
    { currency: "JPY", plannedMinor: "0", dueMinor: "0", creditMinor: "123" },
    { currency: "KWD", plannedMinor: "0", dueMinor: "0", creditMinor: "1234" },
    {
      currency: "MRU",
      plannedMinor: "0",
      dueMinor: "20000",
      creditMinor: "15000",
    },
  ]);
});

it("settlement authorization checks current manager, staff and doctor own-work scope including retained receipts", async () => {
  const s = await visitScenario();
  await s.doctor.post(s.path, s.start);
  const base = `/billing/${s.patient.id}`;
  const method = {
    commandId: randomUUID(),
    id: randomUUID(),
    revision: 0,
    name: "Espèces",
    active: true,
  };
  await s.m.post("/billing/payment-methods", method);
  const staff = await s.create("finance", "staff", [
    "billing.read",
    "billing.edit",
  ]);
  const other = await s.create("other", "doctor", [
    "clinical.read",
    "billing.read",
    "billing.edit",
  ]);
  const chargeId = (await s.m.browser.get("/api" + base)).body.charges[0].id;
  const pay = {
    commandId: randomUUID(),
    currency: "MRU",
    methodId: method.id,
    newMoney: "10",
    deposit: "0",
    allocations: [{ chargeId, newMoney: "10", credit: "0" }],
  };
  expect((await request(app).get("/api" + base)).status).toBe(401);
  expect((await staff.post("/billing/payment-methods", method)).status).toBe(
    403,
  );
  expect((await s.doctor.post(base + "/settlements", pay)).status).toBe(403);
  await s.m.post(`/accounts/${s.doctor.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: ["billing.read", "billing.edit"],
  });
  const own = await s.doctor.post(base + "/settlements", pay);
  expect(own.status).toBe(200);
  expect(
    (await s.doctor.browser.get("/api" + base + "/settlements/" + own.body.id))
      .body,
  ).toEqual(own.body);
  expect((await other.post(base + "/settlements", pay)).status).toBe(403);
  await s.m.post(`/patient-access/${s.patient.id}/share`, {
    commandId: randomUUID(),
    revision: 1,
    accountId: other.id,
    kind: "shared",
  });
  expect(
    (
      await other.post(base + "/settlements", {
        ...pay,
        commandId: randomUUID(),
      })
    ).status,
  ).toBe(404);
  expect(
    (await other.browser.get("/api" + base + "/settlements/" + own.body.id))
      .status,
  ).toBe(404);
  const deposit = {
    ...pay,
    commandId: randomUUID(),
    deposit: "10",
    allocations: [],
  };
  expect((await s.doctor.post(base + "/settlements", deposit)).status).toBe(
    403,
  );
  const recorded = await staff.post(base + "/settlements", deposit);
  expect(recorded.status).toBe(200);
  expect(
    JSON.stringify((await staff.browser.get("/api" + base)).body),
  ).not.toContain("Acte fictif");
  expect(
    (
      await s.doctor.browser.get(
        "/api" + base + "/settlements/" + recorded.body.id,
      )
    ).status,
  ).toBe(404);
  const foreign = await scenario();
  expect((await foreign.m.post(base + "/settlements", pay)).status).toBe(404);
  expect(
    (await foreign.m.browser.get("/api" + base + "/settlements/" + own.body.id))
      .status,
  ).toBe(404);
  expect(
    (await foreign.m.browser.get("/api/billing/payment-methods")).body,
  ).toEqual([]);
  await s.m.post(`/accounts/${staff.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: [],
  });
  expect((await staff.post(base + "/settlements", deposit)).status).toBe(403);
  expect(
    (
      await staff.browser.get(
        "/api" + base + "/settlements/" + recorded.body.id,
      )
    ).status,
  ).toBe(403);
  await s.m.post(`/patient-access/${s.patient.id}/remove`, {
    commandId: randomUUID(),
    revision: 2,
    accountId: s.doctor.id,
  });
  expect((await s.doctor.post(base + "/settlements", pay)).status).toBe(403);
  expect(
    (await s.doctor.browser.get("/api" + base + "/settlements/" + own.body.id))
      .status,
  ).toBe(403);
});

it("competing allocations cannot spend the same deposit on different charges and failed commits retain no funds or number", async () => {
  const s = await visitScenario();
  await s.doctor.post(s.path, s.start);
  const base = `/billing/${s.patient.id}`;
  const method = {
    commandId: randomUUID(),
    id: randomUUID(),
    revision: 0,
    name: "Espèces",
    active: true,
  };
  await s.m.post("/billing/payment-methods", method);
  const deposit = {
    commandId: randomUUID(),
    currency: "MRU",
    methodId: method.id,
    newMoney: "100",
    deposit: "100",
    allocations: [],
  };
  const fn = "settlement_fail_" + randomUUID().replaceAll("-", "");
  await owner.pool.query(
    `CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.receipt->>'patientId' = '${s.patient.id}' THEN RAISE EXCEPTION 'fictional command write failure'; END IF; RETURN NEW; END $$`,
  );
  await owner.pool.query(
    `CREATE TRIGGER ${fn} BEFORE INSERT ON "BillingCommand" FOR EACH ROW EXECUTE FUNCTION ${fn}()`,
  );
  try {
    expect((await s.m.post(base + "/settlements", deposit)).status).toBe(500);
    const failed = (await s.m.browser.get("/api" + base)).body;
    expect(failed.settlements).toEqual([]);
    expect(failed.totals[0].creditMinor).toBe("0");
  } finally {
    await owner.pool.query(`DROP TRIGGER ${fn} ON "BillingCommand"`);
    await owner.pool.query(`DROP FUNCTION ${fn}()`);
  }
  const saved = await s.m.post(base + "/settlements", deposit);
  expect(saved.status).toBe(200);
  expect(saved.body.receiptNumber).toMatch(/-000001$/);
  const charges = (await s.m.browser.get("/api" + base)).body.charges;
  const responses = await Promise.all(
    charges.map((ch: { id: string }) =>
      s.m.post(base + "/settlements", {
        commandId: randomUUID(),
        currency: "MRU",
        methodId: null,
        newMoney: "0",
        deposit: "0",
        allocations: [{ chargeId: ch.id, newMoney: "0", credit: "60" }],
      }),
    ),
  );
  expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(responses.find((r) => r.status === 409)!.body.error).toContain(
    "Crédit",
  );
  const final = (await s.m.browser.get("/api" + base)).body;
  expect(final.totals[0]).toEqual({
    currency: "MRU",
    plannedMinor: "0",
    dueMinor: "14000",
    creditMinor: "4000",
  });
  expect(final.settlements).toHaveLength(2);
});

it("retained French receipt output requires separate financial output grants and distinguishes new funds from credit", async () => {
  const s = await treatmentScenario();
  const method = {
    commandId: randomUUID(),
    id: randomUUID(),
    revision: 0,
    name: "Espèces",
    active: true,
  };
  await s.m.post("/billing/payment-methods", method);
  const base = `/billing/${s.patient.id}`;
  const saved = await s.m.post(base + "/settlements", {
    commandId: randomUUID(),
    currency: "MRU",
    methodId: method.id,
    newMoney: "12.34",
    deposit: "12.34",
    allocations: [],
  });
  const url = "/api" + base + "/settlements/" + saved.body.id + "/print";
  const staff = await s.create("printer", "staff", [
    "billing.read",
    "billing.edit",
  ]);
  expect((await staff.browser.get(url)).status).toBe(403);
  await s.m.post(`/accounts/${staff.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: ["billing.read", "financial.print"],
  });
  const output = await staff.browser.get(url);
  expect(output.status).toBe(200);
  expect(output.body).toMatchObject({
    title: "Reçu",
    settlement: saved.body,
    labels: {
      newMoney: "Nouveaux fonds reçus",
      creditUsed: "Crédit antérieurement reçu utilisé",
      deposit: "Dépôt distinct",
    },
  });
  expect(
    (await staff.browser.get(url.replace("/print", "/download"))).status,
  ).toBe(403);
  expect((await s.m.browser.get(url)).body).toEqual(output.body);
  await s.m.post(`/accounts/${staff.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: ["financial.print"],
  });
  expect((await staff.browser.get(url)).status).toBe(403);
});

it("receipt numbers are clinic-wide per UTC year and retries retain the original year and identity", async () => {
  let clock = Date.UTC(2026, 11, 31, 23, 59);
  app = createApplication({ ...options, now: () => clock });
  const s = await treatmentScenario("MRU", clock);
  const method = {
    commandId: randomUUID(),
    id: randomUUID(),
    revision: 0,
    name: "Espèces",
    active: true,
  };
  await s.m.post("/billing/payment-methods", method);
  const base = `/billing/${s.patient.id}`;
  const command = {
    commandId: randomUUID(),
    currency: "MRU",
    methodId: method.id,
    newMoney: "1",
    deposit: "1",
    allocations: [],
  };
  const first = await s.m.post(base + "/settlements", command);
  expect(first.body.receiptNumber).toBe("REC-2026-000001");
  const patient = (
    await s.m.post("/patients", {
      commandId: randomUUID(),
      name: "Autre fictif",
      phone: "72222222",
      contactKind: "patient",
      contactName: "",
    })
  ).body.patient;
  const second = await s.m.post(`/billing/${patient.id}/settlements`, {
    ...command,
    commandId: randomUUID(),
  });
  expect(second.body.receiptNumber).toBe("REC-2026-000002");
  clock += 120000;
  const third = await s.m.post(base + "/settlements", {
    ...command,
    commandId: randomUUID(),
  });
  expect(third.body.receiptNumber).toBe("REC-2027-000001");
  expect((await s.m.post(base + "/settlements", command)).body).toEqual(
    first.body,
  );
});

it("a mixed-doctor settlement hides the whole receipt but preserves each doctor's own allocation projection", async () => {
  const s = await visitScenario();
  expect(
    (await s.doctor.post(s.path, { ...s.start, procedures: [s.selections[0]] }))
      .status,
  ).toBe(200);
  const other = await s.create("second-performer", "doctor", [
    "clinical.read",
    "procedures.start",
    "billing.read",
    "billing.edit",
  ]);
  await s.m.post(`/patient-access/${s.patient.id}/share`, {
    commandId: randomUUID(),
    revision: 1,
    accountId: other.id,
    kind: "shared",
  });
  expect(
    (
      await other.post(s.path, {
        ...s.start,
        id: randomUUID(),
        commandId: randomUUID(),
        procedures: [{ ...s.selections[1], planRevision: 5 }],
      })
    ).status,
  ).toBe(200);
  await s.m.post(`/accounts/${s.doctor.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: ["billing.read", "billing.edit", "financial.print"],
  });
  const base = `/billing/${s.patient.id}`;
  const method = {
    commandId: randomUUID(),
    id: randomUUID(),
    revision: 0,
    name: "Espèces",
    active: true,
  };
  await s.m.post("/billing/payment-methods", method);
  const charges = (await s.m.browser.get("/api" + base)).body.charges;
  const mixed = await s.m.post(base + "/settlements", {
    commandId: randomUUID(),
    currency: "MRU",
    methodId: method.id,
    newMoney: "100",
    deposit: "0",
    allocations: charges.map((c: { id: string }) => ({
      chargeId: c.id,
      newMoney: "50",
      credit: "0",
    })),
  });
  expect(mixed.status).toBe(200);
  for (const doctor of [s.doctor, other]) {
    const own = (await doctor.browser.get("/api" + base)).body;
    expect(own.charges).toHaveLength(1);
    expect(own.charges[0]).toMatchObject({
      performedBy: doctor.id,
      paidMinor: "5000",
      dueMinor: "5000",
      allocations: [
        {
          settlementId: mixed.body.id,
          newMoneyMinor: "5000",
          creditMinor: "0",
        },
      ],
    });
    expect(own.settlements).toEqual([]);
    expect(own.deposits).toEqual([]);
    expect(
      (
        await doctor.browser.get(
          "/api" + base + "/settlements/" + mixed.body.id,
        )
      ).status,
    ).toBe(404);
  }
  expect(
    (
      await s.doctor.browser.get(
        "/api" + base + "/settlements/" + mixed.body.id + "/print",
      )
    ).status,
  ).toBe(404);
});

it("accepted price reconciliation preserves paid funds and rejects reductions below allocations", async () => {
  const s = await visitScenario();
  await s.doctor.post(s.path, s.start);
  const base = `/billing/${s.patient.id}`;
  const method = {
    commandId: randomUUID(),
    id: randomUUID(),
    revision: 0,
    name: "Espèces",
    active: true,
  };
  await s.m.post("/billing/payment-methods", method);
  const charge = (await s.m.browser.get("/api" + base)).body.charges[0];
  const paid = await s.m.post(base + "/settlements", {
    commandId: randomUUID(),
    currency: "MRU",
    methodId: method.id,
    newMoney: "50",
    deposit: "0",
    allocations: [{ chargeId: charge.id, newMoney: "50", credit: "0" }],
  });
  expect(paid.status).toBe(200);
  await s.m.post(`/accounts/${s.doctor.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: [
      "clinical.read",
      "plans.draft",
      "plans.finalize",
      "plans.accept",
      "acceptance.draft",
      "prices.override",
      "billing.edit",
    ],
  });
  const revise = async (revision: number, price: string) => {
    const path = `/treatment/${s.patient.id}/plans`;
    expect(
      (
        await s.doctor.post(path, {
          ...s.command,
          commandId: randomUUID(),
          revision,
          items: s.selections.map((i) => ({
            ...s.command.items[0],
            id: i.itemId,
            price,
          })),
        })
      ).status,
    ).toBe(200);
    for (const [action, offset, extra] of [
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
          await s.doctor.post(path + "/lifecycle", {
            commandId: randomUUID(),
            id: s.command.id,
            revision: revision + offset,
            action,
            ...extra,
          })
        ).status,
      ).toBe(200);
  };
  await revise(5, "20");
  const command = {
    commandId: randomUUID(),
    chargeId: charge.id,
    revision: 0,
    acceptedRevision: 9,
    reason: "Accord révisé",
  };
  expect((await s.m.post(base + "/reconcile", command)).status).toBe(409);
  expect(
    (await s.m.browser.get("/api" + base)).body.charges.find(
      (c: { id: string }) => c.id === charge.id,
    ),
  ).toMatchObject({
    chargedMinor: "10000",
    paidMinor: "5000",
    dueMinor: "5000",
    adjustments: [],
  });
  await revise(9, "80");
  expect(
    (
      await s.m.post(base + "/reconcile", {
        ...command,
        commandId: randomUUID(),
        acceptedRevision: 13,
      })
    ).status,
  ).toBe(200);
  expect(
    (await s.m.browser.get("/api" + base)).body.charges.find(
      (c: { id: string }) => c.id === charge.id,
    ),
  ).toMatchObject({
    chargedMinor: "8000",
    paidMinor: "5000",
    dueMinor: "3000",
    reconciliationRequired: false,
  });
  expect(
    (await s.m.browser.get("/api" + base + "/settlements/" + paid.body.id))
      .body,
  ).toEqual(paid.body);
});
