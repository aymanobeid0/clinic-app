import { test, expect } from "@playwright/test";
test("Radix login tabs support arrow keys, panel labels and stable shared fields", async ({
  page,
}) => {
  await api(page, null);
  await page.goto("/connexion");
  const principal = page.getByRole("tab", { name: "Responsable principal" });
  const team = page.getByRole("tab", { name: "Équipe", exact: true });
  await expect(principal).toHaveAttribute("aria-selected", "true");
  const before = await page
    .getByLabel("Mot de passe", { exact: true })
    .boundingBox();
  await principal.focus();
  await page.keyboard.press("ArrowRight");
  await expect(team).toBeFocused();
  await expect(team).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("tabpanel", { name: "Équipe", exact: true }),
  ).toBeVisible();
  await expect(page.getByLabel("Adresse e-mail de connexion")).toHaveCount(0);
  expect(
    (await page.getByLabel("Mot de passe", { exact: true }).boundingBox())?.y,
  ).toBe(before?.y);
  await page.keyboard.press("Home");
  await expect(principal).toBeFocused();
  await expect(
    page.getByRole("tabpanel", { name: "Responsable principal" }),
  ).toBeVisible();
});
const account = {
  clinicId: "11111111-1111-4111-8111-111111111111",
  accountId: "22222222-2222-4222-8222-222222222222",
  stage: "ready",
  isManager: true,
  kind: "staff",
  permissions: ["reports.operational", "inventory.read"],
  historicalOnly: false,
  recoverySetup: false,
  username: "manager",
  loginMethod: "email",
  loginEmail: "fictional@example.invalid",
  displayName: "Camille",
};
async function api(
  page: import("@playwright/test").Page,
  identity: object | null = account,
) {
  await page.route("**/api/**", (r) => {
    const url = new URL(r.request().url());
    if (url.pathname.includes("events")) return r.abort();
    const responses: Record<string, object> = {
      "/api/session": { csrfToken: "fictional" },
      "/api/clinic": { code: "fictive", name: "Clinique fictive" },
      "/api/identity": identity ?? {},
      "/api/reports/appointments": { date: "2026-10-29", appointments: [] },
      "/api/reports/financial": {
        date: "2026-10-29",
        balanceAsOf: "2026-10-29T12:00:00Z",
        totals: [],
        patients: [],
      },
      "/api/follow-ups": { tasks: [], pendingNotes: [] },
      "/api/reports/stock": {
        asOfDate: "2026-10-29",
        lowStock: [],
        expiring: [],
        expired: [],
      },
    };
    return r.fulfill({
      status: url.pathname === "/api/identity" && !identity ? 401 : 200,
      json: responses[url.pathname] ?? {},
    });
  });
}
test("login keeps password and submit stable across login methods", async ({
  page,
}) => {
  await page.route("**/api/**", (r) =>
    r.fulfill({
      status: r.request().url().endsWith("/identity") ? 401 : 200,
      json: { csrfToken: "fictional" },
    }),
  );
  await page.goto("/connexion");
  const password = page.getByLabel("Mot de passe", { exact: true });
  const before = await password.boundingBox();
  await page.getByRole("tab", { name: "Équipe", exact: true }).click();
  await expect(page.getByLabel("Code de la clinique")).toBeVisible();
  expect((await password.boundingBox())?.y).toBe(before?.y);
  await expect(
    page.getByRole("link", { name: "Mot de passe oublié ?" }),
  ).toHaveAttribute("href", "/recuperation");
});
test("dashboard uses scoped data and links survive refresh and browser navigation", async ({
  page,
}) => {
  await api(page);
  await page.goto("/workspace");
  await expect(
    page.getByRole("heading", { name: "Bonjour, Camille" }),
  ).toBeVisible();
  await expect(
    page.getByText("Aucun rendez-vous pour cette journée."),
  ).toBeVisible();
  await page.getByRole("link", { name: "Mes préférences" }).click();
  await page.getByRole("button", { name: "Sarcelle", exact: true }).click();
  await expect(page.locator(".clinic-app")).toHaveAttribute(
    "data-theme",
    "teal",
  );
  await page.goBack();
  await expect(
    page.getByRole("link", { name: "Tableau de bord" }),
  ).toHaveAttribute("aria-current", "page");
  await page.goForward();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Mes préférences" }),
  ).toBeVisible();
  await page.goto("/does-not-exist");
  await expect(
    page.getByRole("heading", { name: "Page introuvable" }),
  ).toBeVisible();
});
test("historical accounts never query operational data even through direct URLs", async ({
  page,
}) => {
  await api(page, { ...account, historicalOnly: true });
  const reports: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/reports/") || r.url().includes("/api/clinic"))
      reports.push(r.url());
  });
  await page.goto("/workspace");
  await expect(
    page.getByRole("heading", { name: "Accès refusé" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Tableau de bord" })).toHaveCount(
    0,
  );
  expect(reports).toEqual([]);
});
test("no permissions gives an honest start with no report requests", async ({
  page,
}) => {
  await api(page, { ...account, isManager: false, permissions: [] });
  await page.goto("/workspace");
  await expect(
    page.getByRole("heading", { name: "Votre accès est prêt" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Situation financière" }),
  ).toHaveCount(0);
});
test("report failures do not display stale amounts and recover explicitly", async ({
  page,
}) => {
  await api(page);
  let fail = true;
  await page.route("**/api/reports/financial?*", (r) =>
    r.fulfill(
      fail
        ? { status: 503, json: { error: "Rapport indisponible" } }
        : {
            json: {
              date: "2026-10-29",
              balanceAsOf: "2026-10-29T12:00:00Z",
              patients: [],
              totals: [
                {
                  currency: "MRU",
                  invoiceMinor: "1000",
                  refundMinor: "0",
                  reversedMoneyMinor: "0",
                  newMoneyMinor: "700",
                  appliedCreditMinor: "300",
                  dueMinor: "9007199254740993",
                  creditMinor: "0",
                  openingMinor: "150",
                  adjustmentMinor: "-50",
                  plannedMinor: "1000",
                },
              ],
            },
          },
    ),
  );
  await page.goto("/workspace");
  await expect(
    page.getByText("Rapport indisponible", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("0,00 MRU", { exact: true })).toHaveCount(0);
  fail = false;
  await page
    .getByRole("button", {
      name: "Actualiser Situation financière",
      exact: true,
    })
    .click();
  await expect(
    page.getByText("90071992547409,93 MRU", { exact: true }),
  ).toBeVisible();
  await expect(page.getByText("−0,50 MRU", { exact: true })).toBeVisible();
});
test("restricted setup cannot render operational pages", async ({ page }) => {
  await api(page, { ...account, stage: "password" });
  await page.goto("/workspace");
  await expect(
    page.getByRole("heading", { name: "Votre mot de passe personnel" }),
  ).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
});
test("ready account password settings require current password and use the personal endpoint", async ({
  page,
}) => {
  await api(page);
  let sent: unknown;
  await page.route("**/api/password", async (r) => {
    sent = r.request().postDataJSON();
    await r.fulfill({
      status: 400,
      json: { error: "Mot de passe actuel incorrect." },
    });
  });
  await page.goto("/preferences");
  await page
    .locator("summary")
    .filter({ hasText: /^Changer mon mot de passe$/ })
    .click();
  await page
    .getByRole("textbox", { name: "Mot de passe actuel", exact: true })
    .fill("Fictional-wrong-password");
  await page
    .getByLabel("Nouveau mot de passe personnel")
    .fill("Fictional-new-password");
  await page.getByRole("button", { name: "Changer mon mot de passe" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "Mot de passe actuel incorrect.",
  );
  expect(sent).toEqual({
    currentPassword: "Fictional-wrong-password",
    password: "Fictional-new-password",
  });
});
for (const width of [320, 768, 1024, 1440])
  test(`login responsive and keyboard at ${width}`, async ({ page }) => {
    await api(page, null);
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/connexion");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      "Connexion à votre clinique",
    );
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    if (width >= 1024)
      expect(
        await page.evaluate(
          () => document.documentElement.scrollHeight <= innerHeight,
        ),
      ).toBe(true);
    await page.getByRole("tab", { name: "Équipe", exact: true }).focus();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Tab");
    await expect(page.getByLabel("Code de la clinique")).toBeFocused();
    await page
      .getByRole("button", { name: "Se connecter", exact: false })
      .click();
    await expect(page.getByRole("alert")).toContainText("obligatoire");
  });
test("email recovery links select the received-link method automatically", async ({
  page,
}) => {
  await api(page, null);
  await page.goto("/recuperation#recovery=fictional-recovery-token");
  await page
    .getByText("Récupérer mon compte responsable", { exact: true })
    .click();
  await expect(page.getByLabel("Méthode de récupération")).toHaveValue("email");
  await expect(page.getByLabel("Jeton du lien de récupération")).toHaveValue(
    "fictional-recovery-token",
  );
  await expect(page).not.toHaveURL(/fictional-recovery-token/);
});
test("ready manager verification links open personal settings without the setup-only send control", async ({
  page,
}) => {
  await api(page);
  await page.goto("/#verification=fictional-verification-token");
  await expect(
    page.getByRole("heading", { name: "Mes préférences" }),
  ).toBeVisible();
  await expect(page.getByLabel("Code de vérification reçu")).toHaveValue(
    "fictional-verification-token",
  );
  await expect(
    page.getByRole("button", { name: "Envoyer le lien de vérification" }),
  ).toHaveCount(0);
  await expect(page).not.toHaveURL(/fictional-verification-token/);
});
test("normal laptop fit and enlarged text preserve accessible controls without overlap", async ({
  page,
}) => {
  await api(page, null);
  await page.setViewportSize({ width: 1440, height: 768 });
  await page.goto("/connexion");
  await expect(page.getByLabel("Adresse e-mail de connexion")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollHeight <= innerHeight,
    ),
  ).toBe(true);
  await page.getByRole("tab", { name: "Équipe", exact: true }).click();
  await page.addStyleTag({
    content:
      ".auth-content, .auth-content input, .auth-content button, .auth-content label, .auth-content p {font-size:28px !important;}",
  });
  const username = await page
    .getByLabel("Identifiant", { exact: true })
    .boundingBox();
  const password = await page
    .getByLabel("Mot de passe", { exact: true })
    .boundingBox();
  expect(password!.y).toBeGreaterThanOrEqual(username!.y + username!.height);
  await page
    .getByRole("button", { name: "Se connecter" })
    .scrollIntoViewIfNeeded();
  await expect(
    page.getByRole("button", { name: "Se connecter" }),
  ).toBeInViewport();
});
