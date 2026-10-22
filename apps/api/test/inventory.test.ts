import { randomUUID } from "node:crypto";
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

async function receiver() {
  const m = await manager();
  expect(
    (
      await m.post("/catalog/currencies", {
        commandId: randomUUID(),
        code: "MRU",
      })
    ).status,
  ).toBe(200);
  const ownId = (await m.browser.get("/api/identity")).body.accountId;
  await m.post(`/accounts/${ownId}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: ["inventory.read", "inventory.receive"],
  });
  return m;
}
it("authorized receiving creates whole-pack batch availability and retained receiving history", async () => {
  const m = await receiver();
  const supplier = await m.post("/inventory/suppliers", {
    commandId: randomUUID(),
    name: "Fournisseur fictif",
    active: true,
  });
  expect(supplier.status).toBe(200);
  const item = await m.post("/inventory/items", {
    commandId: randomUUID(),
    name: "Gants",
    lowStockThreshold: 5,
    expiryRequired: true,
    active: true,
  });
  expect(item.status).toBe(200);
  const body = {
    commandId: randomUUID(),
    itemId: item.body.id,
    supplierId: supplier.body.id,
    batchNumber: "LOT-1",
    quantityPacks: 3,
    totalCostMinor: "1500",
    currency: "MRU",
    expiresOn: "2099-12-31",
  };
  const received = await m.post("/inventory/receiving", body);
  expect(received.status).toBe(200);
  const stock = await m.browser.get("/api/inventory");
  expect(stock.status).toBe(200);
  expect(stock.body.items[0]).toMatchObject({
    name: "Gants",
    availablePacks: 3,
    lowStock: true,
    lowStockThreshold: 5,
  });
  expect(stock.body.batches[0]).toMatchObject({
    id: received.body.id,
    quantityPacks: 3,
    availablePacks: 3,
    expired: false,
    expiresOn: "2099-12-31",
  });
  const history = await m.browser.get("/api/inventory/receiving");
  expect(history.body.receipts).toHaveLength(1);
  expect(history.body.receipts[0]).toMatchObject({
    id: received.body.id,
    itemName: "Gants",
    supplierName: "Fournisseur fictif",
    totalCostMinor: "1500",
    currency: "MRU",
    quantityPacks: 3,
  });
});
async function references(
  m: Awaited<ReturnType<typeof receiver>>,
  expiryRequired = true,
) {
  const supplier = await m.post("/inventory/suppliers", {
    commandId: randomUUID(),
    name: "Fournisseur fictif",
    active: true,
  });
  const item = await m.post("/inventory/items", {
    commandId: randomUUID(),
    name: "Gants",
    lowStockThreshold: 5,
    expiryRequired,
    active: true,
  });
  expect([supplier.status, item.status]).toEqual([200, 200]);
  return { supplier: supplier.body, item: item.body };
}
function batch(
  ref: Awaited<ReturnType<typeof references>>,
  overrides: Record<string, unknown> = {},
) {
  return {
    commandId: randomUUID(),
    itemId: ref.item.id,
    supplierId: ref.supplier.id,
    batchNumber: randomUUID(),
    quantityPacks: 3,
    totalCostMinor: "1500",
    currency: "MRU",
    expiresOn: "2099-12-31",
    ...overrides,
  };
}
it("expiry is inclusive through UTC expiry day and warning window, with expired packs excluded", async () => {
  const m = await receiver();
  const ref = await references(m);
  const today = new Date().toISOString().slice(0, 10);
  const day = (offset: number) => {
    const d = new Date(today + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  };
  const set = await m.post("/inventory/settings", {
    commandId: randomUUID(),
    revision: 0,
    expiryWarningDays: 2,
  });
  expect(set.status).toBe(200);
  for (const [offset, quantityPacks] of [
    [-1, 20],
    [0, 1],
    [2, 2],
    [3, 3],
  ]) {
    expect(
      (
        await m.post(
          "/inventory/receiving",
          batch(ref, { expiresOn: day(offset), quantityPacks }),
        )
      ).status,
    ).toBe(200);
  }
  const stock = await m.browser.get("/api/inventory");
  expect(stock.body.items[0]).toMatchObject({
    availablePacks: 6,
    lowStock: false,
  });
  expect(
    stock.body.batches
      .map(
        (b: {
          expiresOn: string;
          expired: boolean;
          expiring: boolean;
          availablePacks: number;
        }) => [b.expiresOn, b.expired, b.expiring, b.availablePacks],
      )
      .sort(),
  ).toEqual(
    [
      [day(-1), true, false, 0],
      [day(0), false, true, 1],
      [day(2), false, true, 2],
      [day(3), false, false, 3],
    ].sort(),
  );
});
it("whole packs, exact costs and valid dates are required without leaving partial receipts", async () => {
  const m = await receiver();
  const ref = await references(m);
  for (const overrides of [
    { quantityPacks: 0 },
    { quantityPacks: -1 },
    { quantityPacks: 1.5 },
    { quantityPacks: "3" },
    { totalCostMinor: "1.5" },
    { totalCostMinor: "-1" },
    { totalCostMinor: "9007199254740992" },
    { currency: "XXX" },
    { expiresOn: "2027-02-29" },
    { expiresOn: "2026-10-22T12:00:00Z" },
    { expiresOn: null },
    { patientId: randomUUID() },
  ]) {
    expect(
      (await m.post("/inventory/receiving", batch(ref, overrides))).status,
    ).toBe(400);
  }
  expect(
    (await m.browser.get("/api/inventory/receiving")).body.receipts,
  ).toEqual([]);
  const optional = await references(m, false);
  expect(
    (
      await m.post(
        "/inventory/receiving",
        batch(optional, { expiresOn: null, totalCostMinor: "0" }),
      )
    ).status,
  ).toBe(200);
});
it("retries replay one receipt and concurrent batch duplicates conflict atomically", async () => {
  const m = await receiver();
  const ref = await references(m);
  const data = batch(ref);
  const results = await Promise.all([
    m.post("/inventory/receiving", data),
    m.post("/inventory/receiving", data),
  ]);
  expect(results.map((r) => r.status)).toEqual([200, 200]);
  expect(results[0].body).toEqual(results[1].body);
  expect(
    (await m.post("/inventory/receiving", { ...data, quantityPacks: 4 }))
      .status,
  ).toBe(409);
  const duplicate = await Promise.all([
    m.post("/inventory/receiving", batch(ref, { batchNumber: "duplicate" })),
    m.post("/inventory/receiving", batch(ref, { batchNumber: "duplicate" })),
  ]);
  expect(duplicate.map((r) => r.status).sort()).toEqual([200, 409]);
  const history = await m.browser.get("/api/inventory/receiving");
  expect(history.body.receipts).toHaveLength(2);
  expect(
    (await m.browser.get("/api/inventory")).body.items[0].availablePacks,
  ).toBe(6);
});
it("item supplier and settings revisions reject lost updates and retain captured receiving names", async () => {
  const m = await receiver();
  const ref = await references(m);
  const data = batch(ref);
  const received = await m.post("/inventory/receiving", data);
  expect(received.status).toBe(200);
  const itemData = {
    commandId: randomUUID(),
    revision: 0,
    name: "Gants renommés",
    active: false,
    lowStockThreshold: 10,
    expiryRequired: true,
  };
  const updates = await Promise.all([
    m.post(`/inventory/items/${ref.item.id}`, itemData),
    m.post(`/inventory/items/${ref.item.id}`, {
      ...itemData,
      commandId: randomUUID(),
      name: "conflit",
    }),
  ]);
  expect(updates.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(
    (
      await m.post(`/inventory/suppliers/${ref.supplier.id}`, {
        commandId: randomUUID(),
        revision: 0,
        name: "Nouveau nom",
        active: false,
      })
    ).status,
  ).toBe(200);
  expect((await m.post("/inventory/receiving", batch(ref))).status).toBe(409);
  const history = await m.browser.get("/api/inventory/receiving");
  expect(history.body.receipts[0]).toMatchObject({
    itemName: "Gants",
    supplierName: "Fournisseur fictif",
  });
  expect((await m.post("/inventory/receiving", data)).body).toEqual(
    received.body,
  );
  expect(
    (
      await m.post(`/inventory/items/${ref.item.id}`, {
        ...itemData,
        commandId: randomUUID(),
        revision: 1,
        expiryRequired: false,
      })
    ).status,
  ).toBe(409);
  const settings = await Promise.all([
    m.post("/inventory/settings", {
      commandId: randomUUID(),
      revision: 0,
      expiryWarningDays: 0,
    }),
    m.post("/inventory/settings", {
      commandId: randomUUID(),
      revision: 0,
      expiryWarningDays: 1,
    }),
  ]);
  expect(settings.map((r) => r.status).sort()).toEqual([200, 409]);
});
async function employee(
  m: Awaited<ReturnType<typeof manager>>,
  permissions: string[],
  kind = "staff",
) {
  const username = "user" + randomUUID().slice(0, 8);
  const created = await m.post("/accounts", {
    username,
    displayName: username,
    kind,
    temporaryPassword: "Fictional-initial-pass-1",
    currentPassword: "Fictional-manager-pass-2",
  });
  expect(created.status).toBe(201);
  expect(
    (
      await m.post(`/accounts/${created.body.id}/permissions`, {
        currentPassword: "Fictional-manager-pass-2",
        permissions,
      })
    ).status,
  ).toBe(200);
  return { ...(await activateEmployee(m.code, username)), id: created.body.id };
}
it("explicit read and receive permissions are independent, with manager-only settings and immediate revocation", async () => {
  const m = await receiver();
  const ref = await references(m);
  const reader = await employee(m, ["inventory.read"]);
  expect((await reader.browser.get("/api/inventory")).status).toBe(200);
  expect((await reader.post("/inventory/receiving", batch(ref))).status).toBe(
    403,
  );
  expect(
    (
      await reader.post("/inventory/settings", {
        commandId: randomUUID(),
        revision: 0,
        expiryWarningDays: 10,
      })
    ).status,
  ).toBe(403);
  const writer = await employee(m, ["inventory.receive"]);
  expect((await writer.browser.get("/api/inventory")).status).toBe(403);
  expect((await writer.browser.get("/api/inventory/receiving")).status).toBe(
    403,
  );
  expect((await writer.browser.get("/api/inventory/settings")).status).toBe(
    403,
  );
  const data = batch(ref);
  expect((await writer.post("/inventory/receiving", data)).status).toBe(200);
  expect((await m.post("/inventory/receiving", data)).status).toBe(409);
  expect(
    (
      await m.post(`/accounts/${writer.id}/permissions`, {
        currentPassword: "Fictional-manager-pass-2",
        permissions: [],
      })
    ).status,
  ).toBe(200);
  expect((await writer.post("/inventory/receiving", data)).status).toBe(403);
  const ownId = (await m.browser.get("/api/identity")).body.accountId;
  expect(
    (
      await m.post(`/accounts/${ownId}/permissions`, {
        currentPassword: "Fictional-manager-pass-2",
        permissions: [],
      })
    ).status,
  ).toBe(200);
  expect((await m.browser.get("/api/inventory")).status).toBe(403);
  expect((await m.post("/inventory/receiving", batch(ref))).status).toBe(403);
  expect(
    (
      await m.post("/inventory/settings", {
        commandId: randomUUID(),
        revision: 0,
        expiryWarningDays: 0,
      })
    ).status,
  ).toBe(200);
});
it("clinic isolation rejects foreign references and never returns foreign stock, history or settings", async () => {
  const m = await receiver();
  const ref = await references(m);
  expect((await m.post("/inventory/receiving", batch(ref))).status).toBe(200);
  expect(
    (
      await m.post("/inventory/settings", {
        commandId: randomUUID(),
        revision: 0,
        expiryWarningDays: 100,
      })
    ).status,
  ).toBe(200);
  const other = await receiver();
  const local = await references(other);
  expect((await other.post("/inventory/receiving", batch(ref))).status).toBe(
    404,
  );
  expect(
    (
      await other.post(
        "/inventory/receiving",
        batch(local, { supplierId: ref.supplier.id }),
      )
    ).status,
  ).toBe(404);
  expect(
    (
      await other.post(`/inventory/items/${ref.item.id}`, {
        commandId: randomUUID(),
        revision: 0,
        name: "Intrusion",
        active: true,
        expiryRequired: true,
        lowStockThreshold: 0,
      })
    ).status,
  ).toBe(404);
  expect(
    (
      await other.post(`/inventory/suppliers/${ref.supplier.id}`, {
        commandId: randomUUID(),
        revision: 0,
        name: "Intrusion",
        active: true,
      })
    ).status,
  ).toBe(404);
  const projection = await other.browser.get("/api/inventory");
  expect(projection.body.batches).toEqual([]);
  expect(projection.body.items.map((i: { id: string }) => i.id)).toEqual([
    local.item.id,
  ]);
  expect(projection.body.settings.expiryWarningDays).toBe(30);
  expect(
    (await other.browser.get("/api/inventory/receiving")).body.receipts,
  ).toEqual([]);
});
it("no patient assignment is needed for authorized operational inventory, while historical-only and disabled accounts are denied", async () => {
  const m = await receiver();
  const ref = await references(m);
  const doctor = await employee(
    m,
    ["inventory.read", "inventory.receive"],
    "doctor",
  );
  expect((await doctor.browser.get("/api/inventory")).status).toBe(200);
  const data = batch(ref);
  expect((await doctor.post("/inventory/receiving", data)).status).toBe(200);
  expect(
    (
      await m.post(`/accounts/${doctor.id}/status`, {
        currentPassword: "Fictional-manager-pass-2",
        status: "historical",
      })
    ).status,
  ).toBe(200);
  expect((await doctor.signIn("Fictional-employee-pass-2")).status).toBe(200);
  expect((await doctor.browser.get("/api/inventory")).status).toBe(403);
  expect((await doctor.post("/inventory/receiving", data)).status).toBe(403);
  expect(
    (
      await m.post(`/accounts/${doctor.id}/status`, {
        currentPassword: "Fictional-manager-pass-2",
        status: "disabled",
      })
    ).status,
  ).toBe(200);
  expect((await doctor.browser.get("/api/inventory")).status).toBe(401);
});
it("unauthenticated reads and cross-origin writes cannot access inventory", async () => {
  for (const path of [
    "/inventory",
    "/inventory/settings",
    "/inventory/receiving",
    "/inventory/events",
  ])
    expect((await request(app).get("/api" + path)).status).toBe(401);
  const m = await receiver();
  const ref = await references(m);
  expect(
    (
      await m.browser
        .post("/api/inventory/receiving")
        .set("Origin", "https://foreign.invalid")
        .send(batch(ref))
    ).status,
  ).toBe(403);
  expect(
    (await m.browser.get("/api/inventory/receiving")).body.receipts,
  ).toEqual([]);
});

it("receiving cost uses a manager-enabled currency without converting or rounding", async () => {
  const m = await receiver();
  const ref = await references(m);
  expect(
    (
      await m.post(
        "/inventory/receiving",
        batch(ref, { currency: "EUR", totalCostMinor: "1234" }),
      )
    ).status,
  ).toBe(400);
  expect(
    (
      await m.post("/catalog/currencies", {
        commandId: randomUUID(),
        code: "EUR",
      })
    ).status,
  ).toBe(200);
  const received = await m.post(
    "/inventory/receiving",
    batch(ref, { currency: "EUR", totalCostMinor: "1234" }),
  );
  expect(received.status).toBe(200);
  expect(received.body).toMatchObject({
    currency: "EUR",
    totalCostMinor: "1234",
  });
});

it("availability changes exactly at UTC midnight while retained receiving history stays unchanged", async () => {
  time = Date.parse("2026-10-22T23:59:59.999Z");
  const m = await receiver();
  const ref = await references(m, false);
  expect(
    (
      await m.post(
        "/inventory/receiving",
        batch(ref, { expiresOn: "2026-10-22", quantityPacks: 2 }),
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await m.post(
        "/inventory/receiving",
        batch(ref, { expiresOn: null, quantityPacks: 3 }),
      )
    ).status,
  ).toBe(200);
  expect(
    (await m.browser.get("/api/inventory")).body.items[0].availablePacks,
  ).toBe(5);
  const history = (await m.browser.get("/api/inventory/receiving")).body;
  time++;
  const after = await m.browser.get("/api/inventory");
  expect(after.body).toMatchObject({
    asOfDate: "2026-10-23",
    items: [{ availablePacks: 3 }],
  });
  expect((await m.browser.get("/api/inventory/receiving")).body).toEqual(
    history,
  );
});
it("a database failure rolls back receiving and its retry can commit once", async () => {
  const m = await receiver();
  const ref = await references(m);
  const data = batch(ref);
  const clinicId = (await m.browser.get("/api/identity")).body
    .clinicId as string;
  // System-boundary fault injection only; assertions remain at authenticated HTTP.
  await owner.pool.query(
    `CREATE FUNCTION inventory_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."clinicId"::text = '${clinicId}' THEN RAISE EXCEPTION 'FICTIONAL_FAILURE'; END IF; RETURN NEW; END $$`,
  );
  await owner.pool.query(
    'CREATE TRIGGER inventory_test_failure BEFORE INSERT ON "InventoryCommand" FOR EACH ROW EXECUTE FUNCTION inventory_test_failure()',
  );
  try {
    const failed = await m.post("/inventory/receiving", data);
    expect(failed.status).toBe(500);
    expect(JSON.stringify(failed.body)).not.toContain("FICTIONAL_FAILURE");
    expect(
      (await m.browser.get("/api/inventory/receiving")).body.receipts,
    ).toEqual([]);
    expect(
      (await m.browser.get("/api/inventory")).body.items[0].availablePacks,
    ).toBe(0);
  } finally {
    await owner.pool.query(
      'DROP TRIGGER inventory_test_failure ON "InventoryCommand"',
    );
    await owner.pool.query("DROP FUNCTION inventory_test_failure()");
  }
  expect((await m.post("/inventory/receiving", data)).status).toBe(200);
  expect((await m.post("/inventory/receiving", data)).status).toBe(200);
  expect(
    (await m.browser.get("/api/inventory/receiving")).body.receipts,
  ).toHaveLength(1);
});
it("inventory SSE invalidates without stock details and closes when read permission is revoked", async () => {
  const m = await receiver();
  const ref = await references(m);
  const accountId = (await m.browser.get("/api/identity")).body.accountId;
  const login = await m.login("Fictional-manager-pass-2");
  const cookie = (login.headers["set-cookie"] as unknown as string[])
    .map((v) => v.split(";")[0])
    .join("; ");
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const port = (server.address() as { port: number }).port;
  const abort = new AbortController();
  try {
    const response = await fetch(
      `http://127.0.0.1:${port}/api/inventory/events`,
      { headers: { Cookie: cookie }, signal: abort.signal },
    );
    expect(response.status).toBe(200);
    const reader = response.body!.getReader();
    expect(new TextDecoder().decode((await reader.read()).value)).toContain(
      "event: invalidate",
    );
    expect((await m.post("/inventory/receiving", batch(ref))).status).toBe(200);
    const signal = new TextDecoder().decode((await reader.read()).value);
    expect(signal).toContain("event: invalidate");
    expect(signal).not.toContain("Gants");
    await m.post(`/accounts/${accountId}/permissions`, {
      currentPassword: "Fictional-manager-pass-2",
      permissions: ["inventory.receive"],
    });
    let closed = false;
    for (let i = 0; i < 5; i++) {
      if ((await reader.read()).done) {
        closed = true;
        break;
      }
    }
    expect(closed).toBe(true);
  } finally {
    abort.abort();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
it("inventory readers can discover manager-enabled receiving currencies without clinical or catalog authority", async () => {
  const m = await receiver();
  const reader = await employee(m, ["inventory.read"]);
  expect((await reader.browser.get("/api/catalog/currencies")).status).toBe(
    403,
  );
  const projection = await reader.browser.get("/api/inventory");
  expect(projection.status).toBe(200);
  expect(projection.body.currencies).toEqual([{ code: "MRU", precision: 2 }]);
  expect(
    (
      await m.post("/catalog/currencies", {
        commandId: randomUUID(),
        code: "JPY",
      })
    ).status,
  ).toBe(200);
  expect((await reader.browser.get("/api/inventory")).body.currencies).toEqual([
    { code: "JPY", precision: 0 },
    { code: "MRU", precision: 2 },
  ]);
});

it("opening one manually selected pack retains a movement and reduces only that batch", async () => {
  const m = await receiver();
  const ownId = (await m.browser.get("/api/identity")).body.accountId;
  await m.post(`/accounts/${ownId}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: ["inventory.read", "inventory.receive", "inventory.consume"],
  });
  const ref = await references(m);
  const first = await m.post("/inventory/receiving", batch(ref));
  const second = await m.post("/inventory/receiving", batch(ref));
  const consumed = await m.post("/inventory/consume", {
    commandId: randomUUID(),
    batchId: first.body.id,
    quantityPacks: 1,
  });
  expect(consumed.status).toBe(200);
  expect(consumed.body).toMatchObject({
    batchId: first.body.id,
    kind: "consume",
    deltaPacks: -1,
    balancePacks: 2,
    actorId: ownId,
  });
  const stock = (await m.browser.get("/api/inventory")).body;
  expect(
    stock.batches.find((b: { id: string }) => b.id === first.body.id)
      .availablePacks,
  ).toBe(2);
  expect(
    stock.batches.find((b: { id: string }) => b.id === second.body.id)
      .availablePacks,
  ).toBe(3);
  expect(stock.items[0].availablePacks).toBe(5);
  expect(
    (await m.browser.get("/api/inventory/movements")).body.movements,
  ).toEqual([consumed.body]);
  expect(
    (await m.browser.get("/api/inventory/receiving")).body.receipts[0]
      .quantityPacks,
  ).toBe(3);
});
async function operator() {
  const m = await receiver();
  const ownId = (await m.browser.get("/api/identity")).body.accountId;
  expect(
    (
      await m.post(`/accounts/${ownId}/permissions`, {
        currentPassword: "Fictional-manager-pass-2",
        permissions: [
          "inventory.read",
          "inventory.receive",
          "inventory.consume",
          "inventory.adjust",
        ],
      })
    ).status,
  ).toBe(200);
  const ref = await references(m);
  const received = await m.post(
    "/inventory/receiving",
    batch(ref, { quantityPacks: 6 }),
  );
  expect(received.status).toBe(200);
  return { ...m, ref, batchId: received.body.id, ownId };
}
it("reasoned waste, disposal and count corrections preserve original and intervening movements", async () => {
  const m = await operator();
  const waste = await m.post("/inventory/corrections", {
    commandId: randomUUID(),
    batchId: m.batchId,
    revision: 0,
    kind: "waste",
    quantityPacks: 2,
    reason: "  Emballage endommagé  ",
  });
  expect(waste.status).toBe(200);
  expect(waste.body).toMatchObject({
    kind: "waste",
    deltaPacks: -2,
    balancePacks: 4,
    revision: 1,
    reason: "Emballage endommagé",
  });
  const disposal = await m.post("/inventory/corrections", {
    commandId: randomUUID(),
    batchId: m.batchId,
    revision: 1,
    kind: "disposal",
    quantityPacks: 1,
    reason: "Contamination",
  });
  expect(disposal.status).toBe(200);
  const count = await m.post("/inventory/corrections", {
    commandId: randomUUID(),
    batchId: m.batchId,
    revision: 2,
    kind: "count",
    countedPacks: 8,
    reason: "Recomptage physique",
  });
  expect(count.status).toBe(200);
  expect(count.body).toMatchObject({
    kind: "count",
    deltaPacks: 5,
    balancePacks: 8,
    revision: 3,
  });
  const down = await m.post("/inventory/corrections", {
    commandId: randomUUID(),
    batchId: m.batchId,
    revision: 3,
    kind: "count",
    countedPacks: 0,
    reason: "Vérification finale",
  });
  expect(down.status).toBe(200);
  expect(down.body).toMatchObject({
    deltaPacks: -8,
    balancePacks: 0,
    revision: 4,
  });
  expect(
    (await m.browser.get("/api/inventory/movements")).body.movements,
  ).toEqual([waste.body, disposal.body, count.body, down.body]);
  expect(
    (await m.browser.get("/api/inventory/receiving")).body.receipts[0]
      .quantityPacks,
  ).toBe(6);
  expect((await m.browser.get("/api/inventory")).body.batches[0]).toMatchObject(
    { remainingPacks: 0, stockRevision: 4, availablePacks: 0 },
  );
});
it("movement inputs reject fractions, missing reasons and patient or visit linkage without partial history", async () => {
  const m = await operator();
  for (const quantityPacks of [0, -1, 0.5, 2, "1", null]) {
    expect(
      (
        await m.post("/inventory/consume", {
          commandId: randomUUID(),
          batchId: m.batchId,
          quantityPacks,
        })
      ).status,
    ).toBe(400);
  }
  for (const extra of [
    { patientId: randomUUID() },
    { visitId: randomUUID() },
    { clinicId: randomUUID() },
  ]) {
    expect(
      (
        await m.post("/inventory/consume", {
          commandId: randomUUID(),
          batchId: m.batchId,
          quantityPacks: 1,
          ...extra,
        })
      ).status,
    ).toBe(400);
  }
  for (const extra of [
    { reason: " " },
    { reason: null },
    { reason: undefined },
    { quantityPacks: 1.5 },
    { quantityPacks: 0 },
    { quantityPacks: -1 },
    { revision: -1 },
    { patientId: randomUUID() },
  ]) {
    expect(
      (
        await m.post("/inventory/corrections", {
          commandId: randomUUID(),
          batchId: m.batchId,
          revision: 0,
          kind: "waste",
          quantityPacks: 1,
          reason: "Perte",
          ...extra,
        })
      ).status,
    ).toBe(400);
  }
  expect(
    (
      await m.post("/inventory/corrections", {
        commandId: randomUUID(),
        batchId: m.batchId,
        revision: 0,
        kind: "count",
        countedPacks: 0.5,
        reason: "Compte",
      })
    ).status,
  ).toBe(400);
  expect(
    (await m.browser.get("/api/inventory/movements")).body.movements,
  ).toEqual([]);
  expect(
    (await m.browser.get("/api/inventory")).body.batches[0].remainingPacks,
  ).toBe(6);
});
it("concurrent openings cannot consume more packs than remain and identical retries commit once", async () => {
  const m = await operator();
  const command = {
    commandId: randomUUID(),
    batchId: m.batchId,
    quantityPacks: 1,
  };
  const repeated = await Promise.all([
    m.post("/inventory/consume", command),
    m.post("/inventory/consume", command),
  ]);
  expect(repeated.map((r) => r.status)).toEqual([200, 200]);
  expect(repeated[0].body).toEqual(repeated[1].body);
  const raced = await Promise.all(
    Array.from({ length: 6 }, () =>
      m.post("/inventory/consume", { ...command, commandId: randomUUID() }),
    ),
  );
  expect(raced.map((r) => r.status).sort()).toEqual([
    200, 200, 200, 200, 200, 409,
  ]);
  expect((await m.post("/inventory/consume", command)).body).toEqual(
    repeated[0].body,
  );
  expect(
    (await m.browser.get("/api/inventory/movements")).body.movements,
  ).toHaveLength(6);
  expect((await m.browser.get("/api/inventory")).body.batches[0]).toMatchObject(
    { remainingPacks: 0, stockRevision: 6 },
  );
});
it("stale counts conflict after intervening consumption and correction retries do not duplicate history", async () => {
  const m = await operator();
  const count = {
    commandId: randomUUID(),
    batchId: m.batchId,
    revision: 0,
    kind: "count",
    countedPacks: 9,
    reason: "Recomptage",
  };
  const first = await m.post("/inventory/corrections", count);
  expect(first.status).toBe(200);
  expect(
    (
      await m.post("/inventory/consume", {
        commandId: randomUUID(),
        batchId: m.batchId,
        quantityPacks: 1,
      })
    ).status,
  ).toBe(200);
  expect((await m.post("/inventory/corrections", count)).body).toEqual(
    first.body,
  );
  expect(
    (await m.post("/inventory/corrections", { ...count, countedPacks: 10 }))
      .status,
  ).toBe(409);
  expect(
    (
      await m.post("/inventory/corrections", {
        ...count,
        commandId: randomUUID(),
        revision: 1,
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await m.post("/inventory/consume", {
        commandId: count.commandId,
        batchId: m.batchId,
        quantityPacks: 1,
      })
    ).status,
  ).toBe(409);
  const waste = {
    commandId: randomUUID(),
    batchId: m.batchId,
    revision: 2,
    kind: "waste",
    quantityPacks: 9,
    reason: "Perte",
  };
  expect((await m.post("/inventory/corrections", waste)).status).toBe(409);
  expect(
    (await m.post("/inventory/corrections", { ...waste, quantityPacks: 1 }))
      .status,
  ).toBe(200);
  expect(
    (await m.browser.get("/api/inventory/movements")).body.movements,
  ).toHaveLength(3);
  expect(
    (await m.browser.get("/api/inventory")).body.batches[0].remainingPacks,
  ).toBe(7);
});
it("competing count corrections conflict rather than silently overwriting physical stock", async () => {
  const m = await operator();
  const body = {
    batchId: m.batchId,
    revision: 0,
    kind: "count",
    countedPacks: 4,
    reason: "Compte",
  };
  const results = await Promise.all([
    m.post("/inventory/corrections", { ...body, commandId: randomUUID() }),
    m.post("/inventory/corrections", {
      ...body,
      commandId: randomUUID(),
      countedPacks: 7,
    }),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  const won = results.find((r) => r.status === 200)!;
  expect(
    (await m.browser.get("/api/inventory")).body.batches[0].remainingPacks,
  ).toBe(won.body.balancePacks);
  expect(
    (await m.browser.get("/api/inventory/movements")).body.movements,
  ).toEqual([won.body]);
});
it("expiry blocks consumption at UTC midnight but allows honest disposal and count correction of expired stock", async () => {
  time = Date.parse("2026-10-22T23:59:59.999Z");
  const m = await operator();
  const received = await m.post(
    "/inventory/receiving",
    batch(m.ref, { expiresOn: "2026-10-22", quantityPacks: 3 }),
  );
  const command = {
    commandId: randomUUID(),
    batchId: received.body.id,
    quantityPacks: 1,
  };
  const opened = await m.post("/inventory/consume", command);
  expect(opened.status).toBe(200);
  time++;
  expect(
    (
      await m.post("/inventory/consume", {
        ...command,
        commandId: randomUUID(),
      })
    ).status,
  ).toBe(409);
  expect((await m.post("/inventory/consume", command)).body).toEqual(
    opened.body,
  );
  const disposed = await m.post("/inventory/corrections", {
    commandId: randomUUID(),
    batchId: received.body.id,
    revision: 1,
    kind: "disposal",
    quantityPacks: 1,
    reason: "Périmé",
  });
  expect(disposed.status).toBe(200);
  const counted = await m.post("/inventory/corrections", {
    commandId: randomUUID(),
    batchId: received.body.id,
    revision: 2,
    kind: "count",
    countedPacks: 5,
    reason: "Stock physique",
  });
  expect(counted.status).toBe(200);
  const stock = (await m.browser.get("/api/inventory")).body.batches.find(
    (b: { id: string }) => b.id === received.body.id,
  );
  expect(stock).toMatchObject({
    expired: true,
    availablePacks: 0,
    remainingPacks: 5,
    stockRevision: 3,
  });
  expect(
    (
      await m.post("/inventory/consume", {
        ...command,
        commandId: randomUUID(),
      })
    ).status,
  ).toBe(409);
  const optional = await references(m, false);
  const nonExpiring = await m.post(
    "/inventory/receiving",
    batch(optional, { expiresOn: null }),
  );
  expect(
    (
      await m.post("/inventory/consume", {
        commandId: randomUUID(),
        batchId: nonExpiring.body.id,
        quantityPacks: 1,
      })
    ).status,
  ).toBe(200);
});
it("consume and adjust permissions remain independent from receiving, manager authority and patient care", async () => {
  const m = await operator();
  const consumer = await employee(m, ["inventory.consume"], "doctor");
  const adjuster = await employee(m, ["inventory.adjust"]);
  const command = {
    commandId: randomUUID(),
    batchId: m.batchId,
    quantityPacks: 1,
  };
  const correction = {
    commandId: randomUUID(),
    batchId: m.batchId,
    revision: 1,
    kind: "waste",
    quantityPacks: 1,
    reason: "Perte",
  };
  expect((await consumer.post("/inventory/consume", command)).status).toBe(200);
  expect((await consumer.browser.get("/api/inventory/movements")).status).toBe(
    403,
  );
  expect(
    (await consumer.post("/inventory/corrections", correction)).status,
  ).toBe(403);
  expect(
    (
      await adjuster.post("/inventory/consume", {
        ...command,
        commandId: randomUUID(),
      })
    ).status,
  ).toBe(403);
  expect(
    (await adjuster.post("/inventory/corrections", correction)).status,
  ).toBe(200);
  expect((await m.post("/inventory/consume", command)).status).toBe(409);
  const receiverOnly = await employee(m, [
    "inventory.read",
    "inventory.receive",
  ]);
  expect((await receiverOnly.post("/inventory/consume", command)).status).toBe(
    403,
  );
  expect(
    (await receiverOnly.post("/inventory/corrections", correction)).status,
  ).toBe(403);
  expect(
    (await receiverOnly.browser.get("/api/inventory/movements")).body.movements,
  ).toHaveLength(2);
  await m.post(`/accounts/${consumer.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: [],
  });
  expect((await consumer.post("/inventory/consume", command)).status).toBe(403);
  await m.post(`/accounts/${m.ownId}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: [],
  });
  expect((await m.post("/inventory/consume", command)).status).toBe(403);
  expect((await m.post("/inventory/corrections", correction)).status).toBe(403);
});
it("foreign batches and spoofed scope cannot cross clinics or expose movement history", async () => {
  const m = await operator(),
    other = await operator();
  const body = {
    commandId: randomUUID(),
    batchId: m.batchId,
    quantityPacks: 1,
  };
  expect((await m.post("/inventory/consume", body)).status).toBe(200);
  expect((await other.post("/inventory/consume", body)).status).toBe(404);
  expect(
    (
      await other.post("/inventory/corrections", {
        commandId: randomUUID(),
        batchId: m.batchId,
        revision: 1,
        kind: "count",
        countedPacks: 5,
        reason: "Intrusion",
      })
    ).status,
  ).toBe(404);
  expect(
    (await other.browser.get("/api/inventory/movements")).body.movements,
  ).toEqual([]);
  expect(
    (await other.browser.get("/api/inventory")).body.batches[0].remainingPacks,
  ).toBe(6);
  expect(
    (
      await m.post("/inventory/consume", {
        ...body,
        commandId: randomUUID(),
        patientId: randomUUID(),
      })
    ).status,
  ).toBe(400);
});
it("historical-only, disabled and unauthenticated accounts cannot use movement endpoints and CSRF is required", async () => {
  const m = await operator();
  const doctor = await employee(
    m,
    ["inventory.read", "inventory.consume", "inventory.adjust"],
    "doctor",
  );
  const command = {
    commandId: randomUUID(),
    batchId: m.batchId,
    quantityPacks: 1,
  };
  const correction = {
    commandId: randomUUID(),
    batchId: m.batchId,
    revision: 0,
    kind: "count",
    countedPacks: 2,
    reason: "Compte",
  };
  await m.post(`/accounts/${doctor.id}/status`, {
    currentPassword: "Fictional-manager-pass-2",
    status: "historical",
  });
  expect((await doctor.signIn("Fictional-employee-pass-2")).status).toBe(200);
  expect((await doctor.post("/inventory/consume", command)).status).toBe(403);
  expect((await doctor.post("/inventory/corrections", correction)).status).toBe(
    403,
  );
  expect((await doctor.browser.get("/api/inventory/movements")).status).toBe(
    403,
  );
  await m.post(`/accounts/${doctor.id}/status`, {
    currentPassword: "Fictional-manager-pass-2",
    status: "disabled",
  });
  expect((await doctor.post("/inventory/consume", command)).status).toBe(401);
  expect((await request(app).get("/api/inventory/movements")).status).toBe(401);
  for (const [path, body] of [
    ["consume", command],
    ["corrections", correction],
  ] as const) {
    expect(
      (
        await m.browser
          .post(`/api/inventory/${path}`)
          .set("Origin", origin)
          .send(body)
      ).status,
    ).toBe(403);
    expect(
      (
        await m.browser
          .post(`/api/inventory/${path}`)
          .set("Origin", "https://foreign.invalid")
          .send(body)
      ).status,
    ).toBe(403);
  }
  expect(
    (await m.browser.get("/api/inventory/movements")).body.movements,
  ).toEqual([]);
});
it("database failure rolls back stock and movement receipts before a successful retry", async () => {
  const m = await operator();
  const clinicId = (await m.browser.get("/api/identity")).body.clinicId;
  const command = {
    commandId: randomUUID(),
    batchId: m.batchId,
    quantityPacks: 1,
  };
  await owner.pool.query(
    `CREATE FUNCTION inventory_movement_test_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."clinicId"::text = '${clinicId}' THEN RAISE EXCEPTION 'FICTIONAL_MOVEMENT_FAILURE'; END IF; RETURN NEW; END $$`,
  );
  await owner.pool.query(
    'CREATE TRIGGER inventory_movement_test_failure BEFORE INSERT ON "InventoryCommand" FOR EACH ROW EXECUTE FUNCTION inventory_movement_test_failure()',
  );
  try {
    const failed = await m.post("/inventory/consume", command);
    expect(failed.status).toBe(500);
    expect(JSON.stringify(failed.body)).not.toContain(
      "FICTIONAL_MOVEMENT_FAILURE",
    );
    expect(
      (await m.browser.get("/api/inventory/movements")).body.movements,
    ).toEqual([]);
    expect(
      (await m.browser.get("/api/inventory")).body.batches[0],
    ).toMatchObject({ remainingPacks: 6, stockRevision: 0 });
  } finally {
    await owner.pool.query(
      'DROP TRIGGER inventory_movement_test_failure ON "InventoryCommand"',
    );
    await owner.pool.query("DROP FUNCTION inventory_movement_test_failure()");
  }
  const result = await m.post("/inventory/consume", command);
  expect(result.status).toBe(200);
  expect((await m.post("/inventory/consume", command)).body).toEqual(
    result.body,
  );
  expect(
    (await m.browser.get("/api/inventory/movements")).body.movements,
  ).toEqual([result.body]);
});
