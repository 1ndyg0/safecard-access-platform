import { expect, test } from '@playwright/test';
import { seedWorld, type SeededWorld } from '../e2e/fixtures/review-seed';
import { signInMember, signInStaff } from '../e2e/fixtures/review-auth';

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
  const ms = Date.now() - start;
  test.info().annotations.push({ type: 'measurement', description: `request_ms=${ms}` });
  return { result, ms };
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

test('a review decision stays within budget with a populated audit ledger', async ({ page }) => {
  const rows = Array.from({ length: 1_000 }, () => ({
    event_type: 'staff_access', actor_id: world.reviewer.userId, actor_type: 'user',
    action: 'Synthetic performance fixture', case_id: world.cases.pendingReview.id,
    campaign_id: world.campaignId, details: {},
  }));
  const inserted = await world.admin.from('audit_events').insert(rows);
  expect(inserted.error).toBeNull();
  await signInStaff(page, world.reviewer);
  const { result, ms } = await timed(() => page.request.post(`/api/admin/cases/${world.cases.pendingReview.id}/review`, {
    data: { decision: 'approved', confirm: true, expected_review_state: 'pending', idempotency_key: 'synthetic-ledger-performance' },
  }));
  expect(result.status()).toBe(200);
  expect((await result.json()).reviewState).toBe('approved');
  expect(ms).toBeLessThan(BUDGET_MS);
});
