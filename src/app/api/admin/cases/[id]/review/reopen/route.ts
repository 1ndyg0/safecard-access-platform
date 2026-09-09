/**
 * POST /api/admin/cases/[id]/review/reopen
 *
 * Reopen a rejected application.
 *
 * Rejection is final in the ordinary review flow. That is deliberate:
 * an applicant who has been told they were rejected should not find
 * themselves quietly back in the queue, and a reviewer should not be
 * able to undo a rejection by clicking the same control twice.
 *
 * Reopening is therefore a separate action, restricted to the
 * accountable role, requiring its own confirmation and its own reason,
 * and recorded as a distinct `is_reopen` decision at critical severity.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { requireStaffAuth } from '@/lib/auth/session';
import { requireRole } from '@/lib/auth/permissions';
import { badRequest, conflict, forbidden, handleApiError, notFound } from '@/lib/api/response';
import { writeAuditEvent } from '@/lib/audit';
import { REASON_MAX, REASON_MIN, canReopen, type ReviewState } from '@/lib/review/state';

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
    const auth = await requireStaffAuth();
    const { id } = await context.params;
    if (!z.string().uuid().safeParse(id).success) return badRequest('Case id must be a UUID.');

    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return badRequest('Reopening a rejected application requires a confirmation and a reason.');
    }

    const admin = getSupabaseAdminClient();
    const { data: caseRecord, error: caseError } = await admin
      .from('recipient_cases')
      .select('id,campaign_id,application_review_state,payment_state,membership_state')
      .eq('id', id)
      .maybeSingle();
    if (caseError) throw new Error(`Failed to load case: ${caseError.message}`);
    if (!caseRecord) return notFound('Case not found.');

    // Only the accountable role, never a school admin.
    const access = await requireRole(
      auth.userId,
      'privacy_admin_owner',
      caseRecord.campaign_id as string,
    );
    if (!access.allowed) {
      return forbidden('Only a privacy administrator may reopen a rejected application.');
    }

    const priorState = caseRecord.application_review_state as ReviewState;
    if (!canReopen(priorState)) {
      return conflict(
        `Only a rejected application can be reopened. This one is "${priorState}".`,
      );
    }

    const { error: decisionError } = await admin
      .from('application_review_decisions')
      .insert({
        case_id: id,
        campaign_id: caseRecord.campaign_id,
        reviewer_id: auth.userId,
        decision: 'pending',
        prior_state: priorState,
        resulting_state: 'pending',
        reason: parsed.data.reason,
        is_reopen: true,
        idempotency_key: parsed.data.idempotency_key,
      });
    if (decisionError) {
      if (decisionError.code === '23505') return conflict('This reopen has already been recorded.');
      throw new Error(`Failed to record reopen: ${decisionError.message}`);
    }

    const { data: updated, error: updateError } = await admin
      .from('recipient_cases')
      .update({ application_review_state: 'pending' })
      .eq('id', id)
      .eq('application_review_state', 'rejected')
      .select('id');
    if (updateError) throw new Error(`Failed to reopen: ${updateError.message}`);
    if (!updated || updated.length === 0) {
      return conflict('This application is no longer rejected. Reload and check.');
    }

    await writeAuditEvent({
      event_type: 'data_correction',
      actor_id: auth.userId,
      actor_type: 'user',
      action: 'Reopened a rejected application',
      target_type: 'application_review',
      target_id: id,
      case_id: id,
      campaign_id: caseRecord.campaign_id as string,
      details: {
        prior_state: priorState,
        resulting_state: 'pending',
        reason: parsed.data.reason,
        is_reopen: true,
      },
      severity: 'critical',
    });

    return NextResponse.json(
      {
        reviewState: 'pending',
        priorState,
        membershipState: caseRecord.membership_state,
        membershipChanged: false,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return handleApiError(error, 'Reopen rejected application');
  }
}
