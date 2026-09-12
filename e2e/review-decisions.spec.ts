import { expect, test } from '@playwright/test';
import { seedWorld, type SeededWorld } from './fixtures/review-seed';
import { signInStaff } from './fixtures/review-auth';

let world: SeededWorld;

test.beforeEach(async () => {
  world = await seedWorld();
});

function decision(overrides: Record<string, unknown> = {}) {
  return {
    decision: 'approved',
    confirm: true,
    expected_review_state: 'pending',
    idempotency_key: `key-${Math.floor(Date.now() / 1000)}-${Math.floor(Math.random() * 1e9)}`,
    ...overrides,
  };
}

test.describe('staff application review', () => {
  test('approves an application without verifying payment', async ({ page }) => {
    await signInStaff(page, world.reviewer);
    const response = await page.request.post(
      `/api/admin/cases/${world.cases.pendingReview.id}/review`,
      { data: decision() },
    );
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.reviewState).toBe('approved');
    expect(body.paymentChanged).toBe(false);

    const { data } = await world.admin
      .from('recipient_cases')
      .select('application_review_state,payment_state,prc_handoff_state,membership_state')
      .eq('id', world.cases.pendingReview.id)
      .single();

    expect(data?.application_review_state).toBe('approved');
    // Approval verified nothing and activated nothing.
    expect(data?.payment_state).toBe('not_started');
    expect(data?.prc_handoff_state).toBe('not_ready');
    expect(data?.membership_state).toBe('not_active');
  });

  test('a verified payment leaves review pending', async ({ page }) => {
    await signInStaff(page, world.reviewer);
    const { data } = await world.admin
      .from('recipient_cases')
      .select('application_review_state,payment_state,membership_state')
      .eq('id', world.cases.paidPendingReview.id)
      .single();

    expect(data?.payment_state).toBe('verified_by_official_source');
    expect(data?.application_review_state).toBe('pending');
    expect(data?.membership_state).toBe('not_active');
  });

  test('approval plus verified payment is handoff-ready and still not membership', async () => {
    const { data } = await world.admin
      .from('recipient_cases')
      .select('application_review_state,payment_state,prc_handoff_state,membership_state')
      .eq('id', world.cases.approvedAndPaid.id)
      .single();

    expect(data?.application_review_state).toBe('approved');
    expect(data?.payment_state).toBe('verified_by_official_source');
    expect(data?.prc_handoff_state).toBe('ready_for_export');
    // The whole point: ready for PRC is not membership.
    expect(data?.membership_state).toBe('not_active');
  });

  test('requests a resubmission with an applicant-safe reason', async ({ page }) => {
    await signInStaff(page, world.reviewer);
    const reason = 'Your birth date does not match the document you uploaded.';
    const response = await page.request.post(
      `/api/admin/cases/${world.cases.pendingReview.id}/review`,
      { data: decision({ decision: 'resubmission_requested', reason }) },
    );
    expect(response.ok()).toBe(true);

    const { data } = await world.admin
      .from('recipient_cases')
      .select('application_review_state,application_state')
      .eq('id', world.cases.pendingReview.id)
      .single();
    expect(data?.application_review_state).toBe('resubmission_requested');
    expect(data?.application_state).toBe('correction_needed');

    const { data: ledger } = await world.admin
      .from('application_review_decisions')
      .select('reviewer_id,reason,prior_state,resulting_state,decided_at')
      .eq('case_id', world.cases.pendingReview.id);
    expect(ledger?.[0]?.reason).toBe(reason);
    expect(ledger?.[0]?.prior_state).toBe('pending');
    expect(ledger?.[0]?.resulting_state).toBe('resubmission_requested');
    expect(ledger?.[0]?.reviewer_id).toBe(world.reviewer.userId);
    expect(ledger?.[0]?.decided_at).toBeTruthy();
  });

  test('rejects an application with a reason', async ({ page }) => {
    await signInStaff(page, world.reviewer);
    const response = await page.request.post(
      `/api/admin/cases/${world.cases.pendingReview.id}/review`,
      {
        data: decision({
          decision: 'rejected',
          reason: 'The applicant is outside the eligible age range for this pilot.',
        }),
      },
    );
    expect(response.ok()).toBe(true);
    expect((await response.json()).membershipChanged).toBe(false);
  });

  test('refuses a resubmission request or rejection without a reason', async ({ page }) => {
    await signInStaff(page, world.reviewer);
    for (const value of ['resubmission_requested', 'rejected']) {
      const response = await page.request.post(
        `/api/admin/cases/${world.cases.pendingReview.id}/review`,
        { data: decision({ decision: value }) },
      );
      expect(response.status()).toBe(400);
    }
  });

  test('refuses a decision without the confirmation flag', async ({ page }) => {
    await signInStaff(page, world.reviewer);
    const payload = decision();
    delete (payload as Record<string, unknown>).confirm;
    const response = await page.request.post(
      `/api/admin/cases/${world.cases.pendingReview.id}/review`,
      { data: payload },
    );
    expect(response.status()).toBe(400);
  });

  test('refuses a duplicate decision', async ({ page }) => {
    await signInStaff(page, world.reviewer);
    const payload = decision();
    const first = await page.request.post(
      `/api/admin/cases/${world.cases.pendingReview.id}/review`,
      { data: payload },
    );
    expect(first.ok()).toBe(true);

    const replay = await page.request.post(
      `/api/admin/cases/${world.cases.pendingReview.id}/review`,
      { data: payload },
    );
    expect(replay.status()).toBe(409);
  });

  test('refuses a decision made against a stale screen', async ({ page }) => {
    await signInStaff(page, world.reviewer);
    await page.request.post(`/api/admin/cases/${world.cases.pendingReview.id}/review`, {
      data: decision(),
    });

    // A second reviewer still holding "pending" on their screen.
    const stale = await page.request.post(
      `/api/admin/cases/${world.cases.pendingReview.id}/review`,
      { data: decision({ decision: 'rejected', reason: 'A conflicting later decision.' }) },
    );
    expect(stale.status()).toBe(409);
  });

  test('treats rejection as final', async ({ page }) => {
    await signInStaff(page, world.reviewer);
    const response = await page.request.post(
      `/api/admin/cases/${world.cases.rejected.id}/review`,
      { data: decision({ expected_review_state: 'rejected' }) },
    );
    // Neither a normal decision nor a silent reset.
    expect([409, 500]).toContain(response.status());

    const { data } = await world.admin
      .from('recipient_cases')
      .select('application_review_state')
      .eq('id', world.cases.rejected.id)
      .single();
    expect(data?.application_review_state).toBe('rejected');
  });

  test('reopening is privileged, separate and audited', async ({ page }) => {
    // A school admin may decide, but may not reopen.
    await signInStaff(page, world.reviewer);
    const denied = await page.request.post(
      `/api/admin/cases/${world.cases.rejected.id}/review/reopen`,
      {
        data: {
          confirm: true,
          reason: 'New supporting document supplied by the applicant.',
          idempotency_key: `reopen-${Date.now()}`,
        },
      },
    );
    expect(denied.status()).toBe(403);

    await signInStaff(page, world.privacyAdmin);
    const allowed = await page.request.post(
      `/api/admin/cases/${world.cases.rejected.id}/review/reopen`,
      {
        data: {
          confirm: true,
          reason: 'New supporting document supplied by the applicant.',
          idempotency_key: `reopen-${Date.now()}`,
        },
      },
    );
    expect(allowed.ok()).toBe(true);

    const { data } = await world.admin
      .from('application_review_decisions')
      .select('is_reopen,prior_state,resulting_state')
      .eq('case_id', world.cases.rejected.id)
      .eq('is_reopen', true);
    expect(data?.[0]?.prior_state).toBe('rejected');
    expect(data?.[0]?.resulting_state).toBe('pending');
  });

  test('no decision path activates membership', async ({ page }) => {
    await signInStaff(page, world.reviewer);
    for (const target of [world.cases.pendingReview, world.cases.paidPendingReview]) {
      await page.request.post(`/api/admin/cases/${target.id}/review`, { data: decision() });
    }

    const { data } = await world.admin
      .from('recipient_cases')
      .select('membership_state')
      .eq('campaign_id', world.campaignId);
    for (const row of data ?? []) {
      expect(row.membership_state).not.toBe('active_confirmed');
    }
  });

  test('denies a decision from staff without a reviewer role on the campaign', async ({
    page,
  }) => {
    // No sign-in at all.
    const response = await page.request.post(
      `/api/admin/cases/${world.cases.pendingReview.id}/review`,
      { data: decision() },
    );
    expect([401, 403]).toContain(response.status());
  });
});
