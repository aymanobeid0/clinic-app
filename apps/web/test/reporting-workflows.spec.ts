import { expect, test } from "@playwright/test";
import { createHash } from "node:crypto";
const exportId = "22222222-2222-4222-8222-222222222222";
const receipt = () => ({
  id: exportId,
  status: "ready",
  expiresAt: new Date(Date.now() + 900000).toISOString(),
  mediaType: "application/json",
  size: 2,
  sha256: createHash("sha256").update("{}").digest("hex"),
});
test("financial projections preserve reconciled currency strings and never fabricate zero data on failure", async ({
  page,
}) => {
  let fail = false;
  await page.route("**/api/**", async (route) => {
    if (route.request().url().includes("/events")) return route.abort();
    await route.fulfill(
      fail
        ? { status: 503, json: { error: "Rapport indisponible" } }
        : {
            json: {
              date: "2026-10-26",
              balanceAsOf: "2026-10-26T00:00:00Z",
              totals: [
                {
                  currency: "MRU",
                  newMoneyMinor: "700",
                  appliedCreditMinor: "300",
                  openingMinor: "150",
                  adjustmentMinor: "-50",
                  dueMinor: "200",
                  creditMinor: "100",
                  plannedMinor: "9007199254740993",
                },
              ],
              patients: [],
            },
          },
    );
  });
  await page.goto("/test/reporting-workflows.harness.html");
  await expect(page.getByTestId("data")).toContainText(
    '"plannedMinor":"9007199254740993"',
  );
  await expect(page.getByTestId("data")).toContainText(
    '"appliedCreditMinor":"300"',
  );
  fail = true;
  await page.getByLabel("Date").fill("2026-10-27");
  await expect(page.getByRole("alert")).toHaveText("Rapport indisponible");
  await expect(page.getByTestId("data")).toBeEmpty();
});
test("export lifecycle verifies private bytes and preserves a valid receipt when cleaning expired artifacts", async ({
  page,
}) => {
  await page.route("**/api/**", async (route) => {
    const url = route.request().url();
    if (url.includes("/events")) return route.abort();
    if (url.endsWith("/exports/cleanup"))
      return route.fulfill({ json: { deleted: 0 } });
    if (url.endsWith("/exports"))
      return route.fulfill({ status: 201, json: receipt() });
    if (url.endsWith("/content"))
      return route.fulfill({ body: "{}", contentType: "application/json" });
    return route.fulfill({ json: {} });
  });
  await page.goto("/test/reporting-workflows.harness.html");
  await page.getByRole("button", { name: "Exporter", exact: true }).click();
  await expect(page.getByTestId("export-status")).toHaveText("ready");
  await page.getByRole("button", { name: "Télécharger", exact: true }).click();
  await expect(page.getByTestId("downloaded")).toHaveText("2");
  await page.getByRole("button", { name: "Nettoyer", exact: true }).click();
  await expect(page.getByTestId("export-status")).toHaveText("ready");
});
test("follow-up uncertain retry retains the exact command despite edited input", async ({
  page,
}) => {
  const writes: object[] = [];
  await page.route("**/api/**", async (route) => {
    if (route.request().method() === "POST") {
      writes.push(route.request().postDataJSON());
      if (writes.length === 1) return route.abort();
      return route.fulfill({ json: { id: "task", revision: 1 } });
    }
    if (route.request().url().includes("/events")) return route.abort();
    return route.fulfill({
      json: {
        tasks: [],
        pendingNotes: [{ id: "note:visit", kind: "pending_note" }],
      },
    });
  });
  await page.goto("/test/reporting-workflows.harness.html?view=tasks");
  await expect(page.getByTestId("data")).toContainText("pending_note");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByTestId("uncertain")).toHaveText("true");
  await page.getByLabel("Échéance").fill("2026-11-10");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await page.getByRole("button", { name: "Réessayer", exact: true }).click();
  await expect(page.getByTestId("uncertain")).toHaveText("false");
  expect(writes).toHaveLength(2);
  expect(writes[1]).toEqual(writes[0]);
  expect(writes[0]).toMatchObject({
    dueOn: "2026-10-27",
    commandId: expect.any(String),
  });
});
for (const query of [
  "?denied&view=tasks",
  "?historical&manager",
  "?denied&manager&view=stock",
]) {
  test(`scope denial issues no reports, task or export requests ${query}`, async ({
    page,
  }) => {
    let requests = 0;
    await page.route("**/api/**", async (r) => {
      requests++;
      await r.fulfill({ json: {} });
    });
    await page.goto("/test/reporting-workflows.harness.html" + query);
    await expect(page.getByTestId("denied")).toHaveText("true");
    await page.getByRole("button", { name: "Actualiser", exact: true }).click();
    await page
      .getByRole("button", { name: "Enregistrer", exact: true })
      .click();
    await page.getByRole("button", { name: "Exporter", exact: true }).click();
    expect(requests).toBe(0);
  });
}
test("manual share and task history use authorized GETs and send nothing", async ({
  page,
}) => {
  const paths: string[] = [];
  await page.route("**/api/**", async (r) => {
    paths.push(
      r.request().method() + " " + new URL(r.request().url()).pathname,
    );
    if (r.request().url().includes("/events")) return r.abort();
    await r.fulfill({
      json: r.request().url().endsWith("/share")
        ? { delivery: "manual", text: "Bonjour, contactez la clinique." }
        : { events: [{ revision: 2, status: "completed" }] },
    });
  });
  await page.goto("/test/reporting-workflows.harness.html?view=share");
  await expect(page.getByTestId("data")).toContainText('"delivery":"manual"');
  await page.goto("/test/reporting-workflows.harness.html?view=history");
  await expect(page.getByTestId("data")).toContainText('"revision":2');
  expect(paths.every((p) => p.startsWith("GET "))).toBe(true);
});
test("task retry conflict refreshes current projection for explicit revision review", async ({
  page,
}) => {
  let writes = 0;
  await page.route("**/api/**", async (r) => {
    if (r.request().method() === "POST") {
      writes++;
      if (writes === 1) return r.abort();
      return r.fulfill({ status: 409, json: { error: "Révision modifiée" } });
    }
    if (r.request().url().includes("/events")) return r.abort();
    await r.fulfill({
      json: { tasks: [{ revision: writes ? 2 : 1 }], pendingNotes: [] },
    });
  });
  await page.goto("/test/reporting-workflows.harness.html?view=tasks&update");
  await expect(page.getByTestId("data")).toContainText('"revision":1');
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByTestId("uncertain")).toHaveText("true");
  await page.getByRole("button", { name: "Réessayer", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Révision modifiée");
  await expect(page.getByTestId("data")).toContainText('"revision":2');
  await expect(page.getByTestId("uncertain")).toHaveText("false");
});
test("report revocation clears private data and task draft", async ({
  page,
}) => {
  let revoked = false;
  await page.route("**/api/**", async (r) => {
    if (r.request().url().includes("/events")) return r.abort();
    await r.fulfill(
      revoked
        ? { status: 403, json: { error: "Accès retiré" } }
        : { json: { tasks: [{ id: "Privé" }], pendingNotes: [] } },
    );
  });
  await page.goto("/test/reporting-workflows.harness.html?view=tasks");
  await expect(page.getByTestId("data")).toContainText("Privé");
  await page.getByLabel("Échéance").fill("2027-01-01");
  revoked = true;
  await page.getByRole("button", { name: "Actualiser", exact: true }).click();
  await expect(page.getByTestId("denied")).toHaveText("true");
  await expect(page.getByTestId("data")).toBeEmpty();
  await expect(page.getByLabel("Échéance")).toHaveValue("2026-10-27");
});
for (const status of [403, 410, 200]) {
  test(`export delivery refuses revoked, expired or corrupt content ${status}`, async ({
    page,
  }) => {
    await page.route("**/api/**", async (r) => {
      const url = r.request().url();
      if (url.includes("/events")) return r.abort();
      if (url.endsWith("/exports"))
        return r.fulfill({ status: 201, json: receipt() });
      if (url.endsWith("/content"))
        return r.fulfill(
          status === 200
            ? { body: "xx" }
            : {
                status,
                json: {
                  error: status === 410 ? "Export expiré" : "Accès retiré",
                },
              },
        );
      return r.fulfill({ json: {} });
    });
    await page.goto("/test/reporting-workflows.harness.html");
    await page.getByRole("button", { name: "Exporter", exact: true }).click();
    await expect(page.getByTestId("export-status")).toHaveText("ready");
    await page
      .getByRole("button", { name: "Télécharger", exact: true })
      .click();
    await expect(page.getByRole("alert")).toContainText(
      status === 200
        ? "ne correspond pas"
        : status === 410
          ? "Export expiré"
          : "Accès retiré",
    );
    await expect(page.getByTestId("downloaded")).toBeEmpty();
    if (status === 403)
      await expect(page.getByTestId("export-denied")).toHaveText("true");
    if (status === 410)
      await expect(page.getByTestId("export-status")).toHaveText("expired");
  });
}
test("export expiry removes its receipt without a download request", async ({
  page,
}) => {
  await page.clock.install({ time: new Date() });
  await page.route("**/api/**", async (r) => {
    if (r.request().url().includes("/events")) return r.abort();
    await r.fulfill({
      json:
        r.request().method() === "POST"
          ? {
              ...receipt(),
              expiresAt: new Date(Date.now() + 1000).toISOString(),
            }
          : {},
    });
  });
  await page.goto("/test/reporting-workflows.harness.html");
  await page.getByRole("button", { name: "Exporter", exact: true }).click();
  await expect(page.getByTestId("export-status")).toHaveText("ready");
  await page.clock.runFor(1500);
  await expect(page.getByTestId("export-status")).toHaveText("expired");
});
test("scope transition retires a late export result and drops task draft", async ({
  page,
}) => {
  let release = () => {};
  const held = new Promise<void>((r) => {
    release = r;
  });
  await page.route("**/api/**", async (r) => {
    if (r.request().url().includes("/events")) return r.abort();
    if (r.request().method() === "POST") {
      await held;
      return r.fulfill({ json: receipt() });
    }
    return r.fulfill({ json: {} });
  });
  await page.goto("/test/reporting-workflows.harness.html");
  await page.getByLabel("Échéance").fill("2027-01-01");
  const request = page.waitForRequest("**/api/exports");
  await page.getByRole("button", { name: "Exporter", exact: true }).click();
  await request;
  await page
    .getByRole("button", { name: "Changer de compte", exact: true })
    .click();
  release();
  await expect(page.getByTestId("export-status")).toHaveText("idle");
  await expect(page.getByLabel("Échéance")).toHaveValue("2026-10-27");
});
test("stock UTC expiry refresh and invalid report dates preserve honest empty states", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-26T23:59:59Z") });
  let nextDay = false;
  await page.route("**/api/**", async (r) => {
    if (r.request().url().includes("/events"))
      return r.fulfill({
        contentType: "text/event-stream",
        body: ": connected\n\n",
      });
    return r.fulfill({
      json: {
        asOfDate: nextDay ? "2026-10-27" : "2026-10-26",
        lowStock: [],
        expiring: [],
        expired: nextDay ? [{ id: "expired" }] : [],
      },
    });
  });
  await page.goto("/test/reporting-workflows.harness.html?view=stock");
  await expect(page.getByTestId("data")).toContainText('"expired":[]');
  nextDay = true;
  await page.clock.runFor(1100);
  await expect(page.getByTestId("data")).toContainText('"id":"expired"');
  await page.goto("/test/reporting-workflows.harness.html");
  await page.getByLabel("Date").fill("invalid");
  await expect(page.getByTestId("data")).toBeEmpty();
});
test("export lost response retries the identical request without a second generation command", async ({
  page,
}) => {
  const writes: object[] = [];
  await page.route("**/api/**", async (r) => {
    if (r.request().url().includes("/events")) return r.abort();
    if (r.request().method() === "POST") {
      writes.push(r.request().postDataJSON());
      if (writes.length === 1) return r.abort();
      return r.fulfill({ json: receipt() });
    }
    return r.fulfill({ json: {} });
  });
  await page.goto("/test/reporting-workflows.harness.html");
  await page.getByRole("button", { name: "Exporter", exact: true }).click();
  await expect(page.getByTestId("export-status")).toHaveText("uncertain");
  await page
    .getByRole("button", { name: "Réessayer export", exact: true })
    .click();
  await expect(page.getByTestId("export-status")).toHaveText("ready");
  expect(writes).toHaveLength(2);
  expect(writes[1]).toEqual(writes[0]);
});
test("changing the follow-up patient retires an uncertain command before retry", async ({
  page,
}) => {
  let writes = 0;
  await page.route("**/api/**", async (r) => {
    if (r.request().url().includes("/events")) return r.abort();
    if (r.request().method() === "POST") {
      writes++;
      return r.abort();
    }
    return r.fulfill({ json: {} });
  });
  await page.goto("/test/reporting-workflows.harness.html");
  await page.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await expect(page.getByTestId("uncertain")).toHaveText("true");
  await page
    .getByRole("button", { name: "Changer de patient", exact: true })
    .click();
  await expect(page.getByTestId("uncertain")).toHaveText("false");
  await page.getByRole("button", { name: "Réessayer", exact: true }).click();
  expect(writes).toBe(1);
});
test("returning to a prior account does not resurrect its prepared export", async ({
  page,
}) => {
  await page.route("**/api/**", async (r) => {
    if (r.request().url().includes("/events")) return r.abort();
    return r.fulfill({
      json: r.request().method() === "POST" ? receipt() : {},
    });
  });
  await page.goto("/test/reporting-workflows.harness.html");
  await page.getByRole("button", { name: "Exporter", exact: true }).click();
  await expect(page.getByTestId("export-status")).toHaveText("ready");
  await page
    .getByRole("button", { name: "Changer de compte", exact: true })
    .click();
  await expect(page.getByTestId("export-status")).toHaveText("idle");
  await page
    .getByRole("button", { name: "Changer de compte", exact: true })
    .click();
  await expect(page.getByTestId("export-status")).toHaveText("idle");
});
test("independent review: cleaned artifact404 permits fresh export generation", async ({
  page,
}) => {
  let creates = 0;
  await page.route("**/api/**", async (r) => {
    const path = new URL(r.request().url()).pathname;
    if (path.includes("/events")) return r.abort();
    if (path === "/api/exports") {
      creates++;
      return r.fulfill({
        json: {
          id: "22222222-2222-4222-8222-222222222222",
          status: "ready",
          expiresAt: new Date(Date.now() + 900000).toISOString(),
          mediaType: "application/json",
          size: 2,
          sha256: createHash("sha256").update("{}").digest("hex"),
        },
      });
    }
    if (path.endsWith("/content"))
      return r.fulfill({ status: 404, json: { error: "Export introuvable." } });
    return r.fulfill({ json: {} });
  });
  await page.goto("/test/reporting-workflows.harness.html");
  await page.getByRole("button", { name: "Exporter", exact: true }).click();
  await expect(page.getByTestId("export-status")).toHaveText("ready");
  await page.getByRole("button", { name: "Télécharger", exact: true }).click();
  await expect(page.getByRole("alert")).toHaveText("Export introuvable.");
  await page.getByRole("button", { name: "Exporter", exact: true }).click();
  await expect.poll(() => creates).toBe(2);
});
