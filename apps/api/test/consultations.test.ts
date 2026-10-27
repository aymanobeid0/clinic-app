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

async function treatmentScenario() {
  const { m, patient, create } = await scenario();
  const own = (await m.browser.get("/api/identity")).body.accountId;
  await m.post(`/accounts/${own}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: ["patients.create", "catalog.manage"],
  });
  await m.post("/catalog/currencies", { commandId: randomUUID(), code: "MRU" });
  const procedureId = randomUUID();
  const catalog = {
    id: procedureId,
    revision: 0,
    name: "Acte fictif",
    currency: "MRU",
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
    currency: "MRU",
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
