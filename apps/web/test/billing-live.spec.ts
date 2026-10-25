import { randomUUID } from "node:crypto";
import { test, expect } from "@playwright/test";
import { openDatabase } from "../../api/src/database.js";
import { createApplication } from "../../api/src/application.js";
import { provisionClinic } from "../../api/src/modules/identity/index.js";

test("authenticated billing hooks document debt without a receipt and receive a separate numbered deposit", async ({
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
    sessionSecret: "fictional-issue57-browser-secret-long-enough",
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
    const code = `r57-${randomUUID()}`.slice(0, 32),
      email = `${code}@example.invalid`,
      password = "Fictional-issue57-personal";
    await provisionClinic(owner, {
      clinicCode: code,
      clinicName: "Clinique fictive R57",
      username: "manager",
      displayName: "Responsable",
      email,
      temporaryPassword: "Fictional-issue57-initial",
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
        password: "Fictional-issue57-initial",
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
      permissions: ["patients.create"],
    });
    const { patient } = await post("patients", {
      commandId: randomUUID(),
      name: "Patient fictif R57",
      phone: "70000000",
      contactKind: "patient",
      contactName: "",
    });
    const method = await post("billing/payment-methods", {
      commandId: randomUUID(),
      id: randomUUID(),
      revision: 0,
      name: "Espèces",
      active: true,
    });
    await post("catalog/currencies", { commandId: randomUUID(), code: "MRU" });
    await page.goto(
      `/test/billing-workflows.harness.html?live&patient=${patient.id}&method=${method.id}`,
    );
    const openingResponse = page.waitForResponse((r) =>
      r.url().endsWith("/opening-balances"),
    );
    await page
      .getByRole("button", { name: "Solde initial", exact: true })
      .click();
    const opened = await openingResponse;
    expect(opened.ok(), await opened.text()).toBe(true);
    await expect(page.getByTestId("workspace")).toContainText(
      '"dueMinor":"7000"',
    );
    let workspace = JSON.parse(await page.getByTestId("workspace").innerText());
    expect(workspace.openingBalances).toHaveLength(1);
    expect(workspace.settlements).toEqual([]);
    await page.getByRole("button", { name: "Dépôt", exact: true }).click();
    await expect(page.getByTestId("workspace")).toContainText(
      '"creditMinor":"12000"',
    );
    workspace = JSON.parse(await page.getByTestId("workspace").innerText());
    expect(workspace.totals).toEqual([
      {
        currency: "MRU",
        plannedMinor: "0",
        dueMinor: "7000",
        creditMinor: "12000",
      },
    ]);
    expect(workspace.settlements).toHaveLength(1);
    expect(workspace.settlements[0]).toMatchObject({
      newMoneyMinor: "12000",
      depositMinor: "12000",
      creditUsedMinor: "0",
      receiptNumber: expect.any(String),
    });
    await page
      .getByRole("button", { name: "Choisir reçu", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Imprimer reçu", exact: true })
      .click();
    await expect(page.getByTestId("document")).toContainText(
      "Nouveaux fonds reçus",
    );
    expect(
      JSON.parse(await page.getByTestId("document").innerText()).settlement.id,
    ).toBe(workspace.settlements[0].id);
    await expect(page.getByRole("alert")).toHaveCount(0);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await runtime.close();
    await owner.close();
  }
});
