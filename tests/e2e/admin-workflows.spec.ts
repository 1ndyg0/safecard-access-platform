import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const campaignId = '11111111-1111-4111-8111-111111111111';
const caseId = '22222222-2222-4222-8222-222222222222';
const paymentIntentId = '33333333-3333-4333-8333-333333333333';
const evidenceId = '44444444-4444-4444-8444-444444444444';

const trend = [30, 7].map((days) => ({
  days,
  points: Array.from({ length: days }, (_, index) => ({ date: `2026-09-${String(index + 1).padStart(2, '0')}`, count: index % 2 ? 6 : 5 })),
}));

test.describe('SafeCard staff operations with isolated API fixtures', () => {
  test('renders exact operational metrics and privacy-safe analytics', async ({ page }) => {
    await page.route('**/api/admin/overview**', (route) => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        user: { full_name: 'Aira Santos', email: 'aira@example.invalid' },
        roles: ['school_admin'],
        campaigns: [{ id: campaignId, organization_id: '55555555-5555-4555-8555-555555555555', name: 'Synthetic Pilot', is_active: true, max_applications: 100 }],
        selectedCampaignId: campaignId,
        metrics: { cases: 12, drafts: 2, submitted: 10, awaitingReview: 4, correction: 1, paymentPending: 3, paymentVerified: 5, readyForHandoff: 2, sentToPrc: 1, active: 1, declined: 0 },
        analytics: { suppressionThreshold: 5, cohortSize: 12, rates: { submittedPerStarted: 0.83, approvedPerSubmitted: 0.6, paymentVerifiedPerSubmitted: 0.5, activePerSubmitted: null }, aging: { under24Hours: 5, oneToThreeDays: null, overThreeDays: 0 }, trend },
      }),
    }));

    await page.goto('/admin');
    await expect(page.getByRole('heading', { name: 'Welcome, Aira Santos' })).toBeVisible();
    await expect(page.getByText('Total cases').locator('..').getByText('12')).toBeVisible();
    await expect(page.getByText('Submitted', { exact: true }).locator('..').getByText('10')).toBeVisible();
    await expect(page.getByText('Started → submitted').locator('..')).toContainText('83%');
    await expect(page.getByText('Not enough data').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Manage access' })).toHaveAttribute('href', '/admin/users');
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations.filter((violation) => ['serious', 'critical'].includes(violation.impact ?? ''))).toEqual([]);
  });

  test('requires explicit confirmation and reason for application decisions', async ({ page }) => {
    let reviewState = 'pending';
    let submittedBody: unknown;
    await page.route(`**/api/admin/cases/${caseId}`, (route) => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        case: { application_ref: 'SC-2026-TEST0001', campaign_id: campaignId, consent_state: 'agreed', application_state: reviewState === 'resubmission_requested' ? 'correction_needed' : 'submitted', application_review_state: reviewState, payment_state: 'verification_pending', prc_handoff_state: 'not_ready', membership_state: 'not_active' },
        profile: { first_name: 'TEST', middle_name: '', last_name: 'PERSON', date_of_birth: '2000-01-01', mobile_number: '09000000000', address_line1: 'TEST ADDRESS', address_line2: '', city: 'TEST CITY', province: 'TEST PROVINCE', zip_code: '0000' },
        payments: [{ id: paymentIntentId, expected_amount: 1200, payment_route: 'bank_transfer_bpi', state: 'verification_pending' }],
        evidence: [{ id: evidenceId, payment_intent_id: paymentIntentId, version_number: 1, file_size_bytes: 204800, state: 'verification_pending' }],
        auditEvents: [{ id: 'event-1', event_type: 'application_submit', action: 'Application submitted', severity: 'info', created_at: '2026-09-09T01:00:00Z' }],
      }),
    }));
    await page.route(`**/api/admin/cases/${caseId}/decision`, async (route) => {
      submittedBody = route.request().postDataJSON();
      reviewState = 'resubmission_requested';
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ reviewed: true }) });
    });

    await page.goto(`/admin/submissions/${caseId}`);
    await page.getByRole('button', { name: 'Request resubmission' }).click();
    const dialog = page.getByRole('dialog', { name: 'Request a corrected resubmission?' });
    await expect(dialog).toBeVisible();
    await dialog.getByLabel('Reason shown to the applicant').fill('Please correct the mobile number.');
    await dialog.getByRole('checkbox').check();
    await dialog.getByRole('button', { name: 'Request resubmission' }).click();
    await expect(page.getByRole('status')).toContainText('recorded in the audit history');
    expect(submittedBody).toEqual({ decision: 'resubmission_requested', reason: 'Please correct the mobile number.' });
    await expect(page.locator('.state-grid article').filter({ hasText: 'application review' })).toContainText('resubmission requested');
  });

  test('keeps payment verification separate from membership activation', async ({ page }) => {
    let verificationBody: unknown;
    await page.route(`**/api/admin/cases/${caseId}`, (route) => route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        case: { application_ref: 'SC-2026-TEST0002', campaign_id: campaignId, consent_state: 'agreed', application_state: 'submitted', application_review_state: 'approved', payment_state: 'verification_pending', prc_handoff_state: 'not_ready', membership_state: 'not_active' },
        profile: null,
        payments: [{ id: paymentIntentId, expected_amount: 1200, payment_route: 'bank_transfer_bpi', state: 'verification_pending' }],
        evidence: [{ id: evidenceId, payment_intent_id: paymentIntentId, version_number: 1, file_size_bytes: 204800, state: 'verification_pending' }],
        auditEvents: [],
      }),
    }));
    await page.route('**/api/payment/verify', async (route) => {
      verificationBody = route.request().postDataJSON();
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ verified: true }) });
    });
    await page.goto(`/admin/submissions/${caseId}`);
    await page.getByRole('button', { name: 'Verify', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Verify this payment evidence?' });
    await expect(dialog).toContainText('Membership remains inactive');
    await dialog.getByRole('checkbox').check();
    await dialog.getByRole('button', { name: 'Verify payment' }).click();
    expect(verificationBody).toEqual({ payment_intent_id: paymentIntentId, evidence_version_id: evidenceId, verification_source: 'manual_prc_reconciliation' });
    await expect(page.getByRole('status')).toContainText('Membership remains inactive');
  });
});
