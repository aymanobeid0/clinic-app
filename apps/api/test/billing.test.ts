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
