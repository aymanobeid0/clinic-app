import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { createApplication } from '../src/application.js';
import { openDatabase } from '../src/database.js';
import { provisionClinic } from '../src/modules/identity/index.js';
const owner = openDatabase(
  'postgresql://clinic_test:fictional-only@127.0.0.1:55437/clinic_issue7',
);
const runtime = openDatabase(
  'postgresql://clinic_runtime_test:fictional-runtime-only@127.0.0.1:55437/clinic_issue7',
);
const origin = 'http://localhost:4173';
let token = '';
const options = {
  database: runtime,
  origin,
  secureCookies: false,
  sessionSecret: 'fictional-session-secret-at-least-32-characters',
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
    clinicName: 'Clinique fictive',
    username: 'manager',
    displayName: 'Responsable',
    email,
    temporaryPassword: 'Fictional-initial-pass-1',
  });
  const browser = request.agent(app);
  let csrf = '';
  const post = async (
    path: string,
    body: Record<string, unknown> & { revision?: number },
  ) => {
    let payload = body;
    const id = /^\/accounts\/([^/]+)\//.exec(path)?.[1];
    if (id && body.revision === undefined) {
      const list = await browser.get('/api/accounts');
      const account = Array.isArray(list.body)
        ? list.body.find((a: { id: string }) => a.id === id)
        : undefined;
      payload = { ...body, revision: account?.revision ?? 0 };
    }
    return browser
      .post(`/api${path}`)
      .set('Origin', origin)
      .set('x-csrf-token', csrf)
      .send(payload);
  };
  const login = async (password: string) => {
    csrf = (await browser.get('/api/session')).body.csrfToken;
    const result = await post('/sign-in', { method: 'email', email, password });
    csrf = result.body.csrfToken;
    return result;
  };
  await login('Fictional-initial-pass-1');
  await post('/onboarding/password', { password: 'Fictional-manager-pass-2' });
  await login('Fictional-manager-pass-2');
  await post('/onboarding/email', { email });
  const batch = await post('/onboarding/verify-email', { token });
  await post('/onboarding/codes-saved', {
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
  let csrf = (await browser.get('/api/session')).body.csrfToken;
  const post = (path: string, body: object) =>
    browser
      .post(`/api${path}`)
      .set('Origin', origin)
      .set('x-csrf-token', csrf)
      .send(body);
  const signIn = async (password: string) => {
    const result = await post('/sign-in', {
      method: 'clinic_username',
      clinicCode: code,
      username,
      password,
    });
    csrf = result.body.csrfToken;
    return result;
  };
  await signIn('Fictional-initial-pass-1');
  await post('/onboarding/password', { password: 'Fictional-employee-pass-2' });
  csrf = (await browser.get('/api/session')).body.csrfToken;
  expect((await signIn('Fictional-employee-pass-2')).status).toBe(200);
  const identity = (await browser.get('/api/identity')).body;
  return { browser, post, identity, signIn };
}

async function scenario() {
  const m = await manager();
  const ownId = (await m.browser.get('/api/identity')).body.accountId;
  await m.post(`/accounts/${ownId}/permissions`, {
    currentPassword: 'Fictional-manager-pass-2',
    permissions: ['patients.create'],
  });
  const patient = (
    await m.post('/patients', {
      commandId: randomUUID(),
      name: 'Patient confidentiel fictif',
      phone: '70000000',
      contactKind: 'patient',
      contactName: '',
    })
  ).body.patient;
  const create = async (
    username: string,
    kind = 'doctor',
    permissions = ['clinical.read', 'notes.draft'],
  ) => {
    const account = (
      await m.post('/accounts', {
        username,
        displayName: username,
        kind,
        temporaryPassword: 'Fictional-initial-pass-1',
        currentPassword: 'Fictional-manager-pass-2',
      })
    ).body;
    await m.post(`/accounts/${account.id}/permissions`, {
      currentPassword: 'Fictional-manager-pass-2',
      permissions,
    });
    const employee = await activateEmployee(m.code, username);
    return { ...employee, id: account.id };
  };
  return { m, patient, create };
}

it('assigned staff draft medical history and a doctor confirms a retained dated version', async () => {
  const { m, patient, create } = await scenario();
  const staff = await create('assistant', 'staff', [
    'clinical.read',
    'history.draft',
  ]);
  const doctor = await create('doctor', 'doctor', [
    'clinical.read',
    'clinical.history',
    'history.draft',
    'history.finalize',
  ]);
  for (const [revision, account] of [staff, doctor].entries())
    await m.post(`/patient-access/${patient.id}/share`, {
      commandId: randomUUID(),
      revision,
      accountId: account.id,
      kind: 'shared',
    });
  const command = {
    commandId: randomUUID(),
    revision: 0,
    observedAt: '2026-10-14T10:00:00Z',
    content: {
      medicalHistory: 'Asthme signalé',
      allergies: 'Pénicilline signalée',
    },
  };
  const draft = await staff.post(
    `/clinical/${patient.id}/history/draft`,
    command,
  );
  expect(draft.status).toBe(200);
  expect(draft.body.draft).toMatchObject({
    revision: 1,
    authorId: staff.id,
    content: command.content,
    status: 'draft',
  });
  expect(
    (
      await staff.post(`/clinical/${patient.id}/history/confirm`, {
        commandId: randomUUID(),
        revision: 1,
      })
    ).status,
  ).toBe(403);
  expect(
    (await staff.post(`/clinical/${patient.id}/history/draft`, command)).body,
  ).toEqual(draft.body);
  const confirmed = await doctor.post(
    `/clinical/${patient.id}/history/confirm`,
    { commandId: randomUUID(), revision: 1 },
  );
  expect(confirmed.status).toBe(200);
  expect(confirmed.body.current).toMatchObject({
    revision: 2,
    authorId: staff.id,
    finalizerId: doctor.id,
    content: command.content,
    status: 'final',
  });
  const read = await doctor.browser.get(`/api/clinical/${patient.id}`);
  expect(read.status).toBe(200);
  expect(read.body.history.events).toHaveLength(2);
  expect(read.body.history.current.content.allergies).toBe(
    'Pénicilline signalée',
  );
});
it('manual mixed FDI chart retains coexisting conditions, presence, treatment and valid surfaces', async () => {
  const { m, patient, create } = await scenario();
  const doctor = await create('chart-doctor', 'doctor', [
    'clinical.read',
    'chart.draft',
    'chart.finalize',
  ]);
  await m.post(`/patient-access/${patient.id}/share`, {
    commandId: randomUUID(),
    revision: 0,
    accountId: doctor.id,
    kind: 'assigned',
  });
  const content = {
    numberingScheme: 'FDI',
    dentition: 'mixed',
    teeth: [
      {
        tooth: '11',
        presence: 'present',
        extractionHistory: false,
        conditions: [{ finding: 'decay', surfaces: ['mesial'] }],
        treatments: ['crown', 'root_canal'],
      },
      {
        tooth: '51',
        presence: 'missing',
        extractionHistory: true,
        conditions: [],
        treatments: ['implant'],
      },
    ],
  };
  const command = {
    commandId: randomUUID(),
    revision: 0,
    observedAt: '2026-10-14T09:00:00Z',
    content,
  };
  const draft = await doctor.post(
    `/clinical/${patient.id}/chart/draft`,
    command,
  );
  expect(draft.status).toBe(200);
  expect(draft.body.draft.content).toEqual(content);
  const confirmed = await doctor.post(`/clinical/${patient.id}/chart/confirm`, {
    commandId: randomUUID(),
    revision: 1,
  });
  expect(confirmed.status).toBe(200);
  expect(confirmed.body.current.content.teeth[0].treatments).toEqual([
    'crown',
    'root_canal',
  ]);
  expect(
    (await doctor.browser.get(`/api/clinical/${patient.id}`)).body.chart.current
      .content.teeth,
  ).toHaveLength(2);
});
it('invalid FDI and surface combinations and future observations fail without changing the record', async () => {
  const { m, patient, create } = await scenario();
  const doctor = await create('doctor', 'doctor', [
    'clinical.read',
    'chart.draft',
  ]);
  await m.post(`/patient-access/${patient.id}/share`, {
    commandId: randomUUID(),
    revision: 0,
    accountId: doctor.id,
    kind: 'assigned',
  });
  const tooth = {
    tooth: '11',
    presence: 'unknown',
    extractionHistory: false,
    conditions: [],
    treatments: [],
  };
  const cases = [
    { numberingScheme: 'Universal', dentition: 'permanent', teeth: [tooth] },
    {
      numberingScheme: 'FDI',
      dentition: 'permanent',
      teeth: [{ ...tooth, tooth: '59' }],
    },
    {
      numberingScheme: 'FDI',
      dentition: 'permanent',
      teeth: [
        {
          ...tooth,
          conditions: [{ finding: 'decay', surfaces: ['occlusal'] }],
        },
      ],
    },
    {
      numberingScheme: 'FDI',
      dentition: 'permanent',
      teeth: [
        {
          ...tooth,
          tooth: '16',
          conditions: [{ finding: 'restoration', surfaces: ['incisal'] }],
        },
      ],
    },
    { numberingScheme: 'FDI', dentition: 'primary', teeth: [tooth] },
    {
      numberingScheme: 'FDI',
      dentition: 'mixed',
      teeth: [{ ...tooth, conditions: [{ finding: 'other', surfaces: [] }] }],
    },
    { numberingScheme: 'FDI', dentition: 'mixed', teeth: [tooth, tooth] },
  ];
  for (const content of cases)
    expect(
      (
        await doctor.post(`/clinical/${patient.id}/chart/draft`, {
          commandId: randomUUID(),
          revision: 0,
          observedAt: '2026-10-14T09:00:00Z',
          content,
        })
      ).status,
    ).toBe(400);
  expect(
    (
      await doctor.post(`/clinical/${patient.id}/chart/draft`, {
        commandId: randomUUID(),
        revision: 0,
        observedAt: '2099-10-14T09:00:00Z',
        content: { numberingScheme: 'FDI', dentition: 'mixed', teeth: [tooth] },
      })
    ).status,
  ).toBe(400);
  expect(
    (await doctor.browser.get(`/api/clinical/${patient.id}`)).body.chart,
  ).toMatchObject({ revision: 0, current: null, draft: null, events: [] });
});
it('corrections preserve finalized history; concurrent drafts reject stale input and retry receipts bind actor and payload', async () => {
  const { m, patient, create } = await scenario();
  const doctor = await create('doctor', 'doctor', [
    'clinical.read',
    'clinical.history',
    'history.draft',
    'history.finalize',
  ]);
  const second = await create('second', 'doctor', [
    'clinical.read',
    'history.draft',
  ]);
  for (const [revision, a] of [doctor, second].entries())
    await m.post(`/patient-access/${patient.id}/share`, {
      commandId: randomUUID(),
      revision,
      accountId: a.id,
      kind: 'shared',
    });
  const command = {
    commandId: randomUUID(),
    revision: 0,
    observedAt: '2026-10-14T09:00:00Z',
    content: { medicalHistory: 'Asthme déclaré', allergies: 'Non évaluées' },
  };
  const result = await doctor.post(
    `/clinical/${patient.id}/history/draft`,
    command,
  );
  expect(result.status).toBe(200);
  await doctor.post(`/clinical/${patient.id}/history/confirm`, {
    commandId: randomUUID(),
    revision: 1,
  });
  const correction = {
    ...command,
    commandId: randomUUID(),
    revision: 2,
    content: { ...command.content, allergies: 'Latex déclaré' },
  };
  const responses = await Promise.all([
    doctor.post(`/clinical/${patient.id}/history/draft`, correction),
    second.post(`/clinical/${patient.id}/history/draft`, {
      ...correction,
      commandId: randomUUID(),
    }),
  ]);
  expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
  const record = (await doctor.browser.get(`/api/clinical/${patient.id}`)).body
    .history;
  expect(record.current.content.allergies).toBe('Non évaluées');
  expect(record.draft.content.allergies).toBe('Latex déclaré');
  expect(
    (
      await doctor.post(`/clinical/${patient.id}/history/draft`, {
        ...command,
        content: { ...command.content, allergies: 'Changed retry' },
      })
    ).status,
  ).toBe(409);
  expect(
    (await second.post(`/clinical/${patient.id}/history/draft`, command))
      .status,
  ).toBe(409);
  await doctor.post(`/clinical/${patient.id}/history/confirm`, {
    commandId: randomUUID(),
    revision: 3,
  });
  const final = (await doctor.browser.get(`/api/clinical/${patient.id}`)).body
    .history;
  expect(final.current.content.allergies).toBe('Latex déclaré');
  expect(final.events[1].content.allergies).toBe('Non évaluées');
  expect(final.events).toHaveLength(4);
});
it('direct clinical reads and writes enforce patient scope, capability, clinic, manager kind and revocation even for retries', async () => {
  const { m, patient, create } = await scenario();
  const doctor = await create('doctor', 'doctor', [
    'clinical.read',
    'history.draft',
  ]);
  const denied = await create('denied', 'staff', []);
  const command = {
    commandId: randomUUID(),
    revision: 0,
    observedAt: '2026-10-14T09:00:00Z',
    content: { medicalHistory: 'Fictif', allergies: 'Non évaluées' },
  };
  expect((await doctor.browser.get(`/api/clinical/${patient.id}`)).status).toBe(
    403,
  );
  expect(
    (await doctor.post(`/clinical/${patient.id}/history/draft`, command))
      .status,
  ).toBe(403);
  expect((await m.browser.get(`/api/clinical/${patient.id}`)).status).toBe(403);
  await m.post(`/patient-access/${patient.id}/share`, {
    commandId: randomUUID(),
    revision: 0,
    accountId: doctor.id,
    kind: 'assigned',
  });
  expect(
    (await doctor.post(`/clinical/${patient.id}/history/draft`, command))
      .status,
  ).toBe(200);
  expect((await denied.browser.get(`/api/clinical/${patient.id}`)).status).toBe(
    403,
  );
  const foreign = await scenario();
  expect(
    (await doctor.browser.get(`/api/clinical/${foreign.patient.id}`)).status,
  ).toBe(403);
  expect(
    (
      await doctor.post(
        `/clinical/${foreign.patient.id}/history/draft`,
        command,
      )
    ).status,
  ).toBe(403);
  await m.post(`/patient-access/${patient.id}/remove`, {
    commandId: randomUUID(),
    revision: 1,
    accountId: doctor.id,
  });
  expect((await doctor.browser.get(`/api/clinical/${patient.id}`)).status).toBe(
    403,
  );
  expect(
    (await doctor.post(`/clinical/${patient.id}/history/draft`, command))
      .status,
  ).toBe(403);
});
it('clinical discovery exposes only explicitly scoped patients without requiring personal-details administration', async () => {
  const { m, patient, create } = await scenario();
  const doctor = await create('doctor', 'doctor', [
    'clinical.read',
    'history.draft',
  ]);
  expect((await doctor.browser.get('/api/clinical-patients')).body).toEqual([]);
  await m.post(`/patient-access/${patient.id}/share`, {
    commandId: randomUUID(),
    revision: 0,
    accountId: doctor.id,
    kind: 'assigned',
  });
  const list = await doctor.browser.get('/api/clinical-patients');
  expect(list.status).toBe(200);
  expect(list.body).toEqual([
    {
      id: patient.id,
      patientNumber: patient.patientNumber,
      name: patient.name,
    },
  ]);
  expect((await doctor.browser.get('/api/patients')).status).toBe(403);
});
it('clinical.read and draft receipts cannot disclose separately permissioned essential history', async () => {
  const { m, patient, create } = await scenario();
  const doctor = await create('doctor', 'doctor', [
    'clinical.read',
    'history.draft',
    'history.finalize',
    'clinical.history',
  ]);
  const staff = await create('assistant', 'staff', [
    'clinical.read',
    'history.draft',
  ]);
  for (const [revision, a] of [doctor, staff].entries())
    await m.post(`/patient-access/${patient.id}/share`, {
      commandId: randomUUID(),
      revision,
      accountId: a.id,
      kind: 'shared',
    });
  const command = {
    commandId: randomUUID(),
    revision: 0,
    observedAt: '2026-10-14T09:00:00Z',
    content: {
      medicalHistory: 'Ancienne information',
      allergies: 'Ancienne allergie',
    },
  };
  await doctor.post(`/clinical/${patient.id}/history/draft`, command);
  await doctor.post(`/clinical/${patient.id}/history/confirm`, {
    commandId: randomUUID(),
    revision: 1,
  });
  expect(
    (await staff.browser.get(`/api/clinical/${patient.id}`)).body.history
      .events,
  ).toEqual([]);
  const saved = await staff.post(`/clinical/${patient.id}/history/draft`, {
    ...command,
    commandId: randomUUID(),
    revision: 2,
    content: {
      medicalHistory: 'Nouvelle information',
      allergies: 'Nouvelle allergie',
    },
  });
  expect(saved.body.events).toEqual([]);
  expect(
    (await doctor.browser.get(`/api/clinical/${patient.id}`)).body.history
      .events,
  ).toHaveLength(3);
});
it('draft-only capability cannot read existing clinical content through mutation receipts', async () => {
  const { m, patient, create } = await scenario();
  const staff = await create('draft-only', 'staff', ['history.draft']);
  await m.post(`/patient-access/${patient.id}/share`, {
    commandId: randomUUID(),
    revision: 0,
    accountId: staff.id,
    kind: 'shared',
  });
  expect(
    (
      await staff.post(`/clinical/${patient.id}/history/draft`, {
        commandId: randomUUID(),
        revision: 0,
        observedAt: '2026-10-14T09:00:00Z',
        content: { medicalHistory: 'Draft', allergies: '' },
      })
    ).status,
  ).toBe(403);
});
it('unsupported special positions use retained explanatory Other notes without invented FDI codes', async () => {
  const { m, patient, create } = await scenario();
  const doctor = await create('doctor', 'doctor', [
    'clinical.read',
    'clinical.history',
    'chart.draft',
    'chart.finalize',
  ]);
  await m.post(`/patient-access/${patient.id}/share`, {
    commandId: randomUUID(),
    revision: 0,
    accountId: doctor.id,
    kind: 'assigned',
  });
  const content = {
    numberingScheme: 'FDI',
    dentition: 'mixed',
    teeth: [],
    otherNotes:
      'Autre : dent surnuméraire signalée, position à décrire par le dentiste.',
  };
  const draft = await doctor.post(`/clinical/${patient.id}/chart/draft`, {
    commandId: randomUUID(),
    revision: 0,
    observedAt: '2026-10-14T09:00:00Z',
    content,
  });
  expect(draft.status).toBe(200);
  const final = await doctor.post(`/clinical/${patient.id}/chart/confirm`, {
    commandId: randomUUID(),
    revision: 1,
  });
  expect(final.body.current.content.otherNotes).toBe(content.otherNotes);
  expect(
    (await doctor.browser.get(`/api/clinical/${patient.id}`)).body.chart
      .events[0].content.otherNotes,
  ).toBe(content.otherNotes);
});
it('capability loss, historical-only status and disabled accounts deny direct clinical routes and receipt replays', async () => {
  const { m, patient, create } = await scenario();
  const doctor = await create('doctor', 'doctor', [
    'clinical.read',
    'history.draft',
  ]);
  await m.post(`/patient-access/${patient.id}/share`, {
    commandId: randomUUID(),
    revision: 0,
    accountId: doctor.id,
    kind: 'assigned',
  });
  const command = {
    commandId: randomUUID(),
    revision: 0,
    observedAt: '2026-10-14T09:00:00Z',
    content: { medicalHistory: 'Fictionnel', allergies: 'Non évaluées' },
  };
  expect(
    (await doctor.post(`/clinical/${patient.id}/history/draft`, command))
      .status,
  ).toBe(200);
  await m.post(`/accounts/${doctor.id}/permissions`, {
    currentPassword: 'Fictional-manager-pass-2',
    permissions: ['history.draft'],
  });
  expect((await doctor.browser.get(`/api/clinical/${patient.id}`)).status).toBe(
    403,
  );
  expect(
    (await doctor.post(`/clinical/${patient.id}/history/draft`, command))
      .status,
  ).toBe(403);
  await m.post(`/accounts/${doctor.id}/permissions`, {
    currentPassword: 'Fictional-manager-pass-2',
    permissions: ['clinical.read', 'history.draft'],
  });
  await m.post(`/accounts/${doctor.id}/status`, {
    currentPassword: 'Fictional-manager-pass-2',
    status: 'historical',
  });
  await doctor.signIn('Fictional-employee-pass-2');
  expect((await doctor.browser.get(`/api/clinical/${patient.id}`)).status).toBe(
    403,
  );
  expect(
    (await doctor.post(`/clinical/${patient.id}/history/draft`, command))
      .status,
  ).toBe(403);
  await m.post(`/accounts/${doctor.id}/status`, {
    currentPassword: 'Fictional-manager-pass-2',
    status: 'disabled',
  });
  expect((await doctor.browser.get(`/api/clinical/${patient.id}`)).status).toBe(
    401,
  );
});
it('old command replays cannot expose superseded clinical content after history permission is revoked', async () => {
  const { m, patient, create } = await scenario();
  const doctor = await create('doctor', 'doctor', [
    'clinical.read',
    'clinical.history',
    'history.draft',
    'history.finalize',
  ]);
  await m.post(`/patient-access/${patient.id}/share`, {
    commandId: randomUUID(),
    revision: 0,
    accountId: doctor.id,
    kind: 'assigned',
  });
  const initial = {
    commandId: randomUUID(),
    revision: 0,
    observedAt: '2026-10-14T09:00:00Z',
    content: {
      medicalHistory: 'SUPERSEDED_PRIVATE_HISTORY',
      allergies: 'SUPERSEDED_PRIVATE_ALLERGY',
    },
  };
  const confirm = { commandId: randomUUID(), revision: 1 };
  expect(
    (await doctor.post(`/clinical/${patient.id}/history/draft`, initial))
      .status,
  ).toBe(200);
  expect(
    (await doctor.post(`/clinical/${patient.id}/history/confirm`, confirm))
      .status,
  ).toBe(200);
  await doctor.post(`/clinical/${patient.id}/history/draft`, {
    ...initial,
    commandId: randomUUID(),
    revision: 2,
    content: {
      medicalHistory: 'Current history',
      allergies: 'Current allergy',
    },
  });
  await doctor.post(`/clinical/${patient.id}/history/confirm`, {
    commandId: randomUUID(),
    revision: 3,
  });
  await m.post(`/accounts/${doctor.id}/permissions`, {
    currentPassword: 'Fictional-manager-pass-2',
    permissions: ['clinical.read', 'history.draft', 'history.finalize'],
  });
  for (const [action, data, revision] of [
    ['draft', initial, 1],
    ['confirm', confirm, 2],
  ] as const) {
    const replay = await doctor.post(
      `/clinical/${patient.id}/history/${action}`,
      data,
    );
    expect(replay.status).toBe(200);
    expect(JSON.stringify(replay.body)).not.toContain('SUPERSEDED_PRIVATE');
    expect(replay.body).toMatchObject({
      revision,
      current: {
        revision: 4,
        content: {
          medicalHistory: 'Current history',
          allergies: 'Current allergy',
        },
      },
      draft: null,
      events: [],
    });
  }
  expect(
    (await doctor.browser.get(`/api/clinical/${patient.id}`)).body.history
      .revision,
  ).toBe(4);
});
