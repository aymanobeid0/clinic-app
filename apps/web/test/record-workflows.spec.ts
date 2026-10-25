import { expect, test, type Page } from '@playwright/test';
async function mockApi(page: Page) {
  await page.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    const data = path.endsWith('/attachments')
      ? route.request().method() === 'POST'
        ? { id: 'file', revision: 1 }
        : {
            attachments: [],
            usage: {
              retainedBytes: 0,
              reservedBytes: 0,
              limitBytes: 2000000000,
              fileLimitBytes: 20000000,
            },
          }
      : path === '/api/historical'
        ? []
        : { cutoff: '2026-10-01T00:00:00Z', clinical: [], attachments: [] };
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(data),
    });
  });
}
test('StrictMode replay leaves mounted attachment commands usable', async ({
  page,
}) => {
  await mockApi(page);
  await page.goto('/test/record-workflows.harness.html');
  await page.getByRole('button', { name: 'Téléverser', exact: true }).click();
  await expect(page.getByRole('status')).toHaveText('uploaded');
  await expect(page.getByRole('alert')).toHaveCount(0);
});
test('StrictMode replay leaves historical snapshot refresh usable', async ({
  page,
}) => {
  await mockApi(page);
  await page.goto('/test/record-workflows.harness.html');
  await page.getByRole('button', { name: 'Recharger historique' }).click();
  await expect(page.getByTestId('cutoff')).toHaveText('2026-10-01T00:00:00Z');
  await expect(page.getByRole('alert')).toHaveCount(0);
});
test('late upload failure cannot move feedback into a newly selected patient', async ({
  page,
}) => {
  await mockApi(page);
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route('**/api/patients/first/attachments?*', async (route) => {
    if (route.request().method() !== 'POST') return route.fallback();
    await held;
    await route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Old patient failure' }),
    });
  });
  await page.goto('/test/record-workflows.harness.html');
  const started = page.waitForRequest((request) => request.method() === 'POST');
  await page.getByRole('button', { name: 'Téléverser', exact: true }).click();
  await started;
  await page.getByRole('button', { name: 'Changer de patient' }).click();
  const completed = page.waitForResponse(
    (response) => response.request().method() === 'POST',
  );
  release();
  await completed;
  await expect(page.getByText('Patient : second')).toBeVisible();
  await expect(page.getByTestId('attachment-busy')).toHaveText('false');
  await expect(page.getByTestId('attachment-uncertain')).toHaveText('false');
  await expect(page.getByRole('alert')).toHaveCount(0);
});
