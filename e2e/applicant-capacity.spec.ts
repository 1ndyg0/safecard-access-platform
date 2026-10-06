import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { seedWorld } from './fixtures/seed';

test('child and guardian declarations cannot create adult consent records', async ({ page }) => {
  const world = await seedWorld();
  const started = await page.request.post('/api/intake/case', {
    data: { campaign_id: world.campaignId, decision: 'accept' },
  });
  expect(started.status()).toBe(201);
  const { caseId } = await started.json();
  for (const declaration of [
    { applicant_category: 'child', consent_actor: 'recipient' },
    { applicant_category: 'child', consent_actor: 'guardian' },
    { applicant_category: 'adult', consent_actor: 'guardian' },
  ]) {
    const response = await page.request.post('/api/consent/grant', { data: {
      ...declaration, case_id: caseId, consent_type: 'membership_application',
      consent_content_version_id: randomUUID(), privacy_notice_version_id: randomUUID(),
      locale: 'en', idempotency_key: `TEST-capacity-${randomUUID()}`,
    } });
    expect(response.status()).toBe(403);
    expect((await response.json()).error).toContain('guardian');
  }
  const omitted = await page.request.post('/api/consent/grant', { data: {
    case_id: caseId, consent_type: 'membership_application',
    consent_content_version_id: randomUUID(), privacy_notice_version_id: randomUUID(),
    locale: 'en', idempotency_key: `TEST-capacity-${randomUUID()}`,
  } });
  expect(omitted.status()).toBe(400);
  const records = await world.admin.from('consent_records').select('id').eq('case_id', caseId);
  expect(records.error).toBeNull();
  expect(records.data).toEqual([]);
  const current = await world.admin.from('recipient_cases').select('consent_state').eq('id', caseId).single();
  expect(current.data?.consent_state).not.toBe('agreed');
});
