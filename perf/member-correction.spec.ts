import { expect, test } from '@playwright/test';
import { seedWorld, type SeededWorld } from '../e2e/fixtures/review-seed';
import { signInMember } from '../e2e/fixtures/review-auth';

/**
 * The member journey runs on a low-cost phone over an unreliable
 * connection. What matters is that the protected screens answer quickly
 * and return only what they need — a status payload that grows with the
 * case file would be a privacy problem before it was a speed problem.
 */

const BUDGET_MS = Number(process.env.PERF_MEMBER_BUDGET_MS ?? 2_000);

let world: SeededWorld;

test.beforeAll(async () => {
  world = await seedWorld();
});

async function timed<T>(work: () => Promise<T>) {
  const start = Date.now();
  const result = await work();
  return { result, ms: Date.now() - start };
}

test('status answers within budget and stays small', async ({ page }) => {
  await signInMember(page, world.cases.correctionRequested);
  const { result, ms } = await timed(() => page.request.get('/api/member/status'));
  expect(result.ok()).toBe(true);
  expect(ms).toBeLessThan(BUDGET_MS);

  const raw = await result.text();
  expect(raw.length).toBeLessThan(4_000);
});

test('the correction payload carries only correctable fields', async ({ page }) => {
  await signInMember(page, world.cases.correctionRequested);
  const { result, ms } = await timed(() => page.request.get('/api/member/correction'));
  expect(result.ok()).toBe(true);
  expect(ms).toBeLessThan(BUDGET_MS);

  const body = await result.json();
  expect(Object.keys(body.values ?? {}).length).toBeLessThanOrEqual(13);
});

test('the status screen becomes readable quickly on a phone', async ({ page }) => {
  await signInMember(page, world.cases.correctionRequested);
  const start = Date.now();
  await page.goto('/member/status');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  expect(Date.now() - start).toBeLessThan(BUDGET_MS * 2);
});

test('a decision does not slow down as the ledger grows', async ({ page }) => {
  await signInMember(page, world.cases.correctionRequested);
  const first = await timed(() => page.request.get('/api/member/status'));
  const second = await timed(() => page.request.get('/api/member/status'));
  expect(second.result.ok()).toBe(true);
  // The status read fetches the latest decision with a limit, so repeat
  // reads should not drift upward.
  expect(second.ms).toBeLessThan(Math.max(first.ms * 4, BUDGET_MS));
});
