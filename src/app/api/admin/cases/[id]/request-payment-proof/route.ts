/**
 * POST /api/admin/cases/[id]/request-payment-proof
 *
 * Ask the applicant for a replacement payment proof (for example, the
 * uploaded image is unreadable or shows the wrong transfer). This is the
 * only payment action a reviewer has besides approving: payment itself is
 * verified inside approve-with-payment.
 *
 * It acts on exactly one payment intent and evidence version named in the
 * body, requires an explicit confirmation flag and the payment state the
 * reviewer saw, and uses the atomic database function so the append-only
 * ledger records the reviewer, reason, prior and resulting state.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { badRequest, conflict, forbidden, notFound } from '@/lib/api/response';
import { assertCampaignAccess, rolesForCampaign, resolveStaffScope } from '@/lib/admin/access';
import { handleAdminError, PRIVATE_NO_STORE } from '@/lib/admin/respond';
import { resolveCaseAccessPolicy } from '@/lib/admin/field-policy';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  confirm: z.literal(true),
  payment_intent_id: z.string().uuid(),
  evidence_id: z.string().uuid(),
  /** Shown to the applicant, so it must be safe to read. */
  reason: z.string().trim().min(10).max(500),
  expected_payment_state: z.string().min(1),
});

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
        'Asking for a new payment proof needs an explicit confirmation, the payment and evidence you reviewed, the state you saw and a reason of at least 10 characters.',
      );
    }
    const body = parsed.data;

    const admin = getSupabaseAdminClient();
    const { data: caseRecord, error: caseError } = await admin
      .from('recipient_cases')
      .select('id,campaign_id')
      .eq('id', id)
      .maybeSingle();
    if (caseError) throw new Error(`Failed to load case: ${caseError.message}`);
    if (!caseRecord) return notFound('Case not found.');

    const campaignId = caseRecord.campaign_id as string;
    assertCampaignAccess(scope, campaignId);
    const policy = resolveCaseAccessPolicy(rolesForCampaign(scope, campaignId));
    if (!policy?.canActOnPayments) {
      return forbidden('Your role cannot act on payment evidence for this campaign.');
    }

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

    const { data, error: actionError } = await admin.rpc('request_payment_evidence_reupload_atomic', {
      p_payment_intent_id: body.payment_intent_id,
      p_evidence_version_id: body.evidence_id,
      p_requested_by: scope.userId,
      p_reason: body.reason,
      p_expected_state: intent.state,
    });
    if (actionError) {
      if (
        actionError.message.includes('since it was loaded')
        || actionError.message.includes('not pending verification')
        || actionError.message.includes('not awaiting verification')
      ) return conflict(actionError.message);
      throw new Error(`Failed to request a replacement proof: ${actionError.message}`);
    }
    const result = Array.isArray(data) ? data[0] : data;
    if (!result) throw new Error('Failed to request a replacement proof: no result returned');

    return NextResponse.json(
      { paymentState: result.payment_state, evidenceState: 'reupload_requested' },
      { headers: PRIVATE_NO_STORE },
    );
  } catch (error) {
    return handleAdminError(error, 'Request payment proof');
  }
}
