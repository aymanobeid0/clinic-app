import { expect, test } from "@playwright/test";
const consultation = {
  id: "55555555-5555-4555-8555-555555555555",
  patientId: "22222222-2222-4222-8222-222222222222",
  doctorId: "11111111-1111-4111-8111-111111111111",
  appointmentId: null,
  date: "2026-10-28",
  revision: 1,
  status: "booked",
  currency: "MRU",
  priceMinor: "50000",
  visitId: null,
  enteredAt: null,
  completedAt: null,
  at: "2026-10-28T12:00:00Z",
  actorId: "11111111-1111-4111-8111-111111111111",
};
test("mocked booking retry retains the original path and payload after changed invalid inputs", async ({
  page,
}) => {
  const sent: { path: string; data: unknown }[] = [];
  await page.route("**/api/**", async (route) => {
    sent.push({
      path: route.request().url(),
      data: route.request().postDataJSON(),
    });
    if (sent.length === 1) await route.abort();
    else await route.fulfill({ json: { id: "booked" } });
  });
  await page.goto("/test/consultation-workflows.harness.html");
  await page
    .getByLabel("Dentiste")
    .fill("11111111-1111-4111-8111-111111111111");
  await page.getByLabel("Prix convenu").fill("500");
  await page.getByRole("button", { name: "Réserver", exact: true }).click();
  await expect(page.getByTestId("uncertain")).toHaveText("true");
  await page.getByLabel("Dentiste").fill("");
  await page.getByLabel("Prix convenu").fill("invalid");
  await page.getByRole("button", { name: "Réserver", exact: true }).click();
  await expect(page.getByTestId("uncertain")).toHaveText("false");
  expect(sent).toHaveLength(2);
  expect(sent[1]).toEqual(sent[0]);
});

test("mocked scope retirement discards uncertain booking and sensitive draft", async ({
  page,
}) => {
  const sent: { url: string; data: Record<string, unknown> }[] = [];
  await page.route("**/api/**", async (route) => {
    sent.push({
      url: route.request().url(),
      data: route.request().postDataJSON(),
    });
    if (sent.length === 1) await route.abort();
    else await route.fulfill({ json: consultation });
  });
  await page.goto("/test/consultation-workflows.harness.html");
  await page.getByLabel("Prix convenu").fill("500");
  await page.getByRole("button", { name: "Réserver", exact: true }).click();
  await expect(page.getByTestId("uncertain")).toHaveText("true");
  await page.getByRole("button", { name: "Changer de patient" }).click();
  await expect(page.getByTestId("uncertain")).toHaveText("false");
  await expect(page.getByLabel("Prix convenu")).toHaveValue("");
  await page.getByRole("button", { name: "Réserver", exact: true }).click();
  await expect.poll(() => sent.length).toBe(2);
  expect(sent[1].url).toContain("33333333-3333-4333-8333-333333333333");
  expect(sent[1].data.commandId).not.toBe(sent[0].data.commandId);
  expect(sent[1].data).not.toHaveProperty("price");
  await page.getByRole("button", { name: "Retirer accès" }).click();
  await page.getByRole("button", { name: "Réserver", exact: true }).click();
  expect(sent).toHaveLength(2);
});

test("mocked payment retains exact path/payload while changed inputs are invalid; stale entry remains a conflict", async ({
  page,
}) => {
  const sent: { url: string; data: unknown }[] = [];
  await page.route("**/api/**", async (route) => {
    const req = route.request(),
      url = req.url();
    if (req.method() === "POST") {
      sent.push({ url, data: req.postDataJSON() });
      if (url.endsWith("/payment") && sent.length === 1) return route.abort();
      return route.fulfill({
        status: url.endsWith("/entry") ? 409 : 200,
        json: url.endsWith("/entry")
          ? { error: "La consultation a changé." }
          : { id: "receipt" },
      });
    }
    return route.fulfill({
      json: url.endsWith("/remuneration")
        ? { rate: "40", shareNumerator: "2000000", shareDenominator: "100" }
        : url.endsWith("/visits")
          ? { visits: [], starts: [], completions: [], appointments: [] }
          : url.includes("/billing/")
            ? { charges: [], totals: [], settlements: [] }
            : url.includes("/notes")
              ? []
              : [consultation],
    });
  });
  await page.goto("/test/consultation-workflows.harness.html?care");
  await page.getByLabel("Montant reçu").fill("500");
  await page.getByLabel("Méthode").fill("66666666-6666-4666-8666-666666666666");
  await page.getByRole("button", { name: "Payer", exact: true }).click();
  await expect(page.getByTestId("payment-uncertain")).toHaveText("true");
  await page.getByLabel("Montant reçu").fill("bad");
  await page.getByLabel("Méthode").fill("");
  await page.getByRole("button", { name: "Payer", exact: true }).click();
  await expect(page.getByTestId("payment-uncertain")).toHaveText("false");
  expect(sent[1]).toEqual(sent[0]);
  await page.getByRole("button", { name: "Entrer", exact: true }).click();
  await expect(page.getByTestId("care-conflict")).toHaveText("true");
  await expect(page.getByTestId("care-error")).toHaveText(
    "La consultation a changé.",
  );
  expect(sent[2].data).toMatchObject({ revision: 1, id: consultation.id });
});

for (const role of [
  "Compte accueil",
  "Autre dentiste",
  "Compte historique",
  "Retirer accès",
]) {
  test(`mocked remuneration authority retires on ${role}`, async ({ page }) => {
    let shareReads = 0;
    await page.route("**/api/**", (route) => {
      const url = route.request().url();
      if (url.endsWith("/remuneration")) shareReads++;
      return route.fulfill({
        json: url.endsWith("/remuneration")
          ? { rate: "40", shareNumerator: "2000000", shareDenominator: "100" }
          : url.endsWith("/visits")
            ? { visits: [], starts: [], completions: [], appointments: [] }
            : url.includes("/billing/")
              ? { charges: [], totals: [] }
              : url.includes("/notes")
                ? []
                : [consultation],
      });
    });
    await page.goto("/test/consultation-workflows.harness.html?care");
    await expect(page.getByTestId("share")).toContainText('"rate":"40"');
    await page.getByLabel("Montant reçu").fill("500");
    await page.getByRole("button", { name: role, exact: true }).click();
    await expect(page.getByTestId("share")).toBeEmpty();
    await expect(page.getByTestId("share-denied")).toHaveText("true");
    await expect(page.getByLabel("Montant reçu")).toHaveValue("");
    const reads = shareReads;
    await page.getByRole("button", { name: "Relire part" }).click();
    expect(shareReads).toBe(reads);
  });
}

test("mocked consultation reads expose empty/failure/denied without fabricating values", async ({
  page,
}) => {
  let status = 200;
  await page.route("**/api/**", (route) =>
    route.fulfill({
      status,
      json:
        status === 200
          ? []
          : { error: status === 503 ? "Indisponible" : "Accès retiré" },
    }),
  );
  await page.goto("/test/consultation-workflows.harness.html?care");
  await expect(page.getByTestId("rows")).toHaveText("[]");
  status = 503;
  await page.getByRole("button", { name: "Relire", exact: true }).click();
  await expect(page.getByTestId("read-error")).toHaveText("Indisponible");
  status = 403;
  await page.getByRole("button", { name: "Relire", exact: true }).click();
  await expect(page.getByTestId("denied")).toHaveText("true");
  await expect(page.getByTestId("rows")).toBeEmpty();
});

test("mocked settings preserve missing values, validate the shared rate contract and explicitly review stale revisions", async ({
  page,
}) => {
  let price: object | null = null;
  const history: object[] = [];
  const sent: Record<string, unknown>[] = [];
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    if (url.endsWith("/events"))
      return route.fulfill({
        contentType: "text/event-stream",
        body: ": verification\n\n",
      });
    if (route.request().method() === "GET")
      return route.fulfill({
        json: url.endsWith("/price") ? price : { history },
      });
    const data = route.request().postDataJSON();
    sent.push(data);
    if (url.endsWith("/price"))
      price = { revision: 1, currency: "MRU", priceMinor: "50000" };
    else {
      if (data.revision !== history.length)
        return route.fulfill({
          status: 409,
          json: { error: "La rémunération a changé." },
        });
      history.push({ ...data, revision: history.length + 1 });
    }
    return route.fulfill({
      json: url.endsWith("/price") ? price : history.at(-1),
    });
  });
  await page.goto("/test/consultation-workflows.harness.html?settings");
  await expect(page.getByTestId("price")).toHaveText("null");
  await expect(page.getByTestId("history")).toHaveText('{"history":[]}');
  await page.getByLabel("Taux").fill("101");
  await page.getByRole("button", { name: "Sauver taux" }).click();
  await expect(page.getByTestId("settings-error")).not.toBeEmpty();
  expect(sent).toHaveLength(0);
  await page.getByLabel("Tarif", { exact: true }).fill("500");
  await page.getByRole("button", { name: "Sauver tarif" }).click();
  await expect(page.getByTestId("price")).toContainText('"priceMinor":"50000"');
  await page.getByLabel("Taux").fill("40");
  await page.getByRole("button", { name: "Sauver taux" }).click();
  await expect(page.getByTestId("history")).toContainText('"rate":"40"');
  await page.getByLabel("Taux").fill("50");
  await page.getByRole("button", { name: "Sauver taux" }).click();
  await expect(page.getByTestId("settings-error")).toHaveText(
    "La rémunération a changé.",
  );
  await page.getByRole("button", { name: "Relire paramètres" }).click();
  await page.getByRole("button", { name: "Sauver taux" }).click();
  await expect(page.getByTestId("history")).toContainText('"rate":"50"');
  await page.getByRole("button", { name: "Relire paramètres" }).click();
  await page.getByRole("button", { name: "Salaire", exact: true }).click();
  await page.getByRole("button", { name: "Sauver taux" }).click();
  await expect(page.getByTestId("history")).toContainText(
    '"mode":"salary","rate":null',
  );
});

test("mocked treatment share retains explicit legacy/missing state instead of a fabricated percentage", async ({
  page,
}) => {
  await page.route("**/api/**", (route) => {
    const url = route.request().url();
    if (url.endsWith("/events"))
      return route.fulfill({
        contentType: "text/event-stream",
        body: ": verification\n\n",
      });
    return route.fulfill({
      json: url.endsWith("/remuneration")
        ? {
            status: "legacy_unsnapshotted",
            remuneration: null,
            shareNumerator: null,
            shareDenominator: null,
          }
        : url.endsWith("/visits")
          ? { visits: [], starts: [], completions: [], appointments: [] }
          : url.includes("/billing/")
            ? { charges: [], totals: [] }
            : url.includes("/notes")
              ? []
              : [consultation],
    });
  });
  await page.goto(
    "/test/consultation-workflows.harness.html?care&start=77777777-7777-4777-8777-777777777777",
  );
  await expect(page.getByTestId("share")).toHaveText(
    '{"status":"legacy_unsnapshotted","remuneration":null,"shareNumerator":null,"shareDenominator":null}',
  );
});
