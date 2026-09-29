import { expect, test } from '@playwright/test';

const campaignId = '11111111-1111-4111-8111-111111111111';
const caseId = '22222222-2222-4222-8222-222222222222';
const consentId = '33333333-3333-4333-8333-333333333333';
const intentId = '44444444-4444-4444-8444-444444444444';
const privacyId = '55555555-5555-4555-8555-555555555555';
const consentContentId = '66666666-6666-4666-8666-666666666666';
const evidenceId = '77777777-7777-4777-8777-777777777777';
const banks = [
  { id: 'bank_transfer_bpi', label: 'BPI', accountNumber: '002963007828' },
  { id: 'bank_transfer_bdo', label: 'BDO', accountNumber: '004530012185' },
  { id: 'bank_transfer_security_bank', label: 'Security Bank', accountNumber: '0132062464003' },
  { id: 'bank_transfer_metrobank', label: 'Metrobank', accountNumber: '151-3-15114558-3' },
] as const;

for (const bank of banks) {
  test(`applicant sees ${bank.label} details and submits only after image proof`, async ({ page }) => {
    const calls: Array<{ path: string; body: Record<string, unknown> }> = [];
    await page.route('**/api/**', async (route) => {
      const path = new URL(route.request().url()).pathname;
      const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      if (path === '/api/pilot/config') return json({ mode: 'live', campaign: { id: campaignId, membership_fee: 1200 }, content: [
        { id: privacyId, content_type: 'privacy_notice', locale: 'en', title: 'Privacy', body: 'Test privacy' },
        { id: consentContentId, content_type: 'consent_text', locale: 'en', title: 'Consent', body: 'Test consent' },
      ], payment: { available: true, reason: null }, externalNotifications: { available: false, reason: 'Not used' } });
      if (path === '/api/payment-config') return json({ available: true, reason: null, amount: 1200, currency: 'PHP', routes: banks.map((item) => ({ ...item, bank: item.label, accountName: 'Philippine Red Cross', accountType: 'Savings', currency: 'PHP' })) });
      if (route.request().method() !== 'POST') return route.continue();
      let body: Record<string, unknown> = {};
      if (!path.includes('/evidence/upload')) body = route.request().postDataJSON() as Record<string, unknown>;
      calls.push({ path, body });
      if (path === '/api/intake/case') return json({ caseId }, 201);
      if (path === '/api/intake/comprehension') return json({ passed: true, score: 4 });
      if (path === '/api/consent/grant') return json({ consentRecordId: consentId }, 201);
      if (path === '/api/intake/profile') return json({ saved: true });
      if (path === '/api/payment/handoff') return json({ paymentIntentId: intentId, status: 'created' }, 201);
      if (path === '/api/payment/mark-paid') return json({ marked: true });
      if (path === '/api/payment/evidence/upload') return json({ evidenceId, state: 'verification_pending' }, 201);
      if (path === '/api/intake/submit') return json({ applicationRef: 'SC-2026-AAAA0001', status: 'created' }, 201);
      return route.continue();
    });

    await page.goto('/apply');
    await page.getByRole('button', { name: 'English' }).click();
    await page.getByRole('button', { name: /Check my understanding/ }).click();
    await page.getByRole('button', { name: 'Continue →' }).click();
    await expect(page.locator('.wizard-card [role="alert"]')).toContainText('Answer all four questions');
    const quiz = page.locator('fieldset.quiz-block');
    await quiz.nth(0).getByText('₱1,200 / year').click();
    await quiz.nth(1).getByText('Philippine Red Cross').click();
    await quiz.nth(2).getByText('The recipient').click();
    await quiz.nth(3).getByText('Hotline 143').click();
    await page.getByRole('button', { name: 'Continue →' }).click();
    await page.getByRole('button', { name: /Accept \/ Mag-apply/ }).click();
    await expect(page.getByRole('heading', { name: 'Consent before personal data.' })).toBeVisible();
    await page.locator('.consent-row input[type="checkbox"]').evaluateAll((inputs) => inputs.forEach((input) => (input as HTMLInputElement).click()));
    await page.getByRole('button', { name: 'Continue privately →' }).click();
    await page.getByLabel('First name').fill('Synthetic');
    await page.getByLabel('Last name').fill('Applicant');
    await page.getByLabel('Date of birth').fill('2000-01-01');
    await page.getByLabel('Sex').selectOption('female');
    await page.getByLabel('Mobile number').fill('09000000000');
    await page.getByLabel('Address').fill('1 Synthetic Street');
    await page.getByLabel('City').fill('Test City');
    await page.getByLabel('Province').fill('Test Province');
    await page.getByLabel('ZIP code').fill('0000');
    await page.getByRole('button', { name: 'Next: Payment →' }).click();
    await page.getByLabel('Bank you will use').selectOption(bank.id);
    await expect(page.locator('.payment-details')).toContainText(bank.accountNumber);
    await expect(page.locator('.payment-details')).toContainText('Philippine Red Cross');
    await expect(page.locator('.payment-details')).toContainText('Savings');
    await expect(page.locator('.payment-details')).toContainText('₱1,200');
    await expect(page.locator('.payment-panel img.payment-qr')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Upload proof →' })).toBeDisabled();
    await page.locator('input[type="file"]').setInputFiles({ name: 'synthetic-proof.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9E3Y8AAAAASUVORK5CYII=', 'base64') });
    await page.locator('.payment-panel .consent-row input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'Upload proof →' }).click();
    await expect(page.getByRole('heading', { name: 'Review before submitting.' })).toBeVisible();
    await page.locator('.wizard-card .consent-row input[type="checkbox"]').check();
    await page.getByRole('button', { name: 'Submit application →' }).click();
    await expect(page.getByRole('heading', { name: 'Submitted — verification pending.' })).toBeVisible();
    await expect(page.getByText('SC-2026-AAAA0001')).toBeVisible();

    expect(calls.find((call) => call.path === '/api/payment/handoff')?.body.payment_route).toBe(bank.id);
    expect(calls.find((call) => call.path === '/api/intake/comprehension')?.body.answers).toEqual({ cost: '1200', activation: 'prc', choice: 'recipient', emergency: '143' });
    expect(calls.map((call) => call.path).indexOf('/api/intake/profile')).toBeLessThan(calls.map((call) => call.path).indexOf('/api/payment/handoff'));
    expect(calls.map((call) => call.path).indexOf('/api/payment/evidence/upload')).toBeLessThan(calls.map((call) => call.path).indexOf('/api/intake/submit'));
  });
}
