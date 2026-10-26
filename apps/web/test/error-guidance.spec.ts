import { test, expect } from "@playwright/test";
test("empty patient form names every required field in French and preserves corrected input", async ({
  page,
}) => {
  await page.goto("/test/error-guidance.harness.html");
  await page.locator("button[type=submit]").click();
  await expect(page.getByRole("alert")).toContainText(
    "Nom : Ce champ est obligatoire.",
  );
  await expect(page.getByRole("alert")).toContainText(
    "Téléphone : Ce champ est obligatoire.",
  );
  await page
    .getByLabel("Nom du patient", { exact: true })
    .fill("Patient fictif");
  await page.locator("button[type=submit]").click();
  await expect(page.getByRole("alert")).not.toContainText("Nom :");
  await expect(page.getByLabel("Nom du patient", { exact: true })).toHaveValue(
    "Patient fictif",
  );
});
test("a malformed login field receives French schema guidance", async ({
  page,
}) => {
  await page.goto("/test/error-guidance.harness.html?login");
  await page.getByLabel("Mode de connexion").selectOption("clinic_username");
  await page.getByLabel("Code de la clinique").fill("??");
  await page.getByLabel("Identifiant", { exact: true }).fill("fictional");
  await page.getByLabel("Mot de passe", { exact: true }).fill("fictional-pass");
  await page.getByRole("button", { name: /Se connecter/ }).click();
  await expect(page.getByRole("alert").last()).toContainText(
    "Code de la clinique",
  );
  await expect(page.getByRole("alert").last()).toContainText(
    "La valeur est invalide.",
  );
});
test("failed login preserves identifiers while clearing the password", async ({
  page,
}) => {
  await page.route("**/api/sign-in", (r) =>
    r.fulfill({
      status: 401,
      json: {
        error:
          "Identifiants invalides. Vérifiez vos identifiants de connexion.",
      },
    }),
  );
  await page.goto("/test/error-guidance.harness.html?login");
  await page
    .getByLabel("Adresse e-mail de connexion")
    .fill("fictional@example.invalid");
  await page.getByLabel("Mot de passe", { exact: true }).fill("fictional-pass");
  await page.getByRole("button", { name: /Se connecter/ }).click();
  await expect(page.getByRole("alert")).toContainText("Identifiants invalides");
  await expect(page.getByLabel("Adresse e-mail de connexion")).toHaveValue(
    "fictional@example.invalid",
  );
  await expect(page.getByLabel("Mot de passe", { exact: true })).toHaveValue(
    "",
  );
});
test("inventory count identifies a missing counted-packs field", async ({
  page,
}) => {
  await page.route("**/api/**", (r) =>
    r.request().url().includes("events")
      ? r.abort()
      : r.fulfill({ json: { batches: [] } }),
  );
  await page.goto("/test/inventory-workflows.harness.html?action=correction");
  await page
    .getByLabel("Payload")
    .fill(
      JSON.stringify({
        kind: "count",
        batchId: "11111111-1111-4111-8111-111111111111",
        revision: 0,
        reason: "Comptage",
      }),
    );
  await page.getByRole("button", { name: "Préparer" }).click();
  await page.getByRole("button", { name: "Confirmer", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Paquets comptés : Ce champ est obligatoire.",
  );
});
