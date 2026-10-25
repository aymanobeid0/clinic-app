import { expect, test } from "@playwright/test";
test("settlement requires confirmation and uncertain retry preserves exact funds and command identity", async ({
  page,
}) => {
  const sent: unknown[] = [];
  await page.route("**/api/**", async (route) => {
    sent.push(route.request().postDataJSON());
    if (sent.length === 1) await route.abort();
    else await route.fulfill({ json: { id: "settled" } });
  });
  await page.goto("/test/billing-workflows.harness.html");
  await page.getByLabel("Nouveaux fonds").fill("50");
  await page
    .getByRole("button", { name: "Sans confirmation", exact: true })
    .click();
  await expect(page.getByTestId("uncertain")).toHaveText("false");
  expect(sent).toHaveLength(0);
  await page.getByRole("button", { name: "Confirmer", exact: true }).click();
  await expect(page.getByTestId("uncertain")).toHaveText("true");
  await page.getByLabel("Nouveaux fonds").fill("invalid");
  await page.getByRole("button", { name: "Réessayer", exact: true }).click();
  await expect(page.getByTestId("uncertain")).toHaveText("false");
  expect(sent).toHaveLength(2);
  expect(sent[1]).toEqual(sent[0]);
  expect(sent[1]).toMatchObject({
    newMoney: "50",
    deposit: "0",
    allocations: [
      {
        chargeId: "11111111-1111-4111-8111-111111111111",
        newMoney: "50",
        credit: "30",
      },
    ],
  });
});

test("scope change discards funds and late command failures under StrictMode", async ({
  page,
}) => {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/**", async (route) => {
    await held;
    await route.fulfill({ status: 503, json: { error: "Ancien règlement" } });
  });
  await page.goto("/test/billing-workflows.harness.html");
  await page.getByLabel("Nouveaux fonds").fill("50");
  const request = page.waitForRequest("**/api/billing/first/settlements");
  await page.getByRole("button", { name: "Confirmer", exact: true }).click();
  await request;
  await page.getByRole("button", { name: "Changer de patient" }).click();
  const response = page.waitForResponse("**/api/billing/first/settlements");
  release();
  await response;
  await expect(page.getByLabel("Nouveaux fonds")).toHaveValue("0");
  await expect(page.getByTestId("busy")).toHaveText("false");
  await expect(page.getByTestId("uncertain")).toHaveText("false");
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("planned, due and credit stay separate; output reauthorizes and denial clears snapshots", async ({
  page,
}) => {
  let prints = 0;
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/print")) {
      prints++;
      await route.fulfill(
        prints === 1
          ? {
              json: {
                title: "Reçu",
                settlement: { newMoneyMinor: "5000", creditUsedMinor: "3000" },
              },
            }
          : { status: 403, json: { error: "Impression refusée" } },
      );
    } else if (path.includes("/settlements/"))
      await route.fulfill({
        json: {
          receiptNumber: "R-2026-1",
          newMoneyMinor: "5000",
          creditUsedMinor: "3000",
        },
      });
    else
      await route.fulfill({
        json: {
          totals: [
            {
              currency: "EUR",
              plannedMinor: "9000",
              dueMinor: "2000",
              creditMinor: "3000",
            },
            {
              currency: "MRU",
              plannedMinor: "0",
              dueMinor: "7000",
              creditMinor: "0",
            },
          ],
        },
      });
  });
  await page.goto("/test/billing-workflows.harness.html?read");
  await expect(page.getByTestId("workspace")).toContainText(
    '"plannedMinor":"9000","dueMinor":"2000","creditMinor":"3000"',
  );
  await expect(page.getByTestId("workspace")).toContainText('"currency":"MRU"');
  await page.getByRole("button", { name: "Lire le reçu" }).click();
  await expect(page.getByTestId("document")).toContainText("R-2026-1");
  await page.getByRole("button", { name: "Imprimer", exact: true }).click();
  await expect(page.getByTestId("document")).toContainText(
    '"creditUsedMinor":"3000"',
  );
  await page.getByRole("button", { name: "Imprimer", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Impression refusée");
  expect(prints).toBe(2);
  await expect(page.getByTestId("document")).toBeEmpty();
  await expect(page.getByTestId("workspace")).toBeEmpty();
});

test("changing the selected receipt cancels late output and removes the former document", async ({
  page,
}) => {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/**", async (route) => {
    if (route.request().url().endsWith("/print")) {
      await held;
      await route.fulfill({ json: { title: "Ancien reçu" } });
    } else await route.fulfill({ json: { totals: [] } });
  });
  await page.goto("/test/billing-workflows.harness.html?read");
  const request = page.waitForRequest("**/settlements/first/print");
  await page.getByRole("button", { name: "Imprimer", exact: true }).click();
  await request;
  await page.getByRole("button", { name: "Autre reçu" }).click();
  release();
  await expect(page.getByTestId("document")).toBeEmpty();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("denied output cancels an older workspace read before it can restore confidential data", async ({
  page,
}) => {
  let hold = false,
    release = () => {},
    delivered = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const delivery = new Promise<void>((resolve) => {
    delivered = resolve;
  });
  await page.route("**/api/**", async (route) => {
    if (route.request().url().endsWith("/print")) {
      await route.fulfill({ status: 403, json: { error: "Accès retiré" } });
    } else {
      const delayed = hold;
      if (delayed) await held;
      await route.fulfill({
        json: { totals: [{ currency: "EUR", dueMinor: "confidential" }] },
      });
      if (delayed) delivered();
    }
  });
  await page.goto("/test/billing-workflows.harness.html?read");
  await expect(page.getByTestId("workspace")).toContainText("confidential");
  hold = true;
  const older = page.waitForRequest("**/api/billing/first");
  await page.getByRole("button", { name: "Actualiser" }).click();
  const oldRequest = await older;
  await page.getByRole("button", { name: "Imprimer", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Accès retiré");
  await expect(page.getByTestId("workspace")).toBeEmpty();
  release();
  await delivery;
  await (await oldRequest.response())?.finished();
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await expect(page.getByTestId("workspace")).toBeEmpty();
});

test("successful correction retires a prepared summary until an authorized fresh read", async ({
  page,
}) => {
  let changed = false;
  await page.route("**/api/**", async (route) => {
    if (route.request().method() === "POST") {
      changed = true;
      await route.fulfill({ json: { id: "correction" } });
    } else if (route.request().url().endsWith("/summary"))
      await route.fulfill({
        json: { dueMinor: changed ? "6000" : "10000", invoiceReferences: [] },
      });
    else await route.fulfill({ json: { totals: [] } });
  });
  await page.goto("/test/billing-workflows.harness.html?read&summary");
  await page.getByRole("button", { name: "Lire le reçu" }).click();
  await expect(page.getByTestId("document")).toContainText("10000");
  const correction = page.waitForResponse("**/api/billing/first/credits");
  await page.getByRole("button", { name: "Ajuster la charge" }).click();
  await correction;
  await expect(page.getByTestId("document")).toBeEmpty();
  await page.getByRole("button", { name: "Lire le reçu" }).click();
  await expect(page.getByTestId("document")).toContainText("6000");
});

test("workspace denial cancels pending document output as well", async ({
  page,
}) => {
  let denied = false,
    release = () => {},
    delivered = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  const delivery = new Promise<void>((resolve) => {
    delivered = resolve;
  });
  await page.route("**/api/**", async (route) => {
    if (route.request().url().endsWith("/print")) {
      await held;
      await route.fulfill({ json: { title: "Confidential receipt" } });
      delivered();
    } else
      await route.fulfill(
        denied
          ? { status: 404, json: { error: "Dossier retiré" } }
          : { json: { totals: [] } },
      );
  });
  await page.goto("/test/billing-workflows.harness.html?read");
  await expect(page.getByTestId("workspace")).toContainText("totals");
  const pending = page.waitForRequest("**/settlements/first/print");
  await page.getByRole("button", { name: "Imprimer", exact: true }).click();
  const request = await pending;
  denied = true;
  const response = page.waitForResponse("**/api/billing/first");
  await page.getByRole("button", { name: "Actualiser" }).click();
  await response;
  release();
  await delivery;
  await (await request.response())?.finished();
  await page.evaluate(() => new Promise(requestAnimationFrame));
  await expect(page.getByTestId("document")).toBeEmpty();
  await expect(page.getByTestId("workspace")).toBeEmpty();
});
