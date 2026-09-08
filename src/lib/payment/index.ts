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
import { writeAuditEvent } from '@/lib/audit';
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
  campaignId: string;
  payerType: 'sponsor' | 'guardian' | 'other';
  payerName?: string;
  payerSponsorId?: string;
  expectedAmount: number;
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
  const approvedRoute = approvedRoutes.find((route) => {
    if (!route || typeof route !== 'object') return false;
    const record = route as Record<string, unknown>;
    return record.type === input.paymentRoute && record.is_active === true;
  });
  if (!approvedRoute) throw new Error('Payment route is not approved for this campaign');

  const paymentIntentId = uuidv4();

  const { error } = await admin.from('payment_intents').insert({
    id: paymentIntentId,
    case_id: input.caseId,
    campaign_id: input.campaignId,
    payer_type: input.payerType,
    payer_name: input.payerName ?? null,
    payer_sponsor_id: input.payerSponsorId ?? null,
    expected_amount: input.expectedAmount,
    currency: 'PHP',
    payment_route: input.paymentRoute,
    state: 'official_handoff_opened',
    handoff_opened_at: new Date().toISOString(),
    idempotency_key: input.idempotencyKey,
    request_hash: requestHash,
  });

  if (error) {
    throw new Error(`Failed to create payment intent: ${error.message}`);
  }

  // Update case payment state
  await admin
    .from('recipient_cases')
    .update({ payment_state: 'official_handoff_opened' })
    .eq('id', input.caseId);

  // R1 records only an official handoff. Direct gateway integration is R2 and
  // intentionally cannot be activated by configuration in this release.
  await writeAuditEvent({
    event_type: 'payment_status_change',
    actor_id: null,
    actor_type: 'anonymous',
    action: `Payment handoff opened for case ${input.caseId}`,
    case_id: input.caseId,
    target_type: 'payment_intent',
    target_id: paymentIntentId,
    details: {
      payer_type: input.payerType,
      expected_amount: input.expectedAmount,
      payment_route: input.paymentRoute,
      direct_gateway_integration: false,
    },
  });

  return { paymentIntentId, status: 'created' };
}

// ============================================================
// Mark payment as paid (payer action — not verified yet)
// ============================================================

export async function markPaymentPaid(
  paymentIntentId: string,
  paymentReference: string,
  payerDeclaration: string,
): Promise<void> {
  const admin = getSupabaseAdminClient();

  const { data: intent } = await admin
    .from('payment_intents')
    .select('state, case_id')
    .eq('id', paymentIntentId)
    .single();

  if (!intent) {
    throw new Error('Payment intent not found');
  }

  validatePaymentTransition(intent.state as PaymentState, 'payer_marked_paid');

  await admin
    .from('payment_intents')
    .update({
      state: 'payer_marked_paid',
      payment_reference: paymentReference,
      payer_declaration: payerDeclaration,
      payer_declared_at: new Date().toISOString(),
      payer_marked_paid_at: new Date().toISOString(),
    })
    .eq('id', paymentIntentId);

  await admin
    .from('recipient_cases')
    .update({ payment_state: 'payer_marked_paid' })
    .eq('id', intent.case_id);

  await writeAuditEvent({
    event_type: 'payment_status_change',
    actor_id: null,
    actor_type: 'anonymous',
    action: `Payment marked as paid for intent ${paymentIntentId}`,
    case_id: intent.case_id,
    target_type: 'payment_intent',
    target_id: paymentIntentId,
    details: { payment_reference: paymentReference, payer_declaration_recorded: true },
  });
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

  await admin
    .from('payment_intents')
    .update({
      state: 'verified_by_official_source',
      verified_at: new Date().toISOString(),
      verified_by: verifiedBy,
      verification_source: verificationSource,
      verification_evidence: evidence ?? null,
    })
    .eq('id', paymentIntentId);

  // Update case — payment is verified but membership is NOT active
  // Membership activation only comes from PRC confirmation
  await admin
    .from('recipient_cases')
    .update({
      payment_state: 'verified_by_official_source',
      prc_handoff_state: 'ready_for_export',
    })
    .eq('id', intent.case_id);

  if (evidenceVersionId) {
    const { error: evidenceError } = await admin
      .from('payment_evidence_versions')
      .update({ state: 'verified', reviewed_by: verifiedBy, reviewed_at: new Date().toISOString() })
      .eq('id', evidenceVersionId)
      .eq('payment_intent_id', paymentIntentId);
    if (evidenceError) throw new Error(`Payment evidence could not be verified: ${evidenceError.message}`);
    await admin.from('payment_evidence').update({ is_verified: true, confirmed_at: new Date().toISOString(), confirmed_by: verifiedBy }).eq('id', evidenceVersionId);
  }

  await writeAuditEvent({
    event_type: 'payment_status_change',
    actor_id: verifiedBy,
    actor_type: 'user',
    action: `Payment verified for intent ${paymentIntentId} via ${verificationSource}`,
    case_id: intent.case_id,
    target_type: 'payment_intent',
    target_id: paymentIntentId,
    details: {
      verification_source: verificationSource,
    },
    severity: 'info',
  });
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
