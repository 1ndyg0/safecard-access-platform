/**
 * Payment handoff service
 *
 * Journey phase 5: Official Sponsorship Payment
 *
 * Key rules:
 * - Payment does NOT activate membership
 * - Only approved payment routes are used
 * - Payer and recipient privacy are separate
 * - Store only minimal payment status metadata
 * - Do not store screenshots or financial artifacts unless approved
 * - Direct payment-gateway integration is outside the R1 boundary
 */

import { getSupabaseAdminClient } from '@/lib/db/client';
import type { PaymentState } from '@/types/database';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'node:crypto';
import { canonicalJson } from '@/lib/canonical-json';

// ============================================================
// Create payment intent (official handoff)
// ============================================================

export interface CreatePaymentIntentInput {
  caseId: string;
  campaignId: string;
  payerType: 'sponsor' | 'guardian' | 'other';
  payerName?: string;
  payerSponsorId?: string;
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
    payerSponsorId: input.payerSponsorId ?? null,
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
    .select('application_state, consent_state, campaign_id, referral_link_id')
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

  if (input.payerType === 'sponsor') {
    if (!input.payerSponsorId || !caseRecord.referral_link_id) {
      throw new Error('Sponsor payment requires the sponsor linked to this referral');
    }
    const { data: linkedReferral } = await admin
      .from('referral_links')
      .select('id')
      .eq('id', caseRecord.referral_link_id)
      .eq('sponsor_id', input.payerSponsorId)
      .maybeSingle();
    if (!linkedReferral) throw new Error('Payer sponsor is not linked to this application');
    const { data: payerSponsor } = await admin
      .from('sponsors')
      .select('is_minor, guardian_approved')
      .eq('id', input.payerSponsorId)
      .eq('campaign_id', input.campaignId)
      .eq('is_active', true)
      .maybeSingle();
    if (!payerSponsor) throw new Error('Payer sponsor is not active in this campaign');
    if (payerSponsor.is_minor && !payerSponsor.guardian_approved) {
      throw new Error('Guardian approval is required before a minor sponsor can pay');
    }
  } else if (input.payerSponsorId) {
    throw new Error('payer_sponsor_id is only valid when payer_type is sponsor');
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
    p_payer_sponsor_id: input.payerSponsorId ?? null,
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

// ============================================================
// Verify payment (staff action — reconciliation)
// ============================================================

export async function verifyPayment(
  paymentIntentId: string,
  verifiedBy: string,
  verificationSource: string,
  evidence?: Record<string, unknown>,
  evidenceVersionId?: string,
): Promise<void> {
  const admin = getSupabaseAdminClient();

  const { data: intent } = await admin
    .from('payment_intents')
    .select('state, case_id, campaign_id')
    .eq('id', paymentIntentId)
    .single();

  if (!intent) {
    throw new Error('Payment intent not found');
  }

  const roleCheck = await requirePaymentVerifierRole(verifiedBy, intent.campaign_id);
  if (!roleCheck) throw new Error('Permission denied: payment verification role required');

  const currentState = intent.state as PaymentState;
  if (!evidenceVersionId) throw new Error('Payment evidence version is required for verification');
  const { error } = await admin.rpc('verify_payment_evidence_atomic', {
    p_payment_intent_id: paymentIntentId,
    p_evidence_version_id: evidenceVersionId,
    p_verified_by: verifiedBy,
    p_verification_source: verificationSource,
    p_expected_state: currentState,
    p_verification_evidence: evidence ?? null,
  });
  if (error) throw new Error(`Payment verification failed: ${error.message}`);
}

async function requirePaymentVerifierRole(userId: string, campaignId: string): Promise<boolean> {
  const { requireAnyRole } = await import('@/lib/auth/permissions');
  const result = await requireAnyRole(
    userId,
    ['finance_export', 'school_admin', 'prc_liaison'],
    campaignId,
  );
  return result.allowed;
}
