import { test, expect, type Page } from "@playwright/test";
const base = {
  clinicId: "11111111-1111-4111-8111-111111111111",
  accountId: "22222222-2222-4222-8222-222222222222",
  stage: "ready",
  isManager: true,
  kind: "staff",
  historicalOnly: false,
  recoverySetup: false,
  username: "manager",
  loginMethod: "email",
  loginEmail: "fictional@example.invalid",
  displayName: "Camille",
};
const all = [
  "patients.read",
  "patients.create",
  "patients.edit",
  "patients.archive",
];
const lina = {
  id: "33333333-3333-4333-8333-333333333333",
  patientNumber: 7,
  name: "Lina Fictive",
  phone: "0600000000",
  contactKind: "guardian",
  contactName: "Sami Fictif",
  archived: false,
  revision: 1,
};
async function api(page: Page, permissions: string[], extra = {}) {
  const calls: string[] = [];
  let current = { ...lina };
  await page.route("**/api/**", async (r) => {
    const url = new URL(r.request().url());
    const method = r.request().method();
    calls.push(`${method} ${url.pathname}${url.search}`);
    if (url.pathname.includes("events")) return r.abort();
    if (url.pathname === "/api/patients" && method === "POST")
      return r.fulfill({
        json: {
          patient: { ...lina, id: "44444444-4444-4444-8444-444444444444", patientNumber: 8, name: "Lina Fictive" },
          duplicateWarning: true,
          duplicates: [lina],
        },
      });
    if (url.pathname.endsWith("/archive")) {
      current = { ...current, archived: true, revision: current.revision + 1 };
      return r.fulfill({ json: current });
    }
    const responses: Record<string, object> = {
      "/api/session": { csrfToken: "fictional" },
      "/api/clinic": { code: "fictive", name: "Clinique fictive" },
      "/api/identity": { ...base, permissions, ...extra },
      "/api/patients": {
        patients: url.searchParams.get("q") === "zzz" ? [] : [current],
      },
      [`/api/patients/${lina.id}`]: current,
      [`/api/patients/${lina.id}/history`]: [
        { action: "registered", at: "2026-10-29T09:00:00Z", actorId: "Accueil", patient: lina },
      ],
    };
    return r.fulfill({ json: responses[url.pathname] ?? {} });
  });
  return calls;
}
test("patient list searches, opens a routed profile and survives refresh", async ({
  page,
}) => {
  await api(page, all);
  await page.goto("/preferences");
  await page.getByRole("link", { name: "Patients", exact: true }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Patients" })).toBeVisible();
  await page.getByLabel("Rechercher un patient").fill("zzz");
  await expect(page.getByText("Aucun patient trouvé.")).toBeVisible();
  await page.getByLabel("Rechercher un patient").fill("");
  await page.getByRole("link", { name: /n°7.*Lina Fictive/ }).click();
  await expect(page).toHaveURL(`/patients/${lina.id}`);
  await expect(page.getByRole("heading", { level: 1, name: "Lina Fictive" })).toBeVisible();
  await expect(page.getByText("Parent ou contact : Sami Fictif")).toBeVisible();
  await expect(page.getByText("Création")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1, name: "Lina Fictive" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("heading", { level: 1, name: "Patients" })).toBeVisible();
});
test("registration shows duplicate warnings with links and allows shared numbers", async ({
  page,
}) => {
  await api(page, all);
  await page.goto("/patients");
  await page.getByRole("link", { name: "Nouveau patient" }).click();
  await page.getByLabel("Nom du patient").fill("Lina Fictive");
  await page.getByLabel("Téléphone de contact").fill("0600000000");
  await page.getByLabel("Titulaire du numéro").selectOption("guardian");
  await page.getByLabel("Nom du parent ou contact").fill("Sami Fictif");
  await page.getByRole("button", { name: "Enregistrer le patient" }).click();
  await expect(page.getByText(/Doublon possible/)).toBeVisible();
  await expect(
    page.getByRole("list", { name: "Doublons possibles" }).getByRole("link", { name: /n°7/ }),
  ).toHaveAttribute("href", `/patients/${lina.id}`);
  await expect(page.getByRole("link", { name: /Ouvrir le dossier n°8/ })).toBeVisible();
});
test("archive is confirmed and the profile then blocks editing", async ({ page }) => {
  await api(page, all);
  await page.goto(`/patients/${lina.id}`);
  page.once("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Archiver le patient" }).click();
  await expect(page.getByText("Patient archivé.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Réactiver le patient" })).toBeVisible();
  await expect(page.getByText(/Réactivez le dossier avant modification/)).toBeVisible();
});
test("read-only role sees no create, edit or archive controls", async ({ page }) => {
  await api(page, ["patients.read"], { isManager: false });
  await page.goto(`/patients/${lina.id}`);
  await expect(page.getByRole("heading", { level: 1, name: "Lina Fictive" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Archiver|Enregistrer/ })).toHaveCount(0);
  await page.goto("/patients");
  await expect(page.getByRole("link", { name: "Nouveau patient" })).toHaveCount(0);
});
test("accounts without patient access are denied without patient requests", async ({
  page,
}) => {
  const calls = await api(page, ["reports.operational"]);
  await page.goto(`/patients/${lina.id}`);
  await expect(page.getByRole("heading", { name: "Accès refusé" })).toBeVisible();
  await page.goto("/patients/nouveau");
  await expect(page.getByRole("heading", { name: "Accès refusé" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Patients", exact: true })).toHaveCount(0);
  expect(calls.filter((c) => c.includes("/api/patients"))).toEqual([]);
});
