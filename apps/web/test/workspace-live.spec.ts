import { randomUUID } from "node:crypto";
import request from "supertest";
import { test, expect } from "@playwright/test";
import { openDatabase } from "../../api/src/database.js";
import { createApplication } from "../../api/src/application.js";
import { provisionClinic } from "../../api/src/modules/identity/index.js";

test("French manager activation, dashboard, preferences, password change and sign-out use real authenticated API", async ({
  page,
}) => {
  test.setTimeout(60000);
  if (process.env.CLINIC_TEST_PORT !== "55446")
    throw new Error("Task-owned disposable port 55446 required");
  const owner = openDatabase(
    "postgresql://clinic_test:fictional-only@127.0.0.1:55446/clinic_issue7",
  );
  const runtime = openDatabase(
    "postgresql://clinic_runtime_test:fictional-runtime-only@127.0.0.1:55446/clinic_issue7",
  );
  let verification = "";
  const app = createApplication({
    database: runtime,
    origin: "http://127.0.0.1:4188",
    secureCookies: false,
    sessionSecret: "fictional-issue60-browser-secret-long-enough",
    mail: {
      async sendVerification(message) {
        verification = message.token;
      },
      async sendNotification() {},
    },
  });
  const server = app.listen(3188, "127.0.0.1");
  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    await owner.connect();
    await runtime.connect();
    await runtime.assertRuntimeRole();
    const code = `r60-${randomUUID()}`.slice(0, 32),
      email = `${code}@example.invalid`;
    const password = "Fictional-issue60-personal";
    await provisionClinic(owner, {
      clinicCode: code,
      clinicName: "Clinique fictive R60",
      username: "manager",
      displayName: "Camille",
      email,
      temporaryPassword: "Fictional-issue60-initial",
    });
    await page.goto("/connexion");
    await page.getByLabel("Adresse e-mail de connexion").fill(email);
    await page
      .getByLabel("Mot de passe", { exact: true })
      .fill("Fictional-issue60-initial");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(
      page.getByRole("heading", { name: "Votre mot de passe personnel" }),
    ).toBeVisible();
    await page
      .getByLabel("Nouveau mot de passe", { exact: true })
      .fill(password);
    await page
      .getByRole("button", { name: "Enregistrer le mot de passe" })
      .click();
    await page.getByLabel("Adresse e-mail de connexion").fill(email);
    await page.getByLabel("Mot de passe", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(
      page.getByRole("heading", { name: "Sécurisez votre accès" }),
    ).toBeVisible();
    await expect(page.getByLabel("Adresse e-mail de récupération")).toHaveValue(
      email,
    );
    await page
      .getByRole("button", { name: "Envoyer le lien de vérification" })
      .click();
    await expect.poll(() => verification.length).toBeGreaterThan(10);
    await page.goto("/#verification=" + verification);
    await page.getByRole("button", { name: "Vérifier mon adresse" }).click();
    await expect(page.locator(".codes li")).toHaveCount(10);
    await page.getByRole("checkbox").check();
    await page
      .getByRole("button", { name: "Terminer la configuration" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Bonjour, Camille" }),
    ).toBeVisible();
    const csrf = (await (await page.request.get("/api/session")).json())
      .csrfToken;
    const post = async (path: string, data: object) => {
      const result = await page.request.post("/api/" + path, {
        headers: { Origin: "http://127.0.0.1:4188", "x-csrf-token": csrf },
        data,
      });
      expect(result.ok(), await result.text()).toBe(true);
      return result.json();
    };
    const identity = await (await page.request.get("/api/identity")).json();
    await post(`accounts/${identity.accountId}/permissions`, {
      revision: 0,
      currentPassword: password,
      permissions: [
        "reports.operational",
        "patients.create",
        "appointments.manage",
      ],
    });
    const doctor = await post("accounts", {
      displayName: "Docteur fictif",
      username: "doctor",
      kind: "doctor",
      temporaryPassword: "Fictional-doctor-initial",
      currentPassword: password,
    });
    const employee = request.agent(app);
    let employeeCsrf = (await employee.get("/api/session")).body.csrfToken;
    const employeePost = (path: string, data: object) =>
      employee
        .post("/api/" + path)
        .set("Origin", "http://127.0.0.1:4188")
        .set("x-csrf-token", employeeCsrf)
        .send(data);
    const login = await employeePost("sign-in", {
      method: "clinic_username",
      clinicCode: code,
      username: "doctor",
      password: "Fictional-doctor-initial",
    });
    expect(login.status).toBe(200);
    employeeCsrf = login.body.csrfToken;
    expect(
      (
        await employeePost("onboarding/password", {
          password: "Fictional-doctor-personal",
        })
      ).status,
    ).toBe(204);
    const patient = await post("patients", {
      commandId: randomUUID(),
      name: "Patient fictif R60",
      phone: "70000000",
      contactKind: "patient",
      contactName: "",
    });
    await post("appointments", {
      commandId: randomUUID(),
      patientId: patient.patient.id,
      dentistId: doctor.id,
      chairId: null,
      startsAt: new Date().toISOString().slice(0, 10) + "T10:00:00Z",
      durationMinutes: 30,
      walkIn: false,
    });
    await page.reload();
    await expect(
      page.getByText("Patient fictif R60", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("Aucune activité financière autorisée pour cette date."),
    ).toBeVisible();
    await page.getByRole("link", { name: "Mes préférences" }).click();
    await page.getByRole("button", { name: "Sarcelle", exact: true }).click();
    await expect(page.locator(".clinic-app")).toHaveAttribute(
      "data-theme",
      "teal",
    );
    await page.reload();
    await expect(
      page.getByRole("heading", { name: "Mes préférences" }),
    ).toBeVisible();
    await page
      .locator("summary")
      .filter({ hasText: /^Changer mon mot de passe$/ })
      .click();
    await page
      .getByRole("textbox", { name: "Mot de passe actuel", exact: true })
      .fill(password);
    await page
      .getByLabel("Nouveau mot de passe personnel")
      .fill("Fictional-issue60-changed");
    await page
      .getByRole("button", { name: "Changer mon mot de passe" })
      .click();
    await expect(
      page.getByRole("heading", { name: "Connexion à votre clinique" }),
    ).toBeVisible();
    await page.getByLabel("Adresse e-mail de connexion").fill(email);
    await page
      .getByLabel("Mot de passe", { exact: true })
      .fill("Fictional-issue60-changed");
    await page.getByRole("button", { name: "Se connecter" }).click();
    await expect(
      page.getByRole("heading", { name: "Mes préférences" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Se déconnecter" }).click();
    await expect(
      page.getByRole("heading", { name: "Connexion à votre clinique" }),
    ).toBeVisible();
    await page.goto("/workspace");
    await expect(
      page.getByRole("heading", { name: "Connexion à votre clinique" }),
    ).toBeVisible();
  } finally {
    await page.goto("about:blank");
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await runtime.close();
    await owner.close();
  }
});
