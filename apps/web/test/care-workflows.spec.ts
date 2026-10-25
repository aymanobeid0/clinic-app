import { expect, test } from "@playwright/test";
test("note draft and late error cannot cross patient scope under StrictMode", async ({
  page,
}) => {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/**", async (route) => {
    await held;
    await route.fulfill({
      status: 503,
      json: { error: "Ancien dossier indisponible" },
    });
  });
  await page.goto("/test/care-workflows.harness.html");
  await page
    .getByLabel("Note", { exact: true })
    .fill("Note confidentielle du premier patient");
  const request = page.waitForRequest(
    "**/api/clinical/first/notes/first/draft",
  );
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await request;
  await page.getByRole("button", { name: "Changer de patient" }).click();
  const response = page.waitForResponse(
    "**/api/clinical/first/notes/first/draft",
  );
  release();
  await response;
  await expect(page.getByLabel("Note", { exact: true })).toHaveValue("");
  await expect(page.getByTestId("busy")).toHaveText("false");
  await expect(page.getByTestId("uncertain")).toHaveText("false");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("uncertain prescription retries its original values even after the form becomes invalid", async ({
  page,
}) => {
  const sent: unknown[] = [];
  await page.route("**/api/**", async (route) => {
    sent.push(route.request().postDataJSON());
    if (sent.length === 1) await route.abort();
    else
      await route.fulfill({
        json: {
          id: "first",
          revision: 1,
          current: null,
          draft: null,
          events: [],
        },
      });
  });
  await page.goto("/test/care-workflows.harness.html?prescription");
  await page
    .getByLabel("Médicament", { exact: true })
    .fill("Référence fictive");
  await page.getByRole("button", { name: "Compléter", exact: true }).click();
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByTestId("uncertain")).toHaveText("true");
  await page.getByLabel("Médicament", { exact: true }).fill("");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByTestId("uncertain")).toHaveText("false");
  expect(sent).toHaveLength(2);
  expect(sent[1]).toEqual(sent[0]);
  await expect(page.getByLabel("Médicament", { exact: true })).toHaveValue("");
});

test("prescription draft and late error cannot cross patient scope under StrictMode", async ({
  page,
}) => {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/**", async (route) => {
    await held;
    await route.fulfill({
      status: 503,
      json: { error: "Ancien dossier indisponible" },
    });
  });
  await page.goto("/test/care-workflows.harness.html?prescription");
  await page
    .getByLabel("Médicament", { exact: true })
    .fill("Note confidentielle du premier patient");
  await page.getByRole("button", { name: "Compléter", exact: true }).click();
  const request = page.waitForRequest(
    "**/api/clinical/first/prescriptions/first/draft",
  );
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await request;
  await page.getByRole("button", { name: "Changer de patient" }).click();
  const response = page.waitForResponse(
    "**/api/clinical/first/prescriptions/first/draft",
  );
  release();
  await response;
  await expect(page.getByLabel("Médicament", { exact: true })).toHaveValue("");
  await expect(page.getByTestId("busy")).toHaveText("false");
  await expect(page.getByTestId("uncertain")).toHaveText("false");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("transient clinical read failures retain the tab draft, denial removes the unauthorized snapshot", async ({
  page,
}) => {
  let status = 200;
  await page.route("**/api/**", (route) =>
    route.fulfill({
      status,
      json:
        status === 200
          ? [{ text: "Dossier confidentiel" }]
          : { error: status === 503 ? "Indisponible" : "Accès retiré" },
    }),
  );
  await page.goto("/test/care-workflows.harness.html?read");
  await page.getByLabel("Saisie locale").fill("Texte non enregistré");
  status = 503;
  await page.getByRole("button", { name: "Relire", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Indisponible");
  await expect(page.getByLabel("Saisie locale")).toHaveValue(
    "Texte non enregistré",
  );
  status = 404;
  await page.getByRole("button", { name: "Relire", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Accès retiré");
  await expect(
    page.getByRole("region", { name: "Dossier", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText("Dossier confidentiel")).toHaveCount(0);
});
