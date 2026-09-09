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
import { validatePaymentTransition } from '@/lib/state-machines';
import type { PaymentState } from '@/types/database';
import { v4 as uuidv4 } from 'uuid';
import { createHash } from 'node:crypto';
import { canonicalJson } from '@/lib/canonical-json';

// ============================================================
// Create payment intent (official handoff)
// ============================================================

export interface CreatePaymentIntentInput {
  caseId: string;
  actorId: string;
  payerType: 'sponsor' | 'guardian' | 'other';
  payerName?: string;
  payerSponsorId?: string;
  paymentRoute: string;
  idempotencyKey: string;
}

export interface PaymentIntentResult {
  paymentIntentId: string;
  status: 'created' | 'exists';
}

export async function createPaymentIntent(
  input: CreatePaymentIntentInput,
): Promise<PaymentIntentResult> {
  const admin = getSupabaseAdminClient();

  // Campaign and amount are server-derived. They are never accepted from the
  // browser because both values affect the financial record.
  const { data: caseRecord } = await admin
    .from('recipient_cases')
    .select('application_state, consent_state, campaign_id, referral_link_id')
    .eq('id', input.caseId)
    .single();

  if (!caseRecord) {
    throw new Error('Case not found');
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
      .eq('campaign_id', caseRecord.campaign_id)
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
    .eq('id', caseRecord.campaign_id)
    .eq('is_active', true)
    .single();
  if (!campaign) throw new Error('Campaign is not active');
  const approvedRoutes = Array.isArray(campaign.approved_payment_routes)
    ? campaign.approved_payment_routes
    : [];
  const approvalType = input.paymentRoute.startsWith('bank_transfer_') ? 'bank_transfer' : input.paymentRoute;
  const approvedRoute = approvedRoutes.find((route) => {
    if (!route || typeof route !== 'object') return false;
    const record = route as Record<string, unknown>;
    return record.type === approvalType && record.is_active === true;
  });
  if (!approvedRoute) throw new Error('Payment route is not approved for this campaign');

  const requestHash = createHash('sha256').update(canonicalJson({
    caseId: input.caseId,
    campaignId: caseRecord.campaign_id,
    payerType: input.payerType,
    payerName: input.payerName ?? null,
    payerSponsorId: input.payerSponsorId ?? null,
    expectedAmount: Number(campaign.membership_fee),
    paymentRoute: input.paymentRoute,
  })).digest('hex');

  const paymentIntentId = uuidv4();

  const { data: committed, error } = await admin.rpc('create_payment_intent_secure', {
    p_payment_intent_id: paymentIntentId,
    p_case_id: input.caseId,
    p_payer_type: input.payerType,
    p_payer_name: input.payerName ?? null,
    p_payer_sponsor_id: input.payerSponsorId ?? null,
    p_payment_route: input.paymentRoute,
    p_idempotency_key: input.idempotencyKey,
    p_request_hash: requestHash,
    p_actor_id: input.actorId,
  });
  if (error) throw new Error(`Failed to create payment intent atomically: ${error.message}`);
  const committedResult = Array.isArray(committed) ? committed[0] : committed;
  if (!committedResult) throw new Error('Failed to create payment intent atomically: no result returned');

  return {
    paymentIntentId: committedResult.payment_intent_id,
    status: committedResult.status as 'created' | 'exists',
  };
}

// ============================================================
// Mark payment as paid (payer action — not verified yet)
// ============================================================

export async function markPaymentPaid(
  paymentIntentId: string,
  paymentReference: string,
  actorId: string,
): Promise<void> {
  const admin = getSupabaseAdminClient();

  const { error } = await admin.rpc('mark_payment_paid_secure', {
    p_payment_intent_id: paymentIntentId,
    p_payment_reference: paymentReference,
    p_actor_id: actorId,
  });
  if (error) throw new Error(`Payment declaration could not be committed atomically: ${error.message}`);
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

  // Can verify from payer_marked_paid or verification_pending
  const currentState = intent.state as PaymentState;
  if (currentState === 'payer_marked_paid') {
    validatePaymentTransition(currentState, 'verification_pending');
    validatePaymentTransition('verification_pending', 'verified_by_official_source');
  } else {
    validatePaymentTransition(currentState, 'verified_by_official_source');
  }

  const { error: verificationError } = await admin.rpc('verify_payment_with_evidence', {
    p_payment_intent_id: paymentIntentId,
    p_evidence_version_id: evidenceVersionId ?? null,
    p_verified_by: verifiedBy,
    p_verification_source: verificationSource,
    p_verification_evidence: evidence ?? null,
  });
  if (verificationError) {
    throw new Error(`Payment verification could not be committed atomically: ${verificationError.message}`);
  }

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
