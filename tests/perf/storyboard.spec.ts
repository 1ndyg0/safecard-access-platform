import { expect, test } from '@playwright/test';

/**
 * Storyboard performance, measured the way a reader experiences it.
 *
 * The property under test is that content and telemetry never gate
 * readiness. The page ships fallback content in the server render, so
 * it must be readable before any request to the content or analytics
 * endpoints has resolved — and it must stay readable when both are slow.
 *
 * Deliberately no `networkidle` wait: telemetry continues while the page
 * is read, so a test that waited for idle would be waiting on correct
 * behaviour to stop.
 */

const LCP_BUDGET_MS = Number(process.env.PERF_LCP_BUDGET_MS ?? 2_500);
const CLS_BUDGET = Number(process.env.PERF_CLS_BUDGET ?? 0.1);

test('renders the storyboard even when content and analytics never answer', async ({ page }) => {
  // Both dependencies hang. The page must still be usable.
  await page.route('**/api/content/storyboard', () => {
    /* never fulfilled */
  });
  await page.route('**/api/analytics/storyboard', () => {
    /* never fulfilled */
  });

  const start = Date.now();
  await page.goto('/benefits');
  await expect(page.locator('.benefit-storyboard')).toBeVisible();
  await expect(page.locator('#storyboard-header-ambulance')).toBeVisible();
  expect(Date.now() - start).toBeLessThan(LCP_BUDGET_MS * 2);

  // And still interactive.
  await page.locator('#storyboard-header-ambulance').click();
  await expect(page.locator('#storyboard-panel-ambulance')).toBeVisible();
});

test('meets the mobile LCP budget', async ({ page }) => {
  await page.goto('/benefits');
  await expect(page.locator('.benefit-storyboard')).toBeVisible();

  const lcp = await page.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let latest = 0;
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) latest = entry.startTime;
        });
        observer.observe({ type: 'largest-contentful-paint', buffered: true });
        setTimeout(() => {
          observer.disconnect();
          resolve(latest);
        }, 2_000);
      }),
  );

  expect(lcp).toBeGreaterThan(0);
  expect(lcp).toBeLessThan(LCP_BUDGET_MS);
});

test('stays within the CLS budget while opening a scenario', async ({ page }) => {
  await page.goto('/benefits');
  await expect(page.locator('.benefit-storyboard')).toBeVisible();

  await page.evaluate(() => {
    const win = window as unknown as { __cls: number };
    win.__cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        const shift = entry as unknown as { value: number; hadRecentInput: boolean };
        if (!shift.hadRecentInput) win.__cls += shift.value;
      }
    }).observe({ type: 'layout-shift', buffered: true });
  });

  await page.locator('#storyboard-header-ambulance').click();
  await expect(page.locator('#storyboard-panel-ambulance')).toBeVisible();
  await page.locator('#storyboard-header-blood').click();
  await expect(page.locator('#storyboard-panel-blood')).toBeVisible();

  const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
  expect(cls).toBeLessThanOrEqual(CLS_BUDGET);
});

test('the content endpoint answers within its own bound', async ({ page }) => {
  const start = Date.now();
  const response = await page.request.get('/api/content/storyboard');
  const elapsed = Date.now() - start;

  expect(response.status()).toBe(200);
  // The registry read is bounded at 1.5s; the endpoint must not exceed
  // that by much even when the registry is unreachable.
  expect(elapsed).toBeLessThan(5_000);
});

test('telemetry does not block interaction', async ({ page }) => {
  // Analytics is slow; reading must not be.
  await page.route('**/api/analytics/storyboard', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 5_000));
    await route.fulfill({ status: 204, body: '' });
  });

  await page.goto('/benefits');
  await expect(page.locator('.benefit-storyboard')).toBeVisible();

  const start = Date.now();
  await page.locator('#storyboard-header-ambulance').click();
  await expect(page.locator('#storyboard-panel-ambulance')).toBeVisible();
  await page.locator('#storyboard-header-blood').click();
  await expect(page.locator('#storyboard-panel-blood')).toBeVisible();

  // Two interactions, both while a telemetry request is still hanging.
  expect(Date.now() - start).toBeLessThan(3_000);
});
