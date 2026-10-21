import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import sharp from "sharp";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createApplication } from "../src/application.js";
import { openDatabase } from "../src/database.js";
import { provisionClinic } from "../src/modules/identity/index.js";
import {
  privateFileStore,
  type PrivateFileStore,
} from "../src/modules/files/index.js";
import { PDFDocument } from "pdf-lib";

const owner = openDatabase(
  "postgresql://clinic_test:fictional-only@127.0.0.1:55437/clinic_issue7",
);
const runtime = openDatabase(
  "postgresql://clinic_runtime_test:fictional-runtime-only@127.0.0.1:55437/clinic_issue7",
);
const origin = "http://localhost:4173";
let directory = "";
beforeAll(async () => {
  await owner.connect();
  await runtime.connect();
  directory = await mkdtemp(join(tmpdir(), "clinic-attachments-"));
  png = await sharp({
    create: { width: 1, height: 1, channels: 3, background: "white" },
  })
    .png()
    .toBuffer();
});
afterAll(async () => {
  await runtime.close();
  await owner.close();
  if (directory) await rm(directory, { recursive: true, force: true });
});

async function scenario(store?: PrivateFileStore, now?: () => number) {
  let token = "";
  const app = createApplication({
    database: runtime,
    origin,
    secureCookies: false,
    now,
    attachmentStore: store ?? privateFileStore(directory),
    sessionSecret: "fictional-session-secret-at-least-32-characters",
    mail: {
      async sendVerification(message) {
        token = message.token;
      },
    },
  });
  const code = `test-${randomUUID()}`.slice(0, 32),
    email = `${code}@example.invalid`;
  await provisionClinic(owner, {
    clinicCode: code,
    clinicName: "Fictional files",
    username: "manager",
    displayName: "Manager",
    email,
    temporaryPassword: "Fictional-initial-pass-1",
  });
  const browser = request.agent(app);
  let csrf = (await browser.get("/api/session")).body.csrfToken;
  const post = (path: string, body: object) =>
    browser
      .post("/api" + path)
      .set("Origin", origin)
      .set("x-csrf-token", csrf)
      .send(body);
  const login = async (password: string) => {
    csrf = (await browser.get("/api/session")).body.csrfToken;
    const r = await post("/sign-in", { method: "email", email, password });
    expect(r.status).toBe(200);
    csrf = r.body.csrfToken;
    return r;
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
  const identity = (await browser.get("/api/identity")).body;
  await post(`/accounts/${identity.accountId}/permissions`, {
    revision: 0,
    currentPassword: "Fictional-manager-pass-2",
    permissions: ["patients.create"],
  });
  const patient = (
    await post("/patients", {
      commandId: randomUUID(),
      name: "Patient fichier fictif",
      phone: "70000000",
      contactKind: "patient",
      contactName: "",
    })
  ).body.patient;
  const base = `/api/patients/${patient.id}/attachments`;
  const upload = (
    body: Buffer,
    query: Record<string, string> = {},
    mime = "image/png",
  ) =>
    browser
      .post(base)
      .query({
        commandId: randomUUID(),
        classification: "financial",
        name: "preuve.png",
        ...query,
      })
      .set("Origin", origin)
      .set("x-csrf-token", csrf)
      .set("Content-Type", mime)
      .send(body);
  const permissions = async (id: string, values: string[]) => {
    const row = (await browser.get("/api/accounts")).body.find(
      (v: { id: string }) => v.id === id,
    );
    const response = await post(`/accounts/${id}/permissions`, {
      revision: row.revision,
      currentPassword: "Fictional-manager-pass-2",
      permissions: values,
    });
    expect(response.status).toBe(200);
  };
  const employee = async (
    kind = "doctor",
    values = [
      "clinical.read",
      "attachments.upload",
      "attachments.replace",
      "attachments.remove",
      "clinical.history",
    ],
  ) => {
    const username = `user-${randomUUID()}`;
    const account = await post("/accounts", {
      username,
      displayName: username,
      kind,
      temporaryPassword: "Fictional-initial-pass-1",
      currentPassword: "Fictional-manager-pass-2",
    });
    expect(account.status).toBe(201);
    await permissions(account.body.id, values);
    const b = request.agent(app);
    let employeeCsrf = (await b.get("/api/session")).body.csrfToken;
    const p = (path: string, body: object) =>
      b
        .post("/api" + path)
        .set("Origin", origin)
        .set("x-csrf-token", employeeCsrf)
        .send(body);
    const signIn = async (password: string) => {
      employeeCsrf = (await b.get("/api/session")).body.csrfToken;
      const r = await p("/sign-in", {
        method: "clinic_username",
        clinicCode: code,
        username,
        password,
      });
      expect(r.status).toBe(200);
      employeeCsrf = r.body.csrfToken;
    };
    await signIn("Fictional-initial-pass-1");
    await p("/onboarding/password", { password: "Fictional-employee-pass-2" });
    await signIn("Fictional-employee-pass-2");
    const access = await browser.get(`/api/patient-access/${patient.id}`);
    expect(
      (
        await post(`/patient-access/${patient.id}/share`, {
          commandId: randomUUID(),
          revision: access.body.revision,
          accountId: account.body.id,
          kind: "assigned",
        })
      ).status,
    ).toBe(200);
    return {
      id: account.body.id,
      browser: b,
      post: p,
      upload: (bytes: Buffer, classification = "clinical") =>
        b
          .post(base)
          .query({ commandId: randomUUID(), classification, name: "image.png" })
          .set("Origin", origin)
          .set("x-csrf-token", employeeCsrf)
          .set("Content-Type", "image/png")
          .send(bytes),
    };
  };
  return {
    app,
    browser,
    post,
    identity,
    patient,
    base,
    upload,
    csrf,
    permissions,
    employee,
  };
}
let png: Buffer;

it("publishes a validated private file and replays an identical upload without counting it twice", async () => {
  const s = await scenario(),
    commandId = randomUUID();
  const first = await s.upload(png, { commandId });
  expect(first.status).toBe(200);
  expect((await s.upload(png, { commandId })).body).toEqual(first.body);
  const listed = await s.browser
    .get(s.base)
    .query({ classification: "financial" });
  expect(listed.body.attachments).toHaveLength(1);
  expect(listed.body.usage.retainedBytes).toBe(png.length);
  const bytes = await s.browser
    .get(`${s.base}/${first.body.id}/versions/1/content`)
    .query({ classification: "financial" });
  expect(bytes.status).toBe(200);
  expect(bytes.body).toEqual(png);
});

it("retains both replacement versions and reasoned removal history without freeing quota", async () => {
  const s = await scenario();
  const v = (await s.upload(png)).body;
  const replace = (reason: string, revision = 1) =>
    s.browser
      .post(`${s.base}/${v.id}/versions`)
      .query({
        commandId: randomUUID(),
        classification: "financial",
        revision,
        reason,
        name: "replacement.png",
      })
      .set("Origin", origin)
      .set("x-csrf-token", s.csrf)
      .set("Content-Type", "image/png")
      .send(png);
  expect((await replace("")).status).toBe(400);
  const replaced = await replace("Nouvelle preuve");
  expect(replaced.status).toBe(200);
  expect(replaced.body.revision).toBe(2);
  expect((await replace("Stale")).status).toBe(409);
  const remove = { commandId: randomUUID(), revision: 2, reason: "Doublon" };
  expect(
    (
      await s.post(
        `/patients/${s.patient.id}/attachments/${v.id}/remove?classification=financial`,
        remove,
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await s.post(
        `/patients/${s.patient.id}/attachments/${v.id}/remove?classification=financial`,
        remove,
      )
    ).status,
  ).toBe(200);
  const list = await s.browser
    .get(s.base)
    .query({ classification: "financial" });
  expect(list.body.attachments).toEqual([]);
  expect(list.body.usage).toMatchObject({
    retainedBytes: png.length * 2,
    reservedBytes: 0,
  });
  const history = await s.browser
    .get(`${s.base}/${v.id}/history`)
    .query({ classification: "financial" });
  expect(history.body.events.map((e: { action: string }) => e.action)).toEqual([
    "upload",
    "replace",
    "remove",
  ]);
  for (const revision of [1, 2])
    expect(
      (
        await s.browser
          .get(`${s.base}/${v.id}/versions/${revision}/content`)
          .query({ classification: "financial" })
      ).body,
    ).toEqual(png);
});

it("rejects spoofed, corrupt, active and oversize files without reserving quota", async () => {
  const s = await scenario();
  for (const [bytes, mime] of [
    [Buffer.from("MZ renamed.exe"), "image/png"],
    [png.subarray(0, 40), "image/png"],
    [png, "image/jpeg"],
    [Buffer.alloc(20_000_001), "image/png"],
  ] as const) {
    expect([400, 413]).toContain((await s.upload(bytes, {}, mime)).status);
  }
  const pdf = await PDFDocument.create();
  pdf.addPage();
  pdf.addJavaScript("bad", 'app.alert("no")');
  expect(
    (await s.upload(Buffer.from(await pdf.save()), {}, "application/pdf"))
      .status,
  ).toBe(400);
  expect(
    (await s.browser.get(s.base).query({ classification: "financial" })).body
      .usage,
  ).toMatchObject({ retainedBytes: 0, reservedBytes: 0 });
});

it("recovers failed private writes and permits a retry of the same command", async () => {
  const disk = privateFileStore(directory);
  let fail = true;
  const s = await scenario({
    ...disk,
    async put(key, bytes) {
      await disk.put(key, bytes);
      if (fail) {
        fail = false;
        throw new Error("fictional disk failure");
      }
    },
  });
  const commandId = randomUUID();
  expect((await s.upload(png, { commandId })).status).toBe(500);
  expect(
    (await s.browser.get(s.base).query({ classification: "financial" })).body
      .usage,
  ).toMatchObject({ retainedBytes: 0, reservedBytes: 0 });
  expect((await s.upload(png, { commandId })).status).toBe(200);
});

it("enforces action, patient, clinic, content and historical-only restrictions for direct identifiers", async () => {
  const s = await scenario(),
    other = await scenario();
  const file = (await s.upload(png)).body;
  expect(
    (await request(s.app).get(s.base).query({ classification: "financial" }))
      .status,
  ).toBe(401);
  expect(
    (
      await other.browser
        .get(`${s.base}/${file.id}/versions/1/content`)
        .query({ classification: "financial" })
    ).status,
  ).toBe(404);
  expect((await s.upload(png, { classification: "clinical" })).status).toBe(
    403,
  );
  const doctor = await s.employee();
  expect((await doctor.upload(png)).status).toBe(200);
  expect(
    (
      await doctor.browser
        .get(`${s.base}/${file.id}/versions/1/content`)
        .query({ classification: "clinical" })
    ).status,
  ).toBe(404);
  await s.permissions(doctor.id, [
    "clinical.read",
    "billing.read",
    "financial.attachments.upload",
    "mixed.attachments.upload",
  ]);
  expect((await doctor.upload(png, "financial")).status).toBe(403);
  expect((await doctor.upload(png)).status).toBe(403);
  const staff = await s.employee("staff", [
    "clinical.read",
    "billing.read",
    "attachments.upload",
    "financial.attachments.upload",
    "mixed.attachments.upload",
  ]);
  expect((await staff.upload(png, "mixed")).status).toBe(200);
  await s.permissions(staff.id, [
    "billing.read",
    "financial.attachments.upload",
  ]);
  expect((await staff.upload(png, "financial")).status).toBe(403);
  const account = (await s.browser.get("/api/accounts")).body.find(
    (a: { id: string }) => a.id === doctor.id,
  );
  expect(
    (
      await s.post(`/accounts/${doctor.id}/status`, {
        revision: account.revision,
        status: "historical",
        currentPassword: "Fictional-manager-pass-2",
      })
    ).status,
  ).toBe(200);
  expect([401, 403]).toContain(
    (await doctor.browser.get(s.base).query({ classification: "clinical" }))
      .status,
  );
});

it("serializes racing replacements and rejects changed-payload command reuse", async () => {
  const s = await scenario(),
    commandId = randomUUID();
  const first = await s.upload(png, { commandId });
  expect(
    (await s.upload(png, { commandId, name: "different.png" })).status,
  ).toBe(409);
  const replace = () =>
    s.browser
      .post(`${s.base}/${first.body.id}/versions`)
      .query({
        commandId: randomUUID(),
        classification: "financial",
        revision: 1,
        reason: "Correction",
        name: "new.png",
      })
      .set("Origin", origin)
      .set("x-csrf-token", s.csrf)
      .set("Content-Type", "image/png")
      .send(png);
  const results = await Promise.all([replace(), replace()]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(
    (await s.browser.get(s.base).query({ classification: "financial" })).body
      .usage,
  ).toMatchObject({ retainedBytes: png.length * 2, reservedBytes: 0 });
});

it("accepts PDF and JPEG, including the exact decimal file limit, while quota races publish only one winner", async () => {
  const s = await scenario();
  const pdf = await PDFDocument.create();
  pdf.addPage();
  const small = Buffer.from(await pdf.save());
  const full = Buffer.concat([
    small.subarray(0, small.length - 6),
    Buffer.alloc(20_000_000 - small.length, 32),
    small.subarray(-6),
  ]);
  expect(full.length).toBe(20_000_000);
  expect(
    (await s.upload(full, { name: "proof.pdf" }, "application/pdf")).status,
  ).toBe(200);
  const jpeg = await sharp(png).jpeg().toBuffer();
  expect(
    (await s.upload(jpeg, { name: "proof.jpg" }, "image/jpeg")).status,
  ).toBe(200);
  // Arrange retained accounting near the real 2GB limit without manufacturing
  // 2GB of clinical uploads. This fixture only probes API admission arithmetic;
  // real private disk reads/writes are exercised by all successful uploads.
  const clinicId = s.identity.clinicId,
    patientId = s.patient.id;
  await owner.clinicTransaction(clinicId, async (tx) => {
    let remaining = 2_000_000_000 - 20_000_000 - jpeg.length - png.length;
    while (remaining > 0) {
      const id = randomUUID(),
        size = Math.min(20_000_000, remaining);
      remaining -= size;
      await tx.attachment.create({
        data: {
          id,
          clinicId,
          patientId,
          classification: "financial",
          revision: 1,
          events: [],
        },
      });
      await tx.attachmentVersion.create({
        data: {
          key: randomUUID(),
          clinicId,
          patientId,
          attachmentId: id,
          revision: 1,
          size,
          snapshot: {
            id,
            patientId,
            revision: 1,
            classification: "financial",
            name: "quota fixture",
            mediaType: "image/png",
            size,
            sha256: "fixture",
            actorId: s.identity.accountId,
            at: new Date().toISOString(),
            reason: "",
          },
        },
      });
    }
  });
  const race = await Promise.all([s.upload(png), s.upload(png)]);
  expect(race.map((r) => r.status).sort()).toEqual([200, 409]);
  const usage = (
    await s.browser.get(s.base).query({ classification: "financial" })
  ).body.usage;
  expect(usage).toMatchObject({
    retainedBytes: 2_000_000_000,
    reservedBytes: 0,
  });
  expect(
    (
      await s.browser
        .get(
          `${s.base}/${race.find((r) => r.status === 200)!.body.id}/versions/1/content`,
        )
        .query({ classification: "financial" })
    ).status,
  ).toBe(200);
  expect((await s.browser.get("/api/identity")).status).toBe(200);
});

it("guards clinical output/history separately and applies patient revocation on the next request", async () => {
  const s = await scenario(),
    doctor = await s.employee();
  const v = (await doctor.upload(png)).body;
  const path = `${s.base}/${v.id}/versions/1/content`;
  expect(
    (await doctor.browser.get(path).query({ classification: "clinical" }))
      .status,
  ).toBe(200);
  expect(
    (
      await doctor.browser
        .get(path)
        .query({ classification: "clinical", output: "download" })
    ).status,
  ).toBe(403);
  expect(
    (
      await doctor.browser
        .get(path)
        .query({ classification: "clinical", output: "print" })
    ).status,
  ).toBe(403);
  const access = await s.browser.get(`/api/patient-access/${s.patient.id}`);
  expect(
    (
      await s.post(`/patient-access/${s.patient.id}/remove`, {
        commandId: randomUUID(),
        revision: access.body.revision,
        accountId: doctor.id,
      })
    ).status,
  ).toBe(200);
  expect(
    (await doctor.browser.get(path).query({ classification: "clinical" }))
      .status,
  ).toBe(403);
  expect((await doctor.upload(png)).status).toBe(403);
});

it("rechecks authorization before publication and reclaims abandoned reservations on the next upload", async () => {
  const disk = privateFileStore(directory);
  let onWrite: () => Promise<void> = async () => {};
  let now = Date.now();
  const s = await scenario(
    {
      ...disk,
      async put(key, bytes) {
        await disk.put(key, bytes);
        await onWrite();
      },
    },
    () => now,
  );
  const doctor = await s.employee();
  onWrite = async () => {
    await s.permissions(doctor.id, []);
  };
  expect((await doctor.upload(png)).status).toBe(403);
  expect(
    (await s.browser.get(s.base).query({ classification: "financial" })).body
      .usage,
  ).toMatchObject({ retainedBytes: 0, reservedBytes: png.length });
  now += 10 * 60_000 + 1;
  onWrite = async () => {};
  expect((await s.upload(png)).status).toBe(200);
  expect(
    (await s.browser.get(s.base).query({ classification: "financial" })).body
      .usage,
  ).toMatchObject({ retainedBytes: png.length, reservedBytes: 0 });
});

it("links an authorized immutable signed-evidence version and preserves it after logical removal", async () => {
  const s = await scenario();
  await s.permissions(s.identity.accountId, [
    "patients.create",
    "catalog.manage",
  ]);
  expect(
    (
      await s.post("/catalog/currencies", {
        commandId: randomUUID(),
        code: "MRU",
      })
    ).status,
  ).toBe(200);
  const procedureId = randomUUID();
  expect(
    (
      await s.post("/catalog", {
        commandId: randomUUID(),
        id: procedureId,
        revision: 0,
        name: "Soin fictif",
        currency: "MRU",
        price: "100",
        durationMinutes: 30,
        active: true,
      })
    ).status,
  ).toBe(200);
  const doctor = await s.employee("doctor", [
    "clinical.read",
    "clinical.history",
    "plans.draft",
    "plans.finalize",
    "plans.accept",
    "acceptance.draft",
    "attachments.upload",
    "attachments.remove",
  ]);
  const path = `/treatment/${s.patient.id}/plans`,
    planId = randomUUID();
  expect(
    (
      await doctor.post(path, {
        commandId: randomUUID(),
        id: planId,
        revision: 0,
        title: "Accord fictif",
        currency: "MRU",
        items: [
          {
            id: randomUUID(),
            procedureId,
            catalogRevision: 1,
            scope: "tooth",
            teeth: ["11"],
            price: "100",
            discount: "0",
            discountReason: "",
          },
        ],
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await doctor.post(path + "/lifecycle", {
        commandId: randomUUID(),
        id: planId,
        revision: 1,
        action: "present",
      })
    ).status,
  ).toBe(200);
  const uploaded = await doctor.upload(png);
  expect(uploaded.status).toBe(200);
  const evidence = {
    commandId: randomUUID(),
    id: planId,
    revision: 2,
    action: "evidence",
    acceptedBy: "Patient fictif",
    acceptedAt: new Date(Date.now() - 1000).toISOString(),
    method: "Signature sur document",
    attachment: { id: uploaded.body.id, revision: 1 },
  };
  expect((await doctor.post(path + '/lifecycle', {...evidence,commandId:randomUUID(),attachment:{id:randomUUID(),revision:1}})).status).toBe(404);
  expect((await doctor.post(path + '/lifecycle', {...evidence,commandId:randomUUID(),attachment:{id:uploaded.body.id,revision:2}})).status).toBe(409);
  const financial=(await s.upload(png)).body;
  expect((await doctor.post(path + '/lifecycle', {...evidence,commandId:randomUUID(),attachment:{id:financial.id,revision:1}})).status).toBe(403);
  const linked = await doctor.post(path + "/lifecycle", evidence);
  expect(linked.status).toBe(200);
  expect(linked.body.evidence.attachment).toEqual(evidence.attachment);
  expect(
    (
      await doctor.post(
        `/patients/${s.patient.id}/attachments/${uploaded.body.id}/remove?classification=clinical`,
        {
          commandId: randomUUID(),
          revision: 1,
          reason: "Retirer de la liste courante",
        },
      )
    ).status,
  ).toBe(200);
  const accepted = await doctor.post(path + "/lifecycle", {
    commandId: randomUUID(),
    id: planId,
    revision: 3,
    action: "accept",
  });
  expect(accepted.status).toBe(200);
  expect(accepted.body.acceptance.attachment).toEqual(evidence.attachment);
  expect(
    (
      await doctor.browser
        .get(`${s.base}/${uploaded.body.id}/versions/1/content`)
        .query({ classification: "clinical" })
    ).status,
  ).toBe(200);
  expect(
    (
      await doctor.post(path + "/lifecycle", {
        ...evidence,
        commandId: randomUUID(),
        revision: 4,
        attachment: { id: randomUUID(), revision: 1 },
      })
    ).status,
  ).toBe(409);
});
