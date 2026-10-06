import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { seedWorld } from './fixtures/seed';
import { signIn } from './fixtures/auth';

test('payment review alone permits scoped proof decisions and denies direct exports and configuration', async ({ page }) => {
  const world = await seedWorld();
  const removed = await world.admin.from('role_assignments').delete()
    .eq('user_id', world.staff.finance.userId).eq('role', 'finance_export');
  expect(removed.error).toBeNull();
  const batchId = randomUUID();
  const batch = await world.admin.from('prc_export_batches').insert({
    id: batchId, campaign_id: world.campaignId, batch_ref: `TEST-${batchId}`,
    created_by: world.staff.privacyAdmin.userId, creation_reason: 'SYNTHETIC TEST export denial',
    reauth_method: 'mfa', reauth_at: new Date().toISOString(), record_count: 1,
    column_order: ['application_ref'], checksum: 'b'.repeat(64), format: 'json',
  });
  expect(batch.error).toBeNull();
  const raw = createClient(process.env.E2E_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  expect((await raw.auth.signInWithPassword(world.staff.finance)).error).toBeNull();
  for (const table of ['recipient_cases', 'recipient_profiles', 'payment_intents', 'payment_evidence_versions', 'prc_export_batches', 'prc_export_items']) {
    expect((await raw.from(table).select('*').limit(1)).error, `${table} raw access must remain denied`).not.toBeNull();
  }
  await signIn(page, world.staff.finance);
  const proof = await page.request.get(`/api/payment/evidence/${world.paymentEvidenceId}`);
  expect(proof.status()).toBe(200);
  const detail = await page.request.get(`/api/admin/cases/${world.cases.approvedUnverifiedPayment}`);
  expect(detail.status()).toBe(200);
  expect(await detail.text()).not.toContain('date_of_birth');
  expect((await page.request.get(`/api/admin/cases/${world.cases.crossCampaign}`)).status()).toBe(403);
  expect((await page.request.get(`/api/export/console?campaign_id=${world.campaignId}`)).status()).toBe(403);
  expect((await page.request.get(`/api/export/download?batch_id=${batchId}`)).status()).toBe(403);
  expect((await page.request.post('/api/export/batch', { data: {
    campaign_id: world.campaignId, creation_reason: 'SYNTHETIC TEST forbidden export',
    case_ids: [world.cases.handoffReady], format: 'json',
  } })).status()).toBe(403);
  expect((await page.request.post('/api/admin/roles/assign', { data: {
    user_id: world.staff.unassigned.userId, campaign_id: world.campaignId,
    role: 'finance_export', reason: 'SYNTHETIC TEST forbidden access grant',
  } })).status()).toBe(403);
  await page.goto(`/admin/submissions/${world.cases.approvedUnverifiedPayment}`);
  await expect(page.getByRole('link', { name: 'PRC export', exact: true })).toHaveCount(0);
  await expect(page.getByRole('link', { name: 'Staff & roles', exact: true })).toHaveCount(0);
  const replacement = await page.request.post(`/api/admin/cases/${world.cases.approvedUnverifiedPayment}/payment`, {
    data: { action: 'request_reupload', payment_intent_id: world.paymentIntentId,
      evidence_id: world.paymentEvidenceId, confirm: true, expected_payment_state: 'verification_pending',
      reason: 'SYNTHETIC TEST request a clearer replacement.' },
  });
  expect(replacement.status()).toBe(200);
  const audit = await world.admin.from('audit_events').select('details')
    .eq('case_id', world.cases.approvedUnverifiedPayment).eq('event_type', 'payment_status_change');
  expect(JSON.stringify(audit.data)).toContain('SYNTHETIC TEST request a clearer replacement.');
});

test('export-only staff cannot read or decide payment proof', async ({ page }) => {
  const world = await seedWorld();
  const removed = await world.admin.from('role_assignments').delete()
    .eq('user_id', world.staff.finance.userId).eq('role', 'payment_reviewer');
  expect(removed.error).toBeNull();
  await signIn(page, world.staff.finance);
  expect((await page.request.get(`/api/payment/evidence/${world.paymentEvidenceId}`)).status()).toBe(403);
  for (const url of [`/api/admin/cases/${world.cases.approvedUnverifiedPayment}/payment`, '/api/payment/verify', '/api/payment/evidence/request-reupload']) {
    const data = url.endsWith('/payment') ? {
      action: 'verify_payment', payment_intent_id: world.paymentIntentId, evidence_id: world.paymentEvidenceId,
      confirm: true, expected_payment_state: 'verification_pending',
    } : url.endsWith('/verify') ? {
      payment_intent_id: world.paymentIntentId, evidence_version_id: world.paymentEvidenceId,
      verification_source: 'manual_prc_reconciliation',
    } : { evidence_version_id: world.paymentEvidenceId, reason: 'SYNTHETIC TEST forbidden replacement.' };
    expect((await page.request.post(url, { data })).status()).toBe(403);
  }
});


test('payment review alone approves the proof without approving the application or activating membership', async ({ page }) => {
  const world = await seedWorld();
  const removed = await world.admin.from('role_assignments').delete()
    .eq('user_id', world.staff.finance.userId).eq('role', 'finance_export');
  expect(removed.error).toBeNull();
  await signIn(page, world.staff.finance);
  const result = await page.request.post(`/api/admin/cases/${world.cases.approvedUnverifiedPayment}/payment`, {
    data: { action: 'verify_payment', payment_intent_id: world.paymentIntentId,
      evidence_id: world.paymentEvidenceId, confirm: true, expected_payment_state: 'verification_pending' },
  });
  expect(result.status()).toBe(200);
  expect((await result.json()).membershipChanged).toBe(false);
  const current = await world.admin.from('recipient_cases')
    .select('application_state,payment_state,membership_state').eq('id', world.cases.approvedUnverifiedPayment).single();
  expect(current.data).toMatchObject({ application_state: 'submitted', payment_state: 'verified_by_official_source', membership_state: 'not_active' });
});
