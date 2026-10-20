import { expect, test, type Page } from '@playwright/test';

/**
 * The apply flow against mocked backends.
 *
 * The point under test: nothing is written until the applicant presses the
 * final submit, and then everything is created in one ordered sequence.
 * Backends are mocked at the network layer so this runs without a database.
 */

const CAMPAIGN_ID = '11111111-1111-4111-8111-111111111111';
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

async function mockBackend(page: Page) {
  const writes: string[] = [];
  await page.route('**/api/pilot/config', (route) => route.fulfill({
    json: {
      mode: 'live', launchGatesComplete: true,
      campaign: { id: CAMPAIGN_ID, membership_fee: 1200 },
      content: ['tl', 'en'].flatMap((locale) => [
        { id: `00000000-0000-4000-8000-0000000000${locale === 'tl' ? '1' : '2'}1`, content_type: 'consent_text', locale, title: 'Consent', body: 'Consent' },
        { id: `00000000-0000-4000-8000-0000000000${locale === 'tl' ? '1' : '2'}2`, content_type: 'privacy_notice', locale, title: 'Privacy', body: 'Privacy' },
      ]),
      payment: { available: true, reason: null },
      externalNotifications: { available: false, reason: 'Parked' },
    },
  }));
  await page.route('**/api/payment-config**', (route) => route.fulfill({
    json: { available: true, reason: null, amount: 1200, currency: 'PHP', accountName: 'SafeCard', routes: [{ id: 'bank', label: 'Bank transfer', instructions: 'Transfer, then upload the receipt.', bank: 'Test Bank', accountNumber: '0000' }] },
  }));
  const respond = (path: string, json: unknown) => page.route(`**${path}`, (route) => {
    if (route.request().method() === 'POST') writes.push(path);
    return route.fulfill({ json });
  });
  await respond('/api/intake/case', { caseId: '22222222-2222-4222-8222-222222222222' });
  await respond('/api/intake/comprehension', { ok: true });
  await respond('/api/consent/grant', { consentRecordId: '33333333-3333-4333-8333-333333333333' });
  await respond('/api/intake/profile', { ok: true });
  await respond('/api/intake/submit', { applicationRef: 'SC-2026-TEST0001' });
  await respond('/api/payment/handoff', { paymentIntentId: '44444444-4444-4444-8444-444444444444' });
  await respond('/api/payment/mark-paid', { ok: true });
  await respond('/api/payment/evidence/upload', { evidenceId: 'e' });
  await respond('/api/intake/cancel', { cancelled: true });
  await respond('/api/intake/clear-session', { cleared: true });
  return writes;
}

async function passTheCheck(page: Page) {
  await page.getByRole('button', { name: /check my understanding/i }).click();
  for (const answer of [
    '₱1,200 per year',
    'My application and payment proof are reviewed first',
    'The Philippine Red Cross',
    'I can cancel at any time and my application is discarded',
    'Call the PRC Hotline 143',
  ]) {
    await page.getByLabel(answer).check();
    await page.getByRole('button', { name: /next question|finish the check/i }).click();
  }
  await page.getByRole('button', { name: /continue to your decision/i }).click();
}

async function fillDetails(page: Page) {
  await page.getByLabel(/first name/i).fill('Test');
  await page.getByLabel(/last name/i).fill('Applicant');
  await page.getByLabel(/date of birth/i).fill('1990-05-04');
  await page.getByLabel(/^sex/i).selectOption('female');
  await page.getByLabel(/mobile number/i).fill('09171234567');
  await page.getByLabel(/^address/i).fill('1 Sample Street');
  await page.getByLabel(/city/i).fill('Manila');
  await page.getByLabel(/province/i).fill('NCR');
  await page.getByLabel(/zip code/i).fill('1000');
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => window.localStorage.setItem('safecard-locale', 'en'));
});

test.describe('apply flow', () => {
  test('saves nothing until the final submit, then creates everything in order', async ({ page }) => {
    const writes = await mockBackend(page);
    await page.goto('/apply');
    await expect(page.getByRole('heading', { name: /know what matters/i })).toBeVisible();

    await passTheCheck(page);
    await page.getByRole('button', { name: /^apply continue/i }).click();
    for (const box of await page.getByRole('checkbox').all()) await box.check();
    await page.getByRole('button', { name: /^continue$/i }).click();
    await fillDetails(page);
    await page.getByRole('button', { name: /next: pay and submit/i }).click();

    // The details, consent and decision have all been entered; nothing has been written.
    await expect(page.getByRole('heading', { name: /review, pay, and submit/i })).toBeVisible();
    expect(writes).toEqual([]);

    await page.getByLabel(/^how will you pay/i).or(page.getByRole('radio').first()).first().check();
    await page.locator('input[type="file"]').first().setInputFiles({ name: 'receipt.png', mimeType: 'image/png', buffer: PNG });
    await page.getByRole('checkbox', { name: /i confirm i made this payment/i }).check();
    expect(writes).toEqual([]);

    await page.getByRole('button', { name: /^submit application$/i }).click();
    await expect(page.getByRole('heading', { name: /we have received your application/i })).toBeVisible();
    expect(writes).toEqual([
      '/api/intake/case',
      '/api/intake/comprehension',
      '/api/consent/grant',
      '/api/intake/profile',
      '/api/intake/submit',
      '/api/payment/handoff',
      '/api/payment/mark-paid',
      '/api/payment/evidence/upload',
    ]);
  });

  test('cancelling before the final submit writes nothing', async ({ page }) => {
    const writes = await mockBackend(page);
    await page.goto('/apply');
    await passTheCheck(page);
    await page.getByRole('button', { name: /^apply continue/i }).click();
    await page.getByRole('button', { name: /cancel application/i }).click();
    // Nothing has been entered yet, so leaving needs no confirmation and no request.
    await expect(page).toHaveURL(/\/$/);
    expect(writes).toEqual([]);
  });

  test('asks for confirmation once details are entered, and still writes nothing', async ({ page }) => {
    const writes = await mockBackend(page);
    await page.goto('/apply');
    await passTheCheck(page);
    await page.getByRole('button', { name: /^apply continue/i }).click();
    for (const box of await page.getByRole('checkbox').all()) await box.check();
    await page.getByRole('button', { name: /^continue$/i }).click();
    await fillDetails(page);
    await page.getByRole('button', { name: /cancel application/i }).click();
    const dialog = page.getByRole('alertdialog');
    await expect(dialog).toBeVisible();
    await dialog.getByRole('button', { name: /keep applying/i }).click();
    await expect(dialog).toBeHidden();
    await page.getByRole('button', { name: /cancel application/i }).click();
    await dialog.getByRole('button', { name: /yes, cancel/i }).click();
    await expect(page).toHaveURL(/\/$/);
    expect(writes).toEqual([]);
  });

  test('marks required and optional fields and validates inline', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/apply');
    await passTheCheck(page);
    await page.getByRole('button', { name: /^apply continue/i }).click();
    for (const box of await page.getByRole('checkbox').all()) await box.check();
    await page.getByRole('button', { name: /^continue$/i }).click();

    await expect(page.getByText(/fields marked \* are required/i)).toBeVisible();
    await expect(page.getByText('(Optional)')).toBeVisible();
    await page.getByRole('button', { name: /next: pay and submit/i }).click();
    await expect(page.getByText('Enter your first name.')).toBeVisible();
    await expect(page.getByText(/use 09xxxxxxxxx/i)).toBeVisible();
  });

  test('can skip the check and go straight to the application', async ({ page }) => {
    await mockBackend(page);
    await page.goto('/apply');
    await page.getByRole('button', { name: /go straight to the application/i }).click();
    await expect(page.getByRole('heading', { name: /what would you like to do/i })).toBeVisible();
  });
});
