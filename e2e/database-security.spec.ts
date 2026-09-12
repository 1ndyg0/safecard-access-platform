import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';
import { expect, test } from '@playwright/test';
import { seedWorld, type SeededWorld } from './fixtures/seed';
import { signIn } from './fixtures/auth';

let world: SeededWorld;
test.beforeEach(async () => { world = await seedWorld(); });

test('receipt bucket enforces private access, MIME restrictions and 10 MB limit', async () => {
  const { data: bucket, error } = await world.admin.storage.getBucket('payment-proofs');
  expect(error).toBeNull();
  expect(bucket?.public).toBe(false);
  expect(bucket?.file_size_limit).toBe(10 * 1024 * 1024);
  expect(bucket?.allowed_mime_types?.slice().sort()).toEqual(['image/jpeg', 'image/png', 'image/webp']);
});

for (const authenticated of [false, true]) {
  test(`raw private tables and views cannot bypass the BFF (${authenticated ? 'staff' : 'anon'})`, async () => {
    const browser = createClient(process.env.E2E_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    if (authenticated) {
      const signedIn = await browser.auth.signInWithPassword(world.staff.privacyAdmin);
      expect(signedIn.error).toBeNull();
    }
    for (const table of ['recipient_profiles', 'application_submissions', 'payment_evidence_versions', 'application_review_decisions', 'admin_case_queue_view', 'application_review_context']) {
      const { data, error } = await browser.from(table).select('*').limit(1);
      expect(error, `${table} must be denied to a raw browser client`).not.toBeNull();
      expect(data).toBeNull();
    }
    const upload = await browser.storage.from('payment-proofs').upload('unauthorized.png', await sharp({ create: { width: 1, height: 1, channels: 3, background: '#ffffff' } }).png().toBuffer(), { contentType: 'image/png' });
    expect(upload.error).not.toBeNull();
  });
}

test('original submission and evidence object identity remain immutable even through service-role writes', async () => {
  const { data: original, error } = await world.admin.from('application_submissions')
    .select('id,submitted_data').eq('case_id', world.cases.handoffReady).eq('is_current', true).single();
  expect(error).toBeNull();
  const changed = await world.admin.from('application_submissions')
    .update({ submitted_data: { first_name: 'Synthetic overwrite attempt' } }).eq('id', original!.id);
  expect(changed.error?.message).toContain('immutable');
  const reread = await world.admin.from('application_submissions').select('submitted_data').eq('id', original!.id).single();
  expect(reread.data?.submitted_data).toEqual(original!.submitted_data);
  const changedEvidence = await world.admin.from('payment_evidence_versions')
    .update({ object_path: 'replacement/forbidden.png' }).eq('id', world.paymentEvidenceId);
  expect(changedEvidence.error?.message).toContain('immutable');
  const deletedEvidence = await world.admin.from('payment_evidence_versions').delete().eq('id', world.paymentEvidenceId);
  expect(deletedEvidence.error?.message).toContain('immutable');
});

test('an invalid actor rolls back review state and decision creation atomically', async () => {
  const before = await world.admin.from('recipient_cases').select('application_review_state,payment_state,membership_state')
    .eq('id', world.cases.verifiedPaymentPendingReview).single();
  const result = await world.admin.rpc('record_application_review_atomic', {
    p_case_id: world.cases.verifiedPaymentPendingReview,
    p_reviewer_id: '00000000-0000-0000-0000-000000000001',
    p_decision: 'approved', p_reason: null, p_expected_state: 'pending',
    p_idempotency_key: 'synthetic-rollback-test', p_is_reopen: false,
  });
  expect(result.error).not.toBeNull();
  const after = await world.admin.from('recipient_cases').select('application_review_state,payment_state,membership_state')
    .eq('id', world.cases.verifiedPaymentPendingReview).single();
  expect(after.data).toEqual(before.data);
  const ledger = await world.admin.from('application_review_decisions').select('id')
    .eq('idempotency_key', 'synthetic-rollback-test');
  expect(ledger.data).toEqual([]);
});

test('signed receipt access is short-lived and audited without recording the URL', async ({ page }) => {
  await signIn(page, world.staff.finance);
  const response = await page.request.get(`/api/payment/evidence/${world.paymentEvidenceId}`);
  expect(response.status()).toBe(200);
  const body = await response.json();
  expect(body.expiresInSeconds).toBe(300);
  expect(typeof body.signedUrl).toBe('string');
  const audit = await world.admin.from('audit_events').select('action,details,actor_id')
    .eq('target_id', world.paymentEvidenceId).eq('event_type', 'staff_access');
  expect(audit.error).toBeNull();
  expect(audit.data?.some((row) => row.actor_id === world.staff.finance.userId && row.action === 'Accessed private payment evidence')).toBe(true);
  expect(JSON.stringify(audit.data)).not.toContain(body.signedUrl);
});

test('school application reviewers cannot obtain private receipt URLs', async ({ page }) => {
  await signIn(page, world.staff.schoolAdmin);
  const response = await page.request.get(`/api/payment/evidence/${world.paymentEvidenceId}`);
  expect(response.status()).toBe(403);
  expect(await response.text()).not.toContain('signedUrl');
});

test('repeated member payment declarations are idempotent and cannot rewind verification', async ({ page }) => {
  const prepared = await world.admin.from('payment_intents').update({ state: 'official_handoff_opened', payer_marked_paid_at: null, payer_declared_at: null, payment_reference: null, payer_declaration: null }).eq('id', world.paymentIntentId);
  expect(prepared.error).toBeNull();
  const record = await world.admin.from('recipient_cases').select('application_ref').eq('id', world.cases.approvedUnverifiedPayment).single();
  expect(record.error).toBeNull();
  const login = await page.request.post('/api/member/auth', { data: { referenceNumber: record.data!.application_ref, mobileNumber: '+639000000000' } });
  expect(login.status()).toBe(200);
  const declaration = { payment_reference: 'TEST IDEMPOTENT REFERENCE', confirm: true };
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await page.request.post('/api/member/payment/mark-paid', { data: declaration });
    expect(response.status()).toBe(200);
    expect(await response.json()).toMatchObject({ marked: true, paymentState: 'payer_marked_paid', membershipChanged: false });
  }
  const progressed = await world.admin.from('payment_intents').update({ state: 'verification_pending' }).eq('id', world.paymentIntentId);
  expect(progressed.error).toBeNull();
  const replay = await page.request.post('/api/member/payment/mark-paid', { data: declaration });
  expect(replay.status()).toBe(200);
  expect((await replay.json()).paymentState).toBe('verification_pending');
  const conflict = await page.request.post('/api/member/payment/mark-paid', { data: { ...declaration, payment_reference: 'TEST DIFFERENT REFERENCE' } });
  expect(conflict.status()).toBe(409);
  const audit = await world.admin.from('audit_events').select('id').eq('target_id', world.paymentIntentId).eq('action', 'Payment marked as paid');
  expect(audit.error).toBeNull();
  expect(audit.data).toHaveLength(1);
  const membership = await world.admin.from('recipient_cases').select('membership_state').eq('id', world.cases.approvedUnverifiedPayment).single();
  expect(membership.data?.membership_state).toBe('not_active');
});
