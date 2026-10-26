import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { openDatabase } from "../../api/src/database.js";
import { createApplication } from "../../api/src/application.js";
import { provisionClinic } from "../../api/src/modules/identity/index.js";

test("authenticated report hooks create a follow-up, prepare manual sharing and deny revoked export delivery", async ({
  page,
}) => {
  const port = process.env.CLINIC_TEST_PORT;
  if (!port || port === "55437")
    throw new Error("Explicit disposable test port required.");
  const owner = openDatabase(
    `postgresql://clinic_test:fictional-only@127.0.0.1:${port}/clinic_issue7`,
  );
  const runtime = openDatabase(
    `postgresql://clinic_runtime_test:fictional-runtime-only@127.0.0.1:${port}/clinic_issue7`,
  );
  let verification = "";
  const app = createApplication({
    database: runtime,
    origin: "http://127.0.0.1:4173",
    secureCookies: false,
    sessionSecret: "fictional-issue59-browser-secret-long-enough",
    mail: {
      async sendVerification(m) {
        verification = m.token;
      },
    },
  });
  const server = app.listen(3000, "127.0.0.1");
  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    await owner.connect();
    await runtime.connect();
    const code = `r59-${randomUUID()}`.slice(0, 32),
      email = `${code}@example.invalid`,
      password = "Fictional-issue59-personal";
    await provisionClinic(owner, {
      clinicCode: code,
      clinicName: "Clinique fictive R59",
      username: "manager",
      displayName: "Responsable",
      email,
      temporaryPassword: "Fictional-issue59-initial",
    });
    let csrf = (await (await page.request.get("/api/session")).json())
      .csrfToken;
    const post = async (path: string, data: object) => {
      const response = await page.request.post(`/api/${path}`, {
        headers: { Origin: "http://127.0.0.1:4173", "x-csrf-token": csrf },
        data,
      });
      expect(response.ok(), await response.text()).toBe(true);
      const text = await response.text();
      return text ? JSON.parse(text) : undefined;
    };
    csrf = (
      await post("sign-in", {
        method: "email",
        email,
        password: "Fictional-issue59-initial",
      })
    ).csrfToken;
    await post("onboarding/password", { password });
    csrf = (await (await page.request.get("/api/session")).json()).csrfToken;
    csrf = (await post("sign-in", { method: "email", email, password }))
      .csrfToken;
    await post("onboarding/email", { email });
    const codes = await post("onboarding/verify-email", {
      token: verification,
    });
    await post("onboarding/codes-saved", {
      batchId: codes.batchId,
      saved: true,
    });
    const identity = await (await page.request.get("/api/identity")).json();
    await post(`accounts/${identity.accountId}/permissions`, {
      revision: 0,
      currentPassword: password,
      permissions: [
        "patients.create",
        "reports.operational",
        "inventory.read",
        "exports.inventory",
      ],
    });
    const { patient } = await post("patients", {
      commandId: randomUUID(),
      name: "Patient fictif R59",
      phone: "70000000",
      contactKind: "patient",
      contactName: "",
    });
    await page.goto(
      `/test/reporting-workflows.harness.html?live&view=tasks&patient=${patient.id}`,
    );
    await page
      .getByRole("button", { name: "Enregistrer", exact: true })
      .click();
    await expect(page.getByTestId("data")).toContainText(patient.id);
    const tasks = JSON.parse(await page.getByTestId("data").innerText()).tasks;
    expect(tasks).toHaveLength(1);
    await page.goto(
      `/test/reporting-workflows.harness.html?live&view=share&task=${tasks[0].id}`,
    );
    await expect(page.getByTestId("data")).toContainText('"delivery":"manual"');
    await expect(page.getByTestId("data")).toContainText("Patient fictif R59");
    await page.getByRole("button", { name: "Exporter", exact: true }).click();
    await expect(page.getByTestId("export-status")).toHaveText("ready");
    await post(`accounts/${identity.accountId}/permissions`, {
      revision: 1,
      currentPassword: password,
      permissions: ["patients.create", "reports.operational", "inventory.read"],
    });
    await page
      .getByRole("button", { name: "Télécharger", exact: true })
      .click();
    await expect(page.getByTestId("export-denied")).toHaveText("true");
    await expect(page.getByTestId("downloaded")).toBeEmpty();
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await runtime.close();
    await owner.close();
  }
});
