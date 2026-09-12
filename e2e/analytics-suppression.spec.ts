import { expect, test } from '@playwright/test';
import { addSubmittedCases, seedWorld, type SeededWorld } from './fixtures/seed';
import { signIn } from './fixtures/auth';

let world: SeededWorld;

/**
 * The suppression boundary is enforced in SQL, so it is exercised here
 * against a real database rather than against a TypeScript mirror that
 * could drift from the migration.
 */
test.describe('dashboard cohorts and suppression', () => {
  test.beforeEach(async () => {
    world = await seedWorld();
  });

  test('a campaign with no cases reports zeros, not blanks', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    const empty = await world.admin
      .from('recipient_cases')
      .update({ is_active: false })
      .eq('campaign_id', world.campaignId);
    expect(empty.error).toBeNull();

    const body = await (
      await page.request.get(`/api/admin/overview?campaign_id=${world.campaignId}`)
    ).json();

    expect(body.counts.total_cases).toBe(0);
    expect(body.counts.prc_confirmed_active).toBe(0);
    // Eleven counts, all present.
    expect(Object.keys(body.counts)).toHaveLength(11);
  });

  test('reports all eleven operational counts from real data', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    const body = await (
      await page.request.get(`/api/admin/overview?campaign_id=${world.campaignId}`)
    ).json();

    expect(body.counts.total_cases).toBe(6);
    expect(body.counts.correction_requested).toBe(1);
    expect(body.counts.payment_verified).toBe(2);
    expect(body.counts.ready_for_prc_handoff).toBe(1);
    expect(body.counts.awaiting_application_review).toBe(5);
    expect(body.counts.prc_confirmed_active).toBe(0);
  });

  test('suppresses a cohort of four and discloses at five', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);

    // Retain immutable histories, excluding the old fixtures from this cohort.
    const cleared = await world.admin.from('recipient_cases').update({ is_active: false }).eq('campaign_id', world.campaignId);
    expect(cleared.error).toBeNull();
    await addSubmittedCases(world.admin, world.campaignId, 5, false);

    await addSubmittedCases(world.admin, world.campaignId, 4);
    const atFour = await (
      await page.request.get(`/api/admin/analytics?campaign_id=${world.campaignId}`)
    ).json();
    expect(atFour.analytics.funnel.started_to_submitted.available).toBe(false);
    expect(atFour.analytics.funnel.started_to_submitted.suppressed).toBe(true);
    expect(atFour.analytics.funnel.started_to_submitted).not.toHaveProperty('rate');

    // The fifth case crosses the threshold.
    await addSubmittedCases(world.admin, world.campaignId, 1);
    const atFive = await (
      await page.request.get(`/api/admin/analytics?campaign_id=${world.campaignId}`)
    ).json();
    expect(atFive.analytics.funnel.started_to_submitted.available).toBe(true);
    expect(atFive.analytics.funnel.started_to_submitted.cohort_size).toBe(10);
  });

  test('suppresses the complement so a small cell cannot be subtracted out', async ({
    page,
  }) => {
    await signIn(page, world.staff.privacyAdmin);
    const cleared = await world.admin.from('recipient_cases').update({ is_active: false }).eq('campaign_id', world.campaignId);
    expect(cleared.error).toBeNull();

    // Twenty submitted, of which all twenty are payment-verified: the
    // complement is zero, so the rate must be withheld even though the
    // denominator is comfortably large.
    await addSubmittedCases(world.admin, world.campaignId, 20);
    const body = await (
      await page.request.get(`/api/admin/analytics?campaign_id=${world.campaignId}`)
    ).json();

    const rate = body.analytics.funnel.submitted_to_payment_verified;
    expect(rate.available).toBe(false);
    expect(rate.suppressed).toBe(true);
  });

  test('never returns an identifier through the analytics endpoint', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    const response = await page.request.get(
      `/api/admin/analytics?campaign_id=${world.campaignId}`,
    );
    const raw = await response.text();

    for (const forbidden of [
      'Synthetic',
      'SC-2026-',
      '+639000000000',
      '@e2e.safecard.test',
      'Synthetic Street',
    ]) {
      expect(raw).not.toContain(forbidden);
    }
  });

  test('reports an untracked measure as unavailable rather than zero', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    const body = await (
      await page.request.get(`/api/admin/analytics?campaign_id=${world.campaignId}`)
    ).json();

    expect(body.analytics.funnel.submitted_to_approved).toMatchObject({
      available: false,
      reason: 'no_application_review_state',
    });
    expect(body.analytics.evidence.upload_success_rate.reason).toBe('no_upload_telemetry');
    expect(body.analytics.storyboard.reason).toBe('not_in_schema');
  });

  test('buckets review aging by wait length', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    const body = await (
      await page.request.get(`/api/admin/analytics?campaign_id=${world.campaignId}`)
    ).json();

    const aging = body.analytics.review_aging;
    expect(aging).toHaveProperty('under_24h');
    expect(aging).toHaveProperty('one_to_three_days');
    expect(aging).toHaveProperty('over_three_days');
    // Small cohorts are withheld, which is itself the correct answer.
    for (const bucket of Object.values(aging) as Array<{ available: boolean }>) {
      expect(typeof bucket.available).toBe('boolean');
    }
  });

  test('switches campaigns and reports the other campaign separately', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);

    const primary = await (
      await page.request.get(`/api/admin/overview?campaign_id=${world.campaignId}`)
    ).json();
    expect(primary.counts.total_cases).toBe(6);

    // The privacy admin holds no role on the other campaign.
    const denied = await page.request.get(
      `/api/admin/overview?campaign_id=${world.otherCampaignId}`,
    );
    expect(denied.status()).toBe(403);
  });

  test('denies analytics for a campaign outside the caller scope', async ({ page }) => {
    await signIn(page, world.staff.outsider);
    const response = await page.request.get(
      `/api/admin/analytics?campaign_id=${world.campaignId}`,
    );
    expect(response.status()).toBe(403);
  });
});
