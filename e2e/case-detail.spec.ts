import { expect, test } from '@playwright/test';
import { seedWorld, type SeededWorld } from './fixtures/seed';
import { signIn } from './fixtures/auth';

let world: SeededWorld;

test.beforeAll(async () => {
  world = await seedWorld();
});

test.describe('case detail and role scoping', () => {
  test('a finance reviewer reaches payment evidence and no unrelated profile field', async ({
    page,
  }) => {
    await signIn(page, world.staff.finance);
    const response = await page.request.get(
      `/api/admin/cases/${world.cases.approvedUnverifiedPayment}`,
    );
    expect(response.ok()).toBe(true);
    const body = await response.json();

    expect(body.capabilities.canViewPayments).toBe(true);
    expect(body.capabilities.canActOnPayments).toBe(true);
    expect(body.payments.length).toBeGreaterThan(0);

    // The withheld fields must be absent from the payload, not merely
    // hidden on screen.
    const serialized = JSON.stringify(body);
    expect(body.profile).not.toHaveProperty('date_of_birth');
    expect(body.profile).not.toHaveProperty('address_line1');
    expect(body.profile).not.toHaveProperty('mobile_number');
    expect(serialized).not.toContain('1 Synthetic Street');
    expect(serialized).not.toContain('+639000000000');
  });

  test('a support agent sees callback details and no payment data', async ({ page }) => {
    await signIn(page, world.staff.support);
    const body = await (
      await page.request.get(`/api/admin/cases/${world.cases.approvedUnverifiedPayment}`)
    ).json();

    expect(body.capabilities.canViewPayments).toBe(false);
    expect(body.payments).toEqual([]);
    expect(body.profile).toHaveProperty('mobile_number');
    expect(body.profile).not.toHaveProperty('date_of_birth');
    expect(body.profile).not.toHaveProperty('address_line1');
  });

  test('denies a case belonging to another campaign', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    const response = await page.request.get(`/api/admin/cases/${world.cases.crossCampaign}`);
    // A 403 rather than an empty 200: a silent empty body still confirms
    // whether the id exists in the caller's campaign.
    expect(response.status()).toBe(403);
  });

  test('shows the five workflow states independently', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    await page.goto(`/admin/submissions/${world.cases.verifiedPaymentPendingReview}`);

    await expect(page.getByRole('heading', { name: 'SC-2026-AAAA0002' })).toBeVisible();
    const states = page.locator('.state-grid article');
    await expect(states).toHaveCount(5);
    await expect(page.getByText('verified by official source')).toBeVisible();
    await expect(page.getByText('not active')).toBeVisible();
  });

  test('records case access in the audit trail', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    await page.request.get(`/api/admin/cases/${world.cases.handoffReady}`);

    const { data } = await world.admin
      .from('audit_events')
      .select('event_type,action,details')
      .eq('case_id', world.cases.handoffReady)
      .eq('event_type', 'staff_access');

    expect((data ?? []).length).toBeGreaterThan(0);
    // Field names are logged; values are not.
    const details = JSON.stringify(data?.[0]?.details ?? {});
    expect(details).toContain('fields_disclosed');
    expect(details).not.toContain('Synthetic Street');
  });
});

test.describe('payment verification', () => {
  test.beforeEach(async () => {
    world = await seedWorld();
  });

  test('verifies one payment and leaves membership untouched', async ({ page }) => {
    await signIn(page, world.staff.finance);

    const response = await page.request.post(
      `/api/admin/cases/${world.cases.approvedUnverifiedPayment}/payment`,
      {
        data: {
          action: 'verify_payment',
          payment_intent_id: world.paymentIntentId,
          confirm: true,
          evidence_id: world.paymentEvidenceId,
          expected_payment_state: 'verification_pending',
        },
      },
    );
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.paymentState).toBe('verified_by_official_source');
    expect(body.membershipChanged).toBe(false);

    const { data } = await world.admin
      .from('recipient_cases')
      .select('payment_state,membership_state,application_state,prc_handoff_state')
      .eq('id', world.cases.approvedUnverifiedPayment)
      .single();

    expect(data?.payment_state).toBe('verified_by_official_source');
    // The decisive assertion: money did not activate anything.
    expect(data?.membership_state).toBe('not_active');
    expect(data?.application_state).toBe('submitted');
    expect(data?.prc_handoff_state).toBe('not_ready');
  });

  test('refuses a decision made against a stale screen', async ({ page }) => {
    await signIn(page, world.staff.finance);
    const payload = {
      action: 'verify_payment',
      payment_intent_id: world.paymentIntentId,
      confirm: true,
      evidence_id: world.paymentEvidenceId,
      expected_payment_state: 'verification_pending',
    };

    const first = await page.request.post(
      `/api/admin/cases/${world.cases.approvedUnverifiedPayment}/payment`,
      { data: payload },
    );
    expect(first.ok()).toBe(true);

    // The same decision replayed must not verify twice.
    const second = await page.request.post(
      `/api/admin/cases/${world.cases.approvedUnverifiedPayment}/payment`,
      { data: payload },
    );
    expect(second.status()).toBe(409);
  });

  test('refuses without the explicit confirmation flag', async ({ page }) => {
    await signIn(page, world.staff.finance);
    const response = await page.request.post(
      `/api/admin/cases/${world.cases.approvedUnverifiedPayment}/payment`,
      {
        data: {
          action: 'verify_payment',
          payment_intent_id: world.paymentIntentId,
          evidence_id: world.paymentEvidenceId,
          expected_payment_state: 'verification_pending',
        },
      },
    );
    expect(response.status()).toBe(400);
  });

  test('refuses an intent that belongs to another case', async ({ page }) => {
    await signIn(page, world.staff.finance);
    const response = await page.request.post(
      `/api/admin/cases/${world.cases.handoffReady}/payment`,
      {
        data: {
          action: 'verify_payment',
          payment_intent_id: world.paymentIntentId,
          confirm: true,
          evidence_id: world.paymentEvidenceId,
          expected_payment_state: 'verification_pending',
        },
      },
    );
    expect(response.status()).toBe(404);
  });

  test('denies payment actions to a support agent', async ({ page }) => {
    await signIn(page, world.staff.support);
    const response = await page.request.post(
      `/api/admin/cases/${world.cases.approvedUnverifiedPayment}/payment`,
      {
        data: {
          action: 'verify_payment',
          payment_intent_id: world.paymentIntentId,
          confirm: true,
          evidence_id: world.paymentEvidenceId,
          expected_payment_state: 'verification_pending',
        },
      },
    );
    expect(response.status()).toBe(403);
  });

  test('requests replacement evidence with a reason and records it', async ({ page }) => {
    await signIn(page, world.staff.finance);
    const reason = 'The receipt is unreadable. Please upload a clearer photo of the full slip.';
    const response = await page.request.post(
      `/api/admin/cases/${world.cases.approvedUnverifiedPayment}/payment`,
      {
        data: {
          action: 'request_reupload',
          payment_intent_id: world.paymentIntentId,
          confirm: true,
          reason,
          expected_payment_state: 'verification_pending',
        },
      },
    );
    expect(response.ok()).toBe(true);
    expect((await response.json()).membershipChanged).toBe(false);

    const { data } = await world.admin
      .from('audit_events')
      .select('details,severity')
      .eq('case_id', world.cases.approvedUnverifiedPayment)
      .eq('event_type', 'payment_status_change');

    expect(JSON.stringify(data)).toContain(reason);
  });

  test('shows the audit timeline with prior and resulting states', async ({ page }) => {
    await signIn(page, world.staff.finance);
    await page.request.post(`/api/admin/cases/${world.cases.approvedUnverifiedPayment}/payment`, {
      data: {
        action: 'verify_payment',
        payment_intent_id: world.paymentIntentId,
        confirm: true,
        evidence_id: world.paymentEvidenceId,
        expected_payment_state: 'verification_pending',
      },
    });

    const body = await (
      await page.request.get(`/api/admin/cases/${world.cases.approvedUnverifiedPayment}/audit`)
    ).json();
    const change = body.events.find(
      (event: { priorState: string | null }) => event.priorState === 'verification_pending',
    );
    expect(change).toBeTruthy();
    expect(change.resultingState).toBe('verified_by_official_source');
    expect(change.actorName).toBe('Finance Reviewer');
    expect(change.severity).toBe('warning');
  });

  test('no path through the console activates membership', async ({ page }) => {
    await signIn(page, world.staff.finance);
    await page.request.post(`/api/admin/cases/${world.cases.approvedUnverifiedPayment}/payment`, {
      data: {
        action: 'verify_payment',
        payment_intent_id: world.paymentIntentId,
        confirm: true,
        evidence_id: world.paymentEvidenceId,
        expected_payment_state: 'verification_pending',
      },
    });

    const { data } = await world.admin
      .from('recipient_cases')
      .select('membership_state')
      .eq('campaign_id', world.campaignId);

    for (const row of data ?? []) {
      expect(row.membership_state).not.toBe('active_confirmed');
    }
  });
});
