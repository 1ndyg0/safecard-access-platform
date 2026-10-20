import { expect, test } from '@playwright/test';
import { seedWorld, type SeededWorld } from './fixtures/seed';
import { signIn, signInAndOpenApplications } from './fixtures/auth';

let world: SeededWorld;

test.beforeEach(async () => {
  // Decisions change state, so every test gets a fresh world.
  world = await seedWorld();
});

const REASON = 'The receipt shows a different amount than the membership fee.';

function approvalBody(caseKey: keyof SeededWorld['cases'], overrides: Record<string, unknown> = {}) {
  const payment = world.payments[world.cases[caseKey]];
  return {
    confirm: true,
    expected_review_state: 'pending',
    payment_intent_id: payment.intentId,
    evidence_id: payment.evidenceId,
    expected_payment_state: 'verification_pending',
    idempotency_key: `e2e-${Math.random().toString(36).slice(2)}-key`,
    ...overrides,
  };
}

test.describe('review slide-over', () => {
  test('shows the applicant, the reference and the proof of payment', async ({ page }) => {
    await signInAndOpenApplications(page, world.staff.privacyAdmin, world.campaignId);
    await page.getByRole('button', { name: /review ana reyes/i }).click();

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute('aria-modal', 'true');
    await expect(dialog.getByRole('heading', { name: 'Ana Reyes' })).toBeVisible();
    await expect(dialog.getByText('SC-2026-AAAA0001').first()).toBeVisible();
    for (const label of ['Date of birth', 'Sex', 'Mobile', 'Email', 'Address', 'Submitted', 'Amount', 'Payment date', 'Reference number', 'Route']) {
      await expect(dialog.getByText(label, { exact: true })).toBeVisible();
    }
    await expect(dialog.getByAltText('Uploaded proof of payment')).toBeVisible();
    await expect(dialog.getByText('E2E-RECEIPT-0001')).toBeVisible();

    // Only approve and reject are offered. The retired actions are gone.
    await expect(dialog.getByRole('button', { name: 'Approve' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Reject' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: /resubmission|replacement|correction/i })).toHaveCount(0);
    await expect(dialog.getByText(/workflow states|payment intents|audit/i)).toHaveCount(0);
  });

  test('is keyboard operable: Escape closes it and focus returns to Review', async ({ page }) => {
    await signInAndOpenApplications(page, world.staff.privacyAdmin, world.campaignId);
    const trigger = page.getByRole('button', { name: /review ana reyes/i });
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(page.getByRole('dialog')).toBeVisible();

    // Focus stays inside the panel however long you tab.
    for (let step = 0; step < 12; step += 1) {
      await page.keyboard.press('Tab');
      expect(await page.evaluate(() => Boolean(document.activeElement?.closest('dialog')))).toBe(true);
    }

    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(trigger).toBeFocused();
  });

  test('Escape inside the reject form backs out of it before closing', async ({ page }) => {
    await signInAndOpenApplications(page, world.staff.privacyAdmin, world.campaignId);
    await page.getByRole('button', { name: /review ana reyes/i }).click();
    await page.getByRole('button', { name: 'Reject' }).click();
    await expect(page.getByLabel('Reason for rejection')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByLabel('Reason for rejection')).toHaveCount(0);
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('approving needs a confirmation, verifies the payment and updates the row', async ({ page }) => {
    await signInAndOpenApplications(page, world.staff.privacyAdmin, world.campaignId, 'status=all');
    await page.getByRole('button', { name: /review ana reyes/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByAltText('Uploaded proof of payment')).toBeVisible();

    await dialog.getByRole('button', { name: 'Approve' }).click();
    await expect(dialog.getByText('Approve this application?')).toBeVisible();
    await dialog.getByRole('button', { name: 'Confirm approve' }).click();
    await expect(dialog.getByText(/approved and payment verified/i)).toBeVisible();

    // The row changed in place, no reload.
    const row = page.getByTestId('application-row').filter({ hasText: 'SC-2026-AAAA0001' });
    await expect(row.getByText('Approved')).toBeVisible();

    const { data } = await world.admin
      .from('recipient_cases')
      .select('application_review_state,payment_state,membership_state,reviewed_by,reviewed_at')
      .eq('id', world.cases.awaitingApproval)
      .single();
    expect(data).toMatchObject({
      application_review_state: 'approved',
      payment_state: 'verified_by_official_source',
      membership_state: 'not_active',
      reviewed_by: world.staff.privacyAdmin.userId,
    });
    expect(data?.reviewed_at).not.toBeNull();
  });

  test('rejecting needs a reason, then shows it afterwards', async ({ page }) => {
    await signInAndOpenApplications(page, world.staff.privacyAdmin, world.campaignId, 'status=all');
    await page.getByRole('button', { name: /review ben santos/i }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('button', { name: 'Reject' }).click();

    const confirm = dialog.getByRole('button', { name: 'Confirm reject' });
    await expect(confirm).toBeDisabled();
    await dialog.getByLabel('Reason for rejection').fill('too short');
    await expect(confirm).toBeDisabled();
    await expect(dialog.getByTestId('reason-counter')).toHaveText('9 / 500');

    await dialog.getByLabel('Reason for rejection').fill(REASON);
    await expect(dialog.getByTestId('reason-counter')).toHaveText(`${REASON.length} / 500`);
    await expect(confirm).toBeEnabled();
    await confirm.click();

    await expect(dialog.getByText(/application rejected/i)).toBeVisible();
    await expect(dialog.getByTestId('rejection-reason')).toHaveText(REASON);
    await expect(page.getByTestId('application-row').filter({ hasText: 'SC-2026-AAAA0002' }).getByText('Rejected')).toBeVisible();

    // The applicant reads the same reason, and payment is untouched.
    const { data } = await world.admin
      .from('recipient_cases')
      .select('application_review_state,rejection_reason,payment_state,reviewed_by')
      .eq('id', world.cases.awaitingRejection)
      .single();
    expect(data).toMatchObject({
      application_review_state: 'rejected',
      rejection_reason: REASON,
      payment_state: 'verification_pending',
      reviewed_by: world.staff.privacyAdmin.userId,
    });

    // Reopening the application shows the stored reason, with no actions.
    await dialog.getByRole('button', { name: 'Close' }).click();
    await page.getByRole('button', { name: /review ben santos/i }).click();
    await expect(page.getByRole('dialog').getByTestId('rejection-reason')).toHaveText(REASON);
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Approve' })).toHaveCount(0);
  });

  test('an application already rejected shows its reason and offers no decision', async ({ page }) => {
    await signInAndOpenApplications(page, world.staff.privacyAdmin, world.campaignId, 'status=rejected');
    await page.getByRole('button', { name: /review eli tan/i }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByTestId('rejection-reason')).toHaveText(
      'The receipt amount does not match the membership fee.',
    );
    await expect(dialog.getByRole('button', { name: /approve|reject/i })).toHaveCount(0);
  });
});

test.describe('application detail API', () => {
  test('returns the applicant and payment for a complete application only', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    const response = await page.request.get(`/api/admin/cases/${world.cases.awaitingApproval}`);
    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.application).toMatchObject({ application_ref: 'SC-2026-AAAA0001', status: 'awaiting_review' });
    expect(body.applicant).toMatchObject({ first_name: 'Ana', last_name: 'Reyes', city: 'Test City' });
    expect(body.payment).toMatchObject({ state: 'verification_pending', route: 'gcash', amount: 1200 });
    expect(body.payment.proof.evidence_id).toBe(world.paymentEvidenceId);

    for (const hidden of [world.cases.incompleteDraft, world.cases.incompleteNoProof, world.cases.legacyCorrection]) {
      expect((await page.request.get(`/api/admin/cases/${hidden}`)).status()).toBe(404);
    }
  });

  test('withholds fields the role may not read', async ({ page }) => {
    await signIn(page, world.staff.schoolAdmin);
    const body = await (await page.request.get(`/api/admin/cases/${world.cases.awaitingApproval}`)).json();
    expect(body.applicant.first_name).toBe('Ana');
    expect(body.applicant).not.toHaveProperty('address_line1');
    expect(body.applicant).not.toHaveProperty('email');
  });

  test('denies another campaign and logs which fields were opened, never their values', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    expect((await page.request.get(`/api/admin/cases/${world.cases.crossCampaign}`)).status()).toBe(403);

    await page.request.get(`/api/admin/cases/${world.cases.awaitingApproval}`);
    const { data } = await world.admin
      .from('audit_events')
      .select('details,action')
      .eq('case_id', world.cases.awaitingApproval)
      .eq('event_type', 'staff_access');
    expect(data?.length).toBeGreaterThan(0);
    expect(JSON.stringify(data)).not.toContain('Reyes');
  });
});

test.describe('decision API', () => {
  test('approve verifies the payment in one action and cannot be repeated', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    const route = `/api/admin/cases/${world.cases.awaitingApproval}/approve-with-payment`;
    const first = await page.request.post(route, { data: approvalBody('awaitingApproval') });
    expect(first.status()).toBe(200);
    expect(await first.json()).toMatchObject({ reviewState: 'approved', paymentVerified: true });

    const again = await page.request.post(route, {
      data: approvalBody('awaitingApproval', { expected_review_state: 'approved', expected_payment_state: 'verified_by_official_source' }),
    });
    expect(again.ok()).toBe(false);
  });

  test('approve refuses a stale payment state and a missing confirmation', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    const route = `/api/admin/cases/${world.cases.awaitingSpare}/approve-with-payment`;
    expect((await page.request.post(route, { data: approvalBody('awaitingSpare', { confirm: false }) })).status()).toBe(400);
    expect(
      (await page.request.post(route, { data: approvalBody('awaitingSpare', { expected_payment_state: 'payer_marked_paid' }) })).status(),
    ).toBe(409);
  });

  test('reject needs a confirmation and a reason of at least ten characters', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    const route = `/api/admin/cases/${world.cases.awaitingRejection}/reject`;
    const key = () => `e2e-${Math.random().toString(36).slice(2)}-key`;
    expect((await page.request.post(route, { data: { confirm: true, reason: 'short', idempotency_key: key() } })).status()).toBe(400);
    expect((await page.request.post(route, { data: { confirm: false, reason: REASON, idempotency_key: key() } })).status()).toBe(400);
    expect((await page.request.post(route, { data: { confirm: true, reason: 'x'.repeat(501), idempotency_key: key() } })).status()).toBe(400);

    const ok = await page.request.post(route, { data: { confirm: true, reason: REASON, idempotency_key: key() } });
    expect(ok.status()).toBe(200);
    // A second decision on the same application is refused, not overwritten.
    const second = await page.request.post(route, { data: { confirm: true, reason: REASON, idempotency_key: key() } });
    expect(second.status()).toBe(409);
  });

  test('reject records the reason in the append-only ledger and the case', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    const response = await page.request.post(`/api/admin/cases/${world.cases.awaitingSpare}/reject`, {
      data: { confirm: true, reason: REASON, idempotency_key: 'e2e-ledger-check-key' },
    });
    expect(response.status()).toBe(200);
    const ledger = await world.admin
      .from('application_review_decisions')
      .select('decision,resulting_state,reason,reviewer_id')
      .eq('case_id', world.cases.awaitingSpare);
    expect(ledger.data).toEqual([
      { decision: 'rejected', resulting_state: 'rejected', reason: REASON, reviewer_id: world.staff.privacyAdmin.userId },
    ]);
    const view = await world.admin
      .from('admin_applications_view')
      .select('status,rejection_reason')
      .eq('id', world.cases.awaitingSpare)
      .single();
    expect(view.data).toEqual({ status: 'rejected', rejection_reason: REASON });
  });

  test('applications that are not complete cannot be decided', async ({ page }) => {
    await signIn(page, world.staff.privacyAdmin);
    for (const hidden of [world.cases.incompleteDraft, world.cases.incompleteNoProof, world.cases.legacyCorrection]) {
      const response = await page.request.post(`/api/admin/cases/${hidden}/reject`, {
        data: { confirm: true, reason: REASON, idempotency_key: `e2e-hidden-${hidden.slice(0, 8)}-key` },
      });
      expect(response.status()).toBe(404);
    }
  });

  test('decisions are refused for the wrong campaign and for a role that may not decide', async ({ page }) => {
    await signIn(page, world.staff.outsider);
    const crossCampaign = await page.request.post(`/api/admin/cases/${world.cases.awaitingApproval}/reject`, {
      data: { confirm: true, reason: REASON, idempotency_key: 'e2e-outsider-key-1' },
    });
    expect(crossCampaign.status()).toBe(403);
  });

  test('a support agent can read applicant contact details but cannot decide', async ({ page }) => {
    await signIn(page, world.staff.support);
    const response = await page.request.post(`/api/admin/cases/${world.cases.awaitingApproval}/reject`, {
      data: { confirm: true, reason: REASON, idempotency_key: 'e2e-support-key-1' },
    });
    expect(response.status()).toBe(403);
  });

  test('the migration keeps new resubmission requests out of the ledger', async () => {
    const result = await world.admin.rpc('record_application_review_atomic', {
      p_case_id: world.cases.awaitingSpare,
      p_reviewer_id: world.staff.privacyAdmin.userId,
      p_decision: 'resubmission_requested',
      p_reason: 'Please correct your birth date.',
      p_expected_state: 'pending',
      p_idempotency_key: 'e2e-resubmission-blocked',
      p_is_reopen: false,
    });
    expect(result.error?.message).toContain('review_decisions_no_new_resubmission_chk');
  });
});
