import { randomUUID, createHash } from "node:crypto";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { createApplication } from "../src/application.js";
import { openDatabase } from "../src/database.js";
import { provisionClinic } from "../src/modules/identity/index.js";
import sharp from "sharp";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { privateFileStore } from "../src/modules/files/index.js";
let directory = "";
const owner = openDatabase(
  "postgresql://clinic_test:fictional-only@127.0.0.1:55437/clinic_issue7",
);
const runtime = openDatabase(
  "postgresql://clinic_runtime_test:fictional-runtime-only@127.0.0.1:55437/clinic_issue7",
);
const origin = "http://localhost:4173";
let token = "";
const options = {
  attachmentStore: {
    put: (key: string, bytes: Buffer) =>
      privateFileStore(directory).put(key, bytes),
    read: (key: string) => privateFileStore(directory).read(key),
    discard: (key: string) => privateFileStore(directory).discard(key),
  },
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
  directory = await mkdtemp(join(tmpdir(), "clinic-historical-"));
  await owner.connect();
  await runtime.connect();
});
afterAll(async () => {
  await runtime.close();
  await owner.close();
  if (directory) await rm(directory, { recursive: true, force: true });
});

it("retains only pre-removal clinical file versions inline after replacement and logical removal", async () => {
  const { m, patient, create } = await scenario();
  const d = await create("files", "doctor", [
    "clinical.read",
    "attachments.upload",
    "attachments.replace",
    "attachments.remove",
    "clinical.history",
    "clinical.print",
    "clinical.download",
  ]);
  const base = `/patient-access/${patient.id}`;
  expect(
    (
      await m.post(base + "/share", {
        commandId: randomUUID(),
        revision: 0,
        accountId: d.id,
        kind: "assigned",
      })
    ).status,
  ).toBe(200);
  const png = await sharp({
    create: { width: 1, height: 1, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
  const csrf = (await d.browser.get("/api/session")).body.csrfToken;
  const upload = async (id?: string, revision?: number) =>
    d.browser
      .post(
        `/api/patients/${patient.id}/attachments${id ? "/" + id + "/versions" : ""}`,
      )
      .query({
        commandId: randomUUID(),
        classification: "clinical",
        name: "Clinique.png",
        ...(id ? { revision, reason: "Remplacement" } : {}),
      })
      .set("Origin", origin)
      .set("x-csrf-token", csrf)
      .set("Content-Type", "image/png")
      .send(png);
  const first = await upload();
  expect(first.status).toBe(200);
  expect(
    (
      await m.post(base + "/remove", {
        commandId: randomUUID(),
        revision: 1,
        accountId: d.id,
      })
    ).status,
  ).toBe(200);
  const removalId = (await m.browser.get("/api" + base + "/history")).body.at(
    -1,
  ).id;
  expect(
    (
      await m.post(base + "/historical", {
        commandId: randomUUID(),
        revision: 2,
        accountId: d.id,
        removalId,
      })
    ).status,
  ).toBe(200);
  const read = `/api/historical/${patient.id}/attachments/${first.body.id}/versions/1/content`;
  expect((await d.browser.get(read)).status).toBe(200);
  expect((await d.browser.get(read + "?output=download")).status).toBe(403);
  expect((await d.browser.get(read + "?output=print")).status).toBe(403);
  const current = d.browser
    .post(`/api/patients/${patient.id}/attachments`)
    .query({
      commandId: randomUUID(),
      classification: "clinical",
      name: "Denied.png",
    })
    .set("Origin", origin)
    .set("x-csrf-token", csrf)
    .set("Content-Type", "image/png")
    .send(png);
  expect((await current).status).toBe(403);
  const other = await create("file-editor", "doctor", [
    "clinical.read",
    "attachments.replace",
    "attachments.remove",
    "clinical.history",
  ]);
  expect(
    (
      await m.post(base + "/share", {
        commandId: randomUUID(),
        revision: 3,
        accountId: other.id,
        kind: "shared",
      })
    ).status,
  ).toBe(200);
  const otherCsrf = (await other.browser.get("/api/session")).body.csrfToken;
  const replacement = await other.browser
    .post(`/api/patients/${patient.id}/attachments/${first.body.id}/versions`)
    .query({
      commandId: randomUUID(),
      classification: "clinical",
      name: "Après.png",
      revision: 1,
      reason: "Révision",
    })
    .set("Origin", origin)
    .set("x-csrf-token", otherCsrf)
    .set("Content-Type", "image/png")
    .send(png);
  expect(replacement.status).toBe(200);
  expect(
    (
      await other.post(
        `/patients/${patient.id}/attachments/${first.body.id}/remove?classification=clinical`,
        { commandId: randomUUID(), revision: 2, reason: "Retrait" },
      )
    ).status,
  ).toBe(200);
  expect((await d.browser.get(read)).status).toBe(200);
  expect(
    (await d.browser.get(read.replace("/versions/1/", "/versions/2/"))).status,
  ).toBe(404);
  expect(
    (await d.browser.get(`/api/historical/${patient.id}`)).body.attachments,
  ).toEqual([first.body]);
  expect(
    (
      await m.post(base + "/revoke", {
        commandId: randomUUID(),
        revision: 4,
        accountId: d.id,
      })
    ).status,
  ).toBe(200);
  expect((await d.browser.get(read)).status).toBe(403);
});

it("closes historical invalidation streams after grant revocation", async () => {
  const { m, d, patient, base, command } = await removedDoctor();
  expect((await m.post(base + "/historical", command)).status).toBe(200);
  const login = await d.signIn("Fictional-employee-pass-2");
  const cookie = (login.headers["set-cookie"] as unknown as string[])
    .map((v) => v.split(";")[0])
    .join("; ");
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  const abort = new AbortController();
  try {
    const response = await fetch(
      `http://127.0.0.1:${(server.address() as { port: number }).port}/api/historical/${patient.id}/events`,
      { headers: { Cookie: cookie }, signal: abort.signal },
    );
    expect(response.status).toBe(200);
    const reader = response.body!.getReader();
    const first = new TextDecoder().decode((await reader.read()).value);
    expect(first).toContain("event: invalidate");
    expect(first).not.toContain(patient.name);
    expect(
      (
        await m.post(base + "/revoke", {
          commandId: randomUUID(),
          revision: 3,
          accountId: d.id,
        })
      ).status,
    ).toBe(200);
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

it("historical-only manager accounts lose clinic-wide authority and doctor kind remains required", async () => {
  const { m, d, base, command, patient } = await removedDoctor();
  expect((await m.post(base + "/historical", command)).status).toBe(200);
  expect(
    (
      await m.post(`/accounts/${d.id}/manager`, {
        isManager: true,
        currentPassword: "Fictional-manager-pass-2",
      })
    ).status,
  ).toBe(200);
  await d.signIn("Fictional-employee-pass-2");
  expect(
    (
      await d.post("/onboarding/email", {
        email: `history-${randomUUID()}@example.invalid`,
      })
    ).status,
  ).toBe(202);
  const batch = await d.post("/onboarding/verify-email", { token });
  expect(batch.status).toBe(200);
  expect(
    (
      await d.post("/onboarding/codes-saved", {
        batchId: batch.body.batchId,
        saved: true,
      })
    ).status,
  ).toBe(204);
  expect(
    (
      await m.post(`/accounts/${d.id}/status`, {
        status: "historical",
        currentPassword: "Fictional-manager-pass-2",
      })
    ).status,
  ).toBe(200);
  expect((await d.signIn("Fictional-employee-pass-2")).status).toBe(200);
  expect((await d.browser.get(`/api/historical/${patient.id}`)).status).toBe(
    200,
  );
  expect((await d.browser.get(`/api/billing/${patient.id}`)).status).toBe(403);
  expect((await d.browser.get("/api/accounts")).status).toBe(403);
  expect(
    (
      await m.post(`/accounts/${d.id}/kind`, {
        kind: "staff",
        currentPassword: "Fictional-manager-pass-2",
      })
    ).status,
  ).toBe(200);
  expect((await d.browser.get(`/api/historical/${patient.id}`)).status).toBe(
    401,
  );
  expect((await d.signIn("Fictional-employee-pass-2")).status).toBe(200);
  expect((await d.browser.get(`/api/historical/${patient.id}`)).status).toBe(
    403,
  );
});

it("freezes own-work charges and payments before later corrections and excludes other doctors prices", async () => {
  const { m, patient, create } = await scenario();
  const own = (await m.browser.get("/api/identity")).body.accountId;
  expect(
    (
      await m.post(`/accounts/${own}/permissions`, {
        currentPassword: "Fictional-manager-pass-2",
        permissions: ["patients.create", "catalog.manage"],
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await m.post("/catalog/currencies", {
        commandId: randomUUID(),
        code: "MRU",
      })
    ).status,
  ).toBe(200);
  const procedureId = randomUUID();
  expect(
    (
      await m.post("/catalog", {
        commandId: randomUUID(),
        id: procedureId,
        revision: 0,
        name: "Acte fictif",
        currency: "MRU",
        price: "100",
        durationMinutes: 30,
        active: true,
      })
    ).status,
  ).toBe(200);
  const permissions = [
    "clinical.read",
    "plans.draft",
    "plans.finalize",
    "plans.accept",
    "acceptance.draft",
    "procedures.start",
    "procedures.complete",
    "billing.read",
    "billing.edit",
    "notes.draft",
    "notes.finalize",
    "prescriptions.draft",
    "prescriptions.sign",
  ];
  const d = await create("own-work", "doctor", permissions),
    other = await create("other-work", "doctor", permissions);
  const access = `/patient-access/${patient.id}`;
  for (const [revision, a] of [d, other].entries())
    expect(
      (
        await m.post(access + "/share", {
          commandId: randomUUID(),
          revision,
          accountId: a.id,
          kind: "assigned",
        })
      ).status,
    ).toBe(200);
  const planId = randomUUID(),
    items = [0, 1].map(() => ({
      id: randomUUID(),
      procedureId,
      catalogRevision: 1,
      scope: "whole_mouth",
      teeth: [],
      price: "100",
      discount: "0",
      discountReason: "",
    }));
  const plans = `/treatment/${patient.id}/plans`;
  expect(
    (
      await d.post(plans, {
        commandId: randomUUID(),
        id: planId,
        revision: 0,
        title: "Plan clinique",
        currency: "MRU",
        items,
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
        acceptedAt: "2026-10-20T12:00:00.000Z",
        method: "Oral",
      },
    ],
    ["accept", 3, {}],
  ] as const)
    expect(
      (
        await d.post(plans + "/lifecycle", {
          commandId: randomUUID(),
          id: planId,
          revision,
          action,
          ...extra,
        })
      ).status,
    ).toBe(200);
  const visits = `/treatment/${patient.id}/visits`;
  const ownVisit = randomUUID(),
    otherVisit = randomUUID();
  expect(
    (
      await d.post(visits, {
        commandId: randomUUID(),
        id: ownVisit,
        appointmentId: null,
        procedures: [{ planId, itemId: items[0]!.id, planRevision: 4 }],
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await other.post(visits, {
        commandId: randomUUID(),
        id: otherVisit,
        appointmentId: null,
        procedures: [{ planId, itemId: items[1]!.id, planRevision: 5 }],
      })
    ).status,
  ).toBe(200);
  const billing = `/billing/${patient.id}`;
  const note = `/clinical/${patient.id}/notes/${otherVisit}`;
  expect(
    (
      await other.post(note + "/draft", {
        commandId: randomUUID(),
        revision: 0,
        text: "Note avant retrait",
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await other.post(note + "/finalize", {
        commandId: randomUUID(),
        revision: 1,
      })
    ).status,
  ).toBe(200);
  const prescription = `/clinical/${patient.id}/prescriptions/${randomUUID()}`;
  const content = {
    medicines: [
      {
        name: "Texte fictif",
        strength: "",
        form: "",
        dose: "Saisie",
        route: "Saisie",
        frequency: "Saisie",
        duration: "Saisie",
        quantity: "",
        instructions: "",
      },
    ],
    instructions: "Avant retrait",
  };
  expect(
    (
      await other.post(prescription + "/draft", {
        commandId: randomUUID(),
        revision: 0,
        content,
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await other.post(prescription + "/finalize", {
        commandId: randomUUID(),
        revision: 1,
      })
    ).status,
  ).toBe(200);
  const charges = (await m.browser.get("/api" + billing)).body.charges as {
    id: string;
    performedBy: string;
  }[];
  const ownCharge = charges.find((c) => c.performedBy === d.id)!,
    foreign = charges.find((c) => c.performedBy === other.id)!;
  const methodId = randomUUID();
  expect(
    (
      await m.post("/billing/payment-methods", {
        commandId: randomUUID(),
        id: methodId,
        revision: 0,
        name: "Espèces",
        active: true,
      })
    ).status,
  ).toBe(200);
  const receipt = await m.post(billing + "/settlements", {
    commandId: randomUUID(),
    currency: "MRU",
    methodId,
    newMoney: "150",
    deposit: "0",
    allocations: [
      { chargeId: ownCharge.id, newMoney: "50", credit: "0" },
      { chargeId: foreign.id, newMoney: "100", credit: "0" },
    ],
  });
  expect(receipt.status).toBe(200);
  expect(
    (
      await m.post(access + "/remove", {
        commandId: randomUUID(),
        revision: 2,
        accountId: d.id,
      })
    ).status,
  ).toBe(200);
  const removalId = (await m.browser.get("/api" + access + "/history")).body.at(
    -1,
  ).id;
  expect(
    (
      await m.post(access + "/historical", {
        commandId: randomUUID(),
        revision: 3,
        accountId: d.id,
        removalId,
      })
    ).status,
  ).toBe(200);
  const snapshot = (await d.browser.get(`/api/historical/${patient.id}`)).body;
  expect(snapshot.financial.charges).toHaveLength(1);
  expect(snapshot.financial.charges[0]).toMatchObject({
    id: ownCharge.id,
    chargedMinor: "10000",
    paidMinor: "5000",
    dueMinor: "5000",
  });
  expect(snapshot.financial.settlements).toEqual([]);
  expect(JSON.stringify(snapshot.financial)).not.toContain(foreign.id);
  expect(snapshot.starts).toHaveLength(2);
  expect(
    snapshot.starts.every(
      (s: object) => !("agreedMinor" in s) && !("item" in s),
    ),
  ).toBe(true);
  expect(
    snapshot.plans.every((p: { items: object[] }) =>
      p.items.every((i) => !("priceMinor" in i)),
    ),
  ).toBe(true);
  expect(
    (
      await m.post(billing + "/reversals", {
        commandId: randomUUID(),
        settlementId: receipt.body.id,
        reason: "Erreur après retrait",
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await other.post(visits + "/actions", {
        commandId: randomUUID(),
        id: otherVisit,
        revision: 1,
        action: "end",
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await other.post(note + "/draft", {
        commandId: randomUUID(),
        revision: 2,
        text: "Correction après retrait",
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await other.post(prescription + "/draft", {
        commandId: randomUUID(),
        revision: 2,
        content: { ...content, instructions: "Après retrait" },
        reason: "Correction",
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await other.post(prescription + "/finalize", {
        commandId: randomUUID(),
        revision: 3,
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await other.post(note + "/finalize", {
        commandId: randomUUID(),
        revision: 3,
      })
    ).status,
  ).toBe(200);
  expect((await d.browser.get(`/api/historical/${patient.id}`)).body).toEqual(
    snapshot,
  );
  expect(
    (
      await d.post(billing + "/settlements", {
        commandId: randomUUID(),
        currency: "MRU",
        methodId,
        newMoney: "10",
        deposit: "0",
        allocations: [{ chargeId: ownCharge.id, newMoney: "10", credit: "0" }],
      })
    ).status,
  ).toBe(403);
  expect(
    (await d.browser.get(`/api${plans}/${planId}/versions/4/print`)).status,
  ).toBe(403);
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

it("requires an explicit manager grant to read the retained removal snapshot", async () => {
  const { m, patient, create } = await scenario();
  const d = await create("former", "doctor", [
    "clinical.read",
    "history.draft",
    "history.finalize",
  ]);
  const share = await m.post(`/patient-access/${patient.id}/share`, {
    commandId: randomUUID(),
    revision: 0,
    accountId: d.id,
    kind: "assigned",
  });
  expect(share.status).toBe(200);
  expect(
    (
      await d.post(`/clinical/${patient.id}/history/draft`, {
        commandId: randomUUID(),
        revision: 0,
        observedAt: new Date().toISOString(),
        content: { medicalHistory: "Avant retrait", allergies: "Aucune" },
      })
    ).status,
  ).toBe(200);
  const removed = await m.post(`/patient-access/${patient.id}/remove`, {
    commandId: randomUUID(),
    revision: 1,
    accountId: d.id,
  });
  expect(removed.status).toBe(200);
  expect((await d.browser.get(`/api/historical/${patient.id}`)).status).toBe(
    403,
  );
  const grant = await m.post(`/patient-access/${patient.id}/historical`, {
    commandId: randomUUID(),
    revision: 2,
    accountId: d.id,
    removalId: (
      await m.browser.get(`/api/patient-access/${patient.id}/history`)
    ).body.at(-1).id,
  });
  expect(grant.status).toBe(200);
  const snapshot = await d.browser.get(`/api/historical/${patient.id}`);
  expect(snapshot.status).toBe(200);
  expect(JSON.stringify(snapshot.body)).toContain("Avant retrait");
  const other = await create("replacement", "doctor", [
    "clinical.read",
    "history.draft",
  ]);
  expect(
    (
      await m.post(`/patient-access/${patient.id}/share`, {
        commandId: randomUUID(),
        revision: 3,
        accountId: other.id,
        kind: "shared",
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await other.post(`/clinical/${patient.id}/history/draft`, {
        commandId: randomUUID(),
        revision: 1,
        observedAt: new Date().toISOString(),
        content: { medicalHistory: "Après retrait", allergies: "Nouvelle" },
      })
    ).status,
  ).toBe(200);
  expect((await d.browser.get(`/api/historical/${patient.id}`)).body).toEqual(
    snapshot.body,
  );
  expect((await d.browser.get("/api/historical")).body).toEqual([
    {
      id: patient.id,
      name: patient.name,
      patientNumber: patient.patientNumber,
      cutoff: snapshot.body.cutoff,
    },
  ]);
});

async function removedDoctor() {
  const s = await scenario();
  const d = await s.create("former", "doctor", [
    "clinical.read",
    "patients.assign",
    "billing.read",
    "billing.edit",
    "clinical.print",
    "clinical.download",
  ]);
  const base = `/patient-access/${s.patient.id}`;
  expect(
    (
      await s.m.post(base + "/share", {
        commandId: randomUUID(),
        revision: 0,
        accountId: d.id,
        kind: "assigned",
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await s.m.post(base + "/remove", {
        commandId: randomUUID(),
        revision: 1,
        accountId: d.id,
      })
    ).status,
  ).toBe(200);
  const removalId = (await s.m.browser.get("/api" + base + "/history")).body.at(
    -1,
  ).id as string;
  const command = {
    commandId: randomUUID(),
    revision: 2,
    accountId: d.id,
    removalId,
  };
  return { ...s, d, base, command };
}
it("only managers grant a real current removal, with version conflicts and safe retries", async () => {
  const { m, d, base, command, patient } = await removedDoctor();
  expect((await d.post(base + "/historical", command)).status).toBe(403);
  expect(
    (
      await m.post(base + "/historical", {
        ...command,
        removalId: randomUUID(),
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await m.post(base + "/historical", {
        ...command,
        cutoff: "2099-01-01T00:00:00Z",
      })
    ).status,
  ).toBe(400);
  const results = await Promise.all([
    m.post(base + "/historical", command),
    m.post(base + "/historical", command),
  ]);
  expect(results.map((r) => r.status)).toEqual([200, 200]);
  expect(
    (
      await m.post(base + "/historical", {
        ...command,
        commandId: randomUUID(),
      })
    ).status,
  ).toBe(409);
  const other = await m.post(base + "/revoke", {
    commandId: randomUUID(),
    revision: 3,
    accountId: d.id,
  });
  expect(other.status).toBe(200);
  expect((await m.post(base + "/historical", command)).status).toBe(200);
  expect((await d.browser.get(`/api/historical/${patient.id}`)).status).toBe(
    403,
  );
  expect(
    (
      await m.post(base + "/historical", {
        ...command,
        commandId: randomUUID(),
        revision: 4,
      })
    ).status,
  ).toBe(409);
});

it("replays retained pre-historical share and remove commands after the upgrade", async () => {
  const { m, patient, create } = await scenario();
  const d = await create("legacy");
  const base = `/patient-access/${patient.id}`;
  const share = {
    commandId: randomUUID(),
    revision: 0,
    accountId: d.id,
    kind: "assigned",
  };
  const remove = { commandId: randomUUID(), revision: 1, accountId: d.id };
  const shared = await m.post(base + "/share", share);
  const removed = await m.post(base + "/remove", remove);
  expect(shared.status).toBe(200);
  expect(removed.status).toBe(200);
  // Upgrade fixture: reproduce the previously shipped durable wire-payload hash.
  // Assertions use HTTP only; no internal persistence assertions.
  for (const [action, command, kind] of [
    ["share", share, "assigned"],
    ["remove", remove, null],
  ] as const) {
    const legacyHash = createHash("sha256")
      .update(
        JSON.stringify([patient.id, d.id, command.revision, action, kind]),
      )
      .digest("hex");
    await owner.pool.query(
      'UPDATE "PatientAccessHistory" SET "payloadHash"=$1 WHERE "commandId"=$2::uuid',
      [legacyHash, command.commandId],
    );
  }
  expect((await m.post(base + "/share", share)).body).toEqual(shared.body);
  expect((await m.post(base + "/remove", remove)).body).toEqual(removed.body);
  expect((await d.browser.get(`/api/clinical/${patient.id}`)).status).toBe(403);
});
it("reassignment and subsequent removal require a fresh explicit historical grant", async () => {
  const { m, d, base, command, patient } = await removedDoctor();
  expect((await m.post(base + "/historical", command)).status).toBe(200);
  expect(
    (
      await m.post(base + "/share", {
        commandId: randomUUID(),
        revision: 3,
        accountId: d.id,
        kind: "assigned",
      })
    ).status,
  ).toBe(200);
  expect((await d.browser.get(`/api/historical/${patient.id}`)).status).toBe(
    403,
  );
  expect(
    (
      await m.post(base + "/remove", {
        commandId: randomUUID(),
        revision: 4,
        accountId: d.id,
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await m.post(base + "/historical", {
        ...command,
        commandId: randomUUID(),
        revision: 5,
      })
    ).status,
  ).toBe(409);
  expect((await d.browser.get(`/api/historical/${patient.id}`)).status).toBe(
    403,
  );
});
it("isolates historical patients and clinics and denies operational and output routes", async () => {
  const { m, d, base, command, patient } = await removedDoctor();
  expect((await m.post(base + "/historical", command)).status).toBe(200);
  expect((await request(app).get(`/api/historical/${patient.id}`)).status).toBe(
    401,
  );
  expect((await m.browser.get(`/api/historical/${patient.id}`)).status).toBe(
    403,
  );
  expect((await d.browser.get(`/api/historical/${randomUUID()}`)).status).toBe(
    403,
  );
  const foreign = await manager();
  expect(
    (await foreign.browser.get(`/api/historical/${patient.id}`)).status,
  ).toBe(403);
  expect((await foreign.post(base + "/historical", command)).status).toBe(404);
  for (const path of [
    `/clinical/${patient.id}`,
    `/billing/${patient.id}`,
    `/treatment/${patient.id}/plans`,
  ])
    expect((await d.browser.get("/api" + path)).status).toBe(403);
  expect((await d.post(`/billing/${patient.id}/settlements`, {})).status).toBe(
    400,
  );
  expect(
    (
      await m.post(`/accounts/${d.id}/status`, {
        status: "historical",
        currentPassword: "Fictional-manager-pass-2",
      })
    ).status,
  ).toBe(200);
  expect((await d.browser.get(`/api/historical/${patient.id}`)).status).toBe(
    401,
  );
  expect((await d.signIn("Fictional-employee-pass-2")).status).toBe(200);
  expect((await d.browser.get(`/api/historical/${patient.id}`)).status).toBe(
    200,
  );
  expect((await d.browser.get("/api/catalog")).status).toBe(403);
  expect(
    (
      await m.post(`/accounts/${d.id}/status`, {
        status: "disabled",
        currentPassword: "Fictional-manager-pass-2",
      })
    ).status,
  ).toBe(200);
  expect((await d.browser.get(`/api/historical/${patient.id}`)).status).toBe(
    401,
  );
});
