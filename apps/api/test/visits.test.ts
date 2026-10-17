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

async function treatmentScenario() {
  const { m, patient, create } = await scenario();
  const own = (await m.browser.get('/api/identity')).body.accountId;
  await m.post(`/accounts/${own}/permissions`, {
    currentPassword: 'Fictional-manager-pass-2',
    permissions: ['patients.create', 'catalog.manage'],
  });
  await m.post('/catalog/currencies', { commandId: randomUUID(), code: 'MRU' });
  const procedureId = randomUUID();
  const catalog = {
    id: procedureId,
    revision: 0,
    name: 'Acte fictif',
    currency: 'MRU',
    price: '100',
    durationMinutes: 40,
    active: true,
  };
  expect(
    (await m.post('/catalog', { ...catalog, commandId: randomUUID() })).status,
  ).toBe(200);
  const doctor = await create('doctor', 'doctor', [
    'clinical.read',
    'clinical.history',
    'plans.draft',
  ]);
  await m.post(`/patient-access/${patient.id}/share`, {
    commandId: randomUUID(),
    revision: 0,
    accountId: doctor.id,
    kind: 'shared',
  });
  const command = {
    commandId: randomUUID(),
    id: randomUUID(),
    revision: 0,
    title: 'Proposition fictive',
    currency: 'MRU',
    items: [
      {
        id: randomUUID(),
        procedureId,
        catalogRevision: 1,
        scope: 'whole_mouth',
        teeth: [] as string[],
        price: '100',
        discount: '0',
        discountReason: '',
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
    currentPassword: 'Fictional-manager-pass-2',
    permissions: [
      'clinical.read',
      'clinical.history',
      'plans.draft',
      'plans.finalize',
      'plans.accept',
      'acceptance.draft',
      'procedures.start',
      'procedures.complete',
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
  await change('present', 1);
  await change('evidence', 2, {
    acceptedBy: 'Patient fictif',
    acceptedAt: '2026-10-16T12:00:00.000Z',
    method: 'Oral',
  });
  expect((await change('accept', 3)).status).toBe(200);
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
it('starts a walk-in visit draft with several accepted procedures exactly once under concurrent retries', async () => {
  const s = await visitScenario();
  const results = await Promise.all([
    s.doctor.post(s.path, s.start),
    s.doctor.post(s.path, s.start),
  ]);
  expect(results.map((r) => r.status)).toEqual([200, 200]);
  expect(results[0]!.body.id).toBe(s.start.id);
  const state = await s.doctor.browser.get(`/api${s.path}`);
  expect(state.body.visits).toHaveLength(1);
  expect(state.body.visits[0]).toMatchObject({
    id: s.start.id,
    status: 'draft',
    doctorId: s.doctor.id,
  });
  expect(state.body.visits[0].procedures).toHaveLength(2);
  expect(state.body.starts).toHaveLength(2);
  expect(state.body.starts[0]).toMatchObject({
    currency: 'MRU',
    agreedMinor: '10000',
    acceptedRevision: 4,
    performedBy: s.doctor.id,
  });
});

it('ending a visit leaves procedures in progress; later visits continue them until explicit individual completion', async () => {
  const s = await visitScenario();
  expect((await s.doctor.post(s.path, s.start)).status).toBe(200);
  const end = {
    commandId: randomUUID(),
    id: s.start.id,
    revision: 1,
    action: 'end',
  };
  expect((await s.doctor.post(`${s.path}/actions`, end)).status).toBe(200);
  let state = (await s.doctor.browser.get(`/api${s.path}`)).body;
  expect(state.completions).toEqual([]);
  expect(state.visits[0].status).toBe('ended');
  let plan = (
    await s.doctor.browser.get(`/api/treatment/${s.patient.id}/plans`)
  ).body[0];
  expect(plan.status).toBe('in_progress');
  for (let n = 0; n < 4; n++) {
    const visit = {
      ...s.start,
      commandId: randomUUID(),
      id: randomUUID(),
      procedures: s.selections.map((p) => ({
        ...p,
        planRevision: plan.revision,
      })),
    };
    expect((await s.doctor.post(s.path, visit)).status).toBe(200);
    if (n === 3) {
      const complete = await s.doctor.post(`${s.path}/actions`, {
        commandId: randomUUID(),
        id: visit.id,
        revision: 1,
        action: 'complete',
        planId: s.command.id,
        itemId: s.selections[0]!.itemId,
      });
      expect(complete.status).toBe(200);
      expect(
        (
          await s.doctor.post(`${s.path}/actions`, {
            commandId: randomUUID(),
            id: visit.id,
            revision: 2,
            action: 'complete',
            planId: s.command.id,
            itemId: s.selections[1]!.itemId,
          })
        ).status,
      ).toBe(200);
    } else
      expect(
        (
          await s.doctor.post(`${s.path}/actions`, {
            ...end,
            commandId: randomUUID(),
            id: visit.id,
          })
        ).status,
      ).toBe(200);
  }
  state = (await s.doctor.browser.get(`/api${s.path}`)).body;
  expect(state.visits).toHaveLength(5);
  expect(state.starts).toHaveLength(2);
  expect(state.completions).toHaveLength(2);
  plan = (await s.doctor.browser.get(`/api/treatment/${s.patient.id}/plans`))
    .body[0];
  expect(plan.status).toBe('completed');
});

it('booked care links one draft to the correct appointment and ends scheduling without completing procedures', async () => {
  const s = await visitScenario();
  const own = (await s.m.browser.get('/api/identity')).body.accountId;
  await s.m.post(`/accounts/${own}/permissions`, {
    currentPassword: 'Fictional-manager-pass-2',
    permissions: ['patients.create', 'catalog.manage', 'appointments.manage'],
  });
  const booked = await s.m.post('/appointments', {
    commandId: randomUUID(),
    patientId: s.patient.id,
    dentistId: s.doctor.id,
    chairId: null,
    startsAt: '2026-10-17T09:00:00.000Z',
    durationMinutes: 30,
    walkIn: false,
    override: false,
  });
  expect(booked.status).toBe(201);
  const start = { ...s.start, appointmentId: booked.body.id };
  expect((await s.doctor.post(s.path, start)).status).toBe(200);
  expect(
    (
      await s.doctor.post(s.path, {
        ...start,
        commandId: randomUUID(),
        id: randomUUID(),
      })
    ).status,
  ).toBe(409);
  let agenda = (await s.m.browser.get('/api/appointments?date=2026-10-17'))
    .body;
  expect(agenda.appointments[0].status).toBe('in_care');
  expect(
    (
      await s.doctor.post(`${s.path}/actions`, {
        commandId: randomUUID(),
        id: start.id,
        revision: 1,
        action: 'end',
      })
    ).status,
  ).toBe(200);
  agenda = (await s.m.browser.get('/api/appointments?date=2026-10-17')).body;
  expect(agenda.appointments[0].status).toBe('completed');
  expect((await s.doctor.post(s.path, start)).body.status).toBe('ended');
  const state = (await s.doctor.browser.get(`/api${s.path}`)).body;
  expect(state.completions).toEqual([]);
  expect(state.visits).toHaveLength(1);
});

it('later first starts retain the accepted version rather than a progress revision', async () => {
  const s = await visitScenario();
  expect(
    (
      await s.doctor.post(s.path, {
        ...s.start,
        procedures: s.selections.slice(0, 1),
      })
    ).status,
  ).toBe(200);
  await s.doctor.post(`${s.path}/actions`, {
    commandId: randomUUID(),
    id: s.start.id,
    revision: 1,
    action: 'end',
  });
  const second = {
    ...s.start,
    id: randomUUID(),
    commandId: randomUUID(),
    procedures: [{ ...s.selections[1], planRevision: 5 }],
  };
  expect((await s.doctor.post(s.path, second)).status).toBe(200);
  const state = (await s.doctor.browser.get(`/api${s.path}`)).body;
  expect(
    state.starts.map((v: { acceptedRevision: number }) => v.acceptedRevision),
  ).toEqual([4, 4]);
});

it('an invalid second procedure rolls back an already changed appointment and leaves no visit or start facts', async () => {
  const s = await visitScenario();
  const own = (await s.m.browser.get('/api/identity')).body.accountId;
  await s.m.post(`/accounts/${own}/permissions`, {
    currentPassword: 'Fictional-manager-pass-2',
    permissions: ['patients.create', 'catalog.manage', 'appointments.manage'],
  });
  const booked = await s.m.post('/appointments', {
    commandId: randomUUID(),
    patientId: s.patient.id,
    dentistId: s.doctor.id,
    chairId: null,
    startsAt: '2026-10-17T10:00:00.000Z',
    durationMinutes: 30,
    walkIn: true,
  });
  expect(booked.status).toBe(201);
  const start = {
    ...s.start,
    appointmentId: booked.body.id,
    procedures: [s.selections[0], { ...s.selections[1], itemId: randomUUID() }],
  };
  expect((await s.doctor.post(s.path, start)).status).toBe(409);
  const state = (await s.doctor.browser.get(`/api${s.path}`)).body;
  expect(state.visits).toEqual([]);
  expect(state.starts).toEqual([]);
  const agenda = (await s.m.browser.get('/api/appointments?date=2026-10-17'))
    .body;
  expect(agenda.appointments[0]).toMatchObject({
    status: 'arrived',
    revision: 0,
  });
  const history = await s.m.browser.get(
    `/api/appointments/${booked.body.id}/history`,
  );
  expect(history.body).toHaveLength(1);
  const plans = (
    await s.doctor.browser.get(`/api/treatment/${s.patient.id}/plans`)
  ).body;
  expect(plans[0]).toMatchObject({ status: 'accepted', revision: 4 });
});
it('clinical scope, role, current permissions and cross-clinic boundaries protect reads and consequential writes', async () => {
  const s = await visitScenario();
  expect((await request(app).get(`/api${s.path}`)).status).toBe(401);
  expect((await s.m.post(s.path, s.start)).status).toBe(403);
  expect((await s.m.browser.get(`/api${s.path}`)).status).toBe(403);
  const staff = await s.create('assistant', 'staff', [
    'clinical.read',
    'procedures.start',
    'procedures.complete',
  ]);
  await s.m.post(`/patient-access/${s.patient.id}/share`, {
    commandId: randomUUID(),
    revision: 1,
    accountId: staff.id,
    kind: 'shared',
  });
  expect((await staff.post(s.path, s.start)).status).toBe(403);
  const stranger = await s.create('stranger', 'doctor', [
    'clinical.read',
    'procedures.start',
  ]);
  expect((await stranger.post(s.path, s.start)).status).toBe(403);
  const other = await scenario();
  const otherDoctor = await other.create('other', 'doctor', [
    'clinical.read',
    'procedures.start',
  ]);
  expect((await otherDoctor.post(s.path, s.start)).status).toBe(403);
  expect((await otherDoctor.browser.get(`/api${s.path}`)).status).toBe(403);
  expect((await s.doctor.post(s.path, s.start)).status).toBe(200);
  await s.m.post(`/accounts/${s.doctor.id}/permissions`, {
    currentPassword: 'Fictional-manager-pass-2',
    permissions: ['clinical.read'],
  });
  expect((await s.doctor.post(s.path, s.start)).status).toBe(403);
  expect(
    (
      await s.doctor.post(`${s.path}/actions`, {
        commandId: randomUUID(),
        id: s.start.id,
        revision: 1,
        action: 'complete',
        planId: s.command.id,
        itemId: s.selections[0]!.itemId,
      })
    ).status,
  ).toBe(403);
  await s.m.post(`/patient-access/${s.patient.id}/remove`, {
    commandId: randomUUID(),
    revision: 2,
    accountId: s.doctor.id,
  });
  expect((await s.doctor.browser.get(`/api${s.path}`)).status).toBe(403);
});
it('stale or changed start commands cannot overwrite care and concurrent completion creates one retained fact', async () => {
  const s = await visitScenario();
  const stale = {
    ...s.start,
    procedures: s.selections.map((p) => ({ ...p, planRevision: 3 })),
  };
  expect((await s.doctor.post(s.path, stale)).status).toBe(409);
  expect((await s.doctor.post(s.path, s.start)).status).toBe(200);
  expect(
    (await s.doctor.post(s.path, { ...s.start, appointmentId: randomUUID() }))
      .status,
  ).toBe(409);
  const a = {
    commandId: randomUUID(),
    id: s.start.id,
    revision: 1,
    action: 'complete',
    planId: s.command.id,
    itemId: s.selections[0]!.itemId,
  };
  const results = await Promise.all([
    s.doctor.post(`${s.path}/actions`, a),
    s.doctor.post(`${s.path}/actions`, { ...a, commandId: randomUUID() }),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  expect((await s.doctor.post(`${s.path}/actions`, a)).status).toBe(200);
  const state = (await s.doctor.browser.get(`/api${s.path}`)).body;
  expect(state.completions).toHaveLength(1);
  expect(state.starts).toHaveLength(2);
  expect(
    (
      await s.doctor.post(`/treatment/${s.patient.id}/plans/lifecycle`, {
        commandId: randomUUID(),
        id: s.command.id,
        revision: 5,
        action: 'cancel',
        reason: 'Impossible après début',
      })
    ).status,
  ).toBe(409);
});

it('the settled start fact retains exact accepted discounts, itemized extras and performer attribution', async () => {
  const s = await visitScenario();
  await s.m.post(`/accounts/${s.doctor.id}/permissions`, {
    currentPassword: 'Fictional-manager-pass-2',
    permissions: [
      'clinical.read',
      'plans.draft',
      'plans.finalize',
      'plans.accept',
      'acceptance.draft',
      'procedures.start',
      'prices.override',
      'discounts',
    ],
  });
  const extraId = randomUUID();
  expect(
    (
      await s.doctor.post(`/treatment/${s.patient.id}/plans`, {
        ...s.command,
        commandId: randomUUID(),
        revision: 4,
        items: s.command.items.map((i) => ({
          ...i,
          price: '90',
          discount: '5',
          discountReason: 'Famille',
          extras: [
            {
              id: extraId,
              label: 'Travail supplémentaire accepté',
              amount: '7.25',
            },
          ],
        })),
      })
    ).status,
  ).toBe(200);
  for (const [action, revision, extra] of [
    ['present', 5, {}],
    [
      'evidence',
      6,
      {
        acceptedBy: 'Patiente fictive',
        acceptedAt: '2026-10-16T12:00:00.000Z',
        method: 'Oral',
      },
    ],
    ['accept', 7, {}],
  ] as const)
    expect(
      (
        await s.doctor.post(`/treatment/${s.patient.id}/plans/lifecycle`, {
          commandId: randomUUID(),
          id: s.command.id,
          revision,
          action,
          ...extra,
        })
      ).status,
    ).toBe(200);
  const start = {
    ...s.start,
    procedures: [{ ...s.selections[0], planRevision: 8 }],
  };
  expect((await s.doctor.post(s.path, start)).status).toBe(200);
  const state = (await s.doctor.browser.get(`/api${s.path}`)).body;
  expect(state.starts[0]).toMatchObject({
    acceptedRevision: 8,
    agreedMinor: '9225',
    currency: 'MRU',
    performedBy: s.doctor.id,
    acceptance: { acceptedBy: 'Patiente fictive' },
    item: {
      priceMinor: '9000',
      discountMinor: '500',
      discountReason: 'Famille',
      extras: [{ id: extraId, amountMinor: '725' }],
    },
  });
});

it('visit notes retain free text and preserve dated corrections after care ends', async () => {
  const s = await visitScenario();
  expect((await s.doctor.post(s.path, s.start)).status).toBe(200);
  const path = `/clinical/${s.patient.id}/notes/${s.start.id}`;
  await s.m.post(`/accounts/${s.doctor.id}/permissions`, {
    currentPassword: 'Fictional-manager-pass-2',
    permissions: [
      'clinical.read',
      'clinical.history',
      'notes.draft',
      'notes.finalize',
      'procedures.start',
    ],
  });
  const draft = {
    commandId: randomUUID(),
    revision: 0,
    text: '  Observation libre.\nDeuxième ligne.  ',
  };
  const saved = await s.doctor.post(`${path}/draft`, draft);
  expect(saved.status).toBe(200);
  expect(saved.body.draft.content.text).toBe(draft.text);
  expect(
    (
      await s.doctor.post(`${s.path}/actions`, {
        commandId: randomUUID(),
        id: s.start.id,
        revision: 1,
        action: 'end',
      })
    ).status,
  ).toBe(200);
  expect((await s.doctor.browser.get(`/api${path}`)).body.pending).toBe(true);
  const finalized = await s.doctor.post(`${path}/finalize`, {
    commandId: randomUUID(),
    revision: 1,
  });
  expect(finalized.status).toBe(200);
  expect(finalized.body.pending).toBe(false);
  expect(finalized.body.current.content.text).toBe(draft.text);
  expect(
    (
      await s.doctor.post(`${path}/draft`, {
        commandId: randomUUID(),
        revision: 2,
        text: 'Correction datée.',
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await s.doctor.post(`${path}/finalize`, {
        commandId: randomUUID(),
        revision: 3,
      })
    ).status,
  ).toBe(200);
  const history = (await s.doctor.browser.get(`/api${path}`)).body;
  expect(
    history.events
      .filter((e: { status: string }) => e.status === 'final')
      .map((e: { content: { text: string } }) => e.content.text),
  ).toEqual([draft.text, 'Correction datée.']);
  expect(history.current.recordedAt).toEqual(expect.any(String));
});

async function noteScenario() {
  const s = await visitScenario();
  expect((await s.doctor.post(s.path, s.start)).status).toBe(200);
  await s.m.post(`/accounts/${s.doctor.id}/permissions`, {
    currentPassword: 'Fictional-manager-pass-2',
    permissions: [
      'clinical.read',
      'clinical.history',
      'notes.draft',
      'notes.finalize',
    ],
  });
  return { ...s, notePath: `/clinical/${s.patient.id}/notes/${s.start.id}` };
}
it('note concurrency requires review, retries retain one revision and old receipts respect current history permission', async () => {
  const s = await noteScenario();
  const draft = {
    commandId: randomUUID(),
    revision: 0,
    text: 'SUPERSEDED_PRIVATE_NOTE',
  };
  const duplicate = await Promise.all([
    s.doctor.post(`${s.notePath}/draft`, draft),
    s.doctor.post(`${s.notePath}/draft`, draft),
  ]);
  expect(duplicate.map((r) => r.status)).toEqual([200, 200]);
  expect(
    (await s.doctor.browser.get(`/api${s.notePath}`)).body.events,
  ).toHaveLength(1);
  const finalize = { commandId: randomUUID(), revision: 1 };
  expect(
    (
      await s.doctor.post(`${s.notePath}/draft`, {
        ...draft,
        commandId: randomUUID(),
        text: 'Saisie concurrente',
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await s.doctor.post(`${s.notePath}/draft`, {
        ...draft,
        text: 'Commande modifiée',
      })
    ).status,
  ).toBe(409);
  expect((await s.doctor.post(`${s.notePath}/finalize`, finalize)).status).toBe(
    200,
  );
  expect(
    (
      await s.doctor.post(`${s.notePath}/draft`, {
        commandId: randomUUID(),
        revision: 2,
        text: 'Texte corrigé actuel',
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await s.doctor.post(`${s.notePath}/finalize`, {
        commandId: randomUUID(),
        revision: 3,
      })
    ).status,
  ).toBe(200);
  await s.m.post(`/accounts/${s.doctor.id}/permissions`, {
    currentPassword: 'Fictional-manager-pass-2',
    permissions: ['clinical.read', 'notes.draft', 'notes.finalize'],
  });
  for (const [action, command, revision] of [
    ['draft', draft, 1],
    ['finalize', finalize, 2],
  ] as const) {
    const replay = await s.doctor.post(`${s.notePath}/${action}`, command);
    expect(replay.status).toBe(200);
    expect(replay.body).toMatchObject({
      revision,
      current: { revision: 4, content: { text: 'Texte corrigé actuel' } },
      draft: null,
      events: [],
    });
    expect(JSON.stringify(replay.body)).not.toContain(
      'SUPERSEDED_PRIVATE_NOTE',
    );
  }
  const upperPath = `/clinical/${s.patient.id.toUpperCase()}/notes/${s.start.id.toUpperCase()}`;
  expect((await s.doctor.browser.get(`/api${upperPath}`)).body.revision).toBe(
    4,
  );
  expect(
    (
      await s.doctor.post(`${upperPath}/draft`, {
        commandId: randomUUID(),
        revision: 4,
        text: 'Même visite canonique',
      })
    ).status,
  ).toBe(200);
  expect((await s.doctor.browser.get(`/api${s.notePath}`)).body.revision).toBe(
    5,
  );
});
it('scoped staff can draft but only an authorized doctor can finalize another author’s note', async () => {
  const s = await noteScenario();
  const staff = await s.create('assistant-notes', 'staff', [
    'clinical.read',
    'notes.draft',
    'notes.finalize',
  ]);
  expect(
    (
      await s.m.post(`/patient-access/${s.patient.id}/share`, {
        commandId: randomUUID(),
        revision: 1,
        accountId: staff.id,
        kind: 'shared',
      })
    ).status,
  ).toBe(200);
  const draft = {
    commandId: randomUUID(),
    revision: 0,
    text: 'Note dictée au fauteuil',
  };
  expect((await staff.post(`${s.notePath}/draft`, draft)).status).toBe(200);
  expect(
    (
      await staff.post(`${s.notePath}/finalize`, {
        commandId: randomUUID(),
        revision: 1,
      })
    ).status,
  ).toBe(403);
  await s.m.post(`/accounts/${s.doctor.id}/permissions`, {
    currentPassword: 'Fictional-manager-pass-2',
    permissions: ['clinical.read', 'notes.finalize'],
  });
  const result = await s.doctor.post(`${s.notePath}/finalize`, {
    commandId: randomUUID(),
    revision: 1,
  });
  expect(result.status).toBe(200);
  expect(result.body.current).toMatchObject({
    authorId: staff.id,
    finalizerId: s.doctor.id,
    content: { text: draft.text },
  });
  expect((await staff.browser.get(`/api${s.notePath}`)).body.events).toEqual(
    [],
  );
  expect(
    (
      await s.doctor.post(`${s.notePath}/draft`, {
        ...draft,
        commandId: randomUUID(),
        revision: 2,
      })
    ).status,
  ).toBe(403);
  await s.m.post(`/accounts/${staff.id}/permissions`, {
    currentPassword: 'Fictional-manager-pass-2',
    permissions: ['notes.draft'],
  });
  expect((await staff.post(`${s.notePath}/draft`, draft)).status).toBe(403);
  expect((await staff.browser.get(`/api${s.notePath}`)).status).toBe(403);
});
it('note routes deny unauthenticated, unrelated, cross-clinic and revoked actors including direct retries', async () => {
  const s = await noteScenario();
  const draft = { commandId: randomUUID(), revision: 0, text: 'Confidentiel' };
  expect((await request(app).get(`/api${s.notePath}`)).status).toBe(401);
  expect((await s.m.browser.get(`/api${s.notePath}`)).status).toBe(403);
  expect((await s.m.post(`${s.notePath}/draft`, draft)).status).toBe(403);
  const stranger = await s.create('stranger-notes', 'doctor', [
    'clinical.read',
    'notes.draft',
  ]);
  expect((await stranger.post(`${s.notePath}/draft`, draft)).status).toBe(403);
  const other = await scenario();
  const otherDoctor = await other.create('other-notes', 'doctor', [
    'clinical.read',
    'notes.draft',
  ]);
  expect((await otherDoctor.browser.get(`/api${s.notePath}`)).status).toBe(403);
  expect((await otherDoctor.post(`${s.notePath}/draft`, draft)).status).toBe(
    403,
  );
  expect((await s.doctor.post(`${s.notePath}/draft`, draft)).status).toBe(200);
  expect(
    (
      await s.doctor.browser.get(
        `/api/clinical/${s.patient.id}/notes/${randomUUID()}`,
      )
    ).status,
  ).toBe(404);
  const p2 = (
    await s.m.post('/patients', {
      commandId: randomUUID(),
      name: 'Autre patient fictif',
      phone: '70000001',
      contactKind: 'patient',
      contactName: '',
    })
  ).body.patient;
  await s.m.post(`/patient-access/${p2.id}/share`, {
    commandId: randomUUID(),
    revision: 0,
    accountId: s.doctor.id,
    kind: 'shared',
  });
  expect(
    (await s.doctor.post(`/clinical/${p2.id}/notes/${s.start.id}/draft`, draft))
      .status,
  ).toBe(404);
  await s.m.post(`/patient-access/${s.patient.id}/remove`, {
    commandId: randomUUID(),
    revision: 1,
    accountId: s.doctor.id,
  });
  expect((await s.doctor.browser.get(`/api${s.notePath}`)).status).toBe(403);
  expect(
    (await s.doctor.browser.get(`/api/clinical/${s.patient.id}/notes`)).status,
  ).toBe(403);
  expect((await s.doctor.post(`${s.notePath}/draft`, draft)).status).toBe(403);
});

it('a visit created with an uppercase UUID has the same canonical note stream', async () => {
  const s = await visitScenario();
  const visitId = s.start.id.toUpperCase();
  expect(
    (await s.doctor.post(s.path, { ...s.start, id: visitId })).status,
  ).toBe(200);
  await s.m.post(`/accounts/${s.doctor.id}/permissions`, {
    currentPassword: 'Fictional-manager-pass-2',
    permissions: ['clinical.read', 'notes.draft'],
  });
  const path = `/clinical/${s.patient.id}/notes/${visitId.toLowerCase()}`;
  const saved = await s.doctor.post(`${path}/draft`, {
    commandId: randomUUID(),
    revision: 0,
    text: 'Note de la même visite',
  });
  expect(saved.status).toBe(200);
  expect(saved.body.visitId).toBe(visitId.toLowerCase());
  expect(
    (await s.doctor.browser.get(`/api/clinical/${s.patient.id}/notes`)).body[0],
  ).toMatchObject({ visitId: visitId.toLowerCase(), revision: 1 });
});
