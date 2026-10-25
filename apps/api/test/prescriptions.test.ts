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

it("clinic medication reference writes are retry-safe and independent from patient access", async () => {
  const { m } = await scenario();
  const entry = {
    commandId: randomUUID(),
    id: randomUUID(),
    revision: 0,
    name: "Médicament fictif",
    strength: "10 mg",
    form: "comprimé",
    active: true,
  };
  const saved = await m.post("/medications", entry);
  expect(saved.status).toBe(200);
  expect((await m.post("/medications", entry)).body).toEqual(saved.body);
  expect((await m.browser.get("/api/medications?q=fictif")).body).toMatchObject(
    [{ name: "Médicament fictif" }],
  );
});

const content = {
  medicines: [
    {
      name: "Texte fictif",
      strength: "10 mg",
      form: "comprimé",
      dose: "Dose saisie",
      route: "Voie saisie",
      frequency: "Fréquence saisie",
      duration: "Durée saisie",
      quantity: "",
      instructions: "Consigne saisie",
    },
  ],
  instructions: "Instructions libres",
};
it("scoped staff drafts and doctor issues independent retained prescription versions", async () => {
  const { m, patient, create } = await scenario();
  const staff = await create("assistant", "staff", [
    "clinical.read",
    "prescriptions.draft",
  ]);
  const doctor = await create("dentiste", "doctor", [
    "clinical.read",
    "clinical.history",
    "prescriptions.draft",
    "prescriptions.sign",
    "clinical.print",
  ]);
  for (const [revision, a] of [staff, doctor].entries())
    expect(
      (
        await m.post(`/patient-access/${patient.id}/share`, {
          commandId: randomUUID(),
          revision,
          accountId: a.id,
          kind: "shared",
        })
      ).status,
    ).toBe(200);
  const id = randomUUID(),
    url = `/clinical/${patient.id}/prescriptions/${id}`,
    command = { commandId: randomUUID(), revision: 0, content };
  const draft = await staff.post(url + "/draft", command);
  expect(draft.status).toBe(200);
  expect(draft.body.draft.content.medicines).toEqual(content.medicines);
  expect(
    (
      await staff.post(url + "/finalize", {
        commandId: randomUUID(),
        revision: 1,
      })
    ).status,
  ).toBe(403);
  const issued = await doctor.post(url + "/finalize", {
    commandId: randomUUID(),
    revision: 1,
  });
  expect(issued.status).toBe(200);
  expect(issued.body.current).toMatchObject({
    authorId: staff.id,
    finalizerId: doctor.id,
  });
  expect((await doctor.browser.get("/api" + url + "/print/2")).status).toBe(
    200,
  );
  expect((await m.browser.get("/api" + url)).status).toBe(403);
  const correction = await doctor.post(url + "/draft", {
    commandId: randomUUID(),
    revision: 2,
    content: { ...content, instructions: "Correction" },
    reason: "Erreur de transcription",
  });
  expect(correction.status).toBe(200);
  const replaced = await doctor.post(url + "/finalize", {
    commandId: randomUUID(),
    revision: 3,
  });
  expect(replaced.body.current.content.replaces).toBe(2);
  const original = await doctor.browser.get("/api" + url + "/print/2");
  expect(original.body.superseded).toBe(true);
  expect(original.body.version.content.instructions).toBe(
    "Instructions libres",
  );
});

it("clinician sees no invented chart suggestions for an unworked patient", async () => {
  const { m, patient, create } = await scenario();
  const d = await create("dentiste", "doctor", [
    "clinical.read",
    "chart.finalize",
  ]);
  await m.post(`/patient-access/${patient.id}/share`, {
    commandId: randomUUID(),
    revision: 0,
    accountId: d.id,
    kind: "shared",
  });
  const r = await d.browser.get(`/api/clinical/${patient.id}/suggestions`);
  expect(r.status).toBe(200);
  expect(r.body).toEqual([]);
});

it("catalog mutation, retirement, recreation and template edits never rewrite saved drafts or issued content", async () => {
  const { m, patient, create } = await scenario(),
    d = await create("dentiste", "doctor", [
      "clinical.read",
      "clinical.history",
      "prescriptions.draft",
      "prescriptions.sign",
      "clinical.print",
    ]);
  await m.post(`/patient-access/${patient.id}/share`, {
    commandId: randomUUID(),
    revision: 0,
    accountId: d.id,
    kind: "shared",
  });
  const entry = {
    commandId: randomUUID(),
    id: randomUUID(),
    revision: 0,
    name: "Original fictif",
    strength: "1 unité",
    form: "forme",
    active: true,
  };
  expect((await m.post("/medications", entry)).status).toBe(200);
  const template = {
    commandId: randomUUID(),
    revision: 0,
    header: "En-tête original",
    footer: "Pied original",
  };
  expect((await m.post("/prescription-template", template)).status).toBe(200);
  const medicine = {
    ...content.medicines[0]!,
    name: entry.name,
    strength: entry.strength,
    form: entry.form,
  };
  const draftId = randomUUID(),
    issuedId = randomUUID();
  for (const id of [draftId, issuedId])
    expect(
      (
        await d.post(`/clinical/${patient.id}/prescriptions/${id}/draft`, {
          commandId: randomUUID(),
          revision: 0,
          content: { ...content, medicines: [medicine] },
        })
      ).status,
    ).toBe(200);
  expect(
    (
      await d.post(
        `/clinical/${patient.id}/prescriptions/${issuedId}/finalize`,
        { commandId: randomUUID(), revision: 1 },
      )
    ).status,
  ).toBe(200);
  expect(
    (
      await m.post("/medications", {
        ...entry,
        commandId: randomUUID(),
        revision: 1,
        name: "Renommé",
        strength: "autre",
        form: "autre",
        active: false,
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await m.post("/medications", {
        ...entry,
        id: randomUUID(),
        commandId: randomUUID(),
        strength: "nouvelle force",
      })
    ).status,
  ).toBe(200);
  await m.post("/prescription-template", {
    ...template,
    commandId: randomUUID(),
    revision: 1,
    header: "Nouveau modèle",
  });
  const draft = await d.browser.get(
    `/api/clinical/${patient.id}/prescriptions/${draftId}`,
  );
  expect(draft.body.draft.content.medicines).toEqual([medicine]);
  const print = await d.browser.get(
    `/api/clinical/${patient.id}/prescriptions/${issuedId}/print/2`,
  );
  expect(print.body.version.content).toMatchObject({
    medicines: [medicine],
    issued: {
      header: "En-tête original",
      footer: "Pied original",
      prescriberId: d.id,
    },
  });
  expect(
    (
      await d.post(
        `/clinical/${patient.id}/prescriptions/${draftId}/finalize`,
        { commandId: randomUUID(), revision: 1 },
      )
    ).status,
  ).toBe(200);
  expect(
    (await m.browser.get("/api/medications?q=Original")).body,
  ).toMatchObject([{ strength: "nouvelle force" }]);
});
it("separate reference commands deny staff, isolate clinics, reject stale/duplicate writes and replay concurrent retries", async () => {
  const { m, create } = await scenario(),
    staff = await create("staff", "staff", [
      "clinical.read",
      "catalog.manage",
      "prescriptions.draft",
    ]),
    other = await manager();
  const entry = {
    commandId: randomUUID(),
    id: randomUUID(),
    revision: 0,
    name: "Isolée",
    strength: "",
    form: "",
    active: true,
  };
  expect((await staff.post("/medications", entry)).status).toBe(403);
  expect((await staff.browser.get("/api/medications")).status).toBe(200);
  expect(
    (
      await Promise.all([
        m.post("/medications", entry),
        m.post("/medications", entry),
      ])
    ).map((r) => r.status),
  ).toEqual([200, 200]);
  expect((await other.browser.get("/api/medications?q=Isolée")).body).toEqual(
    [],
  );
  expect(
    (
      await other.post("/medications", {
        ...entry,
        commandId: randomUUID(),
        revision: 1,
      })
    ).status,
  ).toBe(409);
  expect(
    (await m.post("/medications", { ...entry, commandId: randomUUID() }))
      .status,
  ).toBe(409);
  expect(
    (
      await m.post("/medications", {
        ...entry,
        id: randomUUID(),
        commandId: randomUUID(),
      })
    ).status,
  ).toBe(409);
  const updates = await Promise.all(
    ["A", "B"].map((name) =>
      m.post("/medications", {
        ...entry,
        revision: 1,
        commandId: randomUUID(),
        name,
      }),
    ),
  );
  expect(updates.map((v) => v.status).sort()).toEqual([200, 409]);
});
it("manual drafts survive replay and concurrent edits without silent overwrite and require clinical scope for every print", async () => {
  const { m, patient, create } = await scenario(),
    d = await create("dentiste", "doctor", [
      "clinical.read",
      "clinical.history",
      "prescriptions.draft",
      "prescriptions.sign",
      "clinical.print",
    ]);
  await m.post(`/patient-access/${patient.id}/share`, {
    commandId: randomUUID(),
    revision: 0,
    accountId: d.id,
    kind: "shared",
  });
  const id = randomUUID(),
    url = `/clinical/${patient.id}/prescriptions/${id}`,
    cmd = { commandId: randomUUID(), revision: 0, content };
  const results = await Promise.all([
    d.post(url + "/draft", cmd),
    d.post(url + "/draft", cmd),
  ]);
  expect(results.map((v) => v.status)).toEqual([200, 200]);
  expect((await d.browser.get("/api" + url + "/print/1")).status).toBe(404);
  expect(
    (
      await d.post(url + "/draft", {
        ...cmd,
        content: { ...content, instructions: "Changed reuse" },
      })
    ).status,
  ).toBe(409);
  const changes = await Promise.all(
    ["A", "B"].map((instructions) =>
      d.post(url + "/draft", {
        commandId: randomUUID(),
        revision: 1,
        content: { ...content, instructions },
      }),
    ),
  );
  expect(changes.map((v) => v.status).sort()).toEqual([200, 409]);
  const finalCommand = { commandId: randomUUID(), revision: 2 };
  expect((await d.post(url + "/finalize", finalCommand)).status).toBe(200);
  expect((await d.post(url + "/finalize", finalCommand)).status).toBe(200);
  expect(
    (
      await d.post(url + "/draft", {
        commandId: randomUUID(),
        revision: 3,
        content,
      })
    ).status,
  ).toBe(400);
  expect((await d.browser.get("/api" + url)).body.events).toHaveLength(3);
  expect(
    (
      await m.post(`/patient-access/${patient.id}/remove`, {
        commandId: randomUUID(),
        revision: 1,
        accountId: d.id,
      })
    ).status,
  ).toBe(200);
  expect((await d.browser.get("/api" + url + "/print/3")).status).toBe(403);
});
async function treatmentScenario(category = "manual") {
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
    chartCategory: category,
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

async function visitScenario(category = "manual") {
  const s = await treatmentScenario(category);
  await s.m.post(`/accounts/${s.doctor.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: [
      "clinical.read",
      "chart.finalize",
      "chart.draft",
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

it("explicit completed restoration suggests but only confirmed valid targets append chart history, retries are unique", async () => {
  const s = await visitScenario("restoration");
  await s.doctor.post(s.path, s.start);
  await s.doctor.post(s.path + "/actions", {
    commandId: randomUUID(),
    id: s.start.id,
    revision: 1,
    action: "complete",
    planId: s.command.id,
    itemId: s.selections[0]!.itemId,
  });
  const url = `/clinical/${s.patient.id}/suggestions`,
    pending = (await s.doctor.browser.get("/api" + url)).body;
  expect(pending).toHaveLength(1);
  expect(pending[0]).toMatchObject({
    category: "restoration",
    status: "pending",
  });
  expect(
    (await s.doctor.browser.get(`/api/clinical/${s.patient.id}`)).body.chart
      .current,
  ).toBeNull();
  const target = {
    tooth: "11",
    presence: "unknown",
    extractionHistory: false,
    conditions: [{ finding: "restoration", surfaces: ["occlusal"] }],
    treatments: [],
  };
  const cmd = {
    commandId: randomUUID(),
    chartRevision: 0,
    action: "confirm",
    targets: [target],
  };
  expect((await s.doctor.post(url + "/" + pending[0].id, cmd)).status).toBe(
    400,
  );
  cmd.targets[0]!.conditions[0]!.surfaces = ["mesial"];
  cmd.commandId = randomUUID();
  const result = await s.doctor.post(url + "/" + pending[0].id, cmd);
  expect(result.status).toBe(200);
  expect((await s.doctor.post(url + "/" + pending[0].id, cmd)).status).toBe(
    200,
  );
  const chart = (await s.doctor.browser.get(`/api/clinical/${s.patient.id}`))
    .body.chart;
  expect(chart.events).toHaveLength(1);
  expect(chart.current.content.teeth[0]).toMatchObject({
    tooth: "11",
    conditions: [{ finding: "restoration", surfaces: ["mesial"] }],
  });
});

it.each(["extraction", "crown", "root_canal", "implant", "manual"])(
  "completed explicit %s mapping respects confirmation and dismissal",
  async (category) => {
    const s = await visitScenario(category);
    await s.doctor.post(s.path, s.start);
    await s.doctor.post(s.path + "/actions", {
      commandId: randomUUID(),
      id: s.start.id,
      revision: 1,
      action: "complete",
      planId: s.command.id,
      itemId: s.selections[0]!.itemId,
    });
    const url = `/clinical/${s.patient.id}/suggestions`,
      suggestions = (await s.doctor.browser.get("/api" + url)).body;
    if (category === "manual") {
      expect(suggestions).toEqual([]);
      return;
    }
    expect(suggestions[0].category).toBe(category);
    const command = {
      commandId: randomUUID(),
      chartRevision: 0,
      action: "confirm",
      targets: [
        {
          tooth: "16",
          presence: "unknown",
          extractionHistory: false,
          conditions: [],
          treatments: [],
        },
      ],
    };
    expect(
      (await s.doctor.post(url + "/" + suggestions[0].id, command)).status,
    ).toBe(200);
    const chart = (await s.doctor.browser.get(`/api/clinical/${s.patient.id}`))
      .body.chart;
    if (category === "extraction")
      expect(chart.current.content.teeth[0]).toMatchObject({
        presence: "missing",
        extractionHistory: true,
      });
    else expect(chart.current.content.teeth[0].treatments).toEqual([category]);
    // A separate completion dismissed explicitly must leave the chart unchanged.
    await s.doctor.post(s.path + "/actions", {
      commandId: randomUUID(),
      id: s.start.id,
      revision: 2,
      action: "complete",
      planId: s.command.id,
      itemId: s.selections[1]!.itemId,
    });
    const pending = (await s.doctor.browser.get("/api" + url)).body.find(
      (v: { status: string }) => v.status === "pending",
    );
    const dismiss = {
      commandId: randomUUID(),
      chartRevision: chart.revision,
      action: "dismiss",
      targets: [],
    };
    expect((await s.doctor.post(url + "/" + pending.id, dismiss)).status).toBe(
      200,
    );
    expect((await s.doctor.post(url + "/" + pending.id, dismiss)).status).toBe(
      200,
    );
    expect(
      (await s.doctor.browser.get(`/api/clinical/${s.patient.id}`)).body.chart,
    ).toEqual(chart);
  },
);
it("catalog database outage cannot prevent independent manual save, finalization or retained print", async () => {
  const { m, patient, create } = await scenario(),
    d = await create("dentiste", "doctor", [
      "clinical.read",
      "prescriptions.draft",
      "prescriptions.sign",
      "clinical.print",
    ]);
  await m.post(`/patient-access/${patient.id}/share`, {
    commandId: randomUUID(),
    revision: 0,
    accountId: d.id,
    kind: "shared",
  });
  const url = `/clinical/${patient.id}/prescriptions/${randomUUID()}`;
  // Infrastructure boundary fault injection on the isolated test DB only; restore in finally.
  await owner.pool.query(
    'REVOKE SELECT,INSERT,UPDATE ON "MedicationReference" FROM clinic_runtime',
  );
  try {
    expect((await d.browser.get("/api/medications?q=absent")).status).toBe(500);
    expect(
      (
        await d.post("/medications", {
          commandId: randomUUID(),
          id: randomUUID(),
          revision: 0,
          name: "Panne",
          strength: "",
          form: "",
          active: true,
        })
      ).status,
    ).toBe(500);
    expect(
      (
        await d.post(url + "/draft", {
          commandId: randomUUID(),
          revision: 0,
          content,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await d.post(url + "/finalize", {
          commandId: randomUUID(),
          revision: 1,
        })
      ).status,
    ).toBe(200);
    expect(
      (await d.browser.get("/api" + url + "/print/2")).body.version.content
        .medicines,
    ).toEqual(content.medicines);
  } finally {
    await owner.pool.query(
      'GRANT SELECT,INSERT,UPDATE ON "MedicationReference" TO clinic_runtime',
    );
  }
});
it("restricted pooled runtime enforces clinic RLS on all new stores without application filters", async () => {
  const { m } = await scenario(),
    other = await manager();
  const clinicId = (await m.browser.get("/api/identity")).body.clinicId,
    otherId = (await other.browser.get("/api/identity")).body.clinicId;
  await m.post("/medications", {
    commandId: randomUUID(),
    id: randomUUID(),
    revision: 0,
    name: "RLS fictive",
    strength: "",
    form: "",
    active: true,
  });
  await m.post("/prescription-template", {
    commandId: randomUUID(),
    revision: 0,
    header: "RLS en-tête",
    footer: "",
  });
  expect(await runtime.client.medicationReference.findMany()).toEqual([]);
  for (const id of [clinicId, otherId])
    await runtime.clinicTransaction(id, async (tx) => {
      const rows = await tx.medicationReference.findMany();
      expect(rows.every((r) => r.clinicId === id)).toBe(true);
      const templates = await tx.prescriptionTemplate.findMany();
      expect(templates.every((r) => r.clinicId === id)).toBe(true);
      const commands = await tx.prescriptionCommand.findMany();
      expect(commands.every((r) => r.clinicId === id)).toBe(true);
      const decisions = await tx.chartSuggestionDecision.findMany();
      expect(decisions.every((r) => r.clinicId === id)).toBe(true);
    });
});

it("chart suggestions preserve coexisting findings and drafts and reject racing chart edits", async () => {
  const s = await visitScenario("restoration");
  await s.doctor.post(s.path, s.start);
  await s.doctor.post(s.path + "/actions", {
    commandId: randomUUID(),
    id: s.start.id,
    revision: 1,
    action: "complete",
    planId: s.command.id,
    itemId: s.selections[0]!.itemId,
  });
  const base = `/clinical/${s.patient.id}`,
    suggestion = (await s.doctor.browser.get("/api" + base + "/suggestions"))
      .body[0];
  const chartContent = {
    numberingScheme: "FDI",
    dentition: "mixed",
    otherNotes: "Observation conservée",
    teeth: [
      {
        tooth: "16",
        presence: "present",
        extractionHistory: false,
        conditions: [{ finding: "decay", surfaces: ["distal"] }],
        treatments: ["crown", "root_canal"],
      },
    ],
  };
  expect(
    (
      await s.doctor.post(base + "/chart/draft", {
        commandId: randomUUID(),
        revision: 0,
        observedAt: "2026-10-17T10:00:00.000Z",
        content: chartContent,
      })
    ).status,
  ).toBe(200);
  const confirm = {
    commandId: randomUUID(),
    chartRevision: 1,
    action: "confirm",
    targets: [
      {
        tooth: "16",
        presence: "unknown",
        extractionHistory: false,
        conditions: [{ finding: "restoration", surfaces: ["mesial"] }],
        treatments: [],
      },
    ],
  };
  expect(
    (await s.doctor.post(base + "/suggestions/" + suggestion.id, confirm))
      .status,
  ).toBe(409);
  expect(
    (
      await s.doctor.post(base + "/chart/confirm", {
        commandId: randomUUID(),
        revision: 1,
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await s.doctor.post(base + "/suggestions/" + suggestion.id, {
        ...confirm,
        commandId: randomUUID(),
        chartRevision: 2,
      })
    ).status,
  ).toBe(200);
  const chart = (await s.doctor.browser.get("/api" + base)).body.chart;
  expect(chart.current.content).toMatchObject({
    otherNotes: "Observation conservée",
    teeth: [
      {
        presence: "present",
        treatments: ["crown", "root_canal"],
        conditions: [
          { finding: "decay", surfaces: ["distal"] },
          { finding: "restoration", surfaces: ["mesial"] },
        ],
      },
    ],
  });
  expect(chart.events).toHaveLength(3);
});
it("old prescription printing and command replay never bypass revoked history capability", async () => {
  const { m, patient, create } = await scenario(),
    d = await create("dentiste", "doctor", [
      "clinical.read",
      "clinical.history",
      "prescriptions.draft",
      "prescriptions.sign",
      "clinical.print",
    ]);
  await m.post(`/patient-access/${patient.id}/share`, {
    commandId: randomUUID(),
    revision: 0,
    accountId: d.id,
    kind: "shared",
  });
  const url = `/clinical/${patient.id}/prescriptions/${randomUUID()}`,
    original = { commandId: randomUUID(), revision: 0, content };
  await d.post(url + "/draft", original);
  await d.post(url + "/finalize", { commandId: randomUUID(), revision: 1 });
  await d.post(url + "/draft", {
    commandId: randomUUID(),
    revision: 2,
    content: { ...content, instructions: "Correction" },
    reason: "Motif",
  });
  await d.post(url + "/finalize", { commandId: randomUUID(), revision: 3 });
  expect(
    (
      await m.post(`/accounts/${d.id}/permissions`, {
        currentPassword: "Fictional-manager-pass-2",
        permissions: [
          "clinical.read",
          "prescriptions.draft",
          "prescriptions.sign",
          "clinical.print",
        ],
      })
    ).status,
  ).toBe(200);
  expect((await d.browser.get("/api" + url + "/print/2")).status).toBe(403);
  expect((await d.browser.get("/api" + url + "/print/4")).status).toBe(200);
  const replay = await d.post(url + "/draft", original);
  expect(replay.body.events).toEqual([]);
  expect(replay.body.current.content.instructions).toBe("Correction");
});

it('reference management can retrieve and retire an entry beyond the autocomplete limit',async()=>{
 const m=await manager();let last={id:'',revision:1,name:'',strength:'',form:'',active:true};
 for(let i=0;i<101;i++){const entry={commandId:randomUUID(),id:randomUUID(),revision:0,name:`Référence ${String(i).padStart(3,'0')}`,strength:'',form:'',active:true};const response=await m.post('/medications',entry);expect(response.status).toBe(200);last=response.body;}
 const list=await m.browser.get('/api/medications?retired=true');expect(list.body).toHaveLength(101);expect(list.body.at(-1).id).toBe(last.id);
 expect((await m.browser.get('/api/medications?q=Référence')).body).toHaveLength(100);
 expect((await m.post('/medications',{...last,commandId:randomUUID(),active:false})).status).toBe(200);
 expect((await m.browser.get('/api/medications?retired=true')).body.find((v:{id:string})=>v.id===last.id).active).toBe(false);
});
