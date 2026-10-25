import { expect, test } from "@playwright/test";
test("StrictMode mounted commands serialize same-turn submissions", async ({
  page,
}) => {
  const commands: unknown[] = [];
  await page.route("**/api/**", async (route) => {
    commands.push(route.request().postDataJSON());
    await route.fulfill({ json: { id: "proposal", revision: 1 } });
  });
  await page.goto("/test/treatment-workflows.harness.html");
  await page.getByRole("button", { name: "Enregistrer deux fois" }).click();
  await expect(page.getByRole("status")).toHaveText("Brouillon enregistré");
  expect(commands).toHaveLength(1);
});

test("closing a pending retained-version read cannot reopen its snapshot", async ({
  page,
}) => {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/**", async (route) => {
    await held;
    await route.fulfill({ json: { title: "Version confidentielle" } });
  });
  await page.goto("/test/treatment-workflows.harness.html");
  const request = page.waitForRequest("**/api/treatment/first/version");
  await page.getByRole("button", { name: "Charger la version" }).click();
  await request;
  const cancelled = page.waitForEvent("requestfailed", (request) =>
    request.url().endsWith("/api/treatment/first/version"),
  );
  await page.getByRole("button", { name: "Fermer la version" }).click();
  await cancelled;
  release();
  await expect(page.getByTestId("version")).toBeEmpty();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("late old-patient failures cannot populate the new command scope", async ({
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
  await page.goto("/test/treatment-workflows.harness.html");
  const request = page.waitForRequest("**/api/treatment/first/plans");
  await page.getByRole("button", { name: "Enregistrer deux fois" }).click();
  await request;
  await page.getByRole("button", { name: "Changer de patient" }).click();
  const response = page.waitForResponse("**/api/treatment/first/plans");
  release();
  await response;
  await expect(page.getByText("Patient : second")).toBeVisible();
  await expect(page.getByTestId("busy")).toHaveText("false");
  await expect(page.getByTestId("uncertain")).toHaveText("false");
  await expect(page.getByRole("status")).toBeEmpty();
  await expect(page.getByRole("alert")).toHaveCount(0);
});
