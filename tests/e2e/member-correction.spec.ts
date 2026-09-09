import { expect, test } from '@playwright/test';

test('member can correct and version a staff-returned application', async ({ page }) => {
  let submitted: Record<string, unknown> | undefined;
  await page.route('**/api/member/application-correction', async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify({
        reference: 'SC-2026-TEST0003',
        reason: 'Please correct the mobile number.',
        profile: {
          first_name: 'TEST', middle_name: '', last_name: 'PERSON', date_of_birth: '2000-01-01', sex: 'female', civil_status: '',
          mobile_number: '09000000000', email: 'demo@example.invalid', address_line1: 'TEST ADDRESS', address_line2: '', city: 'TEST CITY', province: 'TEST PROVINCE', zip_code: '0000',
        },
      }) });
      return;
    }
    submitted = route.request().postDataJSON();
    await route.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ resubmitted: true }) });
  });
  await page.route('**/api/member/status', (route) => route.fulfill({ contentType: 'application/json', body: JSON.stringify({
    reference: 'SC-2026-TEST0003',
    states: { application_state: 'resubmitted', application_review_state: 'pending', payment_state: 'not_started', prc_handoff_state: 'not_ready', membership_state: 'not_active', updated_at: '2026-09-09T01:00:00Z' },
    nextAction: 'Application received. Payment remains a separate step.',
    applicationReview: { state: 'pending', reason: null }, paymentCorrection: null,
  }) }));

  await page.goto('/member/correction');
  await expect(page.getByText('Please correct the mobile number.')).toBeVisible();
  await page.getByLabel('Mobile number').fill('09999999999');
  await page.getByRole('button', { name: 'Submit corrections for review →' }).click();
  await expect(page).toHaveURL(/\/member\/status\?resubmitted=1/);
  await expect(page.getByText('Application received. Payment remains a separate step.')).toBeVisible();
  expect(submitted?.profile_data).toMatchObject({ mobile_number: '09999999999' });
  expect(String(submitted?.idempotency_key)).toMatch(/^member-correction-/);
});
