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

it('catalog managers enable exact currencies and create priced procedures without granting clinical access', async () => {
  const { m } = await scenario();

  expect(
    (
      await m.post('/catalog/currencies', {
        commandId: randomUUID(),
        code: 'MRU',
      })
    ).status,
  ).toBe(200);

  const result = await m.post('/catalog', {
    commandId: randomUUID(),
    id: randomUUID(),
    revision: 0,
    name: 'Détartrage',
    currency: 'MRU',
    price: '1250.50',
    durationMinutes: 30,
    active: true,
  });

  expect(result.status).toBe(403);

  const own = (await m.browser.get('/api/identity')).body.accountId;

  await m.post(`/accounts/${own}/permissions`, {
    currentPassword: 'Fictional-manager-pass-2',
    permissions: ['patients.create', 'catalog.manage'],
  });

  const entry = await m.post('/catalog', {
    commandId: randomUUID(),
    id: randomUUID(),
    revision: 0,
    name: 'Détartrage',
    currency: 'MRU',
    price: '1250.50',
    durationMinutes: 30,
    active: true,
  });

  expect(entry.status).toBe(200);
  expect(entry.body.priceMinor).toBe('125050');

  expect((await m.browser.get('/api/catalog')).body.entries).toHaveLength(1);
});

it('assigned doctors create identified proposals with retained catalog prices and conflict-safe revisions', async () => {
  const { m, patient, create } = await scenario();
  const own = (await m.browser.get('/api/identity')).body.accountId;

  await m.post(`/accounts/${own}/permissions`, {
    currentPassword: 'Fictional-manager-pass-2',
    permissions: ['patients.create', 'catalog.manage'],
  });

  await m.post('/catalog/currencies', { commandId: randomUUID(), code: 'MRU' });

  const id = randomUUID();
  expect(
    (
      await m.post('/catalog', {
        commandId: randomUUID(),
        id,
        revision: 0,
        name: 'Restauration',
        currency: 'MRU',
        price: '100.00',
        durationMinutes: 45,
        active: true,
      })
    ).status,
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

  const planId = randomUUID(),
    itemId = randomUUID();
  const command = {
    commandId: randomUUID(),
    id: planId,
    revision: 0,
    title: 'Proposition de soins',
    currency: 'MRU',
    items: [
      {
        id: itemId,
        procedureId: id,
        catalogRevision: 1,
        scope: 'teeth',
        teeth: ['11', '16'],
        price: '100.00',
        discount: '0',
        discountReason: '',
      },
    ],
  };

  const saved = await doctor.post(`/treatment/${patient.id}/plans`, command);
  expect(saved.status).toBe(200);
  expect(saved.body).toMatchObject({
    id: planId,
    revision: 1,
    totalMinor: '10000',
    status: 'draft',
  });
  expect(saved.body.items[0]).toMatchObject({
    baseMinor: '10000',
    priceMinor: '10000',
    teeth: ['11', '16'],
  });

  expect(
    (await doctor.post(`/treatment/${patient.id}/plans`, command)).body.id,
  ).toBe(planId);

  await m.post('/catalog', {
    commandId: randomUUID(),
    id,
    revision: 1,
    name: 'Restauration nouvelle',
    currency: 'MRU',
    price: '120',
    durationMinutes: 60,
    active: true,
  });

  const edit = {
    ...command,
    commandId: randomUUID(),
    revision: 1,
    title: 'Titre révisé',
  };

  expect(
    (await doctor.post(`/treatment/${patient.id}/plans`, edit)).status,
  ).toBe(200);

  const read = await doctor.browser.get(`/api/treatment/${patient.id}/plans`);
  expect(read.body[0].items[0]).toMatchObject({
    name: 'Restauration',
    baseMinor: '10000',
    priceMinor: '10000',
    durationMinutes: 45,
  });

  const race = await Promise.all([
    doctor.post(`/treatment/${patient.id}/plans`, {
      ...edit,
      commandId: randomUUID(),
      revision: 2,
      title: 'A',
    }),
    doctor.post(`/treatment/${patient.id}/plans`, {
      ...edit,
      commandId: randomUUID(),
      revision: 2,
      title: 'B',
    }),
  ]);
  expect(race.map((r) => r.status).sort()).toEqual([200, 409]);
});

it('appointment-only staff receive duration suggestions without catalog prices', async () => {
  const { m, create } = await scenario();
  const own = (await m.browser.get('/api/identity')).body.accountId;
  await m.post(`/accounts/${own}/permissions`, {
    currentPassword: 'Fictional-manager-pass-2',
    permissions: ['catalog.manage'],
  });
  await m.post('/catalog/currencies', { commandId: randomUUID(), code: 'MRU' });

  const id = randomUUID();
  await m.post('/catalog', {
    commandId: randomUUID(),
    id,
    revision: 0,
    name: 'Durée utile',
    currency: 'MRU',
    price: '777',
    durationMinutes: 55,
    active: true,
  });

  const reception = await create('reception', 'staff', ['appointments.manage']);
  const result = await reception.browser.get('/api/appointments/suggestions');
  expect(result.status).toBe(200);
  expect(result.body).toEqual({
    available: true,
    suggestions: [
      { procedureId: id, label: 'Durée utile', durationMinutes: 55 },
    ],
  });
  expect((await reception.browser.get('/api/catalog')).status).toBe(403);
});

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
it('server enforces exact currency precision, manager enable and currency immutability', async () => {
  const { m, catalog, create } = await treatmentScenario();
  const staff = await create('cataloguer', 'staff', ['catalog.manage']);
  expect(
    (
      await staff.post('/catalog/currencies', {
        commandId: randomUUID(),
        code: 'JPY',
      })
    ).status,
  ).toBe(403);
  expect(
    (
      await m.post('/catalog/currencies', {
        commandId: randomUUID(),
        code: 'XXX',
      })
    ).status,
  ).toBe(400);
  const codeCommand = { commandId: randomUUID(), code: 'JPY' };
  expect((await m.post('/catalog/currencies', codeCommand)).status).toBe(200);
  expect((await m.post('/catalog/currencies', codeCommand)).status).toBe(200);
  for (const [currency, price, expected, status] of [
    ['JPY', '10.1', '', 400],
    ['JPY', '10', '10', 200],
    ['MRU', '10.005', '', 400],
    ['MRU', '999999999999999.99', '99999999999999999', 200],
    ['KWD', '10.001', '10001', 200],
  ] as const) {
    if (currency === 'KWD')
      await m.post('/catalog/currencies', {
        commandId: randomUUID(),
        code: currency,
      });
    const result = await staff.post('/catalog', {
      ...catalog,
      commandId: randomUUID(),
      id: randomUUID(),
      currency,
      price,
    });
    expect(result.status).toBe(status);
    if (status === 200) expect(result.body.priceMinor).toBe(expected);
  }
  expect(
    (
      await m.post('/catalog', {
        ...catalog,
        commandId: randomUUID(),
        revision: 1,
        currency: 'JPY',
        price: '100',
      })
    ).status,
  ).toBe(400);
});
it('price overrides and reasoned discounts require separate grants, retain exact totals and old prices', async () => {
  const { m, doctor, command, path } = await treatmentScenario();
  const override = {
    ...command,
    items: [
      {
        ...command.items[0],
        price: '90',
        discount: '5',
        discountReason: 'Remise famille',
      },
    ],
  };
  expect((await doctor.post(path, override)).status).toBe(403);
  const grant = async (permissions: string[]) =>
    m.post(`/accounts/${doctor.id}/permissions`, {
      currentPassword: 'Fictional-manager-pass-2',
      permissions: [
        'clinical.read',
        'clinical.history',
        'plans.draft',
        ...permissions,
      ],
    });
  await grant(['prices.override']);
  expect((await doctor.post(path, override)).status).toBe(403);
  await grant(['prices.override', 'discounts']);
  const saved = await doctor.post(path, override);
  expect(saved.status).toBe(200);
  expect(saved.body.totalMinor).toBe('8500');
  await grant([]);
  expect((await doctor.post(path, override)).status).toBe(403);
  const unchanged = await doctor.post(path, {
    ...override,
    commandId: randomUUID(),
    revision: 1,
    title: 'Titre seul',
  });
  expect(unchanged.status).toBe(200);
  expect(unchanged.body.totalMinor).toBe('8500');
  expect(
    (
      await doctor.post(path, {
        ...override,
        commandId: randomUUID(),
        revision: 2,
        items: [{ ...override.items[0], discount: '7' }],
      })
    ).status,
  ).toBe(403);
  await grant(['discounts']);
  expect(
    (
      await doctor.post(path, {
        ...override,
        commandId: randomUUID(),
        revision: 2,
        items: [{ ...override.items[0], discountReason: '' }],
      })
    ).status,
  ).toBe(400);
});
it('clinical patient scope and account eligibility are enforced for staff, managers, unrelated patients and clinics', async () => {
  const { m, patient, create, doctor, command, path } =
    await treatmentScenario();
  expect((await m.post(path, command)).status).toBe(403);
  expect((await m.browser.get(`/api${path}`)).status).toBe(403);
  const staff = await create('assistant', 'staff', [
    'clinical.read',
    'plans.draft',
  ]);
  expect((await staff.post(path, command)).status).toBe(403);
  await m.post(`/patient-access/${patient.id}/share`, {
    commandId: randomUUID(),
    revision: 1,
    accountId: staff.id,
    kind: 'shared',
  });
  expect((await staff.post(path, command)).status).toBe(200);
  const stranger = await create('stranger');
  expect((await stranger.browser.get(`/api${path}`)).status).toBe(403);
  const other = await treatmentScenario();
  expect((await other.doctor.browser.get(`/api${path}`)).status).toBe(403);
  expect((await other.doctor.post(path, command)).status).toBe(403);
  const remove = await m.post(`/patient-access/${patient.id}/remove`, {
    commandId: randomUUID(),
    revision: 2,
    accountId: staff.id,
  });
  expect(remove.status).toBe(200);
  expect((await staff.post(path, command)).status).toBe(403);
  expect(
    (await doctor.post(`/treatment/${randomUUID()}/plans`, command)).status,
  ).toBe(403);
});
it('FDI scope, stale catalog references, actor bound commands and single patient plan identity reject invalid writes', async () => {
  const { m, doctor, command, path, catalog } = await treatmentScenario();
  for (const item of [
    { ...command.items[0], scope: 'tooth', teeth: [] },
    { ...command.items[0], scope: 'teeth', teeth: ['11', '11'] },
    { ...command.items[0], scope: 'tooth', teeth: ['59'] },
    { ...command.items[0], scope: 'whole_mouth', teeth: ['11'] },
  ])
    expect(
      (
        await doctor.post(path, {
          ...command,
          commandId: randomUUID(),
          items: [item],
        })
      ).status,
    ).toBe(400);
  await m.post('/catalog', {
    ...catalog,
    commandId: randomUUID(),
    revision: 1,
    price: '120',
  });
  expect((await doctor.post(path, command)).status).toBe(409);
  const current = {
    ...command,
    items: [{ ...command.items[0], catalogRevision: 2, price: '120' }],
  };
  expect((await doctor.post(path, current)).status).toBe(200);
  expect(
    (await doctor.post(path, { ...current, title: 'Commande détournée' }))
      .status,
  ).toBe(409);
  const otherPatient = (
    await m.post('/patients', {
      commandId: randomUUID(),
      name: 'Autre patient fictif',
      phone: '70000001',
      contactKind: 'patient',
      contactName: '',
    })
  ).body.patient;
  await m.post(`/patient-access/${otherPatient.id}/share`, {
    commandId: randomUUID(),
    revision: 0,
    accountId: doctor.id,
    kind: 'shared',
  });
  expect(
    (
      await doctor.post(`/treatment/${otherPatient.id}/plans`, {
        ...current,
        commandId: randomUUID(),
      })
    ).status,
  ).toBe(409);
});
it('old command retries never disclose superseded proposals after losing history access', async () => {
  const { m, doctor, command, path } = await treatmentScenario();
  const original = { ...command, title: 'ANCIEN_SECRET_PROPOSITION' };
  expect((await doctor.post(path, original)).status).toBe(200);
  expect(
    (
      await doctor.post(path, {
        ...command,
        commandId: randomUUID(),
        revision: 1,
        title: 'Titre actuel',
      })
    ).status,
  ).toBe(200);
  await m.post(`/accounts/${doctor.id}/permissions`, {
    currentPassword: 'Fictional-manager-pass-2',
    permissions: ['clinical.read', 'plans.draft'],
  });
  const replay = await doctor.post(path, original);
  expect(replay.status).toBe(200);
  expect(replay.body.revision).toBe(2);
  expect(JSON.stringify(replay.body)).not.toContain(
    'ANCIEN_SECRET_PROPOSITION',
  );
  expect(replay.body.events).toEqual([]);
});
it('concurrent catalog commands preserve exactly one next revision and idempotent create makes one proposal', async () => {
  const { m, doctor, command, path, catalog } = await treatmentScenario();
  const updates = await Promise.all(
    ['101', '102'].map((price) =>
      m.post('/catalog', {
        ...catalog,
        commandId: randomUUID(),
        revision: 1,
        price,
      }),
    ),
  );
  expect(updates.map((r) => r.status).sort()).toEqual([200, 409]);
  const current = (await m.browser.get('/api/catalog')).body.entries[0];
  const newCommand = {
    ...command,
    items: [
      {
        ...command.items[0],
        catalogRevision: current.revision,
        price: current.priceMinor === '10100' ? '101' : '102',
      },
    ],
  };
  const retries = await Promise.all([
    doctor.post(path, newCommand),
    doctor.post(path, newCommand),
  ]);
  expect(retries.map((r) => r.status)).toEqual([200, 200]);
  expect((await doctor.browser.get(`/api${path}`)).body).toHaveLength(1);
});

it('doctor-managers retain intrinsic price authority but still require patient scope and separately granted catalog management', async () => {
  const { m, doctor, command, path, catalog, patient } =
    await treatmentScenario();
  expect(
    (
      await m.post(`/accounts/${doctor.id}/manager`, {
        isManager: true,
        currentPassword: 'Fictional-manager-pass-2',
      })
    ).status,
  ).toBe(200);
  expect((await doctor.signIn('Fictional-employee-pass-2')).body.stage).toBe(
    'email',
  );
  await doctor.post('/onboarding/email', {
    email: `doctor-${m.code}@example.invalid`,
  });
  const batch = await doctor.post('/onboarding/verify-email', { token });
  await doctor.post('/onboarding/codes-saved', {
    batchId: batch.body.batchId,
    saved: true,
  });
  const priced = {
    ...command,
    items: [
      {
        ...command.items[0],
        price: '80',
        discount: '5',
        discountReason: 'Décision responsable',
      },
    ],
  };
  const saved = await doctor.post(path, priced);
  expect(saved.status).toBe(200);
  expect(saved.body.totalMinor).toBe('7500');
  expect(
    (
      await doctor.post('/catalog', {
        ...catalog,
        commandId: randomUUID(),
        revision: 1,
        price: '200',
      })
    ).status,
  ).toBe(403);
  await m.post(`/patient-access/${patient.id}/remove`, {
    commandId: randomUUID(),
    revision: 1,
    accountId: doctor.id,
  });
  expect((await doctor.post(path, priced)).status).toBe(403);
  expect((await doctor.browser.get(`/api${path}`)).status).toBe(403);
});
