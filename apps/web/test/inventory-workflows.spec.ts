import { expect, test } from "@playwright/test";
const batchId = "11111111-1111-4111-8111-111111111111";
test("scope change drops drafts and ignores a late command failure under StrictMode", async ({
  page,
}) => {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/**", async (route) => {
    if (route.request().method() === "POST") {
      await held;
      await route.fulfill({ status: 503, json: { error: "Ancien mouvement" } });
    } else if (route.request().url().endsWith("/events")) await route.abort();
    else await route.fulfill({ json: { batches: [] } });
  });
  await page.goto("/test/inventory-workflows.harness.html");
  await page.getByLabel("Motif").fill("Brouillon privé");
  const request = page.waitForRequest("**/api/inventory/corrections");
  await page.getByRole("button", { name: "Confirmer", exact: true }).click();
  await request;
  await page.getByRole("button", { name: "Changer de compte" }).click();
  const response = page.waitForResponse("**/api/inventory/corrections");
  release();
  await response;
  await expect(page.getByLabel("Motif")).toHaveValue("Paquet endommagé");
  await expect(page.getByTestId("busy")).toHaveText("false");
  await expect(page.getByTestId("uncertain")).toHaveText("false");
  await expect(page.getByRole("alert")).toHaveCount(0);
});
for (const message of ["Lot périmé", "Stock insuffisant"]) {
  test(`server conflict ${message} refreshes stock and allows a new corrected command`, async ({
    page,
  }) => {
    let changed = false;
    await page.route("**/api/**", async (route) => {
      if (route.request().method() === "POST") {
        changed = true;
        await route.fulfill({ status: 409, json: { error: message } });
      } else if (route.request().url().endsWith("/events")) await route.abort();
      else await route.fulfill({ json: { availablePacks: changed ? 0 : 5 } });
    });
    await page.goto("/test/inventory-workflows.harness.html");
    await expect(page.getByTestId("stock")).toContainText("5");
    await page.getByRole("button", { name: "Confirmer", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText(message);
    await expect(page.getByTestId("uncertain")).toHaveText("false");
    await expect(page.getByTestId("stock")).toContainText("0");
  });
}
test("revoked inventory read clears stock and drafts and disables commands", async ({
  page,
}) => {
  let revoked = false,
    writes = 0;
  await page.route("**/api/**", async (route) => {
    if (route.request().method() === "POST") {
      writes++;
      await route.fulfill({ json: { id: "unexpected" } });
    } else if (route.request().url().endsWith("/events")) await route.abort();
    else if (route.request().url().endsWith("/identity"))
      await route.fulfill({ status: 401, json: { error: "Session retirée" } });
    else
      await route.fulfill(
        revoked
          ? { status: 403, json: { error: "Accès retiré" } }
          : { json: { batches: [{ batchNumber: "Privé" }] } },
      );
  });
  await page.goto("/test/inventory-workflows.harness.html");
  await expect(page.getByTestId("stock")).toContainText("Privé");
  await page.getByLabel("Motif").fill("Privé");
  revoked = true;
  await page.getByRole("button", { name: "Actualiser", exact: true }).click();
  await expect(page.getByTestId("stock")).toBeEmpty();
  await expect(page.getByTestId("denied")).toHaveText("true");
  await expect(page.getByLabel("Motif")).toHaveValue("Paquet endommagé");
  await page.getByRole("button", { name: "Confirmer", exact: true }).click();
  expect(writes).toBe(0);
});
test("inventory-only permissions are required even for manager authority", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/api/**", async (route) => {
    requests++;
    await route.fulfill({ json: {} });
  });
  await page.goto("/test/inventory-workflows.harness.html?denied&manager");
  await expect(page.getByTestId("denied")).toHaveText("true");
  await page.getByRole("button", { name: "Confirmer", exact: true }).click();
  expect(requests).toBe(0);
});
test("stock classifications refresh at the next UTC day without a server event", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-25T23:59:59Z") });
  let nextDay = false;
  await page.route("**/api/**", async (route) => {
    if (route.request().url().endsWith("/events"))
      await route.fulfill({
        status: 200,
        contentType: "text/event-stream",
        body: ": connected\n\n",
      });
    else await route.fulfill({ json: { expired: nextDay } });
  });
  await page.goto("/test/inventory-workflows.harness.html");
  await expect(page.getByTestId("stock")).toContainText('"expired":false');
  nextDay = true;
  await page.clock.runFor(1100);
  await expect(page.getByTestId("stock")).toContainText('"expired":true');
});
for (const scenario of [
  {
    action: "item",
    path: "items",
    payload: {
      name: "Gants",
      active: true,
      lowStockThreshold: 2,
      expiryRequired: false,
    },
  },
  {
    action: "updateItem",
    path: `items/${batchId}`,
    target: batchId,
    payload: {
      name: "Gants",
      active: false,
      lowStockThreshold: 3,
      expiryRequired: false,
      revision: 2,
    },
  },
  {
    action: "supplier",
    path: "suppliers",
    payload: { name: "Fournisseur", active: true },
  },
  {
    action: "updateSupplier",
    path: `suppliers/${batchId}`,
    target: batchId,
    payload: { name: "Fournisseur", active: false, revision: 1 },
  },
  {
    action: "settings",
    path: "settings",
    payload: { revision: 0, expiryWarningDays: 10 },
  },
  {
    action: "receive",
    path: "receiving",
    payload: {
      itemId: batchId,
      supplierId: batchId,
      batchNumber: "Lot-1",
      quantityPacks: 4,
      totalCostMinor: "1200",
      currency: "EUR",
      expiresOn: "2026-10-25",
    },
  },
  {
    action: "consume",
    path: "consume",
    payload: { batchId, quantityPacks: 1 },
  },
  {
    action: "correction",
    path: "corrections",
    payload: {
      batchId,
      revision: 1,
      kind: "count",
      countedPacks: 0,
      reason: "Inventaire",
    },
  },
  {
    action: "correction",
    path: "corrections",
    payload: {
      batchId,
      revision: 2,
      kind: "disposal",
      quantityPacks: 2,
      reason: "Périmé",
    },
  },
]) {
  test(`authorized ${scenario.action} ${scenario.payload.kind ?? ""} uses existing endpoint and contract`, async ({
    page,
  }) => {
    let body: Record<string, unknown> | undefined;
    await page.route("**/api/**", async (route) => {
      if (route.request().method() === "POST") {
        expect(new URL(route.request().url()).pathname).toBe(
          `/api/inventory/${scenario.path}`,
        );
        body = route.request().postDataJSON();
        await route.fulfill({ json: { id: "saved" } });
      } else if (route.request().url().endsWith("/events")) await route.abort();
      else await route.fulfill({ json: { batches: [] } });
    });
    await page.goto(
      `/test/inventory-workflows.harness.html?action=${scenario.action}&manager&target=${scenario.target ?? ""}`,
    );
    await page.getByLabel("Payload").fill(JSON.stringify(scenario.payload));
    await page.getByRole("button", { name: "Préparer", exact: true }).click();
    const response = page.waitForResponse(`**/api/inventory/${scenario.path}`);
    await page.getByRole("button", { name: "Confirmer", exact: true }).click();
    await response;
    expect(body).toEqual({
      ...scenario.payload,
      commandId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    });
  });
}
test("whole packs and reasons validate before writes; uncertain retry keeps the exact movement", async ({
  page,
}) => {
  const sent: unknown[] = [];
  await page.route("**/api/**", async (route) => {
    if (route.request().method() === "POST") {
      sent.push(route.request().postDataJSON());
      if (sent.length === 1) await route.abort();
      else await route.fulfill({ json: { id: "movement" } });
    } else if (route.request().url().endsWith("/events")) await route.abort();
    else
      await route.fulfill({
        json: { availablePacks: sent.length === 2 ? 4 : 5 },
      });
  });
  await page.goto("/test/inventory-workflows.harness.html");
  await expect(page.getByTestId("stock")).toContainText("5");
  await page.getByLabel("Paquets").fill("0.5");
  await page.getByRole("button", { name: "Confirmer", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Vérifiez");
  expect(sent).toHaveLength(0);
  await page.getByLabel("Paquets").fill("1");
  await page.getByLabel("Motif").fill(" ");
  await page.getByRole("button", { name: "Confirmer", exact: true }).click();
  expect(sent).toHaveLength(0);
  await page.getByLabel("Motif").fill("Cassé");
  await page
    .getByRole("button", { name: "Sans confirmation", exact: true })
    .click();
  expect(sent).toHaveLength(0);
  await page.getByRole("button", { name: "Confirmer", exact: true }).click();
  await expect(page.getByTestId("uncertain")).toHaveText("true");
  await page.getByLabel("Paquets").fill("99");
  await page.getByRole("button", { name: "Réessayer", exact: true }).click();
  await expect(page.getByTestId("uncertain")).toHaveText("false");
  expect(sent).toHaveLength(2);
  expect(sent[1]).toEqual(sent[0]);
  await expect(page.getByTestId("stock")).toContainText("4");
});
test("review: uncertain retry conflict refreshes stock", async ({ page }) => {
  let posts = 0;
  await page.route("**/api/**", async (route) => {
    if (route.request().method() === "POST") {
      posts++;
      if (posts === 1) await route.abort();
      else
        await route.fulfill({
          status: 409,
          json: { error: "Stock insuffisant" },
        });
    } else if (route.request().url().endsWith("/events"))
      await route.fulfill({ status: 204 });
    else await route.fulfill({ json: { availablePacks: posts >= 2 ? 0 : 5 } });
  });
  await page.goto("/test/inventory-workflows.harness.html");
  await expect(page.getByTestId("stock")).toContainText('"availablePacks":5');
  await page.getByRole("button", { name: "Confirmer", exact: true }).click();
  await expect(page.getByTestId("uncertain")).toHaveText("true");
  await page.getByRole("button", { name: "Réessayer", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Stock insuffisant");
  await expect(page.getByTestId("stock")).toContainText('"availablePacks":0', {
    timeout: 1000,
  });
});
