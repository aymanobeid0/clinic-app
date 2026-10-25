import { randomUUID, createHash } from "node:crypto";
import { crc32 } from "node:zlib";
import sharp from "sharp";
import type { ExportRequest } from "@clinic/contracts";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { createApplication } from "../src/application.js";
import { openDatabase } from "../src/database.js";
import { provisionClinic } from "../src/modules/identity/index.js";
import { cleanupExpiredExports } from "../src/modules/exports/index.js";
const owner = openDatabase(
  `postgresql://clinic_test:fictional-only@127.0.0.1:${process.env.CLINIC_TEST_PORT ?? "55437"}/clinic_issue7`,
);
const runtime = openDatabase(
  `postgresql://clinic_runtime_test:fictional-runtime-only@127.0.0.1:${process.env.CLINIC_TEST_PORT ?? "55437"}/clinic_issue7`,
);
const origin = "http://localhost:4173";
let time = Date.now();
let token = "";
const objects = new Map<string, Buffer>();
let failReads = false;
let readHook: (() => Promise<void>) | undefined;
const options = {
  now: () => time,
  database: runtime,
  origin,
  secureCookies: false,
  sessionSecret: "fictional-session-secret-at-least-32-characters",
  attachmentStore: {
    async put(key: string, bytes: Buffer) {
      objects.set(key, bytes);
    },
    async read(key: string) {
      await readHook?.();
      if (failReads || !objects.has(key)) throw new Error("unavailable");
      return objects.get(key)!;
    },
    async discard(key: string) {
      objects.delete(key);
    },
  },
  mail: {
    async sendVerification(message: { token: string }) {
      token = message.token;
    },
  },
};
let app = createApplication(options);
beforeEach(() => {
  objects.clear();
  failReads = false;
  readHook = undefined;
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
    csrf =
      result.body.csrfToken ??
      (await browser.get("/api/session")).body.csrfToken;
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
    csrf =
      result.body.csrfToken ??
      (await browser.get("/api/session")).body.csrfToken;
    return result;
  };
  await signIn("Fictional-initial-pass-1");
  await post("/onboarding/password", { password: "Fictional-employee-pass-2" });
  csrf = (await browser.get("/api/session")).body.csrfToken;
  expect((await signIn("Fictional-employee-pass-2")).status).toBe(200);
  const identity = (await browser.get("/api/identity")).body;
  return { browser, post, identity, signIn };
}

async function scenario(_now?: number) {
  const m = await manager();

  const ownId = (await m.browser.get("/api/identity")).body.accountId;

  await m.post(`/accounts/${ownId}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",

    permissions: ["patients.create", "patients.read", "exports.patients"],
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

it("exports authenticated patient records privately and replays concurrent commands", async () => {
  expect((await request(app).post("/api/exports").send({})).status).toBe(403);
  const s = await scenario();
  const id = (await s.m.browser.get("/api/identity")).body.accountId;
  await s.m.post(`/accounts/${id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: ["exports.patients", "patients.read"],
  });
  const command = {
    commandId: randomUUID(),
    category: "patients",
    patientId: s.patient.id,
    format: "json",
  };
  const results = await Promise.all([
    s.m.post("/exports", command),
    s.m.post("/exports", command),
  ]);
  expect(results.map((r) => r.status)).toEqual([201, 201]);
  expect(results[0].body).toEqual(results[1].body);
  const content = await s.m.browser.get(
    `/api/exports/${results[0].body.id}/content`,
  );
  expect(content.status).toBe(200);
  expect(content.headers["cache-control"]).toBe("no-store");
  expect(content.body.data.patient).toMatchObject({
    id: s.patient.id,
    name: s.patient.name,
  });
  expect(JSON.stringify(content.body)).not.toMatch(
    /passwordHash|credentialVersion|registrationHash|storageKey|sessionSecret/,
  );
});

it("exports patient CSV with escaped spreadsheet formulas and rejects reused commands", async () => {
  const s = await scenario();
  const formulaPatient = (
    await s.m.post("/patients", {
      commandId: randomUUID(),
      name: "=SUM(1,2)",
      phone: "71111111",
      contactKind: "patient",
      contactName: "",
    })
  ).body.patient;
  const command = {
    commandId: randomUUID(),
    category: "patients",
    patientId: formulaPatient.id,
    format: "csv",
  };
  const receipt = await s.m.post("/exports", command);
  expect(receipt.status).toBe(201);
  const content = await s.m.browser.get(
    `/api/exports/${receipt.body.id}/content`,
  );
  expect(content.headers["content-type"]).toContain("text/csv");
  expect(content.text).toContain('"\'=SUM(1,2)"');
  expect(
    (await s.m.post("/exports", { ...command, format: "json" })).status,
  ).toBe(409);
});

async function exported(
  user: Awaited<ReturnType<typeof manager>>,
  body: object,
) {
  const receipt = await user.post("/exports", {
    commandId: randomUUID(),
    ...body,
  });
  expect(receipt.status).toBe(201);
  const content = await user.browser.get(
    `/api/exports/${receipt.body.id}/content`,
  );
  expect(content.status).toBe(200);
  return content;
}

it("requires configurable manager output permissions, current patient scope, and blocks clinic/account guessing", async () => {
  const s = await scenario(),
    other = await scenario();
  const id = (await s.m.browser.get("/api/identity")).body.accountId;
  await s.m.post(`/accounts/${id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: ["patients.read"],
  });
  expect(
    (
      await s.m.post("/exports", {
        commandId: randomUUID(),
        category: "patients",
        patientId: s.patient.id,
        format: "json",
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await s.m.post("/exports", {
        commandId: randomUUID(),
        category: "inventory",
        format: "json",
      })
    ).status,
  ).toBe(403);
  const doctor = await s.create("export-doctor", "doctor", [
    "patients.read",
    "exports.patients",
    "clinical.read",
  ]);
  expect(
    (
      await doctor.post("/exports", {
        commandId: randomUUID(),
        category: "patients",
        patientId: s.patient.id,
        format: "json",
      })
    ).status,
  ).toBe(403);
  await s.m.post(`/patient-access/${s.patient.id}/share`, {
    commandId: randomUUID(),
    revision: 0,
    accountId: doctor.id,
    kind: "shared",
  });
  const receipt = await doctor.post("/exports", {
    commandId: randomUUID(),
    category: "patients",
    patientId: s.patient.id,
    format: "json",
  });
  expect(receipt.status).toBe(201);
  expect(
    (await s.m.browser.get(`/api/exports/${receipt.body.id}/content`)).status,
  ).toBe(404);
  expect(
    (await other.m.browser.get(`/api/exports/${receipt.body.id}/content`))
      .status,
  ).toBe(404);
  expect(
    (
      await doctor.post("/exports", {
        commandId: randomUUID(),
        category: "patients",
        patientId: other.patient.id,
        format: "json",
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await s.m.post(`/patient-access/${s.patient.id}/remove`, {
        commandId: randomUUID(),
        revision: 1,
        accountId: doctor.id,
      })
    ).status,
  ).toBe(200);
  expect(
    (await doctor.browser.get(`/api/exports/${receipt.body.id}/content`))
      .status,
  ).toBe(403);
});

it("rechecks permission revocation before delivery and denies disabled and historical logins", async () => {
  const s = await scenario();
  const staff = await s.create("exports-staff", "staff", [
    "patients.read",
    "exports.patients",
  ]);
  const receipt = await staff.post("/exports", {
    commandId: randomUUID(),
    category: "patients",
    patientId: s.patient.id,
    format: "json",
  });
  expect(receipt.status).toBe(201);
  await s.m.post(`/accounts/${staff.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: ["patients.read"],
  });
  expect(
    (await staff.browser.get(`/api/exports/${receipt.body.id}/content`)).status,
  ).toBe(403);
  for (const status of ["disabled", "historical"]) {
    const doctor = await s.create(`exports-${status}`, "doctor", [
      "exports.patients",
      "patients.read",
    ]);
    expect(
      (
        await s.m.post(`/accounts/${doctor.id}/status`, {
          currentPassword: "Fictional-manager-pass-2",
          status,
        })
      ).status,
    ).toBe(200);
    await doctor.signIn("Fictional-employee-pass-2");
    expect(
      (
        await doctor.post("/exports", {
          commandId: randomUUID(),
          category: "patients",
          patientId: s.patient.id,
          format: "json",
        })
      ).status,
    ).toBeGreaterThanOrEqual(400);
  }
});

it("expires artifacts and cleans their bytes without changing retained upload usage", async () => {
  const s = await scenario();
  const receipt = await s.m.post("/exports", {
    commandId: randomUUID(),
    category: "patients",
    patientId: s.patient.id,
    format: "json",
  });
  expect(receipt.status).toBe(201);
  time += 15 * 60_000;
  expect(
    (await s.m.browser.get(`/api/exports/${receipt.body.id}/content`)).status,
  ).toBe(410);
  const cleanup = await s.m.post("/exports/cleanup", {});
  expect(cleanup.body).toEqual({ deleted: 1 });
  expect(
    (await s.m.browser.get(`/api/exports/${receipt.body.id}/content`)).status,
  ).toBe(404);
});

it("independent expiry cleanup removes an idle clinic artifact after application restart", async () => {
  time = Date.now() - 16 * 60_000;
  const s = await scenario();
  const receipt = await s.m.post("/exports", {
    commandId: randomUUID(),
    category: "patients",
    patientId: s.patient.id,
    format: "json",
  });
  expect(receipt.status).toBe(201);
  app = createApplication(options);
  expect(await cleanupExpiredExports(runtime)).toBeGreaterThanOrEqual(1);
  expect(
    (await s.m.browser.get(`/api/exports/${receipt.body.id}/content`)).status,
  ).toBe(404);
});

it("exports clinical versions only with clinical scope and refuses non-doctor manager clinical output", async () => {
  const s = await scenario();
  expect(
    (
      await s.m.post("/exports", {
        commandId: randomUUID(),
        category: "clinical",
        patientId: s.patient.id,
        format: "json",
      })
    ).status,
  ).toBe(403);
  const doctor = await s.create("clinical-export", "doctor", [
    "clinical.read",
    "clinical.history",
    "clinical.download",
    "exports.patients",
    "history.draft",
  ]);
  await s.m.post(`/patient-access/${s.patient.id}/share`, {
    commandId: randomUUID(),
    revision: 0,
    accountId: doctor.id,
    kind: "shared",
  });
  const draft = await doctor.post(`/clinical/${s.patient.id}/history/draft`, {
    commandId: randomUUID(),
    revision: 0,
    observedAt: new Date(time).toISOString(),
    content: { medicalHistory: "Antécédent fictif", allergies: "" },
  });
  expect(draft.status).toBe(200);
  const receipt = await doctor.post("/exports", {
    commandId: randomUUID(),
    category: "clinical",
    patientId: s.patient.id,
    format: "json",
  });
  expect(receipt.status).toBe(201);
  const content = await doctor.browser.get(
    `/api/exports/${receipt.body.id}/content`,
  );
  expect(content.body.data.clinical[0].versions[0].content.medicalHistory).toBe(
    "Antécédent fictif",
  );
});

it("exports financial reconciliation with explicit currencies and inventory movement history", async () => {
  const s = await scenario();
  await s.m.post("/catalog/currencies", {
    commandId: randomUUID(),
    code: "MRU",
  });
  expect(
    (
      await s.m.post(`/billing/${s.patient.id}/opening-balances`, {
        commandId: randomUUID(),
        id: randomUUID(),
        currency: "MRU",
        amount: "12",
        provenance: "Registre fictif",
        asOf: new Date(time).toISOString(),
      })
    ).status,
  ).toBe(200);
  const financial = await exported(s.m, {
    category: "financial",
    patientId: s.patient.id,
    format: "json",
  });
  expect(financial.body.data.totals).toContainEqual({
    currency: "MRU",
    plannedMinor: "0",
    dueMinor: "1200",
    creditMinor: "0",
  });
  const own = (await s.m.browser.get("/api/identity")).body.accountId;
  await s.m.post(`/accounts/${own}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: [
      "exports.inventory",
      "inventory.read",
      "inventory.receive",
      "inventory.consume",
    ],
  });
  const item = await s.m.post("/inventory/items", {
    commandId: randomUUID(),
    name: "Gants",
    lowStockThreshold: 1,
    expiryRequired: false,
    active: true,
  });
  const supplier = await s.m.post("/inventory/suppliers", {
    commandId: randomUUID(),
    name: "Fournisseur",
    active: true,
  });
  const batch = await s.m.post("/inventory/receiving", {
    commandId: randomUUID(),
    itemId: item.body.id,
    supplierId: supplier.body.id,
    batchNumber: "FICTIF",
    quantityPacks: 3,
    totalCostMinor: "1500",
    currency: "MRU",
    expiresOn: null,
  });
  expect(batch.status).toBe(200);
  expect(
    (
      await s.m.post("/inventory/consume", {
        commandId: randomUUID(),
        batchId: batch.body.id,
        quantityPacks: 1,
      })
    ).status,
  ).toBe(200);
  const stock = await exported(s.m, { category: "inventory", format: "json" });
  expect(stock.body.data.batches[0]).toMatchObject({
    remainingPacks: 2,
    totalCostMinor: "1500",
    currency: "MRU",
  });
  expect(stock.body.data.movements[0]).toMatchObject({
    batchId: batch.body.id,
    deltaPacks: -1,
    balancePacks: 2,
    revision: 1,
  });
});

it("delivers a private ZIP with exact retained versions and checksums; failed reads publish nothing and retry safely", async () => {
  const s = await scenario();
  const png = await sharp({
    create: { width: 1, height: 1, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  const csrf = (await s.m.browser.get("/api/session")).body.csrfToken;
  const upload = await s.m.browser
    .post(`/api/patients/${s.patient.id}/attachments`)
    .query({
      commandId: randomUUID(),
      classification: "financial",
      name: "preuve.png",
    })
    .set("Origin", origin)
    .set("x-csrf-token", csrf)
    .set("Content-Type", "image/png")
    .send(png);
  expect(upload.status).toBe(200);
  const command = {
    commandId: randomUUID(),
    category: "attachments",
    patientId: s.patient.id,
    format: "zip",
    classification: "financial",
    versions: [{ id: upload.body.id, revision: 1 }],
  };
  failReads = true;
  expect((await s.m.post("/exports", command)).status).toBe(503);
  expect(
    (await s.m.browser.get(`/api/exports/${command.commandId}/content`)).status,
  ).toBe(404);
  failReads = false;
  const receipt = await s.m.post("/exports", command);
  expect(receipt.status).toBe(201);
  const content = await s.m.browser
    .get(`/api/exports/${receipt.body.id}/content`)
    .buffer(true)
    .parse((res, done) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => done(null, Buffer.concat(chunks)));
    });
  expect(content.status).toBe(200);
  const bytes = content.body as Buffer;
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(
    receipt.body.sha256,
  );
  const entries = new Map<string, Buffer>();
  let offset = 0;
  while (bytes.readUInt32LE(offset) === 0x04034b50) {
    const size = bytes.readUInt32LE(offset + 18),
      nameLength = bytes.readUInt16LE(offset + 26),
      extraLength = bytes.readUInt16LE(offset + 28);
    const name = bytes
      .subarray(offset + 30, offset + 30 + nameLength)
      .toString();
    const data = bytes.subarray(
      offset + 30 + nameLength + extraLength,
      offset + 30 + nameLength + extraLength + size,
    );
    expect(crc32(data)).toBe(bytes.readUInt32LE(offset + 14));
    entries.set(name, data);
    offset += 30 + nameLength + extraLength + size;
  }
  expect(entries.get(`attachments/${upload.body.id}/1`)).toEqual(png);
  const manifest = JSON.parse(entries.get("manifest.json")!.toString());
  expect(manifest.data.files[0]).toMatchObject({
    id: upload.body.id,
    revision: 1,
    sha256: createHash("sha256").update(png).digest("hex"),
  });
  expect(bytes.includes(Buffer.from("storageKey"))).toBe(false);
  expect(
    (
      await s.m.post("/exports", {
        ...command,
        commandId: randomUUID(),
        classification: "clinical",
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await s.m.browser.get(
        `/api/patients/${s.patient.id}/attachments?classification=financial`,
      )
    ).body.usage.retainedBytes,
  ).toBe(png.length);
  const staff = await s.create("financial-file-export", "staff", [
    "exports.financial",
    "billing.read",
    "financial.history",
    "financial.download",
    "clinical.read",
  ]);
  expect(
    (
      await s.m.post(`/patient-access/${s.patient.id}/share`, {
        commandId: randomUUID(),
        revision: 0,
        accountId: staff.id,
        kind: "shared",
      })
    ).status,
  ).toBe(200);
  expect(
    (await staff.post("/exports", { ...command, commandId: randomUUID() }))
      .status,
  ).toBe(201);
  const doctor = await s.create("opaque-file-doctor", "doctor", [
    "exports.financial",
    "billing.read",
    "financial.history",
    "financial.download",
    "clinical.read",
  ]);
  expect(
    (
      await s.m.post(`/patient-access/${s.patient.id}/share`, {
        commandId: randomUUID(),
        revision: 1,
        accountId: doctor.id,
        kind: "shared",
      })
    ).status,
  ).toBe(200);
  expect(
    (await doctor.post("/exports", { ...command, commandId: randomUUID() }))
      .status,
  ).toBe(403);
});
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

it("exports only own-work money and redacts restricted staff invoices while managers retain billing references", async () => {
  const s = await mixedCorrectionScenario();
  expect(
    (
      await s.m.post(s.base + "/settlements", {
        commandId: randomUUID(),
        currency: "MRU",
        methodId: s.methodId,
        newMoney: "200",
        deposit: "0",
        allocations: s.charges.map((ch) => ({
          chargeId: ch.id,
          newMoney: "100",
          credit: "0",
        })),
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await s.doctor.post(s.path + "/actions", {
        commandId: randomUUID(),
        id: s.start.id,
        revision: 1,
        action: "complete",
        planId: s.command.id,
        itemId: s.selections[0]!.itemId,
      })
    ).status,
  ).toBe(200);
  const invoice = await s.m.post(s.base + "/invoices", {
    commandId: randomUUID(),
    chargeIds: [s.own.id],
  });
  expect(invoice.status).toBe(200);
  const staff = await s.create("restricted-export", "staff", [
    "billing.read",
    "exports.financial",
  ]);
  const requestBody = {
    category: "financial",
    patientId: s.patient.id,
    format: "json",
  };
  const receipt = await staff.post("/exports", {
    commandId: randomUUID(),
    ...requestBody,
  });
  expect(receipt.status).toBe(201);
  const restricted = await staff.browser.get(
    `/api/exports/${receipt.body.id}/content`,
  );
  expect(restricted.body.data.invoices[0].items[0]).not.toHaveProperty("name");
  expect(restricted.body.data.invoices[0].items[0]).not.toHaveProperty("teeth");
  const managerOutput = await exported(s.m, requestBody);
  expect(managerOutput.body.data.invoices[0].items[0].name).toBe("Acte fictif");
  await s.m.post(`/accounts/${s.doctor.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: ["billing.read", "exports.financial"],
  });
  const ownReceipt = await s.doctor.post("/exports", {
    commandId: randomUUID(),
    ...requestBody,
  });
  expect(ownReceipt.status).toBe(201);
  const own = await s.doctor.browser.get(
    `/api/exports/${ownReceipt.body.id}/content`,
  );
  expect(own.body.data.charges.map((c: { id: string }) => c.id)).toEqual([
    s.own.id,
  ]);
  expect(own.body.data.settlements).toEqual([]);
  expect(own.body.data.totals).toContainEqual({
    currency: "MRU",
    plannedMinor: "0",
    dueMinor: "0",
    creditMinor: "0",
  });
  expect(JSON.stringify(own.body)).not.toContain(s.foreign.id);
});

it("preserves clinical acceptance-file relationships and doctor-manager patient restrictions", async () => {
  const s = await treatmentScenario();
  await s.m.post(`/accounts/${s.doctor.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: [
      "clinical.read",
      "clinical.history",
      "clinical.download",
      "exports.patients",
      "plans.draft",
      "plans.finalize",
      "acceptance.draft",
      "attachments.upload",
    ],
  });
  const png = await sharp({
    create: { width: 1, height: 1, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  const csrf = (await s.doctor.browser.get("/api/session")).body.csrfToken;
  const upload = await s.doctor.browser
    .post(`/api/patients/${s.patient.id}/attachments`)
    .query({
      commandId: randomUUID(),
      classification: "clinical",
      name: "preuve-clinique.png",
    })
    .set("Origin", origin)
    .set("x-csrf-token", csrf)
    .set("Content-Type", "image/png")
    .send(png);
  expect(upload.status).toBe(200);
  expect((await s.doctor.post(s.path, s.command)).status).toBe(200);
  expect(
    (
      await s.doctor.post(s.path + "/lifecycle", {
        commandId: randomUUID(),
        id: s.command.id,
        revision: 1,
        action: "present",
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await s.doctor.post(s.path + "/lifecycle", {
        commandId: randomUUID(),
        id: s.command.id,
        revision: 2,
        action: "evidence",
        acceptedBy: "Patient fictif",
        acceptedAt: new Date(time).toISOString(),
        method: "Document signé",
        attachment: { id: upload.body.id, revision: 1 },
      })
    ).status,
  ).toBe(200);
  const receipt = await s.doctor.post("/exports", {
    commandId: randomUUID(),
    category: "clinical",
    patientId: s.patient.id,
    format: "json",
  });
  expect(receipt.status).toBe(201);
  const content = await s.doctor.browser.get(
    `/api/exports/${receipt.body.id}/content`,
  );
  expect(content.body.data.plans.at(-1).evidence.attachment).toEqual({
    id: upload.body.id,
    revision: 1,
  });
  expect(
    (
      await s.m.post(`/accounts/${s.doctor.id}/manager`, {
        currentPassword: "Fictional-manager-pass-2",
        isManager: true,
      })
    ).status,
  ).toBe(200);
  await s.doctor.signIn("Fictional-employee-pass-2");
  await s.doctor.post("/onboarding/email", {
    email: `promoted-${s.m.code}@example.invalid`,
  });
  const verified = await s.doctor.post("/onboarding/verify-email", { token });
  await s.doctor.post("/onboarding/codes-saved", {
    saved: true,
    batchId: verified.body.batchId,
  });
  expect((await s.doctor.browser.get("/api/identity")).body).toMatchObject({
    isManager: true,
    kind: "doctor",
    stage: "ready",
  });
  const otherPatient = (
    await s.m.post("/patients", {
      commandId: randomUUID(),
      name: "Autre patient",
      phone: "72222222",
      contactKind: "patient",
      contactName: "",
    })
  ).body.patient;
  expect(
    (
      await s.doctor.post("/exports", {
        commandId: randomUUID(),
        category: "clinical",
        patientId: otherPatient.id,
        format: "json",
      })
    ).status,
  ).toBe(403);
});

it("caps separately accounted temporary storage and recovers capacity after expiry", async () => {
  const s = await scenario();
  for (let n = 0; n < 20; n++)
    expect(
      (
        await s.m.post("/exports", {
          commandId: randomUUID(),
          category: "patients",
          patientId: s.patient.id,
          format: "json",
        })
      ).status,
    ).toBe(201);
  const command = {
    commandId: randomUUID(),
    category: "patients",
    patientId: s.patient.id,
    format: "json",
  };
  expect((await s.m.post("/exports", command)).status).toBe(409);
  expect(
    (await s.m.browser.get(`/api/exports/${command.commandId}/content`)).status,
  ).toBe(404);
  time += 15 * 60_000;
  expect((await s.m.post("/exports", command)).status).toBe(201);
});

it("rejects oversized persisted histories before generation and leaves no deliverable artifact", async () => {
  const s = await scenario();
  // Fixture only: create a long retained history without 1 001 rate-limited UI
  // writes. Assertions remain at the authenticated export HTTP boundary.
  await owner.pool.query(
    'INSERT INTO "PatientHistory" (id,"clinicId","patientId","actorId","commandId","payloadHash",action,at,patient) SELECT gen_random_uuid(),"clinicId","patientId","actorId",gen_random_uuid(),\'fixture\',action,at,patient FROM "PatientHistory" CROSS JOIN generate_series(1,1000) WHERE "patientId"=$1',
    [s.patient.id],
  );
  const command = {
    commandId: randomUUID(),
    category: "patients",
    patientId: s.patient.id,
    format: "json",
  };
  expect((await s.m.post("/exports", command)).status).toBe(413);
  expect(
    (await s.m.browser.get(`/api/exports/${command.commandId}/content`)).status,
  ).toBe(404);
});

it("holds generation admission slots until disconnected requests actually finish", async () => {
  const scenarios = [];
  for (let i = 0; i < 4; i++) scenarios.push(await scenario());
  const png = await sharp({
    create: { width: 1, height: 1, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  const commands: Extract<ExportRequest, { category: "attachments" }>[] = [];
  for (const s of scenarios) {
    const csrf = (await s.m.browser.get("/api/session")).body.csrfToken;
    const upload = await s.m.browser
      .post(`/api/patients/${s.patient.id}/attachments`)
      .query({
        commandId: randomUUID(),
        classification: "financial",
        name: "preuve.png",
      })
      .set("Origin", origin)
      .set("x-csrf-token", csrf)
      .set("Content-Type", "image/png")
      .send(png);
    expect(upload.status).toBe(200);
    commands.push({
      commandId: randomUUID(),
      category: "attachments",
      patientId: s.patient.id,
      classification: "financial",
      format: "zip",
      versions: [{ id: upload.body.id, revision: 1 }],
    });
  }
  let release!: () => void,
    entered!: () => void,
    count = 0;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const allEntered = new Promise<void>((resolve) => {
    entered = resolve;
  });
  readHook = async () => {
    if (++count === 4) entered();
    await gate;
  };
  const csrfTokens = await Promise.all(
    scenarios.map(
      async (s) =>
        (await s.m.browser.get("/api/session")).body.csrfToken as string,
    ),
  );
  const requests = scenarios.map((s, i) =>
    s.m.browser
      .post("/api/exports")
      .set("Origin", origin)
      .set("x-csrf-token", csrfTokens[i]!)
      .send(commands[i]!),
  );
  const pending = requests.map((r) =>
    r.then(
      (value) => value,
      (error) => error,
    ),
  );
  try {
    await allEntered;
    requests[0]!.abort();
    const fifth = await scenarios[0]!.m.post("/exports", {
      ...commands[0],
      commandId: randomUUID(),
    });
    expect(fifth.status).toBe(503);
  } finally {
    release();
    await Promise.all(pending);
    readHook = undefined;
  }
  const retry = await scenarios[0]!.m.post("/exports", {
    ...commands[0],
    commandId: randomUUID(),
  });
  expect(retry.status).toBe(201);
}, 30000);
