import { expect, test } from '@playwright/test';

const paymentIntentId = '33333333-3333-4333-8333-333333333333';
const uploadSessionId = '55555555-5555-4555-8555-555555555555';
const evidenceId = '66666666-6666-4666-8666-666666666666';

test('uploads replacement evidence directly to private storage before server finalization', async ({ page }) => {
  let completed = false;
  let initiationBody: Record<string, unknown> | undefined;
  let finalizationBody: Record<string, unknown> | undefined;
  let storageMethod = '';
  let storageContentType = '';

  await page.route('**/api/member/status', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        reference: 'SC-2026-TEST0004',
        states: {
          application_state: 'submitted',
          application_review_state: 'approved',
          payment_state: 'verification_pending',
          prc_handoff_state: 'not_ready',
          membership_state: 'not_active',
          updated_at: '2026-09-09T01:00:00Z',
        },
        nextAction: 'Payment verification remains pending.',
        applicationReview: { state: 'approved', reason: null },
        paymentCorrection: completed ? null : {
          caseId: '11111111-1111-4111-8111-111111111111',
          campaignId: '22222222-2222-4222-8222-222222222222',
          paymentIntentId,
          amount: 1200,
          referenceNumber: 'TEST-REFERENCE-001',
          reason: 'Please upload a clearer receipt.',
          dataMode: 'synthetic',
        },
      }),
    });
  });
  await page.route('**/api/payment/evidence/initiate', async (route) => {
    initiationBody = route.request().postDataJSON();
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify({
        uploadSessionId,
        state: 'initiated',
        evidenceVersionId: null,
        uploadUrl: `http://127.0.0.1:3000/storage/v1/object/upload/sign/payment-proofs/quarantine/${uploadSessionId}?token=TEST`,
      }),
    });
  });
  await page.route('**/storage/v1/object/upload/sign/**', async (route) => {
    storageMethod = route.request().method();
    storageContentType = route.request().headers()['content-type'] ?? '';
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ Key: 'private-object' }) });
  });
  await page.route('**/api/payment/evidence/finalize', async (route) => {
    finalizationBody = route.request().postDataJSON();
    completed = true;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ evidenceId, versionNumber: 2, state: 'verification_pending', status: 'created' }),
    });
  });

  await page.goto('/member/status');
  await expect(page.getByText('Please upload a clearer receipt.')).toBeVisible();
  await page.getByLabel(/Replacement image/).setInputFiles({
    name: 'test-receipt.png',
    mimeType: 'image/png',
    buffer: Buffer.from('89504e470d0a1a0a0000000d49484452', 'hex'),
  });
  await page.getByRole('button', { name: 'Submit replacement evidence' }).click();

  await expect(page.getByText('Replacement evidence received. Staff verification is pending.')).toBeVisible();
  expect(initiationBody).toMatchObject({
    payment_intent_id: paymentIntentId,
    content_type: 'image/png',
    size_bytes: 16,
  });
  expect(String(initiationBody?.idempotency_key)).toMatch(/^evidence-/);
  expect(initiationBody).not.toHaveProperty('case_id');
  expect(initiationBody).not.toHaveProperty('campaign_id');
  expect(initiationBody).not.toHaveProperty('amount');
  expect(storageMethod).toBe('PUT');
  expect(storageContentType).toContain('multipart/form-data');
  expect(finalizationBody).toEqual({ upload_session_id: uploadSessionId });
});

test('rejects the legacy application-server multipart upload path', async ({ request }) => {
  const response = await request.post('/api/payment/evidence/upload');
  expect(response.status()).toBe(410);
  await expect(response.json()).resolves.toMatchObject({ error: expect.stringContaining('no longer supported') });
});
