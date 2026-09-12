import { test, expect } from '@playwright/test';

test.describe('SafeCard synthetic application happy path', () => {
  test('completes the consent-first walkthrough without creating a real application', async ({ page }) => {
    await page.goto('/apply', { waitUntil: 'commit' });

    await page.getByRole('button', { name: 'English' }).click();
    await expect(page.getByText('Synthetic walkthrough')).toBeVisible();

    await page.getByRole('button', { name: /Check my understanding/i }).click();
    await page.getByRole('radio', { name: '₱1,200 / year' }).check();
    await page.getByRole('radio', { name: 'Philippine Red Cross' }).check();
    await page.getByRole('radio', { name: 'The recipient' }).check();
    await page.getByRole('radio', { name: 'Hotline 143' }).check();
    await page.getByRole('button', { name: 'Continue →' }).click();

    await page.getByRole('button', { name: /Accept \/ Mag-apply/i }).click();
    await expect(page.getByRole('heading', { name: 'Consent before personal data.' })).toBeVisible();

    await page.getByRole('checkbox').nth(0).check();
    await page.getByRole('checkbox').nth(1).check();
    await page.getByRole('checkbox').nth(2).check();
    await page.getByRole('button', { name: /Continue privately/i }).click();

    await expect(page.getByRole('heading', { name: 'Synthetic form demonstration' })).toBeVisible();
    await page.getByRole('button', { name: 'Review →' }).click();
    await expect(page.getByRole('heading', { name: 'Review before submitting.' })).toBeVisible();

    await page.getByRole('button', { name: 'Complete demo →' }).click();
    await expect(page.getByRole('heading', { name: 'No real application was created.' })).toBeVisible();
    await expect(page.getByText(/^DEMO-\d{4}-[A-Z0-9]{8}$/)).toBeVisible();
  });

  test('shows Filipino or natural Taglish copy through the first decision steps', async ({ page }) => {
    await page.goto('/apply', { waitUntil: 'commit' });

    await expect(page.getByText('Synthetic na walkthrough')).toBeVisible();
    await expect(page.getByText(/Huwag maglagay ng totoong personal na impormasyon/i)).toBeVisible();
    await page.getByRole('button', { name: /Suriin ang pagkaunawa/i }).click();
    await expect(page.getByRole('heading', { name: 'Apat na bagay na dapat malinaw.' })).toBeVisible();
    await expect(page.getByText('Magkano ang working annual fee?')).toBeVisible();
    await page.getByRole('radio', { name: '₱1,200 / year' }).check();
    await page.getByRole('radio', { name: 'Philippine Red Cross' }).check();
    await page.getByRole('radio', { name: 'Ang recipient' }).check();
    await page.getByRole('radio', { name: 'Hotline 143' }).check();
    await page.getByRole('button', { name: 'Magpatuloy →' }).click();
    await expect(page.getByRole('heading', { name: 'Ang iyong sagot ay sa iyo lamang.' })).toBeVisible();
    await expect(page.getByText('Hindi makakatanggap ng notification ang sponsor')).toBeVisible();
  });
});

test.describe('SafeCard controlled-pilot application', () => {
  test('keeps payment visible and submits the complete applicant declaration', async ({ page }) => {
    const campaignId = '11111111-1111-4111-8111-111111111111';
    const caseId = '22222222-2222-4222-8222-222222222222';
    const intentId = '33333333-3333-4333-8333-333333333333';
    const requests = new Map<string, string | null>();
    const json = (body: unknown) => ({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });

    await page.route('**/api/pilot/config', (route) => route.fulfill(json({
      mode: 'live',
      launchGatesComplete: true,
      campaign: { id: campaignId, membership_fee: 1200 },
      content: [
        { id: '44444444-4444-4444-8444-444444444441', content_type: 'privacy_notice', locale: 'tl', title: 'Privacy', body: 'Controlled pilot.' },
        { id: '44444444-4444-4444-8444-444444444442', content_type: 'consent_text', locale: 'tl', title: 'Consent', body: 'Controlled pilot.' },
        { id: '44444444-4444-4444-8444-444444444443', content_type: 'privacy_notice', locale: 'en', title: 'Privacy', body: 'Controlled pilot.' },
        { id: '44444444-4444-4444-8444-444444444444', content_type: 'consent_text', locale: 'en', title: 'Consent', body: 'Controlled pilot.' },
      ],
      payment: { available: true, reason: null },
      externalNotifications: { available: false, reason: 'Parked' },
    })));
    await page.route('**/api/payment-config?*', (route) => route.fulfill(json({
      available: true,
      reason: null,
      amount: 1200,
      monthlyEquivalent: 100,
      currency: 'PHP',
      accountName: 'PHILIPPINE RED CROSS',
      routes: [
        { id: 'gcash', label: 'GCash QR', instructions: 'Use the official QR.', accountName: 'PHILIPPINE RED CROSS', qrImageUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=' },
        { id: 'bpi', label: 'BPI bank transfer', instructions: 'Use the official account.', accountName: 'PHILIPPINE RED CROSS', bank: 'BPI', accountNumber: '002963000782B', swiftCode: 'BOPIPHMM', branch: 'Chinese Gen., Blumentritt Branch' },
      ],
    })));
    const apiResponses: Record<string, unknown> = {
      '/api/intake/case': { caseId },
      '/api/intake/comprehension': { recorded: true },
      '/api/consent/grant': { consentRecordId: '55555555-5555-4555-8555-555555555555' },
      '/api/intake/profile': { saved: true },
      '/api/intake/submit': { applicationRef: 'SC-2026-TEST0001' },
      '/api/payment/handoff': { paymentIntentId: intentId },
      '/api/payment/mark-paid': { marked: true },
      '/api/payment/evidence/upload': { evidenceId: '66666666-6666-4666-8666-666666666666' },
    };
    for (const [path, body] of Object.entries(apiResponses)) {
      await page.route(`**${path}`, async (route) => {
        requests.set(path, route.request().postData());
        await route.fulfill(json(body));
      });
    }

    await page.goto('/apply', { waitUntil: 'commit' });
    await page.getByRole('button', { name: 'English' }).click();
    await expect(page.getByText('Controlled live pilot')).toBeVisible();
    await expect(page.getByLabel('Application progress').getByText('Payment')).toBeVisible();
    await page.getByRole('button', { name: /Check my understanding/i }).click();
    await page.getByRole('radio', { name: '₱1,200 / year' }).check();
    await page.getByRole('radio', { name: 'Philippine Red Cross' }).check();
    await page.getByRole('radio', { name: 'The recipient' }).check();
    await page.getByRole('radio', { name: 'Hotline 143' }).check();
    await page.getByRole('button', { name: 'Continue →' }).click();
    await page.getByRole('button', { name: /Accept \/ Mag-apply/i }).click();
    await page.getByRole('checkbox').nth(0).check();
    await page.getByRole('checkbox').nth(1).check();
    await page.getByRole('checkbox').nth(2).check();
    await page.getByRole('button', { name: /Continue privately/i }).click();

    await page.getByLabel('First name').fill('TEST');
    await page.getByLabel('Last name').fill('APPLICANT');
    await page.getByLabel('Date of birth').fill('2000-01-01');
    await page.getByLabel('Mobile number').fill('09000000000');
    await page.getByLabel('Email (optional)').fill('pilot@example.invalid');
    await page.getByLabel('Address').fill('TEST ADDRESS');
    await page.getByLabel('City').fill('TEST CITY');
    await page.getByLabel('Province').fill('TEST PROVINCE');
    await page.getByLabel('ZIP code').fill('0000');
    await page.getByRole('button', { name: 'Review →' }).click();
    await page.getByRole('button', { name: 'Submit application →' }).click();

    await expect(page.getByRole('heading', { name: /Pay outside SafeCard/i })).toBeVisible();
    await page.getByRole('radio', { name: /GCash QR/i }).check();
    await expect(page.getByAltText('Official GCash QR code')).toBeVisible();
    await page.getByRole('radio', { name: /BPI bank transfer/i }).check();
    await expect(page.getByText('002963000782B')).toBeVisible();
    await page.getByLabel('Payment reference or transaction number').fill('TEST-TRANSACTION-001');
    await expect(page.getByLabel('Amount paid (PHP)')).toHaveValue('1200');
    await page.getByLabel(/Proof of payment/).setInputFiles({
      name: 'test-receipt.png',
      mimeType: 'image/png',
      buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64'),
    });
    await page.getByRole('checkbox', { name: /I confirm this transfer/i }).check();
    await page.getByRole('button', { name: 'Submit proof for review →' }).click();

    await expect(page.getByRole('heading', { name: 'Submission received—not yet active.' })).toBeVisible();
    await expect(page.getByText('SC-2026-TEST0001')).toBeVisible();
    const marked = JSON.parse(requests.get('/api/payment/mark-paid') ?? '{}');
    expect(marked).toMatchObject({
      payment_intent_id: intentId,
      payment_reference: 'TEST-TRANSACTION-001',
      amount_paid: 1200,
      data_mode: 'live',
    });
    expect(marked.paid_at).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(requests.get('/api/payment/evidence/upload')).toContain('test-receipt.png');
  });
});
