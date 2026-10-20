/**
 * Payment handoff service
 *
 * Journey phase 5: Official Payment
 *
 * Key rules:
 * - Payment does NOT activate membership
 * - Only approved payment routes are used
 * - Store only minimal payment status metadata
 * - Do not store screenshots or financial artifacts unless approved
 * - Direct payment-gateway integration is outside the R1 boundary
 */

import { getSupabaseAdminClient } from '@/lib/db/client';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'node:crypto';
import { canonicalJson } from '@/lib/canonical-json';

// ============================================================
// Create payment intent (official handoff)
// ============================================================

export interface CreatePaymentIntentInput {
  caseId: string;
  campaignId: string;
  payerType: 'guardian' | 'other';
  payerName?: string;
  expectedAmount: number;
  paymentRoute: string;
  idempotencyKey: string;
  actorId: string;
}

export interface PaymentIntentResult {
  paymentIntentId: string;
  status: 'created' | 'exists';
}

export async function createPaymentIntent(
  input: CreatePaymentIntentInput,
): Promise<PaymentIntentResult> {
  const admin = getSupabaseAdminClient();

  const requestHash = createHash('sha256').update(canonicalJson({
    caseId: input.caseId,
    campaignId: input.campaignId,
    payerType: input.payerType,
    payerName: input.payerName ?? null,
    expectedAmount: input.expectedAmount,
    paymentRoute: input.paymentRoute,
  })).digest('hex');
  const { data: existing } = await admin
    .from('payment_intents')
    .select('id, request_hash')
    .eq('idempotency_key', input.idempotencyKey)
    .maybeSingle();

  if (existing) {
    if (existing.request_hash !== requestHash) {
      throw new Error('Idempotency key was already used with a different payment request');
    }
    return { paymentIntentId: existing.id, status: 'exists' };
  }

  // Verify case exists and has submitted application.
  const { data: caseRecord } = await admin
    .from('recipient_cases')
    .select('application_state, consent_state, campaign_id')
    .eq('id', input.caseId)
    .single();

  if (!caseRecord) {
    throw new Error('Case not found');
  }

  if (caseRecord.campaign_id !== input.campaignId) {
    throw new Error('Payment campaign does not match the application');
  }

  if (caseRecord.consent_state !== 'agreed') {
    throw new Error('Cannot create payment: consent must be active');
  }

  if (caseRecord.application_state !== 'submitted' && caseRecord.application_state !== 'resubmitted') {
    throw new Error('Cannot create payment: application must be submitted first');
  }

  const { data: campaign } = await admin
    .from('pilot_campaigns')
    .select('membership_fee, approved_payment_routes')
    .eq('id', input.campaignId)
    .eq('is_active', true)
    .single();
  if (!campaign) throw new Error('Campaign is not active');
  if (Number(campaign.membership_fee) !== input.expectedAmount) {
    throw new Error('Payment amount does not match the approved campaign fee');
  }
  const approvedRoutes = Array.isArray(campaign.approved_payment_routes)
    ? campaign.approved_payment_routes
    : [];
  const approvalType = input.paymentRoute.startsWith('bank_transfer_')
    ? 'bank_transfer'
    : input.paymentRoute;
  const approvedRoute = approvedRoutes.find((route) => {
    if (!route || typeof route !== 'object') return false;
    const record = route as Record<string, unknown>;
    return record.type === approvalType && record.is_active === true;
  });
  if (!approvedRoute) throw new Error('Payment route is not approved for this campaign');

  const paymentIntentId = uuidv4();

  const { data, error } = await admin.rpc('create_payment_intent_atomic', {
    p_payment_intent_id: paymentIntentId,
    p_case_id: input.caseId,
    p_campaign_id: input.campaignId,
    p_payer_type: input.payerType,
    p_payer_name: input.payerName ?? null,
    p_expected_amount: input.expectedAmount,
    p_payment_route: input.paymentRoute,
    p_idempotency_key: input.idempotencyKey,
    p_request_hash: requestHash,
    p_actor_id: input.actorId,
  });
  if (error) throw new Error(`Failed to create payment intent: ${error.message}`);
  const result = Array.isArray(data) ? data[0] : data;
  if (!result) throw new Error('Failed to create payment intent: no result returned');
  return {
    paymentIntentId: result.payment_intent_id as string,
    status: result.status as 'created' | 'exists',
  };
}

// ============================================================
// Mark payment as paid (payer action — not verified yet)
// ============================================================

export async function markPaymentPaid(
  paymentIntentId: string,
  paymentReference: string,
  payerDeclaration: string,
  paidAt: string,
  amountPaid: number,
  actorId: string | null,
): Promise<{ paymentState: string }> {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin.rpc('mark_payment_paid_atomic', {
    p_payment_intent_id: paymentIntentId,
    p_payment_reference: paymentReference,
    p_payer_declaration: payerDeclaration,
    p_paid_at: paidAt,
    p_amount_paid: amountPaid,
    p_actor_id: actorId,
  });
  if (error) throw new Error(`Payment could not be marked paid: ${error.message}`);
  const result = Array.isArray(data) ? data[0] : data;
  if (!result) throw new Error('Payment declaration returned no state.');
  return { paymentState: result.payment_state as string };
}
