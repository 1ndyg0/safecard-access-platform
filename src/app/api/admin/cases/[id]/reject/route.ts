/**
 * POST /api/admin/cases/[id]/reject
 *
 * Reject an application that is awaiting review, with a reason the applicant
 * can read on their status page.
 *
 *   - It requires an explicit confirmation flag and an idempotency key, so a
 *     stray click or a retry cannot decide twice.
 *   - It only acts on an application that is still awaiting review. If someone
 *     else decided first, this returns 409 rather than overwriting their
 *     decision.
 *   - The reason is stored in the append-only ledger
 *     (application_review_decisions); the database copies it, the reviewer and
 *     the time onto the case.
 *   - Payment is never changed by a rejection.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { badRequest, conflict, forbidden, notFound } from '@/lib/api/response';
import { assertCampaignAccess, resolveStaffScope, rolesForCampaign } from '@/lib/admin/access';
import { handleAdminError, PRIVATE_NO_STORE } from '@/lib/admin/respond';
import { resolveCaseAccessPolicy } from '@/lib/admin/field-policy';
import { REASON_MAX, REASON_MIN } from '@/lib/review/state';

export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  confirm: z.literal(true),
  reason: z.string().trim().min(REASON_MIN).max(REASON_MAX),
  idempotency_key: z.string().min(8).max(200),
});

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const scope = await resolveStaffScope();
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) return badRequest('Application id must be a UUID.');

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return badRequest(
        `Rejecting needs a confirmation and a reason of ${REASON_MIN} to ${REASON_MAX} characters.`,
      );
    }
    const body = parsed.data;

    const admin = getSupabaseAdminClient();
    const { data: application, error: applicationError } = await admin
      .from('admin_applications_view')
      .select('id,campaign_id,status')
      .eq('id', id)
      .maybeSingle();
    if (applicationError) throw new Error(`Failed to load application: ${applicationError.message}`);
    if (!application) return notFound('Application not found.');

    const campaignId = application.campaign_id as string;
    assertCampaignAccess(scope, campaignId);
    const policy = resolveCaseAccessPolicy(rolesForCampaign(scope, campaignId));
    if (!policy?.canReviewApplication) {
      return forbidden('Your role cannot decide applications for this campaign.');
    }
    if (application.status !== 'awaiting_review') {
      return conflict(`This application is already ${String(application.status).replace('_', ' ')}.`);
    }

    const { data, error } = await admin.rpc('record_application_review_atomic', {
      p_case_id: id,
      p_reviewer_id: scope.userId,
      p_decision: 'rejected',
      p_reason: body.reason,
      p_expected_state: 'pending',
      p_idempotency_key: body.idempotency_key,
      p_is_reopen: false,
    });
    if (error) {
      if (
        error.message.includes('already been recorded')
        || error.message.includes('since it was loaded')
        || error.message.includes('Invalid application review transition')
      ) {
        return conflict(error.message);
      }
      throw new Error(`Failed to record rejection: ${error.message}`);
    }
    const result = Array.isArray(data) ? data[0] : data;
    if (!result) throw new Error('Failed to record rejection: no result returned');

    return NextResponse.json(
      { status: 'rejected', reason: body.reason, paymentState: result.payment_state },
      { headers: PRIVATE_NO_STORE },
    );
  } catch (error) {
    return handleAdminError(error, 'Reject application');
  }
}
