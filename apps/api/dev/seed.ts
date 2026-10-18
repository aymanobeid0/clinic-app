import { randomUUID } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import request from "supertest";
import { permissionSchema } from "@clinic/contracts";
import { createApplication } from "../src/application.js";
import { openDatabase } from "../src/database.js";
import { provisionClinic } from "../src/modules/identity/index.js";
import { localMail } from "./mail.js";
import {
  localDirectory,
  ownerUrl,
  runtimeUrl,
  origin,
  requireLocalDevelopment,
} from "../../../scripts/local-dev-config.ts";
requireLocalDevelopment();
const code = "demo-local",
  email = "manager@example.invalid",
  password = "Demo-clinic-2026!",
  temporary = "Demo-initial-2026!";
const owner = openDatabase(ownerUrl),
  runtime = openDatabase(runtimeUrl);
try {
  await owner.connect();
  await runtime.connect();
  await runtime.assertRuntimeRole();
  const existing = await owner.client.clinic.findUnique({ where: { code } });
  if (existing) {
    let completed: { clinicId?: string };
    try {
      completed = JSON.parse(
        await readFile(join(localDirectory, "seeded.json"), "utf8"),
      );
    } catch {
      throw new Error(
        "Initial local demo setup is incomplete or its completion record is missing. Existing data was retained. See README local setup recovery; do not delete the database volume.",
      );
    }
    if (completed.clinicId !== existing.id)
      throw new Error(
        "Local demo completion record does not match this database. Existing data was retained; see README local setup recovery.",
      );
    console.log(
      "Existing completed local clinic retained; demo data and passwords were not overwritten.",
    );
  } else {
    await provisionClinic(owner, {
      clinicCode: code,
      clinicName: "Clinique locale - donnees fictives",
      username: "manager",
      displayName: "Responsable demonstration",
      email,
      temporaryPassword: temporary,
    });
    const mail = await localMail(),
      secret = await readFile(join(localDirectory, "session-secret"), "utf8");
    const app = createApplication({
      database: runtime,
      sessionSecret: secret,
      origin,
      secureCookies: false,
      mail: mail.adapter,
    });
    function session() {
      const browser = request.agent(app);
      let csrf = "";
      return {
        browser,
        async post(path: string, body: object) {
          const response = await browser
            .post("/api/" + path)
            .set("Origin", origin)
            .set("x-csrf-token", csrf)
            .send(body);
          if (response.status >= 400)
            throw new Error(
              `Local demo setup failed at ${path}: HTTP ${response.status}. Existing data retained; no reset performed.`,
            );
          if (response.body?.csrfToken) csrf = response.body.csrfToken;
          return response.body;
        },
        async refresh() {
          csrf = (await browser.get("/api/session")).body.csrfToken;
        },
      };
    }
    const manager = session();
    await manager.refresh();
    await manager.post("sign-in", {
      method: "email",
      email,
      password: temporary,
    });
    await manager.post("onboarding/password", { password });
    await manager.refresh();
    await manager.post("sign-in", { method: "email", email, password });
    await manager.post("onboarding/email", { email });
    const batch = await manager.post("onboarding/verify-email", {
      token: mail.verification(email),
    });
    await writeFile(
      join(localDirectory, "demo-recovery-codes.json"),
      JSON.stringify({ email, codes: batch.codes }, null, 2) + "\n",
      { mode: 0o600 },
    );
    await manager.post("onboarding/codes-saved", {
      batchId: batch.batchId,
      saved: true,
    });
    const own = (await manager.browser.get("/api/identity")).body;
    await manager.post(`accounts/${own.accountId}/permissions`, {
      revision: 0,
      currentPassword: password,
      permissions: [
        "patients.read",
        "patients.create",
        "patients.edit",
        "patients.archive",
        "catalog.manage",
        "appointments.manage",
        "appointments.override",
      ],
    });
    const doctorPermissions = permissionSchema.options.filter(
      (p) =>
        p.startsWith("clinical.") ||
        [
          "chart.",
          "history.",
          "plans.",
          "notes.",
          "prescriptions.",
          "procedures.",
          "acceptance.",
        ].some((prefix) => p.startsWith(prefix)) ||
        [
          "patients.read",
          "appointments.manage",
          "prices.override",
          "discounts",
        ].includes(p),
    );
    const assistantPermissions = [
      "patients.read",
      "appointments.manage",
      "clinical.read",
      "clinical.history",
      "history.draft",
      "chart.draft",
      "plans.draft",
      "notes.draft",
      "prescriptions.draft",
      "acceptance.draft",
    ];
    const employees = [];
    for (const [username, kind, permissions] of [
      ["dentiste", "doctor", doctorPermissions],
      ["assistant", "staff", assistantPermissions],
    ] as const) {
      const account = await manager.post("accounts", {
        username,
        displayName:
          username === "dentiste"
            ? "Dentiste demonstration"
            : "Assistant demonstration",
        kind,
        temporaryPassword: temporary,
        currentPassword: password,
      });
      await manager.post(`accounts/${account.id}/permissions`, {
        revision: 0,
        currentPassword: password,
        permissions,
      });
      const employee = session();
      await employee.refresh();
      await employee.post("sign-in", {
        method: "clinic_username",
        clinicCode: code,
        username,
        password: temporary,
      });
      await employee.post("onboarding/password", { password });
      await employee.refresh();
      await employee.post("sign-in", {
        method: "clinic_username",
        clinicCode: code,
        username,
        password,
      });
      employees.push({ ...employee, id: account.id });
    }
    for (const [index, name] of [
      "Lina Demonstration",
      "Sami Demonstration",
    ].entries()) {
      const result = await manager.post("patients", {
        commandId: randomUUID(),
        name,
        phone: "7000000" + (index + 1),
        contactKind: "patient",
        contactName: "",
      });
      for (const [revision, employee] of employees.entries())
        await manager.post(`patient-access/${result.patient.id}/share`, {
          commandId: randomUUID(),
          revision,
          accountId: employee.id,
          kind: revision === 0 ? "assigned" : "shared",
        });
    }
    await manager.post("catalog/currencies", {
      commandId: randomUUID(),
      code: "MRU",
    });
    for (const [name, chartCategory, price] of [
      ["Consultation fictive", "manual", "100.00"],
      ["Restauration fictive", "restoration", "300.00"],
    ] as const)
      await manager.post("catalog", {
        commandId: randomUUID(),
        id: randomUUID(),
        revision: 0,
        name,
        chartCategory,
        currency: "MRU",
        price,
        durationMinutes: 30,
        active: true,
      });
    await manager.post("medications", {
      commandId: randomUUID(),
      id: randomUUID(),
      revision: 0,
      name: "Reference de demonstration (fictive)",
      strength: "",
      form: "Exemple de saisie uniquement",
      active: true,
    });
    await writeFile(
      join(localDirectory, "seeded.json"),
      JSON.stringify({
        clinicId: own.clinicId,
        completedAt: new Date().toISOString(),
      }) + "\n",
      { mode: 0o600 },
    );
    console.log(
      "Fictional demo clinic prepared through authenticated application workflows. Logins are documented in README.md.",
    );
  }
} finally {
  await runtime.close();
  await owner.close();
}
