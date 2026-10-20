import { expect, test } from '@playwright/test';
import { seedWorld, type SeededWorld } from './fixtures/seed';
import { signIn } from './fixtures/auth';

let world: SeededWorld;

test.beforeAll(async () => {
  world = await seedWorld();
});

test.describe('case detail and role scoping', () => {
  test('a school administrator reaches payment evidence and no address or contact field', async ({
    page,
  }) => {
    await signIn(page, world.staff.schoolAdmin);
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

  test('shows the workflow states independently', async ({ page }) => {
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
    await page.request.get(`/api/admin/cases/${world.cases.approvedVerified}`);

    const { data } = await world.admin
      .from('audit_events')
      .select('event_type,action,details')
      .eq('case_id', world.cases.approvedVerified)
      .eq('event_type', 'staff_access');

    expect((data ?? []).length).toBeGreaterThan(0);
    // Field names are logged; values are not.
    const details = JSON.stringify(data?.[0]?.details ?? {});
    expect(details).toContain('fields_disclosed');
    expect(details).not.toContain('Synthetic Street');
  });
});

test.describe('approving with payment verification', () => {
  test.beforeEach(async () => {
    world = await seedWorld();
  });

  const approval = (overrides: Record<string, unknown> = {}) => ({
    confirm: true,
    expected_review_state: 'pending',
    payment_intent_id: world.paymentIntentId,
    evidence_id: world.paymentEvidenceId,
    expected_payment_state: 'verification_pending',
    idempotency_key: `approve-${Math.floor(Math.random() * 1e12)}`,
    ...overrides,
  });
  const route = () => `/api/admin/cases/${world.cases.approvedUnverifiedPayment}/approve-with-payment`;

  test('one approval approves the application and verifies the payment', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    const response = await page.request.post(route(), { data: approval() });
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.reviewState).toBe('approved');
    expect(body.paymentVerified).toBe(true);
    expect(body.paymentState).toBe('verified_by_official_source');

    const { data } = await world.admin
      .from('recipient_cases')
      .select('payment_state,membership_state,application_state,application_review_state')
      .eq('id', world.cases.approvedUnverifiedPayment)
      .single();

    expect(data?.application_review_state).toBe('approved');
    expect(data?.payment_state).toBe('verified_by_official_source');
    // Approval does not change the other state machines.
    expect(data?.membership_state).toBe('not_active');
    expect(data?.application_state).toBe('submitted');
  });

  test('a school administrator can approve with payment verification without any finance role', async ({ page }) => {
    await signIn(page, world.staff.schoolAdmin);
    const response = await page.request.post(route(), { data: approval() });
    expect(response.ok()).toBe(true);
    expect((await response.json()).paymentVerified).toBe(true);
  });

  test('refuses a decision made against a stale screen', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    const first = await page.request.post(route(), { data: approval() });
    expect(first.ok()).toBe(true);

    // The same screen replayed must not verify twice.
    const second = await page.request.post(route(), { data: approval() });
    expect(second.status()).toBe(409);
  });

  test('refuses without the explicit confirmation flag', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    const response = await page.request.post(route(), { data: approval({ confirm: undefined }) });
    expect(response.status()).toBe(400);
  });

  test('refuses an intent that belongs to another case', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    const response = await page.request.post(
      `/api/admin/cases/${world.cases.approvedVerified}/approve-with-payment`,
      { data: approval() },
    );
    expect(response.status()).toBe(404);
  });

  test('denies approval and payment actions to a support agent', async ({ page }) => {
    await signIn(page, world.staff.support);
    const approve = await page.request.post(route(), { data: approval() });
    expect(approve.status()).toBe(403);
    const replace = await page.request.post(
      `/api/admin/cases/${world.cases.approvedUnverifiedPayment}/request-payment-proof`,
      {
        data: {
          confirm: true,
          payment_intent_id: world.paymentIntentId,
          evidence_id: world.paymentEvidenceId,
          expected_payment_state: 'verification_pending',
          reason: 'The receipt is unreadable. Please upload a clearer photo.',
        },
      },
    );
    expect(replace.status()).toBe(403);
  });

  test('retired separate payment routes no longer exist', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    const verify = await page.request.post(
      `/api/admin/cases/${world.cases.approvedUnverifiedPayment}/payment`,
      { data: { action: 'verify_payment' } },
    );
    expect(verify.status()).toBe(404);
    const legacy = await page.request.post('/api/payment/verify', { data: {} });
    expect(legacy.status()).toBe(404);
  });

  test('asks the applicant for a replacement proof with a reason and records it', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    const reason = 'The receipt is unreadable. Please upload a clearer photo of the full slip.';
    const response = await page.request.post(
      `/api/admin/cases/${world.cases.approvedUnverifiedPayment}/request-payment-proof`,
      {
        data: {
          confirm: true,
          payment_intent_id: world.paymentIntentId,
          evidence_id: world.paymentEvidenceId,
          expected_payment_state: 'verification_pending',
          reason,
        },
      },
    );
    expect(response.ok()).toBe(true);
    expect((await response.json()).evidenceState).toBe('reupload_requested');

    const { data } = await world.admin
      .from('audit_events')
      .select('details,severity')
      .eq('case_id', world.cases.approvedUnverifiedPayment)
      .eq('event_type', 'payment_status_change');

    expect(JSON.stringify(data)).toContain(reason);

    const { data: caseRow } = await world.admin
      .from('recipient_cases')
      .select('application_review_state,payment_state')
      .eq('id', world.cases.approvedUnverifiedPayment)
      .single();
    // Asking for a new proof decides nothing about the application.
    expect(caseRow?.application_review_state).toBe('pending');
    expect(caseRow?.payment_state).toBe('verification_pending');
  });

  test('shows the audit timeline with prior and resulting states', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    await page.request.post(route(), { data: approval() });

    const body = await (
      await page.request.get(`/api/admin/cases/${world.cases.approvedUnverifiedPayment}/audit`)
    ).json();
    const change = body.events.find(
      (event: { priorState: string | null }) => event.priorState === 'verification_pending',
    );
    expect(change).toBeTruthy();
    expect(change.resultingState).toBe('verified_by_official_source');
    expect(change.actorName).toBe('Privacy Admin');
    expect(change.severity).toBe('info');
  });

  test('no path through the console activates membership', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    await page.request.post(route(), { data: approval() });

    const { data } = await world.admin
      .from('recipient_cases')
      .select('membership_state')
      .eq('campaign_id', world.campaignId);

    for (const row of data ?? []) {
      expect(row.membership_state).not.toBe('active_confirmed');
    }
  });
});
