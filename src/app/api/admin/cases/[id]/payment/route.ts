/**
 * POST /api/admin/cases/[id]/payment
 *
 * Finance actions on one payment intent: verify the payment, or request
 * replacement evidence.
 *
 * Three properties this route holds deliberately:
 *
 *   1. It acts on exactly one payment intent, named in the body and
 *      re-read from the database inside the request. There is no bulk
 *      form of this action.
 *   2. It requires an explicit confirmation flag. A verification that
 *      can be triggered by a stray click is not a verification.
 *   3. Verifying a payment moves payment_state only. It does not touch
 *      application_state, prc_handoff_state or membership_state. Money
 *      arriving is not an application decision and is not membership.
 *      Only a PRC confirmation may produce active_confirmed, and that
 *      path does not pass through this file.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { badRequest, conflict, forbidden, notFound } from '@/lib/api/response';
import { assertCampaignAccess, rolesForCampaign, resolveStaffScope } from '@/lib/admin/access';
import { handleAdminError, PRIVATE_NO_STORE } from '@/lib/admin/respond';
import { resolveCaseAccessPolicy } from '@/lib/admin/field-policy';
import type { PaymentState } from '@/types/database';

export const dynamic = 'force-dynamic';

const bodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('verify_payment'),
    payment_intent_id: z.string().uuid(),
    /** Must be true. Present so the decision cannot be made by accident. */
    confirm: z.literal(true),
    /** The evidence row the reviewer actually looked at. */
    evidence_id: z.string().uuid(),
    /** Guards against acting on a stale screen. */
    expected_payment_state: z.string().min(1),
  }),
  z.object({
    action: z.literal('request_reupload'),
    payment_intent_id: z.string().uuid(),
    evidence_id: z.string().uuid(),
    confirm: z.literal(true),
    /** Shown to the applicant, so it must be safe to read. */
    reason: z.string().trim().min(10).max(500),
    expected_payment_state: z.string().min(1),
  }),
]);

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const scope = await resolveStaffScope();
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) return badRequest('Case id must be a UUID.');

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return badRequest(
        'A payment action requires the intent id, an explicit confirmation and the state you saw.',
      );
    }
    const body = parsed.data;

    const admin = getSupabaseAdminClient();

    const { data: caseRecord, error: caseError } = await admin
      .from('recipient_cases')
      .select('id,campaign_id,payment_state,membership_state')
      .eq('id', id)
      .maybeSingle();
    if (caseError) throw new Error(`Failed to load case: ${caseError.message}`);
    if (!caseRecord) return notFound('Case not found.');
    assertCampaignAccess(scope, caseRecord.campaign_id as string);
    const policy = resolveCaseAccessPolicy(
      rolesForCampaign(scope, caseRecord.campaign_id as string),
    );
    if (!policy?.canActOnPayments) {
      return forbidden('Your role cannot act on payment evidence.');
    }

    // Per-record validation: the intent must belong to this case.
    const { data: intent, error: intentError } = await admin
      .from('payment_intents')
      .select('id,case_id,state,expected_amount')
      .eq('id', body.payment_intent_id)
      .maybeSingle();
    if (intentError) throw new Error(`Failed to load payment intent: ${intentError.message}`);
    if (!intent || intent.case_id !== id) {
      return notFound('Payment intent not found for this case.');
    }

    // Stale-screen guard: refuse if the state moved since it was rendered.
    if (intent.state !== body.expected_payment_state) {
      return conflict(
        `This payment has moved to "${intent.state}" since the page was loaded. Reload and review it again.`,
      );
    }

    const priorState = intent.state as PaymentState;

    if (body.action === 'verify_payment') {
      const { data, error: actionError } = await admin.rpc(
        'verify_payment_evidence_atomic',
        {
          p_payment_intent_id: body.payment_intent_id,
          p_evidence_version_id: body.evidence_id,
          p_verified_by: scope.userId,
          p_verification_source: 'manual_prc_reconciliation',
          p_expected_state: priorState,
          p_verification_evidence: { reviewer_confirmed_match: true },
        },
      );
      if (actionError) {
        if (
          actionError.message.includes('since it was loaded')
          || actionError.message.includes('not pending verification')
          || actionError.message.includes('not verifiable')
        ) return conflict(actionError.message);
        throw new Error(`Failed to verify payment: ${actionError.message}`);
      }
      const result = Array.isArray(data) ? data[0] : data;
      if (!result) throw new Error('Failed to verify payment: no result returned');

      return NextResponse.json(
        {
          paymentState: result.payment_state,
          priorState,
          prcHandoffState: result.prc_handoff_state,
          membershipState: result.membership_state,
          membershipChanged: false,
        },
        { headers: PRIVATE_NO_STORE },
      );
    }

    const { data, error: actionError } = await admin.rpc(
      'request_payment_evidence_reupload_atomic',
      {
        p_payment_intent_id: body.payment_intent_id,
        p_evidence_version_id: body.evidence_id,
        p_requested_by: scope.userId,
        p_reason: body.reason,
        p_expected_state: priorState,
      },
    );
    if (actionError) {
      if (
        actionError.message.includes('since it was loaded')
        || actionError.message.includes('not pending verification')
        || actionError.message.includes('not awaiting verification')
      ) return conflict(actionError.message);
      throw new Error(`Failed to request replacement: ${actionError.message}`);
    }
    const result = Array.isArray(data) ? data[0] : data;
    if (!result) throw new Error('Failed to request replacement: no result returned');

    return NextResponse.json(
      {
        paymentState: result.payment_state,
        priorState,
        evidenceState: 'reupload_requested',
        membershipState: result.membership_state,
        membershipChanged: false,
      },
      { headers: PRIVATE_NO_STORE },
    );
  } catch (error) {
    return handleAdminError(error, 'Admin payment action');
  }
}
