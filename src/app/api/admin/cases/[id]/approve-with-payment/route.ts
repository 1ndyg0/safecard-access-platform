/**
 * POST /api/admin/cases/[id]/approve-with-payment
 *
 * Administrator approval: approve the application AND verify the payment
 * proof the reviewer looked at, in one confirmed action. This is the only
 * place a payment is verified.
 *
 *   - It needs a reviewer role on the campaign (privacy_admin_owner or
 *     school_admin). No separate finance role exists.
 *   - It names the exact payment intent and evidence row the reviewer
 *     looked at, and refuses a stale screen for both the review state
 *     and the payment state.
 *   - It requires an explicit confirmation flag and an idempotency key.
 *   - It uses the same atomic database functions, so the append-only
 *     ledgers record the reviewer, prior and resulting state.
 *
 * Both steps are separate transactions. If verifying the payment fails
 * after the approval was recorded, the response says exactly that and
 * the application simply stays approved with payment still pending.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { badRequest, conflict, forbidden, notFound } from '@/lib/api/response';
import { assertCampaignAccess, rolesForCampaign, resolveStaffScope } from '@/lib/admin/access';
import { handleAdminError, PRIVATE_NO_STORE } from '@/lib/admin/respond';
import { resolveCaseAccessPolicy } from '@/lib/admin/field-policy';
import { REVIEW_STATES } from '@/lib/review/state';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  confirm: z.literal(true),
  expected_review_state: z.enum(REVIEW_STATES),
  payment_intent_id: z.string().uuid(),
  evidence_id: z.string().uuid(),
  expected_payment_state: z.string().min(1),
  idempotency_key: z.string().min(8).max(200),
});

const REVIEWER_ROLES = ['privacy_admin_owner', 'school_admin'];

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
        'Approval with payment needs an explicit confirmation, the payment intent and evidence you reviewed, and the states you saw.',
      );
    }
    const body = parsed.data;

    const admin = getSupabaseAdminClient();
    const { data: caseRecord, error: caseError } = await admin
      .from('recipient_cases')
      .select('id,campaign_id,application_review_state,payment_state')
      .eq('id', id)
      .maybeSingle();
    if (caseError) throw new Error(`Failed to load case: ${caseError.message}`);
    if (!caseRecord) return notFound('Case not found.');

    const campaignId = caseRecord.campaign_id as string;
    assertCampaignAccess(scope, campaignId);
    const roles = rolesForCampaign(scope, campaignId);
    const policy = resolveCaseAccessPolicy(roles);
    if (!roles.some((role) => REVIEWER_ROLES.includes(role))) {
      return forbidden('Your role cannot decide applications for this campaign.');
    }
    if (!policy?.canActOnPayments) {
      return forbidden('Your role cannot verify payments for this campaign.');
    }

    // The intent must belong to this case and be in the state the reviewer saw.
    const { data: intent, error: intentError } = await admin
      .from('payment_intents')
      .select('id,case_id,state')
      .eq('id', body.payment_intent_id)
      .maybeSingle();
    if (intentError) throw new Error(`Failed to load payment intent: ${intentError.message}`);
    if (!intent || intent.case_id !== id) return notFound('Payment intent not found for this case.');
    if (intent.state !== body.expected_payment_state) {
      return conflict(
        `This payment has moved to "${intent.state}" since the page was loaded. Reload and review it again.`,
      );
    }

    // Step 1: approve the application (skipped if it is already approved).
    let approvedNow = false;
    if (caseRecord.application_review_state !== 'approved') {
      const { error: decisionError } = await admin.rpc('record_application_review_atomic', {
        p_case_id: id,
        p_reviewer_id: scope.userId,
        p_decision: 'approved',
        p_reason: null,
        p_expected_state: body.expected_review_state,
        p_idempotency_key: body.idempotency_key,
        p_is_reopen: false,
      });
      if (decisionError) {
        if (
          decisionError.message.includes('already been recorded')
          || decisionError.message.includes('since it was loaded')
          || decisionError.message.includes('Invalid application review transition')
        ) return conflict(decisionError.message);
        throw new Error(`Failed to record approval: ${decisionError.message}`);
      }
      approvedNow = true;
    }

    // Step 2: verify the payment proof the reviewer looked at.
    const { data: verified, error: verifyError } = await admin.rpc('verify_payment_evidence_atomic', {
      p_payment_intent_id: body.payment_intent_id,
      p_evidence_version_id: body.evidence_id,
      p_verified_by: scope.userId,
      p_verification_source: 'manual_prc_reconciliation',
      p_expected_state: intent.state,
      p_verification_evidence: { reviewer_confirmed_match: true, approved_with_application: true },
    });
    if (verifyError) {
      return NextResponse.json(
        {
          error: `The application was ${approvedNow ? 'approved' : 'already approved'}, but the payment could not be verified: ${verifyError.message}`,
          reviewState: 'approved',
          paymentVerified: false,
        },
        { status: 409, headers: PRIVATE_NO_STORE },
      );
    }
    const result = Array.isArray(verified) ? verified[0] : verified;

    return NextResponse.json(
      {
        reviewState: 'approved',
        paymentState: result?.payment_state ?? 'verified_by_official_source',
        paymentVerified: true,
      },
      { headers: PRIVATE_NO_STORE },
    );
  } catch (error) {
    return handleAdminError(error, 'Approve with payment');
  }
}
