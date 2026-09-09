import { expect, test } from '@playwright/test';
import { addSubmittedCases, seedWorld, type SeededWorld } from '../e2e/fixtures/seed';
import { signIn } from '../e2e/fixtures/auth';

/**
 * Performance characteristics of the operations console.
 *
 * The property under test is not raw speed on a laptop — it is that the
 * dashboard and analytics endpoints do work proportional to the number
 * of *result* rows, not the number of cases in the campaign. Aggregation
 * happens in PostgreSQL, so growing a campaign from a handful of cases
 * to several hundred must not grow the response, and must not grow
 * latency in proportion.
 *
 * A regression here almost always means someone moved a count back into
 * the application server.
 */

const VOLUME = Number(process.env.PERF_CASE_COUNT ?? 400);
const DASHBOARD_BUDGET_MS = Number(process.env.PERF_DASHBOARD_BUDGET_MS ?? 2_000);
const QUEUE_BUDGET_MS = Number(process.env.PERF_QUEUE_BUDGET_MS ?? 2_000);

let world: SeededWorld;

test.beforeAll(async () => {
  test.setTimeout(300_000);
  world = await seedWorld();
  await addSubmittedCases(world.admin, world.campaignId, VOLUME);
});

async function timed<T>(work: () => Promise<T>): Promise<{ result: T; ms: number }> {
  const start = Date.now();
  const result = await work();
  return { result, ms: Date.now() - start };
}

test.describe('scale', () => {
  test('the dashboard aggregates in SQL and returns a constant-size payload', async ({
    page,
  }) => {
    await signIn(page, world.staff.privacyAdmin);

    const { result, ms } = await timed(() =>
      page.request.get(`/api/admin/overview?campaign_id=${world.campaignId}`),
    );
    expect(result.ok()).toBe(true);
    expect(ms).toBeLessThan(DASHBOARD_BUDGET_MS);

    const body = await result.json();
    expect(body.counts.total_cases).toBeGreaterThanOrEqual(VOLUME);

    // The response carries eleven numbers regardless of campaign size.
    // If a case row ever appears here, the aggregation moved out of SQL.
    const raw = JSON.stringify(body);
    expect(raw).not.toContain('SC-2026-COHORT');
    expect(raw.length).toBeLessThan(8_000);
  });

  test('analytics stays constant-size at volume', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    const { result, ms } = await timed(() =>
      page.request.get(`/api/admin/analytics?campaign_id=${world.campaignId}`),
    );
    expect(result.ok()).toBe(true);
    expect(ms).toBeLessThan(DASHBOARD_BUDGET_MS);

    const raw = await result.text();
    expect(raw.length).toBeLessThan(4_000);
    expect(raw).not.toContain('SC-2026-COHORT');
  });

  test('the queue returns one page, not the whole campaign', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    const { result, ms } = await timed(() =>
      page.request.get(`/api/admin/cases?campaign_id=${world.campaignId}&limit=25`),
    );
    expect(result.ok()).toBe(true);
    expect(ms).toBeLessThan(QUEUE_BUDGET_MS);

    const body = await result.json();
    expect(body.cases).toHaveLength(25);
    expect(body.pagination.total).toBeGreaterThanOrEqual(VOLUME);
  });

  test('sorting by longest waiting does not degrade at volume', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    const { result, ms } = await timed(() =>
      page.request.get(
        `/api/admin/cases?campaign_id=${world.campaignId}&sort=longest_waiting&limit=25`,
      ),
    );
    expect(result.ok()).toBe(true);
    expect(ms).toBeLessThan(QUEUE_BUDGET_MS);
    expect((await result.json()).cases).toHaveLength(25);
  });

  test('a deep page costs about the same as the first', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    const first = await timed(() =>
      page.request.get(`/api/admin/cases?campaign_id=${world.campaignId}&limit=25&page=1`),
    );
    const deep = await timed(() =>
      page.request.get(`/api/admin/cases?campaign_id=${world.campaignId}&limit=25&page=10`),
    );

    expect(deep.result.ok()).toBe(true);
    // Generous: catches a linear scan, not ordinary variance.
    expect(deep.ms).toBeLessThan(Math.max(first.ms * 6, QUEUE_BUDGET_MS));
  });
});
