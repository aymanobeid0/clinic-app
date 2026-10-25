import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";

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

it("doctor reversal checks foreign available and refunded funding descendants beyond scoped history", async () => {
  const s = await mixedCorrectionScenario();
  await s.m.post(`/accounts/${s.doctor.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: ["billing.read", "reversals"],
  });
  const receipt = await s.m.post(s.base + "/settlements", {
    commandId: randomUUID(),
    currency: "MRU",
    methodId: s.methodId,
    newMoney: "100",
    deposit: "0",
    allocations: [{ chargeId: s.own.id, newMoney: "100", credit: "0" }],
  });
  expect(receipt.status).toBe(200);
  expect(
    (
      await s.m.post(s.base + "/allocation-releases", {
        commandId: randomUUID(),
        settlementId: receipt.body.id,
        chargeId: s.own.id,
        amount: "100",
        reason: "Move",
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await s.m.post(s.base + "/settlements", {
        commandId: randomUUID(),
        currency: "MRU",
        methodId: null,
        newMoney: "0",
        deposit: "0",
        allocations: [{ chargeId: s.foreign.id, newMoney: "0", credit: "100" }],
      })
    ).status,
  ).toBe(200);
  const credit = await s.m.post(s.base + "/credits", {
    commandId: randomUUID(),
    chargeId: s.foreign.id,
    revision: 0,
    finalCharge: "0",
    reason: "Foreign care correction",
  });
  expect(credit.status).toBe(200);
  const command = {
    commandId: randomUUID(),
    settlementId: receipt.body.id,
    reason: "Mistaken payment",
  };
  expect((await s.doctor.post(s.base + "/reversals", command)).status).toBe(
    403,
  );
  const proposed = await s.other.post(s.base + "/refund-requests", {
    commandId: randomUUID(),
    sourceId: credit.body.credits[0].id,
    amount: "100",
    reason: "Return own care funds",
  });
  expect(proposed.status).toBe(200);
  expect(
    (
      await s.other.post(s.base + "/refund-approvals", {
        commandId: randomUUID(),
        requestId: proposed.body.id,
        reason: "Concerned doctor",
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await s.other.post(s.base + "/refunds", {
        commandId: randomUUID(),
        requestId: proposed.body.id,
        reason: "Returned",
      })
    ).status,
  ).toBe(200);
  expect((await s.doctor.post(s.base + "/reversals", command)).status).toBe(
    409,
  );
  expect((await s.m.browser.get("/api" + s.base)).body.totals[0]).toMatchObject(
    { dueMinor: "10000", creditMinor: "0" },
  );
});

it("fully released own payment reversal retains own history and identical retry", async () => {
  const s = await completedBillingScenario();
  await s.m.post(`/accounts/${s.doctor.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: ["billing.read", "reversals"],
  });
  for (const ch of s.charges)
    expect(
      (
        await s.m.post(s.base + "/allocation-releases", {
          commandId: randomUUID(),
          settlementId: s.receipt.body.id,
          chargeId: ch.id,
          amount: "100",
          reason: "Release",
        })
      ).status,
    ).toBe(200);
  const command = {
    commandId: randomUUID(),
    settlementId: s.receipt.body.id,
    reason: "Error",
  };
  const reversed = await s.doctor.post(s.base + "/reversals", command);
  expect(reversed.status).toBe(200);
  expect((await s.doctor.post(s.base + "/reversals", command)).body).toEqual(
    reversed.body,
  );
  expect(
    (await s.doctor.browser.get("/api" + s.base)).body.corrections,
  ).toContainEqual(reversed.body);
});

it("own credit from mixed-performer cancellation supports concerned-doctor refund request retry and approval", async () => {
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
      await s.m.post(`/accounts/${s.doctor.id}/manager`, {
        isManager: true,
        currentPassword: "Fictional-manager-pass-2",
      })
    ).status,
  ).toBe(200);
  expect((await s.doctor.signIn("Fictional-employee-pass-2")).status).toBe(200);
  await s.doctor.post("/onboarding/email", {
    email: `correction-${s.m.code}@example.invalid`,
  });
  const verified = await s.doctor.post("/onboarding/verify-email", { token });
  expect(
    (
      await s.doctor.post("/onboarding/codes-saved", {
        saved: true,
        batchId: verified.body.batchId,
      })
    ).status,
  ).toBe(204);
  const cancelled = await s.doctor.post(s.base + "/cancel-plan", {
    commandId: randomUUID(),
    planId: s.command.id,
    revision: 5,
    charges: s.charges.map((ch) => ({
      chargeId: ch.id,
      revision: 0,
      finalCharge: "60",
    })),
    reason: "Explicit partial final charges",
  });
  expect(cancelled.status).toBe(200);
  const own = (await s.other.browser.get("/api" + s.base)).body;
  expect(own.corrections).toEqual([]);
  expect(own.creditSources).toHaveLength(1);
  const command = {
    commandId: randomUUID(),
    sourceId: own.creditSources[0].id,
    amount: "40",
    reason: "Own performed work",
  };
  const proposed = await s.other.post(s.base + "/refund-requests", command);
  expect(proposed.status).toBe(200);
  expect(
    (await s.other.post(s.base + "/refund-requests", command)).body,
  ).toEqual(proposed.body);
  expect(
    (
      await s.other.post(s.base + "/refund-approvals", {
        commandId: randomUUID(),
        requestId: proposed.body.id,
        reason: "Concerned approval",
      })
    ).status,
  ).toBe(200);
});

it("explicit credit survives routine clinical completion and remains invoice eligible", async () => {
  const s = await visitScenario();
  expect((await s.doctor.post(s.path, s.start)).status).toBe(200);
  const base = "/billing/" + s.patient.id;
  const charges = (await s.m.browser.get("/api" + base)).body.charges as {
    id: string;
    itemId: string;
  }[];
  expect(
    (
      await s.m.post(base + "/credits", {
        commandId: randomUUID(),
        chargeId: charges[0]!.id,
        revision: 0,
        finalCharge: "60",
        reason: "Credit before completion",
      })
    ).status,
  ).toBe(200);
  for (const [i, p] of s.selections.entries())
    expect(
      (
        await s.doctor.post(s.path + "/actions", {
          commandId: randomUUID(),
          id: s.start.id,
          revision: i + 1,
          action: "complete",
          planId: p.planId,
          itemId: p.itemId,
        })
      ).status,
    ).toBe(200);
  const state = (await s.m.browser.get("/api" + base)).body;
  expect(
    state.charges.find((ch: { id: string }) => ch.id === charges[0]!.id),
  ).toMatchObject({ chargedMinor: "6000", reconciliationRequired: false });
  const methodId = randomUUID();
  await s.m.post("/billing/payment-methods", {
    commandId: randomUUID(),
    id: methodId,
    revision: 0,
    name: "Cash",
    active: true,
  });
  expect(
    (
      await s.m.post(base + "/settlements", {
        commandId: randomUUID(),
        currency: "MRU",
        methodId,
        newMoney: "60",
        deposit: "0",
        allocations: [
          { chargeId: charges[0]!.id, newMoney: "60", credit: "0" },
        ],
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await s.m.post(base + "/invoices", {
        commandId: randomUUID(),
        chargeIds: [charges[0]!.id],
      })
    ).status,
  ).toBe(200);
});

it("aggregate final charges preserve the accepted base-plus-extras range without narrowing", async () => {
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
    ],
  });
  const item = {
    ...s.command.items[0]!,
    price: "999999999999999.999",
    extras: Array.from({ length: 50 }, () => ({
      id: randomUUID(),
      label: "Extra",
      amount: "999999999999999.999",
    })),
  };
  expect(
    (await s.doctor.post(s.path, { ...s.command, items: [item] })).status,
  ).toBe(200);
  for (const [action, revision, extra] of [
    ["present", 1, {}],
    [
      "evidence",
      2,
      {
        acceptedBy: "Fictional patient",
        acceptedAt: "2026-10-16T12:00:00.000Z",
        method: "Oral",
      },
    ],
    ["accept", 3, {}],
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
  expect(
    (
      await s.doctor.post(`/treatment/${s.patient.id}/visits`, {
        commandId: randomUUID(),
        id: randomUUID(),
        appointmentId: null,
        procedures: [
          { planId: s.command.id, itemId: item.id, planRevision: 4 },
        ],
      })
    ).status,
  ).toBe(200);
  const base = "/billing/" + s.patient.id;
  const charge = (await s.m.browser.get("/api" + base)).body.charges[0];
  const corrected = await s.m.post(base + "/credits", {
    commandId: randomUUID(),
    chargeId: charge.id,
    revision: 0,
    finalCharge: "50000000000000000.000",
    reason: "Exact aggregate final charge",
  });
  expect(corrected.status).toBe(200);
  expect((await s.m.browser.get("/api" + base)).body.charges[0]).toMatchObject({
    originalMinor: "50999999999999999949",
    chargedMinor: "50000000000000000000",
    dueMinor: "50000000000000000000",
  });
  await s.m.post(`/accounts/${s.doctor.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: ["clinical.read", "plans.finalize", "discounts"],
  });
  expect(
    (
      await s.doctor.post(base + "/cancel-plan", {
        commandId: randomUUID(),
        planId: s.command.id,
        revision: 5,
        charges: [
          {
            chargeId: charge.id,
            revision: 1,
            finalCharge: "49000000000000000.000",
          },
        ],
        reason: "Exact aggregate cancellation",
      })
    ).status,
  ).toBe(200);
  expect(
    (await s.m.browser.get("/api" + base)).body.charges[0].chargedMinor,
  ).toBe("49000000000000000000");
});

it("refund execution and credit reuse compete for the same funds atomically", async () => {
  const s = await completedBillingScenario();
  const release = await s.m.post(s.base + "/allocation-releases", {
    commandId: randomUUID(),
    settlementId: s.receipt.body.id,
    chargeId: s.charges[0]!.id,
    amount: "40",
    reason: "Reallocation",
  });
  const proposed = await s.m.post(s.base + "/refund-requests", {
    commandId: randomUUID(),
    sourceId: release.body.credits[0].id,
    amount: "40",
    reason: "Return",
  });
  expect(
    (
      await s.m.post(s.base + "/refund-approvals", {
        commandId: randomUUID(),
        requestId: proposed.body.id,
        reason: "Approved",
      })
    ).status,
  ).toBe(200);
  const results = await Promise.all([
    s.m.post(s.base + "/refunds", {
      commandId: randomUUID(),
      requestId: proposed.body.id,
      reason: "Returned",
    }),
    s.m.post(s.base + "/settlements", {
      commandId: randomUUID(),
      currency: "MRU",
      methodId: null,
      newMoney: "0",
      deposit: "0",
      allocations: [
        { chargeId: s.charges[0]!.id, newMoney: "0", credit: "40" },
      ],
    }),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  const after = (await s.m.browser.get("/api" + s.base)).body;
  expect(after.totals[0].creditMinor).toBe("0");
  expect(after.totals[0].dueMinor).toBe(
    results[0]!.status === 200 ? "4000" : "0",
  );
});
it("correction capabilities, own-work approval, current access and clinic/patient boundaries are enforced", async () => {
  const s = await completedBillingScenario();
  const command = {
    commandId: randomUUID(),
    chargeId: s.charges[0]!.id,
    revision: 0,
    finalCharge: "60",
    reason: "Correction",
  };
  expect((await s.doctor.post(s.base + "/credits", command)).status).toBe(403);
  await s.m.post(`/accounts/${s.doctor.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: ["billing.read", "discounts", "refunds", "reversals"],
  });
  const credit = await s.doctor.post(s.base + "/credits", command);
  expect(credit.status).toBe(200);
  const sourceId = credit.body.credits[0].id;
  const other = await s.create("other-refund-doctor", "doctor", [
    "clinical.read",
    "billing.read",
    "discounts",
    "refunds",
    "reversals",
  ]);
  await s.m.post(`/patient-access/${s.patient.id}/share`, {
    commandId: randomUUID(),
    revision: 1,
    accountId: other.id,
    kind: "shared",
  });
  expect(
    (
      await other.post(s.base + "/credits", {
        ...command,
        commandId: randomUUID(),
        revision: 1,
      })
    ).status,
  ).toBe(404);
  expect(
    (
      await other.post(s.base + "/refund-requests", {
        commandId: randomUUID(),
        sourceId,
        amount: "40",
        reason: "Non autorisé",
      })
    ).status,
  ).toBe(404);
  const request = await s.doctor.post(s.base + "/refund-requests", {
    commandId: randomUUID(),
    sourceId,
    amount: "40",
    reason: "Retour",
  });
  const action = {
    commandId: randomUUID(),
    requestId: request.body.id,
    reason: "Approbation propre travail",
  };
  expect((await other.post(s.base + "/refund-approvals", action)).status).toBe(
    404,
  );
  expect(
    (await s.doctor.post(s.base + "/refund-approvals", action)).status,
  ).toBe(200);
  const staff = await s.create("restricted-corrections", "staff", [
    "billing.read",
    "refunds",
  ]);
  const restricted = (await staff.browser.get("/api" + s.base)).body;
  expect(restricted.charges[0]).not.toHaveProperty("name");
  expect(restricted.charges[0]).not.toHaveProperty("teeth");
  expect(
    (
      await staff.post(s.base + "/credits", {
        ...command,
        commandId: randomUUID(),
        revision: 1,
      })
    ).status,
  ).toBe(403);
  const foreign = await manager();
  expect((await foreign.post(s.base + "/credits", command)).status).toBe(404);
  const secondPatient = (
    await s.m.post("/patients", {
      commandId: randomUUID(),
      name: "Autre patient fictif",
      phone: "70000001",
      contactKind: "patient",
      contactName: "",
    })
  ).body.patient;
  expect(
    (
      await s.m.post("/billing/" + secondPatient.id + "/credits", {
        ...command,
        commandId: randomUUID(),
      })
    ).status,
  ).toBe(404);
  expect(
    (await staff.browser.post("/api" + s.base + "/refunds").send(action))
      .status,
  ).toBe(403);
  expect(
    (
      await s.m.post(s.base + "/credits", {
        ...command,
        commandId: randomUUID(),
        reason: " ",
      })
    ).status,
  ).toBe(400);
  await s.m.post(`/accounts/${s.doctor.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: ["billing.read"],
  });
  expect((await s.doctor.post(s.base + "/credits", command)).status).toBe(403);
  expect(
    (await s.doctor.post(s.base + "/refund-approvals", action)).status,
  ).toBe(403);
  await s.m.post(`/accounts/${s.doctor.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: ["billing.read", "discounts", "refunds"],
  });
  expect(
    (
      await s.m.post(`/patient-access/${s.patient.id}/remove`, {
        commandId: randomUUID(),
        revision: 2,
        accountId: s.doctor.id,
      })
    ).status,
  ).toBe(200);
  expect((await s.doctor.post(s.base + "/credits", command)).status).toBe(403);
  expect(
    (await s.doctor.post(s.base + "/refund-approvals", action)).status,
  ).toBe(403);
});
it("unassigned deposits need manager approval and competing refunds cannot overspend", async () => {
  const s = await completedBillingScenario();
  const deposited = await s.m.post(s.base + "/settlements", {
    commandId: randomUUID(),
    currency: "MRU",
    methodId: s.receipt.body.methodId,
    newMoney: "40",
    deposit: "40",
    allocations: [],
  });
  expect(deposited.status).toBe(200);
  const staff = await s.create("deposit-staff", "staff", ["refunds"]);
  const requests = await Promise.all(
    [1, 2].map(() =>
      staff.post(s.base + "/refund-requests", {
        commandId: randomUUID(),
        sourceId: deposited.body.id,
        amount: "40",
        reason: "Retour dépôt",
      }),
    ),
  );
  expect(requests.map((r) => r.status)).toEqual([200, 200]);
  await s.m.post(`/accounts/${s.doctor.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: ["refunds", "billing.read"],
  });
  expect(
    (
      await s.doctor.post(s.base + "/refund-approvals", {
        commandId: randomUUID(),
        requestId: requests[0]!.body.id,
        reason: "Dépôt sans attribution",
      })
    ).status,
  ).toBe(404);
  for (const r of requests)
    expect(
      (
        await s.m.post(s.base + "/refund-approvals", {
          commandId: randomUUID(),
          requestId: r.body.id,
          reason: "Responsable",
        })
      ).status,
    ).toBe(200);
  const refunded = await Promise.all(
    requests.map((r) =>
      staff.post(s.base + "/refunds", {
        commandId: randomUUID(),
        requestId: r.body.id,
        reason: "Fonds rendus",
      }),
    ),
  );
  expect(refunded.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(
    (await s.m.browser.get("/api" + s.base)).body.totals[0].creditMinor,
  ).toBe("0");
  expect(
    (
      await s.m.post(s.base + "/refund-requests", {
        commandId: randomUUID(),
        sourceId: deposited.body.id,
        amount: "1",
        reason: "Épuisé",
      })
    ).status,
  ).toBe(409);
});
it("corrections keep exact KWD precision and reject stale competing credits", async () => {
  const s = await completedBillingScenario("KWD");
  const command = {
    commandId: randomUUID(),
    chargeId: s.charges[0]!.id,
    revision: 0,
    finalCharge: "60.001",
    reason: "Prix exact",
  };
  expect(
    (
      await s.m.post(s.base + "/credits", {
        ...command,
        finalCharge: "60.0001",
      })
    ).status,
  ).toBe(400);
  const results = await Promise.all([
    s.m.post(s.base + "/credits", command),
    s.m.post(s.base + "/credits", { ...command, commandId: randomUUID() }),
  ]);
  expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
  const state = (await s.m.browser.get("/api" + s.base)).body;
  expect(state.totals[0]).toMatchObject({
    currency: "KWD",
    dueMinor: "0",
    creditMinor: "39999",
  });
  expect(
    state.charges.find((ch: { id: string }) => ch.id === command.chargeId)
      .chargedMinor,
  ).toBe("60001");
  const credit = results.find((r) => r.status === 200)!.body;
  expect(
    (
      await s.m.post(s.base + "/refund-requests", {
        commandId: randomUUID(),
        sourceId: credit.credits[0].id,
        amount: "39.9991",
        reason: "Précision",
      })
    ).status,
  ).toBe(400);
  expect(
    (await s.m.post(s.base + "/credits", { ...command, finalCharge: "50" }))
      .status,
  ).toBe(409);
  const request = await s.m.post(s.base + "/refund-requests", {
    commandId: randomUUID(),
    sourceId: credit.credits[0].id,
    amount: "39.999",
    reason: "Exact",
  });
  const action = {
    commandId: randomUUID(),
    requestId: request.body.id,
    reason: "Exact approuvé",
  };
  expect((await s.m.post(s.base + "/refund-approvals", action)).status).toBe(
    200,
  );
  expect(
    (
      await s.m.post(s.base + "/refunds", {
        ...action,
        commandId: randomUUID(),
      })
    ).body.amountMinor,
  ).toBe("39999");
});
it("late correction persistence failure rolls back charge, releases and command so identical retry succeeds", async () => {
  const s = await completedBillingScenario();
  const command = {
    commandId: randomUUID(),
    chargeId: s.charges[0]!.id,
    revision: 0,
    finalCharge: "50",
    reason: "Correction atomique",
  };
  const fn = "correction_fail_" + randomUUID().replaceAll("-", "");
  await owner.pool.query(
    `CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.receipt->>'patientId' = '${s.patient.id}' THEN RAISE EXCEPTION 'fictional correction commit failure'; END IF; RETURN NEW; END $$`,
  );
  await owner.pool.query(
    `CREATE TRIGGER ${fn} BEFORE INSERT ON "BillingCommand" FOR EACH ROW EXECUTE FUNCTION ${fn}()`,
  );
  try {
    expect((await s.m.post(s.base + "/credits", command)).status).toBe(500);
    const state = (await s.m.browser.get("/api" + s.base)).body;
    expect(state.corrections).toEqual([]);
    expect(state.totals[0]).toMatchObject({ creditMinor: "0", dueMinor: "0" });
    expect(
      state.charges.find((ch: { id: string }) => ch.id === command.chargeId),
    ).toMatchObject({ chargedMinor: "10000", paidMinor: "10000", revision: 0 });
  } finally {
    await owner.pool.query(`DROP TRIGGER ${fn} ON "BillingCommand"`);
    await owner.pool.query(`DROP FUNCTION ${fn}()`);
  }
  expect((await s.m.post(s.base + "/credits", command)).status).toBe(200);
});
it("refunds need explicit approval, return only available credit once, and retain approval evidence", async () => {
  const s = await completedBillingScenario();
  const credit = await s.m.post(s.base + "/credits", {
    commandId: randomUUID(),
    chargeId: s.charges[0]!.id,
    revision: 0,
    finalCharge: "60",
    reason: "Correction",
  });
  const staff = await s.create("refund-staff", "staff", [
    "refunds",
    "billing.read",
  ]);
  const requestCommand = {
    commandId: randomUUID(),
    sourceId: credit.body.credits[0].id,
    amount: "40",
    reason: "Retour demandé",
  };
  const proposed = await staff.post(
    s.base + "/refund-requests",
    requestCommand,
  );
  expect(proposed.status).toBe(200);
  const action = {
    commandId: randomUUID(),
    requestId: proposed.body.id,
    reason: "Retour validé",
  };
  expect((await staff.post(s.base + "/refunds", action)).status).toBe(409);
  expect((await staff.post(s.base + "/refund-approvals", action)).status).toBe(
    403,
  );
  const approval = await s.m.post(s.base + "/refund-approvals", action);
  expect(approval.status).toBe(200);
  const execute = { ...action, commandId: randomUUID() };
  const results = await Promise.all([
    staff.post(s.base + "/refunds", execute),
    staff.post(s.base + "/refunds", execute),
  ]);
  expect(results.map((r) => r.status)).toEqual([200, 200]);
  expect(results[0]!.body).toEqual(results[1]!.body);
  expect(results[0]!.body.approvalId).toBe(approval.body.id);
  expect(
    (
      await staff.post(s.base + "/refunds", {
        ...execute,
        commandId: randomUUID(),
      })
    ).status,
  ).toBe(409);
  expect((await s.m.browser.get("/api" + s.base)).body.totals[0]).toMatchObject(
    { dueMinor: "0", creditMinor: "0" },
  );
  expect(
    (
      await s.m.post(s.base + "/reversals", {
        commandId: randomUUID(),
        settlementId: s.receipt.body.id,
        reason: "Erreur",
      })
    ).status,
  ).toBe(409);
});
it("releases preserve fund provenance through credit reuse and reversal restores debt without returning money", async () => {
  const s = await completedBillingScenario();
  const issued = await s.m.post(s.base + "/invoices", {
    commandId: randomUUID(),
    chargeIds: s.charges.map((c) => c.id),
  });
  const release = await s.m.post(s.base + "/allocation-releases", {
    commandId: randomUUID(),
    settlementId: s.receipt.body.id,
    chargeId: s.charges[0]!.id,
    amount: "40",
    reason: "Réaffectation",
  });
  expect(release.status).toBe(200);
  const state = () => s.m.browser.get("/api" + s.base);
  expect((await state()).body.totals[0]).toMatchObject({
    dueMinor: "4000",
    creditMinor: "4000",
  });
  const reused = await s.m.post(s.base + "/settlements", {
    commandId: randomUUID(),
    currency: "MRU",
    methodId: null,
    newMoney: "0",
    deposit: "0",
    allocations: [{ chargeId: s.charges[0]!.id, newMoney: "0", credit: "40" }],
  });
  expect(reused.status).toBe(200);
  expect(reused.body.receiptNumber).toBeNull();
  const releaseAgain = await s.m.post(s.base + "/allocation-releases", {
    commandId: randomUUID(),
    settlementId: reused.body.id,
    chargeId: s.charges[0]!.id,
    amount: "20",
    reason: "Nouvelle affectation",
  });
  expect(releaseAgain.status).toBe(200);
  expect((await state()).body.totals[0]).toMatchObject({
    dueMinor: "2000",
    creditMinor: "2000",
  });
  const command = {
    commandId: randomUUID(),
    settlementId: s.receipt.body.id,
    reason: "Paiement saisi par erreur",
  };
  const reversed = await Promise.all([
    s.m.post(s.base + "/reversals", command),
    s.m.post(s.base + "/reversals", command),
  ]);
  expect(reversed.map((r) => r.status)).toEqual([200, 200]);
  expect(reversed[0]!.body).toEqual(reversed[1]!.body);
  expect((await state()).body.totals[0]).toMatchObject({
    dueMinor: "20000",
    creditMinor: "0",
  });
  expect(
    (await s.m.browser.get(`/api${s.base}/settlements/${s.receipt.body.id}`))
      .body,
  ).toEqual(s.receipt.body);
  expect(
    (await s.m.browser.get(`/api${s.base}/invoices/${issued.body.id}/print`))
      .body.invoice,
  ).toEqual(issued.body);
  expect(
    (
      await s.m.post(s.base + "/reversals", {
        ...command,
        commandId: randomUUID(),
      })
    ).status,
  ).toBe(409);
});
it("partial-care cancellation requires every explicit final charge and preserves performed care without automatic refund", async () => {
  const s = await visitScenario();
  expect((await s.doctor.post(s.path, s.start)).status).toBe(200);
  const base = "/billing/" + s.patient.id;
  const before = (await s.m.browser.get("/api" + base)).body;
  const methodId = randomUUID();
  expect(
    (
      await s.m.post("/billing/payment-methods", {
        commandId: randomUUID(),
        id: methodId,
        revision: 0,
        name: "Espèces",
        active: true,
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await s.m.post(base + "/settlements", {
        commandId: randomUUID(),
        currency: "MRU",
        methodId,
        newMoney: "200",
        deposit: "0",
        allocations: before.charges.map((ch: { id: string }) => ({
          chargeId: ch.id,
          newMoney: "100",
          credit: "0",
        })),
      })
    ).status,
  ).toBe(200);
  const command = {
    commandId: randomUUID(),
    planId: s.command.id,
    revision: 5,
    reason: "Soins partiels arrêtés",
    charges: before.charges.map((ch: { id: string }) => ({
      chargeId: ch.id,
      revision: 0,
      finalCharge: "30",
    })),
  };
  expect((await s.m.post(base + "/cancel-plan", command)).status).toBe(403);
  await s.m.post(`/accounts/${s.doctor.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: [
      "clinical.read",
      "plans.finalize",
      "discounts",
      "billing.read",
    ],
  });
  expect(
    (
      await s.doctor.post(base + "/cancel-plan", {
        ...command,
        charges: command.charges.slice(0, 1),
      })
    ).status,
  ).toBe(409);
  const cancelled = await s.doctor.post(base + "/cancel-plan", command);
  expect(cancelled.status).toBe(200);
  expect((await s.doctor.post(base + "/cancel-plan", command)).body).toEqual(
    cancelled.body,
  );
  const after = (await s.m.browser.get("/api" + base)).body;
  expect(after.charges).toHaveLength(2);
  expect(after.totals[0]).toMatchObject({
    dueMinor: "0",
    creditMinor: "14000",
  });
  expect(
    after.corrections.filter((v: { kind: string }) => v.kind === "refund"),
  ).toEqual([]);
  const visits = (await s.doctor.browser.get("/api" + s.path)).body;
  expect(visits.starts).toHaveLength(2);
});
it("reasoned credits release paid funds without refunding or changing issued invoices", async () => {
  const s = await completedBillingScenario();
  const invoice = await s.m.post(s.base + "/invoices", {
    commandId: randomUUID(),
    chargeIds: [s.charges[0]!.id],
  });
  const command = {
    commandId: randomUUID(),
    chargeId: s.charges[0]!.id,
    revision: 0,
    finalCharge: "60",
    reason: "Correction explicite",
  };
  const result = await s.m.post(s.base + "/credits", command);
  expect(result.status).toBe(200);
  const state = (await s.m.browser.get("/api" + s.base)).body;
  expect(
    state.charges.find((c: { id: string }) => c.id === command.chargeId),
  ).toMatchObject({
    originalMinor: "10000",
    chargedMinor: "6000",
    paidMinor: "6000",
    dueMinor: "0",
  });
  expect(state.totals[0].creditMinor).toBe("4000");
  expect(result.body.invoiceIds).toEqual([invoice.body.id]);
  expect((await s.m.post(s.base + "/credits", command)).body).toEqual(
    result.body,
  );
  expect(
    (await s.m.browser.get(`/api${s.base}/invoices/${invoice.body.id}/print`))
      .body.invoice,
  ).toEqual(invoice.body);
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

async function manager(now?: number) {
  const code = `test-${randomUUID()}`.slice(0, 32);

  const email = `${code}@example.invalid`;

  await provisionClinic(
    owner,
    {
      clinicCode: code,

      clinicName: "Clinique fictive",

      username: "manager",

      displayName: "Responsable",

      email,

      temporaryPassword: "Fictional-initial-pass-1",
    },
    now,
  );

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

async function scenario(now?: number) {
  const m = await manager(now);

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

it("manager configures a payment method and records one explicit deposit receipt under concurrent retries", async () => {
  const s = await treatmentScenario();
  const method = {
    commandId: randomUUID(),
    id: randomUUID(),
    revision: 0,
    name: "Espèces",
    active: true,
  };
  expect((await s.m.post("/billing/payment-methods", method)).status).toBe(200);
  const path = `/billing/${s.patient.id}/settlements`;
  const command = {
    commandId: randomUUID(),
    currency: "MRU",
    methodId: method.id,
    newMoney: "120",
    deposit: "120",
    allocations: [],
  };
  const results = await Promise.all([
    s.m.post(path, command),
    s.m.post(path, command),
  ]);
  expect(results.map((r) => r.status)).toEqual([200, 200]);
  expect(results[0].body).toEqual(results[1].body);
  expect(results[0].body).toMatchObject({
    newMoneyMinor: "12000",
    depositMinor: "12000",
    creditUsedMinor: "0",
    methodName: "Espèces",
  });
  expect(results[0].body.receiptNumber).toMatch(/^REC-\d{4}-000001$/);
  const state = (await s.m.browser.get(`/api/billing/${s.patient.id}`)).body;
  expect(state.settlements).toHaveLength(1);
  expect(state.deposits).toEqual([
    {
      settlementId: results[0].body.id,
      currency: "MRU",
      amountMinor: "12000",
      availableMinor: "12000",
    },
  ]);
  expect(state.totals).toEqual([
    { currency: "MRU", plannedMinor: "0", dueMinor: "0", creditMinor: "12000" },
  ]);
});

it("mixed and credit-only settlements preserve old funds, reconcile excess and cannot overspend under races", async () => {
  const s = await visitScenario();
  await s.doctor.post(s.path, s.start);
  const base = `/billing/${s.patient.id}`;
  const method = {
    commandId: randomUUID(),
    id: randomUUID(),
    revision: 0,
    name: "Virement",
    active: true,
  };
  await s.m.post("/billing/payment-methods", method);
  const deposit = await s.m.post(base + "/settlements", {
    commandId: randomUUID(),
    currency: "MRU",
    methodId: method.id,
    newMoney: "120",
    deposit: "120",
    allocations: [],
  });
  const state = (await s.m.browser.get("/api" + base)).body;
  const first = state.charges[0].id,
    second = state.charges[1].id;
  const command = {
    commandId: randomUUID(),
    currency: "MRU",
    methodId: method.id,
    newMoney: "80",
    deposit: "10",
    allocations: [{ chargeId: first, newMoney: "70", credit: "30" }],
  };
  const mixed = await s.m.post(base + "/settlements", command);
  expect(mixed.status).toBe(200);
  expect(mixed.body).toMatchObject({
    newMoneyMinor: "8000",
    depositMinor: "1000",
    creditUsedMinor: "3000",
    receiptNumber: `REC-${new Date().getUTCFullYear()}-000002`,
  });
  expect(mixed.body.allocations[0].sources).toEqual([
    { settlementId: deposit.body.id, amountMinor: "3000" },
  ]);
  const credit = {
    commandId: randomUUID(),
    currency: "MRU",
    methodId: null,
    newMoney: "0",
    deposit: "0",
    allocations: [{ chargeId: second, newMoney: "0", credit: "60" }],
  };
  const race = await Promise.all([
    s.m.post(base + "/settlements", credit),
    s.m.post(base + "/settlements", { ...credit, commandId: randomUUID() }),
  ]);
  expect(race.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(race.find((r) => r.status === 200)!.body.receiptNumber).toBeNull();
  const after = (await s.m.browser.get("/api" + base)).body;
  expect(after.totals).toEqual([
    {
      currency: "MRU",
      plannedMinor: "0",
      dueMinor: "4000",
      creditMinor: "4000",
    },
  ]);
  expect(
    after.charges.find((c: { id: string }) => c.id === first),
  ).toMatchObject({
    paidMinor: "10000",
    dueMinor: "0",
    reconciliationRequired: false,
  });
  expect(
    (await s.m.post(base + "/settlements", { ...command, newMoney: "81" }))
      .status,
  ).toBe(409);
  const retained = await s.m.browser.get(
    `/api${base}/settlements/${mixed.body.id}`,
  );
  expect(retained.status).toBe(200);
  expect(retained.body).toEqual(mixed.body);
});

it("settlements enforce method revisions, exact currency, explicit excess and patient-scoped credit", async () => {
  const s = await visitScenario();
  await s.doctor.post(s.path, s.start);
  const base = `/billing/${s.patient.id}`;
  const method = {
    commandId: randomUUID(),
    id: randomUUID(),
    revision: 0,
    name: "Original",
    active: true,
  };
  expect((await s.m.post("/billing/payment-methods", method)).status).toBe(200);
  const deposit = {
    commandId: randomUUID(),
    currency: "MRU",
    methodId: method.id,
    newMoney: "150",
    deposit: "150",
    allocations: [],
  };
  const received = await s.m.post(base + "/settlements", deposit);
  expect(received.status).toBe(200);
  const changed = {
    ...method,
    commandId: randomUUID(),
    revision: 1,
    name: "Renamed",
    active: false,
  };
  expect((await s.m.post("/billing/payment-methods", changed)).status).toBe(
    200,
  );
  expect(
    (
      await s.m.post("/billing/payment-methods", {
        ...changed,
        commandId: randomUUID(),
      })
    ).status,
  ).toBe(409);
  expect(
    (
      await s.m.post(base + "/settlements", {
        ...deposit,
        commandId: randomUUID(),
      })
    ).status,
  ).toBe(400);
  expect((await s.m.post(base + "/settlements", deposit)).body).toEqual(
    received.body,
  );
  expect(
    (await s.m.browser.get("/api" + base + "/settlements/" + received.body.id))
      .body.methodName,
  ).toBe("Original");
  await s.m.post("/billing/payment-methods", {
    ...changed,
    commandId: randomUUID(),
    revision: 2,
    active: true,
  });
  const chargeId = (await s.m.browser.get("/api" + base)).body.charges[0].id;
  const pay = {
    ...deposit,
    commandId: randomUUID(),
    newMoney: "120",
    deposit: "0",
    allocations: [{ chargeId, newMoney: "100", credit: "0" }],
  };
  expect((await s.m.post(base + "/settlements", pay)).status).toBe(400);
  expect(
    (await s.m.post(base + "/settlements", { ...pay, newMoney: "100.001" }))
      .status,
  ).toBe(400);
  expect(
    (
      await s.m.post(base + "/settlements", {
        ...pay,
        newMoney: "100",
        allocations: [pay.allocations[0], pay.allocations[0]],
      })
    ).status,
  ).toBe(400);
  for (const code of ["JPY", "KWD"])
    await s.m.post("/catalog/currencies", { commandId: randomUUID(), code });
  expect(
    (
      await s.m.post(base + "/settlements", {
        ...deposit,
        commandId: randomUUID(),
        currency: "JPY",
        newMoney: "1.1",
        deposit: "1.1",
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await s.m.post(base + "/settlements", {
        ...pay,
        newMoney: "100",
        currency: "JPY",
      })
    ).status,
  ).toBe(400);
  for (const [currency, amount] of [
    ["JPY", "123"],
    ["KWD", "1.234"],
  ])
    expect(
      (
        await s.m.post(base + "/settlements", {
          ...deposit,
          commandId: randomUUID(),
          currency,
          newMoney: amount,
          deposit: amount,
        })
      ).status,
    ).toBe(200);
  const otherPatient = (
    await s.m.post("/patients", {
      commandId: randomUUID(),
      name: "Autre fictif",
      phone: "71111111",
      contactKind: "patient",
      contactName: "",
    })
  ).body.patient;
  expect(
    (
      await s.m.post(`/billing/${otherPatient.id}/settlements`, {
        ...deposit,
        commandId: randomUUID(),
        newMoney: "0",
        deposit: "0",
        methodId: null,
        allocations: [{ chargeId, newMoney: "0", credit: "100" }],
      })
    ).status,
  ).toBe(404);
  expect(
    (
      await s.m.browser.get(
        `/api/billing/${otherPatient.id}/settlements/${received.body.id}`,
      )
    ).status,
  ).toBe(404);
  expect((await s.m.browser.get("/api" + base)).body.totals).toEqual([
    { currency: "JPY", plannedMinor: "0", dueMinor: "0", creditMinor: "123" },
    { currency: "KWD", plannedMinor: "0", dueMinor: "0", creditMinor: "1234" },
    {
      currency: "MRU",
      plannedMinor: "0",
      dueMinor: "20000",
      creditMinor: "15000",
    },
  ]);
});

it("settlement authorization checks current manager, staff and doctor own-work scope including retained receipts", async () => {
  const s = await visitScenario();
  await s.doctor.post(s.path, s.start);
  const base = `/billing/${s.patient.id}`;
  const method = {
    commandId: randomUUID(),
    id: randomUUID(),
    revision: 0,
    name: "Espèces",
    active: true,
  };
  await s.m.post("/billing/payment-methods", method);
  const staff = await s.create("finance", "staff", [
    "billing.read",
    "billing.edit",
  ]);
  const other = await s.create("other", "doctor", [
    "clinical.read",
    "billing.read",
    "billing.edit",
  ]);
  const chargeId = (await s.m.browser.get("/api" + base)).body.charges[0].id;
  const pay = {
    commandId: randomUUID(),
    currency: "MRU",
    methodId: method.id,
    newMoney: "10",
    deposit: "0",
    allocations: [{ chargeId, newMoney: "10", credit: "0" }],
  };
  expect((await request(app).get("/api" + base)).status).toBe(401);
  expect((await staff.post("/billing/payment-methods", method)).status).toBe(
    403,
  );
  expect((await s.doctor.post(base + "/settlements", pay)).status).toBe(403);
  await s.m.post(`/accounts/${s.doctor.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: ["billing.read", "billing.edit"],
  });
  const own = await s.doctor.post(base + "/settlements", pay);
  expect(own.status).toBe(200);
  expect(
    (await s.doctor.browser.get("/api" + base + "/settlements/" + own.body.id))
      .body,
  ).toEqual(own.body);
  expect((await other.post(base + "/settlements", pay)).status).toBe(403);
  await s.m.post(`/patient-access/${s.patient.id}/share`, {
    commandId: randomUUID(),
    revision: 1,
    accountId: other.id,
    kind: "shared",
  });
  expect(
    (
      await other.post(base + "/settlements", {
        ...pay,
        commandId: randomUUID(),
      })
    ).status,
  ).toBe(404);
  expect(
    (await other.browser.get("/api" + base + "/settlements/" + own.body.id))
      .status,
  ).toBe(404);
  const deposit = {
    ...pay,
    commandId: randomUUID(),
    deposit: "10",
    allocations: [],
  };
  expect((await s.doctor.post(base + "/settlements", deposit)).status).toBe(
    403,
  );
  const recorded = await staff.post(base + "/settlements", deposit);
  expect(recorded.status).toBe(200);
  expect(
    JSON.stringify((await staff.browser.get("/api" + base)).body),
  ).not.toContain("Acte fictif");
  expect(
    (
      await s.doctor.browser.get(
        "/api" + base + "/settlements/" + recorded.body.id,
      )
    ).status,
  ).toBe(404);
  const foreign = await scenario();
  expect((await foreign.m.post(base + "/settlements", pay)).status).toBe(404);
  expect(
    (await foreign.m.browser.get("/api" + base + "/settlements/" + own.body.id))
      .status,
  ).toBe(404);
  expect(
    (await foreign.m.browser.get("/api/billing/payment-methods")).body,
  ).toEqual([]);
  await s.m.post(`/accounts/${staff.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: [],
  });
  expect((await staff.post(base + "/settlements", deposit)).status).toBe(403);
  expect(
    (
      await staff.browser.get(
        "/api" + base + "/settlements/" + recorded.body.id,
      )
    ).status,
  ).toBe(403);
  await s.m.post(`/patient-access/${s.patient.id}/remove`, {
    commandId: randomUUID(),
    revision: 2,
    accountId: s.doctor.id,
  });
  expect((await s.doctor.post(base + "/settlements", pay)).status).toBe(403);
  expect(
    (await s.doctor.browser.get("/api" + base + "/settlements/" + own.body.id))
      .status,
  ).toBe(403);
});

it("competing allocations cannot spend the same deposit on different charges and failed commits retain no funds or number", async () => {
  const s = await visitScenario();
  await s.doctor.post(s.path, s.start);
  const base = `/billing/${s.patient.id}`;
  const method = {
    commandId: randomUUID(),
    id: randomUUID(),
    revision: 0,
    name: "Espèces",
    active: true,
  };
  await s.m.post("/billing/payment-methods", method);
  const deposit = {
    commandId: randomUUID(),
    currency: "MRU",
    methodId: method.id,
    newMoney: "100",
    deposit: "100",
    allocations: [],
  };
  const fn = "settlement_fail_" + randomUUID().replaceAll("-", "");
  await owner.pool.query(
    `CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.receipt->>'patientId' = '${s.patient.id}' THEN RAISE EXCEPTION 'fictional command write failure'; END IF; RETURN NEW; END $$`,
  );
  await owner.pool.query(
    `CREATE TRIGGER ${fn} BEFORE INSERT ON "BillingCommand" FOR EACH ROW EXECUTE FUNCTION ${fn}()`,
  );
  try {
    expect((await s.m.post(base + "/settlements", deposit)).status).toBe(500);
    const failed = (await s.m.browser.get("/api" + base)).body;
    expect(failed.settlements).toEqual([]);
    expect(failed.totals[0].creditMinor).toBe("0");
  } finally {
    await owner.pool.query(`DROP TRIGGER ${fn} ON "BillingCommand"`);
    await owner.pool.query(`DROP FUNCTION ${fn}()`);
  }
  const saved = await s.m.post(base + "/settlements", deposit);
  expect(saved.status).toBe(200);
  expect(saved.body.receiptNumber).toMatch(/-000001$/);
  const charges = (await s.m.browser.get("/api" + base)).body.charges;
  const responses = await Promise.all(
    charges.map((ch: { id: string }) =>
      s.m.post(base + "/settlements", {
        commandId: randomUUID(),
        currency: "MRU",
        methodId: null,
        newMoney: "0",
        deposit: "0",
        allocations: [{ chargeId: ch.id, newMoney: "0", credit: "60" }],
      }),
    ),
  );
  expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
  expect(responses.find((r) => r.status === 409)!.body.error).toContain(
    "Crédit",
  );
  const final = (await s.m.browser.get("/api" + base)).body;
  expect(final.totals[0]).toEqual({
    currency: "MRU",
    plannedMinor: "0",
    dueMinor: "14000",
    creditMinor: "4000",
  });
  expect(final.settlements).toHaveLength(2);
});

it("retained French receipt output requires separate financial output grants and distinguishes new funds from credit", async () => {
  const s = await treatmentScenario();
  const method = {
    commandId: randomUUID(),
    id: randomUUID(),
    revision: 0,
    name: "Espèces",
    active: true,
  };
  await s.m.post("/billing/payment-methods", method);
  const base = `/billing/${s.patient.id}`;
  const saved = await s.m.post(base + "/settlements", {
    commandId: randomUUID(),
    currency: "MRU",
    methodId: method.id,
    newMoney: "12.34",
    deposit: "12.34",
    allocations: [],
  });
  const url = "/api" + base + "/settlements/" + saved.body.id + "/print";
  const staff = await s.create("printer", "staff", [
    "billing.read",
    "billing.edit",
  ]);
  expect((await staff.browser.get(url)).status).toBe(403);
  await s.m.post(`/accounts/${staff.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: ["billing.read", "financial.print"],
  });
  const output = await staff.browser.get(url);
  expect(output.status).toBe(200);
  expect(output.body).toMatchObject({
    title: "Reçu",
    settlement: saved.body,
    labels: {
      newMoney: "Nouveaux fonds reçus",
      creditUsed: "Crédit antérieurement reçu utilisé",
      deposit: "Dépôt distinct",
    },
  });
  expect(
    (await staff.browser.get(url.replace("/print", "/download"))).status,
  ).toBe(403);
  expect((await s.m.browser.get(url)).body).toEqual(output.body);
  await s.m.post(`/accounts/${staff.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: ["financial.print"],
  });
  expect((await staff.browser.get(url)).status).toBe(403);
});

it("receipt numbers are clinic-wide per UTC year and retries retain the original year and identity", async () => {
  let clock = Date.UTC(2026, 11, 31, 23, 59);
  app = createApplication({ ...options, now: () => clock });
  const s = await treatmentScenario("MRU", clock);
  const method = {
    commandId: randomUUID(),
    id: randomUUID(),
    revision: 0,
    name: "Espèces",
    active: true,
  };
  await s.m.post("/billing/payment-methods", method);
  const base = `/billing/${s.patient.id}`;
  const command = {
    commandId: randomUUID(),
    currency: "MRU",
    methodId: method.id,
    newMoney: "1",
    deposit: "1",
    allocations: [],
  };
  const first = await s.m.post(base + "/settlements", command);
  expect(first.body.receiptNumber).toBe("REC-2026-000001");
  const patient = (
    await s.m.post("/patients", {
      commandId: randomUUID(),
      name: "Autre fictif",
      phone: "72222222",
      contactKind: "patient",
      contactName: "",
    })
  ).body.patient;
  const second = await s.m.post(`/billing/${patient.id}/settlements`, {
    ...command,
    commandId: randomUUID(),
  });
  expect(second.body.receiptNumber).toBe("REC-2026-000002");
  clock += 120000;
  const third = await s.m.post(base + "/settlements", {
    ...command,
    commandId: randomUUID(),
  });
  expect(third.body.receiptNumber).toBe("REC-2027-000001");
  expect((await s.m.post(base + "/settlements", command)).body).toEqual(
    first.body,
  );
});

it("a mixed-doctor settlement hides the whole receipt but preserves each doctor's own allocation projection", async () => {
  const s = await visitScenario();
  expect(
    (await s.doctor.post(s.path, { ...s.start, procedures: [s.selections[0]] }))
      .status,
  ).toBe(200);
  const other = await s.create("second-performer", "doctor", [
    "clinical.read",
    "procedures.start",
    "billing.read",
    "billing.edit",
  ]);
  await s.m.post(`/patient-access/${s.patient.id}/share`, {
    commandId: randomUUID(),
    revision: 1,
    accountId: other.id,
    kind: "shared",
  });
  expect(
    (
      await other.post(s.path, {
        ...s.start,
        id: randomUUID(),
        commandId: randomUUID(),
        procedures: [{ ...s.selections[1], planRevision: 5 }],
      })
    ).status,
  ).toBe(200);
  await s.m.post(`/accounts/${s.doctor.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: ["billing.read", "billing.edit", "financial.print"],
  });
  const base = `/billing/${s.patient.id}`;
  const method = {
    commandId: randomUUID(),
    id: randomUUID(),
    revision: 0,
    name: "Espèces",
    active: true,
  };
  await s.m.post("/billing/payment-methods", method);
  const charges = (await s.m.browser.get("/api" + base)).body.charges;
  const mixed = await s.m.post(base + "/settlements", {
    commandId: randomUUID(),
    currency: "MRU",
    methodId: method.id,
    newMoney: "100",
    deposit: "0",
    allocations: charges.map((c: { id: string }) => ({
      chargeId: c.id,
      newMoney: "50",
      credit: "0",
    })),
  });
  expect(mixed.status).toBe(200);
  for (const doctor of [s.doctor, other]) {
    const own = (await doctor.browser.get("/api" + base)).body;
    expect(own.charges).toHaveLength(1);
    expect(own.charges[0]).toMatchObject({
      performedBy: doctor.id,
      paidMinor: "5000",
      dueMinor: "5000",
      allocations: [
        {
          settlementId: mixed.body.id,
          newMoneyMinor: "5000",
          creditMinor: "0",
        },
      ],
    });
    expect(own.settlements).toEqual([]);
    expect(own.deposits).toEqual([]);
    expect(
      (
        await doctor.browser.get(
          "/api" + base + "/settlements/" + mixed.body.id,
        )
      ).status,
    ).toBe(404);
  }
  expect(
    (
      await s.doctor.browser.get(
        "/api" + base + "/settlements/" + mixed.body.id + "/print",
      )
    ).status,
  ).toBe(404);
});

it("accepted price reconciliation preserves paid funds and rejects reductions below allocations", async () => {
  const s = await visitScenario();
  await s.doctor.post(s.path, s.start);
  const base = `/billing/${s.patient.id}`;
  const method = {
    commandId: randomUUID(),
    id: randomUUID(),
    revision: 0,
    name: "Espèces",
    active: true,
  };
  await s.m.post("/billing/payment-methods", method);
  const charge = (await s.m.browser.get("/api" + base)).body.charges[0];
  const paid = await s.m.post(base + "/settlements", {
    commandId: randomUUID(),
    currency: "MRU",
    methodId: method.id,
    newMoney: "50",
    deposit: "0",
    allocations: [{ chargeId: charge.id, newMoney: "50", credit: "0" }],
  });
  expect(paid.status).toBe(200);
  await s.m.post(`/accounts/${s.doctor.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: [
      "clinical.read",
      "plans.draft",
      "plans.finalize",
      "plans.accept",
      "acceptance.draft",
      "prices.override",
      "billing.edit",
    ],
  });
  const revise = async (revision: number, price: string) => {
    const path = `/treatment/${s.patient.id}/plans`;
    expect(
      (
        await s.doctor.post(path, {
          ...s.command,
          commandId: randomUUID(),
          revision,
          items: s.selections.map((i) => ({
            ...s.command.items[0],
            id: i.itemId,
            price,
          })),
        })
      ).status,
    ).toBe(200);
    for (const [action, offset, extra] of [
      ["present", 1, {}],
      [
        "evidence",
        2,
        {
          acceptedBy: "Patient fictif",
          acceptedAt: "2026-10-16T12:00:00.000Z",
          method: "Oral",
        },
      ],
      ["accept", 3, {}],
    ] as const)
      expect(
        (
          await s.doctor.post(path + "/lifecycle", {
            commandId: randomUUID(),
            id: s.command.id,
            revision: revision + offset,
            action,
            ...extra,
          })
        ).status,
      ).toBe(200);
  };
  await revise(5, "20");
  const command = {
    commandId: randomUUID(),
    chargeId: charge.id,
    revision: 0,
    acceptedRevision: 9,
    reason: "Accord révisé",
  };
  expect((await s.m.post(base + "/reconcile", command)).status).toBe(409);
  expect(
    (await s.m.browser.get("/api" + base)).body.charges.find(
      (c: { id: string }) => c.id === charge.id,
    ),
  ).toMatchObject({
    chargedMinor: "10000",
    paidMinor: "5000",
    dueMinor: "5000",
    adjustments: [],
  });
  await revise(9, "80");
  expect(
    (
      await s.m.post(base + "/reconcile", {
        ...command,
        commandId: randomUUID(),
        acceptedRevision: 13,
      })
    ).status,
  ).toBe(200);
  expect(
    (await s.m.browser.get("/api" + base)).body.charges.find(
      (c: { id: string }) => c.id === charge.id,
    ),
  ).toMatchObject({
    chargedMinor: "8000",
    paidMinor: "5000",
    dueMinor: "3000",
    reconciliationRequired: false,
  });
  expect(
    (await s.m.browser.get("/api" + base + "/settlements/" + paid.body.id))
      .body,
  ).toEqual(paid.body);
});

it("manual invoices require completed fully paid procedures and retain one invoice under concurrent retries", async () => {
  const s = await visitScenario();
  expect((await s.doctor.post(s.path, s.start)).status).toBe(200);
  const base = `/billing/${s.patient.id}`;
  const charges = (await s.m.browser.get("/api" + base)).body.charges as {
    id: string;
    itemId: string;
  }[];
  const method = {
    commandId: randomUUID(),
    id: randomUUID(),
    revision: 0,
    name: "Espèces",
    active: true,
  };
  await s.m.post("/billing/payment-methods", method);
  const command = {
    commandId: randomUUID(),
    chargeIds: charges.map((c) => c.id),
  };
  expect((await s.m.post(base + "/invoices", command)).status).toBe(409);
  await s.m.post(base + "/settlements", {
    commandId: randomUUID(),
    currency: "MRU",
    methodId: method.id,
    newMoney: "200",
    deposit: "0",
    allocations: charges.map((c) => ({
      chargeId: c.id,
      newMoney: "100",
      credit: "0",
    })),
  });
  expect((await s.m.post(base + "/invoices", command)).status).toBe(409);
  for (const [i, selection] of s.selections.entries())
    expect(
      (
        await s.doctor.post(s.path + "/actions", {
          commandId: randomUUID(),
          id: s.start.id,
          revision: i + 1,
          action: "complete",
          planId: selection.planId,
          itemId: selection.itemId,
        })
      ).status,
    ).toBe(200);
  const issued = await Promise.all([
    s.m.post(base + "/invoices", command),
    s.m.post(base + "/invoices", command),
  ]);
  expect(issued.map((r) => r.status)).toEqual([200, 200]);
  expect(issued[1].body).toEqual(issued[0].body);
  expect(issued[0].body).toMatchObject({
    number: "INV-2026-000001",
    currency: "MRU",
    totalMinor: "20000",
    identity: {
      patientName: "Patient confidentiel fictif",
      clinicName: "Clinique fictive",
    },
  });
  expect(issued[0].body.items).toHaveLength(2);
  expect(
    (
      await s.m.post(base + "/invoices", {
        ...command,
        commandId: randomUUID(),
      })
    ).status,
  ).toBe(409);
  expect((await s.m.browser.get("/api" + base + "/invoices")).body).toEqual([
    issued[0].body,
  ]);
  expect(
    (
      await s.m.browser.get(
        "/api" + base + "/invoices/" + issued[0].body.id + "/print",
      )
    ).body.invoice,
  ).toEqual(issued[0].body);
});

it("completed-plan summaries show paid and unpaid procedures with existing document references without creating debt", async () => {
  const s = await visitScenario();
  await s.doctor.post(s.path, s.start);
  const base = `/billing/${s.patient.id}`,
    url = base + "/plans/" + s.command.id + "/summary";
  expect((await s.m.browser.get("/api" + url)).status).toBe(409);
  const charges = (await s.m.browser.get("/api" + base)).body.charges as {
    id: string;
    itemId: string;
  }[];
  for (const [i, p] of s.selections.entries())
    expect(
      (
        await s.doctor.post(s.path + "/actions", {
          commandId: randomUUID(),
          id: s.start.id,
          revision: i + 1,
          action: "complete",
          planId: p.planId,
          itemId: p.itemId,
        })
      ).status,
    ).toBe(200);
  const method = {
    commandId: randomUUID(),
    id: randomUUID(),
    revision: 0,
    name: "Espèces",
    active: true,
  };
  await s.m.post("/billing/payment-methods", method);
  const receipt = await s.m.post(base + "/settlements", {
    commandId: randomUUID(),
    currency: "MRU",
    methodId: method.id,
    newMoney: "120",
    deposit: "0",
    allocations: [
      { chargeId: charges[0]!.id, newMoney: "100", credit: "0" },
      { chargeId: charges[1]!.id, newMoney: "20", credit: "0" },
    ],
  });
  const invoice = await s.m.post(base + "/invoices", {
    commandId: randomUUID(),
    chargeIds: [charges[0]!.id],
  });
  expect(invoice.status).toBe(200);
  expect(
    (
      await s.m.post(base + "/invoices", {
        commandId: randomUUID(),
        chargeIds: [charges[1]!.id],
      })
    ).status,
  ).toBe(409);
  const before = (await s.m.browser.get("/api" + base)).body;
  const summary = await s.m.browser.get("/api" + url);
  expect(summary.status).toBe(200);
  expect(summary.body).toMatchObject({
    planId: s.command.id,
    currency: "MRU",
    chargedMinor: "20000",
    paidMinor: "12000",
    dueMinor: "8000",
    scope: "whole_plan",
  });
  expect(summary.body.procedures).toHaveLength(2);
  expect(
    summary.body.procedures.find(
      (p: { chargeId: string }) => p.chargeId === charges[0]!.id,
    ),
  ).toMatchObject({
    invoice: { id: invoice.body.id, number: invoice.body.number },
    payments: [
      {
        settlementId: receipt.body.id,
        receiptNumber: receipt.body.receiptNumber,
        amountMinor: "10000",
      },
    ],
  });
  expect((await s.m.browser.get("/api" + url + "/print")).body).toEqual({
    title: "Récapitulatif du plan terminé",
    summary: summary.body,
  });
  expect((await s.m.browser.get("/api" + base)).body).toEqual(before);
});

async function completedBillingScenario(currency = "MRU", now?: number) {
  const s = await visitScenario(currency, now);
  expect((await s.doctor.post(s.path, s.start)).status).toBe(200);
  for (const [i, p] of s.selections.entries())
    expect(
      (
        await s.doctor.post(s.path + "/actions", {
          commandId: randomUUID(),
          id: s.start.id,
          revision: i + 1,
          action: "complete",
          planId: p.planId,
          itemId: p.itemId,
        })
      ).status,
    ).toBe(200);
  const base = `/billing/${s.patient.id}`;
  const charges = (await s.m.browser.get("/api" + base)).body.charges as {
    id: string;
    itemId: string;
  }[];
  const method = {
    commandId: randomUUID(),
    id: randomUUID(),
    revision: 0,
    name: "Espèces",
    active: true,
  };
  expect((await s.m.post("/billing/payment-methods", method)).status).toBe(200);
  const receipt = await s.m.post(base + "/settlements", {
    commandId: randomUUID(),
    currency,
    methodId: method.id,
    newMoney: "200",
    deposit: "0",
    allocations: charges.map((ch) => ({
      chargeId: ch.id,
      newMoney: "100",
      credit: "0",
    })),
  });
  expect(receipt.status).toBe(200);
  return { ...s, base, charges, receipt };
}

it("issued invoices retain linked corrections on new price reconciliation while prior commands remain retryable", async () => {
  const s = await completedBillingScenario();
  const issued = await s.m.post(s.base + "/invoices", {
    commandId: randomUUID(),
    chargeIds: [s.charges[0]!.id],
  });
  expect(issued.status).toBe(200);
  await s.m.post(`/accounts/${s.doctor.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: [
      "clinical.read",
      "plans.draft",
      "plans.finalize",
      "plans.accept",
      "acceptance.draft",
      "prices.override",
    ],
  });
  const planPath = `/treatment/${s.patient.id}/plans`;
  expect(
    (
      await s.doctor.post(planPath, {
        ...s.command,
        commandId: randomUUID(),
        revision: 6,
        items: s.selections.map((p) => ({
          ...s.command.items[0]!,
          id: p.itemId,
          price: "120",
        })),
      })
    ).status,
  ).toBe(200);
  for (const [action, revision, extra] of [
    ["present", 7, {}],
    [
      "evidence",
      8,
      {
        acceptedBy: "Patient fictif",
        acceptedAt: "2026-10-16T12:00:00.000Z",
        method: "Oral",
      },
    ],
    ["accept", 9, {}],
  ] as const)
    expect(
      (
        await s.doctor.post(planPath + "/lifecycle", {
          commandId: randomUUID(),
          id: s.command.id,
          revision,
          action,
          ...extra,
        })
      ).status,
    ).toBe(200);
  const reconciliation = {
    commandId: randomUUID(),
    chargeId: s.charges[0]!.id,
    revision: 0,
    acceptedRevision: 10,
    reason: "Accord renouvelé",
  };
  const linked = await s.m.post(s.base + "/reconcile", reconciliation);
  expect(linked.status).toBe(200);
  expect(linked.body.correctionId).toBeTruthy();
  const after = (await s.m.browser.get("/api" + s.base)).body;
  expect(
    after.charges.find((c: { id: string }) => c.id === s.charges[0]!.id),
  ).toMatchObject({
    originalMinor: "10000",
    chargedMinor: "12000",
    paidMinor: "10000",
    dueMinor: "2000",
  });
  expect(
    after.corrections.find(
      (c: { id: string }) => c.id === linked.body.correctionId,
    ).invoiceIds,
  ).toEqual([issued.body.id]);
  expect(
    (await s.m.browser.get(`/api${s.base}/invoices/${issued.body.id}/print`))
      .body.invoice,
  ).toEqual(issued.body);
  const allowed = {
    ...reconciliation,
    commandId: randomUUID(),
    chargeId: s.charges[1]!.id,
  };
  const adjustment = await s.m.post(s.base + "/reconcile", allowed);
  expect(adjustment.status).toBe(200);
  expect(
    (
      await s.m.post(s.base + "/settlements", {
        commandId: randomUUID(),
        currency: "MRU",
        methodId: s.receipt.body.methodId,
        newMoney: "20",
        deposit: "0",
        allocations: [
          { chargeId: s.charges[1]!.id, newMoney: "20", credit: "0" },
        ],
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await s.m.post(s.base + "/invoices", {
        commandId: randomUUID(),
        chargeIds: [s.charges[1]!.id],
      })
    ).body.totalMinor,
  ).toBe("12000");
  expect((await s.m.post(s.base + "/reconcile", allowed)).body).toEqual(
    adjustment.body,
  );
});

it("doctors issue only own completed work and mixed invoices never expose another performer through reads, totals or outputs", async () => {
  const s = await visitScenario("MRU", undefined, 3);
  expect(
    (
      await s.doctor.post(s.path, {
        ...s.start,
        procedures: s.selections.slice(0, 2),
      })
    ).status,
  ).toBe(200);
  const other = await s.create("other-invoice-doctor", "doctor", [
    "clinical.read",
    "procedures.start",
    "procedures.complete",
    "billing.read",
    "invoices.issue",
    "financial.print",
  ]);
  await s.m.post(`/patient-access/${s.patient.id}/share`, {
    commandId: randomUUID(),
    revision: 1,
    accountId: other.id,
    kind: "shared",
  });
  const otherVisit = randomUUID();
  expect(
    (
      await other.post(s.path, {
        ...s.start,
        commandId: randomUUID(),
        id: otherVisit,
        procedures: [{ ...s.selections[2], planRevision: 5 }],
      })
    ).status,
  ).toBe(200);
  for (const [i, p] of s.selections.slice(0, 2).entries())
    expect(
      (
        await s.doctor.post(s.path + "/actions", {
          commandId: randomUUID(),
          id: s.start.id,
          revision: i + 1,
          action: "complete",
          planId: p.planId,
          itemId: p.itemId,
        })
      ).status,
    ).toBe(200);
  expect(
    (
      await other.post(s.path + "/actions", {
        commandId: randomUUID(),
        id: otherVisit,
        revision: 1,
        action: "complete",
        planId: s.command.id,
        itemId: s.selections[2]!.itemId,
      })
    ).status,
  ).toBe(200);
  await s.m.post(`/accounts/${s.doctor.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: ["billing.read", "invoices.issue", "financial.print"],
  });
  const base = `/billing/${s.patient.id}`;
  const charges = (await s.m.browser.get("/api" + base)).body.charges as {
    id: string;
    performedBy: string;
  }[];
  const own = charges.filter((c) => c.performedBy === s.doctor.id),
    foreign = charges.find((c) => c.performedBy === other.id)!;
  const method = {
    commandId: randomUUID(),
    id: randomUUID(),
    revision: 0,
    name: "Espèces",
    active: true,
  };
  await s.m.post("/billing/payment-methods", method);
  await s.m.post(base + "/settlements", {
    commandId: randomUUID(),
    currency: "MRU",
    methodId: method.id,
    newMoney: "300",
    deposit: "0",
    allocations: charges.map((c) => ({
      chargeId: c.id,
      newMoney: "100",
      credit: "0",
    })),
  });
  expect(
    (
      await s.doctor.post(base + "/invoices", {
        commandId: randomUUID(),
        chargeIds: [foreign.id],
      })
    ).status,
  ).toBe(404);
  const command = { commandId: randomUUID(), chargeIds: [own[0]!.id] };
  const issued = await s.doctor.post(base + "/invoices", command);
  expect(issued.status).toBe(200);
  const mixed = await s.m.post(base + "/invoices", {
    commandId: randomUUID(),
    chargeIds: [own[1]!.id, foreign.id],
  });
  expect(mixed.status).toBe(200);
  expect(
    (await s.doctor.browser.get("/api" + base + "/invoices")).body,
  ).toEqual([issued.body]);
  expect(
    (
      await s.doctor.browser.get(
        "/api" + base + "/invoices/" + mixed.body.id + "/print",
      )
    ).status,
  ).toBe(404);
  const summary = (
    await s.doctor.browser.get(`/api${base}/plans/${s.command.id}/summary`)
  ).body;
  expect(summary).toMatchObject({
    scope: "own_work",
    chargedMinor: "20000",
    paidMinor: "20000",
    dueMinor: "0",
  });
  expect(summary.procedures).toHaveLength(2);
  expect(
    summary.procedures.find(
      (p: { chargeId: string }) => p.chargeId === own[1]!.id,
    ).invoice,
  ).toBeNull();
  expect((await other.browser.get("/api" + base + "/invoices")).body).toEqual(
    [],
  );
  expect(
    (await other.browser.get(`/api${base}/plans/${s.command.id}/summary/print`))
      .body.summary,
  ).toMatchObject({
    scope: "own_work",
    chargedMinor: "10000",
    paidMinor: "10000",
  });
  await s.m.post(`/accounts/${s.doctor.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: [
      "billing.read",
      "invoices.issue",
      "financial.print",
      "discounts",
    ],
  });
  const correctionCommand = {
    commandId: randomUUID(),
    chargeId: own[1]!.id,
    revision: 0,
    finalCharge: "60",
    reason: "Own work correction",
  };
  const ownCredit = await s.doctor.post(base + "/credits", correctionCommand);
  expect(ownCredit.status).toBe(200);
  expect(ownCredit.body.invoiceIds).toEqual([]);
  expect(
    (await s.doctor.post(base + "/credits", correctionCommand)).body,
  ).toEqual(ownCredit.body);
  expect((await s.doctor.browser.get("/api" + base)).body.corrections).toEqual([
    ownCredit.body,
  ]);
  expect(
    (await s.m.browser.get("/api" + base)).body.corrections[0].invoiceIds,
  ).toEqual([mixed.body.id]);
  expect((await other.browser.get("/api" + base)).body.corrections).toEqual([]);
  expect(
    (
      await s.m.post(`/patient-access/${s.patient.id}/remove`, {
        commandId: randomUUID(),
        revision: 2,
        accountId: s.doctor.id,
      })
    ).status,
  ).toBe(200);
  expect((await s.doctor.post(base + "/invoices", command)).status).toBe(403);
  expect(
    (
      await s.doctor.browser.get(
        "/api" + base + "/invoices/" + issued.body.id + "/print",
      )
    ).status,
  ).toBe(403);
  expect(
    (await s.doctor.browser.get(`/api${base}/plans/${s.command.id}/summary`))
      .status,
  ).toBe(403);
});

it("invoice issue, reads, replays and summary outputs enforce current staff, patient and clinic authorization", async () => {
  const s = await completedBillingScenario();
  const command = {
    commandId: randomUUID(),
    chargeIds: s.charges.map((ch) => ch.id),
  };
  const staff = await s.create("invoice-staff", "staff", [
    "billing.read",
    "billing.edit",
    "financial.print",
  ]);
  expect((await staff.post(s.base + "/invoices", command)).status).toBe(403);
  await s.m.post(`/accounts/${staff.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: ["invoices.issue", "billing.read"],
  });
  const issued = await staff.post(s.base + "/invoices", command);
  expect(issued.status).toBe(200);
  const eligible = (await staff.browser.get("/api" + s.base)).body.charges;
  expect(eligible[0].completedAt).toMatch(/^2026-/);
  expect(eligible[0]).not.toHaveProperty("name");
  expect(issued.body.items[0]).not.toHaveProperty("name");
  expect(issued.body.items[0]).not.toHaveProperty("teeth");
  const url = s.base + "/invoices/" + issued.body.id;
  const summary = s.base + "/plans/" + s.command.id + "/summary";
  expect((await staff.browser.get("/api" + url + "/print")).status).toBe(403);
  expect((await staff.browser.get("/api" + summary + "/print")).status).toBe(
    403,
  );
  await s.m.post(`/accounts/${staff.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: ["invoices.issue", "billing.read", "financial.print"],
  });
  expect(
    (await staff.browser.get("/api" + url + "/print")).body.invoice,
  ).toEqual(issued.body);
  const restricted = (await staff.browser.get("/api" + summary + "/print")).body
    .summary;
  expect(restricted).not.toHaveProperty("title");
  expect(restricted.procedures[0]).not.toHaveProperty("name");
  expect((await staff.browser.get("/api" + url + "/download")).status).toBe(
    403,
  );
  expect((await staff.browser.get("/api" + summary + "/download")).status).toBe(
    403,
  );
  const full = (await s.m.browser.get("/api" + url)).body;
  expect(full.items[0].name).toBe("Acte fictif");
  expect(full).not.toHaveProperty("allocations");
  expect(full.items[0]).not.toHaveProperty("payments");
  expect(full.items[0]).not.toHaveProperty("creditMinor");
  const otherPatient = (
    await s.m.post("/patients", {
      commandId: randomUUID(),
      name: "Autre fictif",
      phone: "73333333",
      contactKind: "patient",
      contactName: "",
    })
  ).body.patient;
  expect(
    (
      await s.m.browser.get(
        `/api/billing/${otherPatient.id}/invoices/${full.id}`,
      )
    ).status,
  ).toBe(404);
  expect(
    (
      await s.m.post(`/billing/${otherPatient.id}/invoices`, {
        commandId: randomUUID(),
        chargeIds: command.chargeIds,
      })
    ).status,
  ).toBe(404);
  expect(
    (
      await s.m.browser.get(
        `/api/billing/${otherPatient.id}/plans/${s.command.id}/summary`,
      )
    ).status,
  ).toBe(404);
  const foreign = await manager();
  expect((await foreign.browser.get("/api" + url)).status).toBe(404);
  expect((await foreign.browser.get("/api" + summary)).status).toBe(404);
  expect((await foreign.post(s.base + "/invoices", command)).status).toBe(404);
  expect((await request(app).get("/api" + url)).status).toBe(401);
  expect(
    (await staff.browser.post("/api" + s.base + "/invoices").send(command))
      .status,
  ).toBe(403);
  expect(
    (
      await staff.post(s.base + "/invoices", {
        ...command,
        chargeIds: [command.chargeIds[0]],
      })
    ).status,
  ).toBe(409);
  await s.m.post(`/accounts/${staff.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: ["billing.read"],
  });
  expect((await staff.post(s.base + "/invoices", command)).status).toBe(403);
  await s.m.post(`/accounts/${staff.id}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: ["financial.print"],
  });
  expect((await staff.browser.get("/api" + url + "/print")).status).toBe(403);
  expect((await staff.browser.get("/api" + summary)).status).toBe(403);
});

it("invoice failures roll back the document, number and charge reservation; overlapping new commands issue once", async () => {
  const s = await completedBillingScenario();
  const command = {
    commandId: randomUUID(),
    chargeIds: s.charges.map((ch) => ch.id),
  };
  const before = (await s.m.browser.get("/api" + s.base)).body;
  const fn = "invoice_fail_" + randomUUID().replaceAll("-", "");
  await owner.pool.query(
    `CREATE FUNCTION ${fn}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.receipt->>'patientId' = '${s.patient.id}' THEN RAISE EXCEPTION 'fictional invoice commit failure'; END IF; RETURN NEW; END $$`,
  );
  await owner.pool.query(
    `CREATE TRIGGER ${fn} BEFORE INSERT ON "BillingCommand" FOR EACH ROW EXECUTE FUNCTION ${fn}()`,
  );
  try {
    expect((await s.m.post(s.base + "/invoices", command)).status).toBe(500);
    expect((await s.m.browser.get("/api" + s.base + "/invoices")).body).toEqual(
      [],
    );
    expect((await s.m.browser.get("/api" + s.base)).body).toEqual(before);
  } finally {
    await owner.pool.query(`DROP TRIGGER ${fn} ON "BillingCommand"`);
    await owner.pool.query(`DROP FUNCTION ${fn}()`);
  }
  const responses = await Promise.all([
    s.m.post(s.base + "/invoices", command),
    s.m.post(s.base + "/invoices", { ...command, commandId: randomUUID() }),
  ]);
  expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
  const invoice = responses.find((r) => r.status === 200)!.body;
  expect(invoice.number).toBe("INV-2026-000001");
  expect((await s.m.browser.get("/api" + s.base + "/invoices")).body).toEqual([
    invoice,
  ]);
  expect((await s.m.browser.get("/api" + s.base)).body).toEqual(before);
});

async function additionalCompletedPlan(
  s: Awaited<ReturnType<typeof completedBillingScenario>>,
  currency: string,
  price: string,
) {
  expect(
    (
      await s.m.post("/catalog/currencies", {
        commandId: randomUUID(),
        code: currency,
      })
    ).status,
  ).toBe(200);
  const procedureId = randomUUID();
  expect(
    (
      await s.m.post("/catalog", {
        commandId: randomUUID(),
        id: procedureId,
        revision: 0,
        name: "Autre acte fictif",
        currency,
        price,
        durationMinutes: 30,
        active: true,
      })
    ).status,
  ).toBe(200);
  const plan = {
    ...s.command,
    commandId: randomUUID(),
    id: randomUUID(),
    currency,
    items: [{ ...s.command.items[0]!, id: randomUUID(), procedureId, price }],
  };
  const path = `/treatment/${s.patient.id}/plans`;
  expect((await s.doctor.post(path, plan)).status).toBe(200);
  for (const [action, revision, extra] of [
    ["present", 1, {}],
    [
      "evidence",
      2,
      {
        acceptedBy: "Patient fictif",
        acceptedAt: "2026-10-16T12:00:00.000Z",
        method: "Oral",
      },
    ],
    ["accept", 3, {}],
  ] as const)
    expect(
      (
        await s.doctor.post(path + "/lifecycle", {
          commandId: randomUUID(),
          id: plan.id,
          revision,
          action,
          ...extra,
        })
      ).status,
    ).toBe(200);
  const visitId = randomUUID();
  expect(
    (
      await s.doctor.post(s.path, {
        commandId: randomUUID(),
        id: visitId,
        appointmentId: null,
        procedures: [
          { planId: plan.id, itemId: plan.items[0]!.id, planRevision: 4 },
        ],
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await s.doctor.post(s.path + "/actions", {
        commandId: randomUUID(),
        id: visitId,
        revision: 1,
        action: "complete",
        planId: plan.id,
        itemId: plan.items[0]!.id,
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await s.doctor.post(s.path + "/actions", {
        commandId: randomUUID(),
        id: visitId,
        revision: 2,
        action: "end",
      })
    ).status,
  ).toBe(200);
  const state = (await s.m.browser.get("/api" + s.base)).body;
  const charge = state.charges.find(
    (ch: { planId: string }) => ch.planId === plan.id,
  ) as { id: string };
  expect(
    (
      await s.m.post(s.base + "/settlements", {
        commandId: randomUUID(),
        currency,
        methodId: s.receipt.body.methodId,
        newMoney: price,
        deposit: "0",
        allocations: [{ chargeId: charge.id, newMoney: price, credit: "0" }],
      })
    ).status,
  ).toBe(200);
  return { charge, plan };
}

it("invoices group whole procedures across plans only within one currency, with exact independent totals and unique concurrent numbers", async () => {
  const s = await completedBillingScenario();
  expect(
    (
      await s.doctor.post(s.path + "/actions", {
        commandId: randomUUID(),
        id: s.start.id,
        revision: 3,
        action: "end",
      })
    ).status,
  ).toBe(200);
  const second = await additionalCompletedPlan(s, "MRU", "100");
  const kwd = await additionalCompletedPlan(s, "KWD", "100.001");
  const jpy = await additionalCompletedPlan(s, "JPY", "100");
  expect(
    (
      await s.m.post(s.base + "/invoices", {
        commandId: randomUUID(),
        chargeIds: [kwd.charge.id, jpy.charge.id],
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await s.m.post(s.base + "/invoices", {
        commandId: randomUUID(),
        chargeIds: [kwd.charge.id, kwd.charge.id],
      })
    ).status,
  ).toBe(400);
  expect(
    (
      await s.m.post(s.base + "/invoices", {
        commandId: randomUUID(),
        chargeIds: [],
      })
    ).status,
  ).toBe(400);
  const commands = [
    {
      commandId: randomUUID(),
      chargeIds: [s.charges[0]!.id, second.charge.id],
    },
    { commandId: randomUUID(), chargeIds: [s.charges[1]!.id] },
  ];
  const invoices = await Promise.all(
    commands.map((c) => s.m.post(s.base + "/invoices", c)),
  );
  expect(invoices.map((r) => r.status)).toEqual([200, 200]);
  expect(invoices.map((r) => r.body.number).sort()).toEqual([
    "INV-2026-000001",
    "INV-2026-000002",
  ]);
  expect(invoices[0]!.body.totalMinor).toBe("20000");
  expect(
    invoices[0]!.body.items.map((i: { planId: string }) => i.planId).sort(),
  ).toEqual([s.command.id, second.plan.id].sort());
  const a = await s.m.post(s.base + "/invoices", {
    commandId: randomUUID(),
    chargeIds: [kwd.charge.id],
  });
  const b = await s.m.post(s.base + "/invoices", {
    commandId: randomUUID(),
    chargeIds: [jpy.charge.id],
  });
  expect(a.body).toMatchObject({
    currency: "KWD",
    totalMinor: "100001",
    number: "INV-2026-000003",
  });
  expect(b.body).toMatchObject({
    currency: "JPY",
    totalMinor: "100",
    number: "INV-2026-000004",
  });
  const summary = (
    await s.m.browser.get(`/api${s.base}/plans/${kwd.plan.id}/summary`)
  ).body;
  expect(summary).toMatchObject({
    currency: "KWD",
    paidMinor: "100001",
    dueMinor: "0",
    chargedMinor: "100001",
  });
});

it("invoice reprints retain identity and content across patient/catalog changes and UTC year rollover", async () => {
  let clock = Date.UTC(2026, 11, 31, 23, 59);
  app = createApplication({ ...options, now: () => clock });
  const s = await completedBillingScenario("MRU", clock);
  const command = { commandId: randomUUID(), chargeIds: [s.charges[0]!.id] };
  const first = await s.m.post(s.base + "/invoices", command);
  expect(first.body.number).toBe("INV-2026-000001");
  const own = (await s.m.browser.get("/api/identity")).body.accountId;
  await s.m.post(`/accounts/${own}/permissions`, {
    currentPassword: "Fictional-manager-pass-2",
    permissions: [
      "patients.create",
      "patients.read",
      "patients.edit",
      "catalog.manage",
    ],
  });
  const patient = (await s.m.browser.get("/api/patients/" + s.patient.id)).body;
  expect(
    (
      await s.m.post(`/patients/${s.patient.id}/contact`, {
        commandId: randomUUID(),
        revision: patient.revision,
        name: "Nom modifié fictif",
        phone: "75555555",
        contactKind: "patient",
        contactName: "",
      })
    ).status,
  ).toBe(200);
  expect(
    (
      await s.m.post("/catalog", {
        ...s.catalog,
        commandId: randomUUID(),
        revision: 1,
        name: "Nouveau tarif fictif",
        price: "900",
      })
    ).status,
  ).toBe(200);
  clock += 120000;
  const second = await s.m.post(s.base + "/invoices", {
    commandId: randomUUID(),
    chargeIds: [s.charges[1]!.id],
  });
  expect(second.body.number).toBe("INV-2027-000001");
  expect(second.body.identity.patientName).toBe("Nom modifié fictif");
  expect((await s.m.post(s.base + "/invoices", command)).body).toEqual(
    first.body,
  );
  expect(
    (await s.m.browser.get(`/api${s.base}/invoices/${first.body.id}/download`))
      .body.invoice,
  ).toEqual(first.body);
  expect(
    (
      await s.m.browser.get(
        `/api${s.base}/settlements/${s.receipt.body.id}/print`,
      )
    ).body.settlement,
  ).toEqual(s.receipt.body);
});
