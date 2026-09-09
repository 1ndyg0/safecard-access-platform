import { expect, test } from '@playwright/test';
import { seedWorld, type SeededWorld } from './fixtures/seed';
import { queueReferences, signIn, signInAndOpenQueue } from './fixtures/auth';

let world: SeededWorld;

test.beforeAll(async () => {
  world = await seedWorld();
});

test.describe('submission queue', () => {
  test('filters each workflow state on its own column', async ({ page }) => {
    await signInAndOpenQueue(page, world.staff.privacyAdmin, world.campaignId);

    // Payment filter must not touch the application filter.
    await page.getByLabel('Payment').selectOption('verified_by_official_source');
    await page.getByRole('button', { name: 'Apply' }).click();
    const verified = await queueReferences(page);
    expect(verified).toContain('SC-2026-AAAA0002');
    expect(verified).not.toContain('SC-2026-AAAA0001');

    await page.getByLabel('Payment').selectOption('');
    await page.getByLabel('Application', { exact: true }).selectOption('correction_needed');
    await page.getByRole('button', { name: 'Apply' }).click();
    expect(await queueReferences(page)).toEqual(['SC-2026-AAAA0004']);
  });

  test('a membership value on the consent filter never reaches the database', async ({
    page,
  }) => {
    await signIn(page, world.staff.privacyAdmin);

    // The old implementation OR'd one value across five enum columns,
    // which PostgreSQL rejects outright. The API must refuse it as a
    // validation error, not surface a 500.
    const response = await page.request.get(
      `/api/admin/cases?campaign_id=${world.campaignId}&consent_state=active_confirmed`,
    );
    expect(response.status()).toBe(400);
    expect(response.status()).not.toBe(500);
  });

  test('every independent filter returns only matching rows', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    const checks = [
      { param: 'consent_state=agreed', expectSome: true },
      { param: 'application_state=submitted', expectSome: true },
      { param: 'review_bucket=correction_requested', expectSome: true },
      { param: 'payment_state=verified_by_official_source', expectSome: true },
      { param: 'prc_handoff_state=ready_for_export', expectSome: true },
      { param: 'membership_state=active_confirmed', expectSome: false },
    ];

    for (const check of checks) {
      const response = await page.request.get(
        `/api/admin/cases?campaign_id=${world.campaignId}&${check.param}`,
      );
      expect(response.ok(), `${check.param} should not error`).toBe(true);
      const body = await response.json();
      if (check.expectSome) expect(body.cases.length).toBeGreaterThan(0);
      else expect(body.cases.length).toBe(0);
    }
  });

  test('exact reference search matches one case and rejects a prefix', async ({ page }) => {
    await signInAndOpenQueue(page, world.staff.privacyAdmin, world.campaignId);

    await page.getByLabel('Application reference').fill('SC-2026-AAAA0003');
    await page.getByRole('button', { name: 'Apply' }).click();
    expect(await queueReferences(page)).toEqual(['SC-2026-AAAA0003']);

    const prefix = await page.request.get(
      `/api/admin/cases?campaign_id=${world.campaignId}&application_ref=SC-2026-AAAA`,
    );
    expect(prefix.status()).toBe(400);
  });

  test('longest waiting uses the review-wait clock, not case age', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    const response = await page.request.get(
      `/api/admin/cases?campaign_id=${world.campaignId}&sort=longest_waiting`,
    );
    const body = await response.json();
    const refs: string[] = body.cases.map((row: { application_ref: string }) => row.application_ref);

    // AAAA0006 is the oldest case in the campaign but was resubmitted an
    // hour ago, so it must not lead. AAAA0005 has genuinely been waiting
    // on review the longest.
    expect(refs[0]).toBe('SC-2026-AAAA0005');
    expect(refs.indexOf('SC-2026-AAAA0006')).toBeGreaterThan(refs.indexOf('SC-2026-AAAA0005'));

    // Cases not awaiting review carry no wait and sort last.
    const waiting = body.cases.filter(
      (row: { review_waiting_since: string | null }) => row.review_waiting_since !== null,
    );
    const notWaiting = body.cases.filter(
      (row: { review_waiting_since: string | null }) => row.review_waiting_since === null,
    );
    if (notWaiting.length > 0 && waiting.length > 0) {
      expect(body.cases.indexOf(notWaiting[0])).toBeGreaterThan(
        body.cases.indexOf(waiting[waiting.length - 1]),
      );
    }
  });

  test('newest and oldest sort in opposite directions', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    const newest = await (
      await page.request.get(`/api/admin/cases?campaign_id=${world.campaignId}&sort=newest`)
    ).json();
    const oldest = await (
      await page.request.get(`/api/admin/cases?campaign_id=${world.campaignId}&sort=oldest`)
    ).json();

    expect(new Date(newest.cases[0].created_at).getTime()).toBeGreaterThanOrEqual(
      new Date(oldest.cases[0].created_at).getTime(),
    );
  });

  test('the date range includes the whole of the closing day', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    const today = new Date().toISOString().slice(0, 10);

    const inclusive = await (
      await page.request.get(
        `/api/admin/cases?campaign_id=${world.campaignId}&from=${today}&to=${today}`,
      )
    ).json();
    // Cases seeded moments ago fall on today and must be inside a
    // same-day range, which only holds if `to` covers 23:59:59.999.
    expect(inclusive.pagination.total).toBeGreaterThan(0);
    expect(inclusive.dateRangeTimezone).toBe('UTC');

    const future = await (
      await page.request.get(
        `/api/admin/cases?campaign_id=${world.campaignId}&from=2099-01-01&to=2099-01-02`,
      )
    ).json();
    expect(future.pagination.total).toBe(0);
  });

  test('paginates on the server without repeating or dropping a row', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    const first = await (
      await page.request.get(`/api/admin/cases?campaign_id=${world.campaignId}&limit=2&page=1`)
    ).json();
    const second = await (
      await page.request.get(`/api/admin/cases?campaign_id=${world.campaignId}&limit=2&page=2`)
    ).json();

    expect(first.cases).toHaveLength(2);
    const firstIds = first.cases.map((row: { id: string }) => row.id);
    const secondIds = second.cases.map((row: { id: string }) => row.id);
    expect(firstIds.some((id: string) => secondIds.includes(id))).toBe(false);
    expect(first.pagination.total).toBe(second.pagination.total);
  });

  test('keeps filters in the URL so a view can be shared', async ({ page }) => {
    await signInAndOpenQueue(page, world.staff.privacyAdmin, world.campaignId);
    await page.getByLabel('PRC handoff').selectOption('ready_for_export');
    await page.getByRole('button', { name: 'Apply' }).click();

    await expect(page).toHaveURL(/prc_handoff_state=ready_for_export/);

    // Reloading the shared URL reproduces the same view.
    await page.reload();
    expect(await queueReferences(page)).toEqual(['SC-2026-AAAA0003']);
  });

  test('shows an empty state rather than a blank table', async ({ page }) => {
    await signInAndOpenQueue(
      page,
      world.staff.privacyAdmin,
      world.campaignId,
      'membership_state=active_confirmed',
    );
    await expect(page.getByText(/no submissions match these filters/i)).toBeVisible();
  });

  test('denies a queue request for another campaign', async ({ page }) => {
    await signIn(page, world.staff.outsider);
    const response = await page.request.get(
      `/api/admin/cases?campaign_id=${world.campaignId}`,
    );
    expect(response.status()).toBe(403);
  });

  test('denies staff with no active role', async ({ page }) => {
    await signIn(page, world.staff.unassigned).catch(() => undefined);
    const response = await page.request.get(
      `/api/admin/cases?campaign_id=${world.campaignId}`,
    );
    expect([401, 403]).toContain(response.status());
  });
});
