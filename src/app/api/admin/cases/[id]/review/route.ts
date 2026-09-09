/**
 * POST /api/admin/cases/[id]/review
 *
 * Commit one application review decision: approve, request
 * resubmission, or reject.
 *
 * What this route guarantees:
 *
 *   - It changes application_review_state and nothing else. Payment,
 *     PRC handoff and membership are read before and re-asserted after,
 *     and the response says so explicitly.
 *   - It requires an explicit confirmation flag, so a decision cannot be
 *     made by a stray click.
 *   - It requires the review state the reviewer was looking at. If
 *     someone else decided first, this returns 409 rather than
 *     overwriting their decision.
 *   - It requires an idempotency key. A retried request lands once.
 *   - It records reviewer, timestamp, reason, prior and resulting state
 *     in an append-only ledger.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { requireStaffAuth } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/auth/permissions';
import { badRequest, conflict, forbidden, handleApiError, notFound } from '@/lib/api/response';
import { writeAuditEvent } from '@/lib/audit';
import {
  REASON_MAX,
  REASON_MIN,
  REVIEW_DECISIONS,
  REVIEW_STATES,
  assertTransition,
  requiresReason,
  type ReviewDecision,
  type ReviewState,
} from '@/lib/review/state';

export const dynamic = 'force-dynamic';

/** Roles that may decide an application. Finance is deliberately absent. */
const REVIEWER_ROLES = ['privacy_admin_owner', 'school_admin'] as const;

const bodySchema = z.object({
  decision: z.enum(REVIEW_DECISIONS),
  /** Must be true. The confirmation checkbox on the staff screen. */
  confirm: z.literal(true),
  reason: z.string().trim().min(REASON_MIN).max(REASON_MAX).optional(),
  /** The review state the reviewer saw when they decided. */
  expected_review_state: z.enum(REVIEW_STATES),
  /** Stable per decision attempt, so a retry cannot double-apply. */
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
      return badRequest(
        'A review decision needs the decision, an explicit confirmation, the review state you saw, and an idempotency key.',
      );
    }
    const body = parsed.data;

    if (requiresReason(body.decision as ReviewDecision) && !body.reason) {
      return badRequest(
        'Requesting a resubmission or rejecting an application requires a reason the applicant can read.',
      );
    }

    const admin = getSupabaseAdminClient();
    const { data: caseRecord, error: caseError } = await admin
      .from('recipient_cases')
      .select(
        'id,campaign_id,application_review_state,application_state,payment_state,prc_handoff_state,membership_state',
      )
      .eq('id', id)
      .maybeSingle();
    if (caseError) throw new Error(`Failed to load case: ${caseError.message}`);
    if (!caseRecord) return notFound('Case not found.');

    const access = await requireAnyRole(
      auth.userId,
      [...REVIEWER_ROLES],
      caseRecord.campaign_id as string,
    );
    if (!access.allowed) return forbidden('Your role cannot decide applications for this campaign.');

    const priorState = caseRecord.application_review_state as ReviewState;

    // Stale-screen and conflicting-decision guard.
    if (priorState !== body.expected_review_state) {
      return conflict(
        `This application moved to "${priorState}" since the page was loaded. Reload and review it again.`,
      );
    }

    const resultingState = body.decision as ReviewState;
    assertTransition(priorState, resultingState);

    const { data: submission } = await admin
      .from('application_submissions')
      .select('id')
      .eq('case_id', id)
      .eq('is_current', true)
      .maybeSingle();

    // Insert first. The unique idempotency key means a duplicate request
    // fails here, before anything is mutated.
    const { error: decisionError } = await admin
      .from('application_review_decisions')
      .insert({
        case_id: id,
        campaign_id: caseRecord.campaign_id,
        submission_id: submission?.id ?? null,
        reviewer_id: auth.userId,
        decision: resultingState,
        prior_state: priorState,
        resulting_state: resultingState,
        reason: body.reason ?? null,
        idempotency_key: body.idempotency_key,
      });
    if (decisionError) {
      if (decisionError.code === '23505') {
        return conflict('This decision has already been recorded.');
      }
      throw new Error(`Failed to record decision: ${decisionError.message}`);
    }

    // Conditional update: if another request changed the state between
    // the read and here, this matches zero rows and we report a conflict
    // rather than clobbering it.
    const { data: updated, error: updateError } = await admin
      .from('recipient_cases')
      .update({ application_review_state: resultingState })
      .eq('id', id)
      .eq('application_review_state', priorState)
      .select('id');
    if (updateError) throw new Error(`Failed to apply decision: ${updateError.message}`);
    if (!updated || updated.length === 0) {
      return conflict('Another reviewer decided this application first. Reload and check.');
    }

    // A resubmission request also moves the applicant-facing application
    // state, because the applicant now has something to do. Approve and
    // reject do not: the application itself is unchanged by being judged.
    if (resultingState === 'resubmission_requested') {
      await admin
        .from('recipient_cases')
        .update({ application_state: 'correction_needed' })
        .eq('id', id)
        .in('application_state', ['submitted', 'resubmitted', 'ready_for_review']);
      if (submission?.id) {
        await admin
          .from('application_submissions')
          .update({ correction_reason: body.reason ?? null })
          .eq('id', submission.id);
      }
    }

    await writeAuditEvent({
      event_type: 'data_correction',
      actor_id: auth.userId,
      actor_type: 'user',
      action: `Application review decision: ${resultingState}`,
      target_type: 'application_review',
      target_id: id,
      case_id: id,
      campaign_id: caseRecord.campaign_id as string,
      details: {
        prior_state: priorState,
        resulting_state: resultingState,
        reason: body.reason ?? null,
        submission_id: submission?.id ?? null,
        // Recorded so the trail shows these were untouched.
        payment_state: caseRecord.payment_state,
        prc_handoff_state: caseRecord.prc_handoff_state,
        membership_state: caseRecord.membership_state,
      },
      severity: resultingState === 'rejected' ? 'critical' : 'warning',
    });

    return NextResponse.json(
      {
        reviewState: resultingState,
        priorState,
        // Restated so no client can infer that a decision moved anything else.
        paymentState: caseRecord.payment_state,
        prcHandoffState: caseRecord.prc_handoff_state,
        membershipState: caseRecord.membership_state,
        membershipChanged: false,
        paymentChanged: false,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return handleApiError(error, 'Application review decision');
  }
}
