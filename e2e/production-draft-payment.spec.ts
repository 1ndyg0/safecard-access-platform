import { randomUUID } from 'node:crypto';
import { expect, test } from '@playwright/test';
import { seedWorld } from './fixtures/seed';

test('draft application opens one approved bank-transfer intent only after comprehension and profile completion', async () => {
  // seedWorld refuses shared and production projects and resets a disposable database.
  const world = await seedWorld();
  const admin = world.admin;
  const caseId = randomUUID();
  const actorId = world.staff.finance.userId;
  const { error: caseError } = await admin.from('recipient_cases').insert({
    id: caseId,
    campaign_id: world.campaignId,
    auth_user_id: actorId,
    consent_state: 'agreed',
    application_state: 'draft',
    comprehension_passed: false,
    payment_state: 'not_started',
  });
  expect(caseError).toBeNull();
  const { error: profileError } = await admin.from('recipient_profiles').insert({
    case_id: caseId,
    first_name: 'Synthetic',
    last_name: 'Applicant',
    date_of_birth: '2000-01-01',
    sex: 'female',
    mobile_number: '+639000000000',
    address_line1: '1 Synthetic Street',
    city: 'Test City',
    province: 'Test Province',
    zip_code: '0000',
    fields_completed: true,
  });
  expect(profileError).toBeNull();

  const intentId = randomUUID();
  const key = `e2e-payment-${caseId}`;
  const payload = {
    p_payment_intent_id: intentId,
    p_case_id: caseId,
    p_campaign_id: world.campaignId,
    p_payer_type: 'other',
    p_payer_name: null,
    p_payer_sponsor_id: null,
    p_expected_amount: 1200,
    p_payment_route: 'bank_transfer_bpi',
    p_idempotency_key: key,
    p_request_hash: 'same-request',
    p_actor_id: actorId,
  };

  const blocked = await admin.rpc('create_payment_intent_atomic', payload);
  expect(blocked.error?.message).toContain('Complete comprehension');

  const answers = { cost: '1200', activation: 'prc', choice: 'recipient', emergency: '143' };
  const { error: updateError } = await admin.from('recipient_cases').update({ comprehension_passed: true, comprehension_score: 4, comprehension_answers: answers }).eq('id', caseId);
  expect(updateError).toBeNull();

  const invalidRoute = await admin.rpc('create_payment_intent_atomic', { ...payload, p_payment_route: 'gcash' });
  expect(invalidRoute.error?.message).toContain('Choose an approved bank transfer method');

  const created = await admin.rpc('create_payment_intent_atomic', payload);
  expect(created.error).toBeNull();
  expect(created.data?.[0]).toMatchObject({ payment_intent_id: intentId, status: 'created' });
  const replay = await admin.rpc('create_payment_intent_atomic', { ...payload, p_payment_intent_id: randomUUID() });
  expect(replay.error).toBeNull();
  expect(replay.data?.[0]).toMatchObject({ payment_intent_id: intentId, status: 'exists' });
  const { count } = await admin.from('payment_intents').select('id', { count: 'exact', head: true }).eq('case_id', caseId);
  expect(count).toBe(1);
  const { data: currentCase } = await admin.from('recipient_cases').select('application_state,payment_state,membership_state,comprehension_answers').eq('id', caseId).single();
  expect(currentCase).toMatchObject({ application_state: 'draft', payment_state: 'official_handoff_opened', membership_state: 'not_active', comprehension_answers: answers });
});
