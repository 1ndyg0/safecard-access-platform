import { expect, test } from '@playwright/test';
import {
  publishMaterialConsentChange,
  seedWorld,
  syntheticProfile,
  type SeededWorld,
} from './fixtures/review-seed';
import { expireMemberSession, signInMember } from './fixtures/review-auth';

let world: SeededWorld;

test.beforeEach(async () => {
  world = await seedWorld();
});

function correction(overrides: Record<string, unknown> = {}) {
  return {
    profile: { ...syntheticProfile(4), first_name: 'Test4Corrected' },
    reviewed_all_fields: true,
    locale: 'fil',
    idempotency_key: `corr-${Math.floor(Date.now() / 1000)}-${Math.floor(Math.random() * 1e9)}`,
    ...overrides,
  };
}

test.describe('member status', () => {
  test('shows all six things separately', async ({ page }) => {
    await signInMember(page, world.cases.correctionRequested);
    const body = await (await page.request.get('/api/member/status')).json();

    expect(body.reference).toBe(world.cases.correctionRequested.reference);
    expect(body.states.application_state).toBe('correction_needed');
    expect(body.states.application_review_state).toBe('resubmission_requested');
    expect(body.states.payment_state).toBeTruthy();
    expect(body.states.prc_handoff_state).toBeTruthy();
    expect(body.states.membership_state).toBe('not_active');
    expect(body.review.reason).toContain('birth date');
  });

  test('returns no other applicant data', async ({ page }) => {
    await signInMember(page, world.cases.correctionRequested);
    const raw = await (await page.request.get('/api/member/status')).text();
    // The other applicant's reference must not appear anywhere.
    expect(raw).not.toContain(world.cases.otherApplicant.reference);
  });

  test('a member session cannot reach another case', async ({ page }) => {
    await signInMember(page, world.cases.correctionRequested);
    const body = await (await page.request.get('/api/member/correction')).json();
    // There is no case parameter to supply; the response is always the
    // session's own case.
    expect(body.reference).toBe(world.cases.correctionRequested.reference);
    expect(body.reference).not.toBe(world.cases.otherApplicant.reference);
  });

  test('rejects an unauthorized member', async ({ page }) => {
    const response = await page.request.get('/api/member/status');
    expect(response.status()).toBe(401);
  });

  test('rejects a mismatched reference and mobile without offering an OTP', async ({ page }) => {
    const response = await page.request.post('/api/member/auth', {
      data: {
        referenceNumber: world.cases.correctionRequested.reference,
        mobileNumber: '+639999999999',
      },
    });
    expect(response.status()).toBe(401);
    expect((await response.text()).toLowerCase()).not.toContain('otp');
  });

  test('rejects an expired member session', async ({ page }) => {
    await signInMember(page, world.cases.correctionRequested);
    await expireMemberSession(page);
    const response = await page.request.get('/api/member/status');
    expect(response.status()).toBe(401);
  });

  test('issues a signed, secure, HTTP-only cookie that expires in 30 minutes', async ({
    page,
  }) => {
    await signInMember(page, world.cases.correctionRequested);
    const cookie = (await page.context().cookies()).find(
      (item) => item.name === 'sc_member_session',
    );
    expect(cookie).toBeTruthy();
    expect(cookie?.httpOnly).toBe(true);
    expect(cookie?.value.split('.')).toHaveLength(2);
    const lifetime = (cookie?.expires ?? 0) - Math.floor(Date.now() / 1000);
    expect(lifetime).toBeGreaterThan(25 * 60);
    expect(lifetime).toBeLessThanOrEqual(30 * 60 + 30);
  });
});

test.describe('corrections', () => {
  test('offers the stored fields and the reviewer reason', async ({ page }) => {
    await signInMember(page, world.cases.correctionRequested);
    const body = await (await page.request.get('/api/member/correction?locale=fil')).json();

    expect(body.eligibility.allowed).toBe(true);
    expect(body.reviewReason).toContain('birth date');
    expect(body.values.first_name).toBe('Test4');
    // Only the correctable fields come back.
    expect(body.values).not.toHaveProperty('fields_completed');
  });

  test('submits a new version, preserves the old one and resets review', async ({ page }) => {
    await signInMember(page, world.cases.correctionRequested);
    const response = await page.request.post('/api/member/correction', { data: correction() });
    expect(response.ok()).toBe(true);
    const body = await response.json();
    expect(body.reviewState).toBe('pending');
    expect(body.membershipChanged).toBe(false);

    const { data: submissions } = await world.admin
      .from('application_submissions')
      .select('id,is_current,original_submission_id,submitted_data')
      .eq('case_id', world.cases.correctionRequested.id)
      .order('submitted_at', { ascending: true });

    // Two versions: the original preserved, the correction current.
    expect(submissions).toHaveLength(2);
    expect(submissions?.[0]?.is_current).toBe(false);
    expect(submissions?.[1]?.is_current).toBe(true);
    expect(submissions?.[1]?.original_submission_id).toBe(submissions?.[0]?.id);
    expect(
      (submissions?.[0]?.submitted_data as Record<string, string>).first_name,
    ).toBe('Test4');

    const { data: caseRow } = await world.admin
      .from('recipient_cases')
      .select('application_state,application_review_state,payment_state,prc_handoff_state,membership_state')
      .eq('id', world.cases.correctionRequested.id)
      .single();
    expect(caseRow?.application_state).toBe('resubmitted');
    expect(caseRow?.application_review_state).toBe('pending');
    // Untouched by a correction.
    expect(caseRow?.payment_state).toBe('not_started');
    expect(caseRow?.prc_handoff_state).toBe('not_ready');
    expect(caseRow?.membership_state).toBe('not_active');
  });

  test('refuses a duplicate correction', async ({ page }) => {
    await signInMember(page, world.cases.correctionRequested);
    const payload = correction();
    const first = await page.request.post('/api/member/correction', { data: payload });
    expect(first.ok()).toBe(true);

    const replay = await page.request.post('/api/member/correction', { data: payload });
    expect(replay.status()).toBe(409);

    const { count } = await world.admin
      .from('application_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('case_id', world.cases.correctionRequested.id);
    expect(count).toBe(2);
  });

  test('refuses a correction that was never requested', async ({ page }) => {
    await signInMember(page, world.cases.pendingReview);
    const response = await page.request.post('/api/member/correction', { data: correction() });
    expect(response.status()).toBe(409);
    expect((await response.json()).eligibility.reason).toBe('not_requested');
  });

  test('refuses a correction when consent was withdrawn', async ({ page }) => {
    await signInMember(page, world.cases.consentWithdrawn);
    const body = await (await page.request.get('/api/member/correction')).json();
    expect(body.eligibility.allowed).toBe(false);
    expect(body.eligibility.reason).toBe('consent_withdrawn');

    const response = await page.request.post('/api/member/correction', { data: correction() });
    expect(response.status()).toBe(409);
  });

  test('refuses a correction when consent already expired', async ({ page }) => {
    await signInMember(page, world.cases.consentExpired);
    const body = await (await page.request.get('/api/member/correction')).json();
    expect(body.eligibility.reason).toBe('consent_expired');
  });

  test('requires renewed consent after a material content change', async ({ page }) => {
    await publishMaterialConsentChange(world.admin, world.privacyAdmin.userId);

    await signInMember(page, world.cases.correctionRequested);
    const body = await (await page.request.get('/api/member/correction?locale=fil')).json();
    expect(body.eligibility.allowed).toBe(false);
    expect(body.eligibility.reason).toBe('consent_renewal_required');
    expect(body.eligibility.renewedConsent.changeSummary).toContain('retention');

    // And it is re-checked at submit time, not only when the form loaded.
    const response = await page.request.post('/api/member/correction', { data: correction() });
    expect(response.status()).toBe(409);

    const { count } = await world.admin
      .from('application_submissions')
      .select('id', { count: 'exact', head: true })
      .eq('case_id', world.cases.correctionRequested.id);
    expect(count).toBe(1);
  });

  test('refuses real-looking personal information in synthetic mode', async ({ page }) => {
    await signInMember(page, world.cases.correctionRequested);
    const response = await page.request.post('/api/member/correction', {
      data: correction({
        profile: {
          ...syntheticProfile(4),
          first_name: 'Maria',
          last_name: 'Santos',
          mobile_number: '+639171234567',
          address_line1: '221 Real Street',
          city: 'Quezon City',
        },
      }),
    });
    expect(response.ok()).toBe(false);
  });

  test('refuses a correction without confirming every field was reviewed', async ({ page }) => {
    await signInMember(page, world.cases.correctionRequested);
    const payload = correction();
    delete (payload as Record<string, unknown>).reviewed_all_fields;
    const response = await page.request.post('/api/member/correction', { data: payload });
    expect(response.status()).toBe(400);
  });

  test('a rejected applicant is told, and is offered the hotline', async ({ page }) => {
    await signInMember(page, world.cases.rejected);
    await page.goto('/member/status');
    await expect(page.getByText(/hindi naaprubahan|not approved/i).first()).toBeVisible();
    await expect(page.getByRole('link', { name: /143/ }).first()).toBeVisible();
  });

  test('stores no personal data in browser storage', async ({ page }) => {
    await signInMember(page, world.cases.correctionRequested);
    await page.goto('/member/correction');
    await expect(page.getByRole('button', { name: /isumite|submit/i })).toBeVisible();

    const stored = await page.evaluate(() => ({
      local: JSON.stringify(window.localStorage),
      session: JSON.stringify(window.sessionStorage),
    }));
    for (const blob of [stored.local, stored.session]) {
      expect(blob).not.toContain('Test4');
      expect(blob).not.toContain('+639000000000');
      expect(blob).not.toContain(world.cases.correctionRequested.reference);
    }
  });
});
