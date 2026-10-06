import { randomUUID } from 'node:crypto';
import { expect, test, type APIResponse } from '@playwright/test';
import sharp from 'sharp';
import { seedWorld } from './fixtures/seed';
import { signIn } from './fixtures/auth';

async function jsonAt(response: APIResponse, status: number) {
  const body = await response.json();
  expect(response.status(), JSON.stringify(body)).toBe(status);
  return body;
}

for (const bank of ['bpi', 'bdo', 'security_bank', 'metrobank']) {
  test(`real applicant backend completes ${bank} transfer, private proof and staff review`, async ({ page, browser }, testInfo) => {
    // seedWorld rejects the production project; all records and file bytes are disposable.
    const world = await seedWorld();
    const consentId = randomUUID();
    const notice = await world.admin.from('content_versions').select('id')
      .eq('content_type', 'privacy_notice').eq('locale', 'en').single();
    expect(notice.error).toBeNull();
    const consent = await world.admin.from('content_versions').insert({
      id: consentId, content_type: 'consent_text', locale: 'en', version: 1,
      created_by: world.staff.privacyAdmin.userId,
      title: 'SYNTHETIC TEST consent', body: 'SYNTHETIC TEST consent for disposable verification only.',
      approval_status: 'approved', is_published: true, published_at: new Date().toISOString(),
    });
    expect(consent.error).toBeNull();
    const capacity = await world.admin.from('pilot_campaigns')
      .update({ max_applications: null, max_sponsors: null }).eq('id', world.campaignId);
    expect(capacity.error).toBeNull();

    const { caseId } = await jsonAt(await page.request.post('/api/intake/case', {
      data: { campaign_id: world.campaignId, decision: 'accept' },
    }), 201);
    const { consentRecordId } = await jsonAt(await page.request.post('/api/consent/grant', {
      data: { applicant_category: 'adult', consent_actor: 'recipient', case_id: caseId, consent_type: 'membership_application',
        consent_content_version_id: consentId, privacy_notice_version_id: notice.data!.id,
        locale: 'en', idempotency_key: `test-consent-${caseId}` },
    }), 201);
    await jsonAt(await page.request.post('/api/intake/comprehension', {
      data: { case_id: caseId, answers: { cost: '1200', activation: 'prc', choice: 'recipient', emergency: '143' } },
    }), 200);
    const profile = { first_name: 'Synthetic', last_name: 'Applicant', date_of_birth: '2000-01-01',
      sex: 'female', mobile_number: '09000000000', address_line1: '1 Test Street',
      city: 'Test City', province: 'Test Province', zip_code: '0000' };
    await jsonAt(await page.request.post('/api/intake/profile', {
      data: { case_id: caseId, profile_data: profile, ready_for_payment: true, data_mode: 'synthetic' },
    }), 200);
    const handoff = { case_id: caseId, campaign_id: world.campaignId, payer_type: 'other',
      expected_amount: 1200, payment_route: `bank_transfer_${bank}`,
      idempotency_key: `test-intent-${caseId}`, data_mode: 'synthetic' };
    const { paymentIntentId } = await jsonAt(await page.request.post('/api/payment/handoff', { data: handoff }), 201);
    expect((await jsonAt(await page.request.post('/api/payment/handoff', { data: handoff }), 200)).paymentIntentId)
      .toBe(paymentIntentId);
    await jsonAt(await page.request.post('/api/payment/mark-paid', {
      data: { payment_intent_id: paymentIntentId, payment_reference: 'TEST TRANSFER',
        payer_declaration: 'TEST BANK TRANSFER PROOF', data_mode: 'synthetic' },
    }), 200);
    const proof = await sharp(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="800" height="240"><rect width="800" height="240" fill="white"/><text x="30" y="100" font-size="30">SYNTHETIC TEST PROOF - NO TRANSFER</text><text x="30" y="160" font-size="24">Disposable test only - PHP 1200</text></svg>')).png().toBuffer();
    let { evidenceId } = await jsonAt(await page.request.post('/api/payment/evidence/upload', {
      multipart: { payment_intent_id: paymentIntentId, case_id: caseId, campaign_id: world.campaignId,
        amount: '1200', reference_number: 'TEST TRANSFER', payer_declaration: 'TEST BANK TRANSFER PROOF',
        data_mode: 'synthetic', file: { name: 'SYNTHETIC-TEST-NO-TRANSFER.png', mimeType: 'image/png', buffer: proof } },
    }), 201);
    const submission = { case_id: caseId, consent_record_id: consentRecordId,
      content_versions_seen: [notice.data!.id, consentId], privacy_notice_version_id: notice.data!.id,
      profile_data: profile, submitted_by: 'recipient', idempotency_key: `test-submit-${caseId}`, data_mode: 'synthetic' };
    const submitted = await jsonAt(await page.request.post('/api/intake/submit', { data: submission }), 201);
    expect(submitted.applicationRef).toMatch(/^SC-\d{4}-[A-Z0-9]{8}$/);
    const replay = await jsonAt(await page.request.post('/api/intake/submit', { data: submission }), 200);
    expect(replay.applicationRef).toBe(submitted.applicationRef);
    expect((await page.request.get(`/api/payment/evidence/${evidenceId}`)).status()).toBe(403);

    const staffContext = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
    try {
      const staffPage = await staffContext.newPage();
      await signIn(staffPage, world.staff.finance);
      const privateProof = await jsonAt(await staffPage.request.get(`/api/payment/evidence/${evidenceId}`), 200);
      expect(privateProof.expiresInSeconds).toBe(300);
      expect((await staffPage.request.get(privateProof.signedUrl)).status()).toBe(200);
      const oldEvidenceId = evidenceId;
      await jsonAt(await staffPage.request.post(`/api/admin/cases/${caseId}/payment`, {
        data: { action: 'request_reupload', payment_intent_id: paymentIntentId, confirm: true,
          evidence_id: evidenceId, expected_payment_state: 'verification_pending',
          reason: 'SYNTHETIC TEST: request a clearly labeled replacement proof.' },
      }), 200);
      const replacement = await jsonAt(await page.request.post('/api/payment/evidence/upload', {
        multipart: { payment_intent_id: paymentIntentId, case_id: caseId, campaign_id: world.campaignId,
          amount: '1200', reference_number: 'TEST REPLACEMENT', payer_declaration: 'TEST BANK TRANSFER PROOF',
          data_mode: 'synthetic', file: { name: 'SYNTHETIC-TEST-REPLACEMENT.png', mimeType: 'image/png', buffer: proof } },
      }), 201);
      evidenceId = replacement.evidenceId;
      expect(evidenceId).not.toBe(oldEvidenceId);
      const history = await world.admin.from('payment_evidence_versions')
        .select('id,state,supersedes_id,version_number').eq('payment_intent_id', paymentIntentId)
        .order('version_number');
      expect(history.error).toBeNull();
      expect(history.data).toEqual([
        { id: oldEvidenceId, state: 'superseded', supersedes_id: null, version_number: 1 },
        { id: evidenceId, state: 'verification_pending', supersedes_id: oldEvidenceId, version_number: 2 },
      ]);
      const verified = await jsonAt(await staffPage.request.post(`/api/admin/cases/${caseId}/payment`, {
        data: { action: 'verify_payment', payment_intent_id: paymentIntentId, confirm: true,
          evidence_id: evidenceId, expected_payment_state: 'verification_pending' },
      }), 200);
      expect(verified.membershipChanged).toBe(false);
      const current = await world.admin.from('recipient_cases')
        .select('application_state,payment_state,membership_state').eq('id', caseId).single();
      expect(current.data).toMatchObject({ application_state: 'submitted',
        payment_state: 'verified_by_official_source', membership_state: 'not_active' });
      const audit = await world.admin.from('audit_events').select('actor_id,event_type')
        .eq('case_id', caseId).eq('actor_id', world.staff.finance.userId);
      expect(audit.error).toBeNull();
      expect(audit.data?.some((event) => event.event_type === 'staff_access')).toBe(true);
      expect(audit.data?.length).toBeGreaterThanOrEqual(2);
      const versions = await world.admin.from('application_submissions')
        .select('id', { count: 'exact', head: true }).eq('case_id', caseId);
      expect(versions.count).toBe(1);
    } finally {
      await staffContext.close();
    }
  });
}
