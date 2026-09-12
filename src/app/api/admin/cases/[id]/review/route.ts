/**
 * POST /api/admin/cases/[id]/review
 *
 * Commit one application review decision: approve, request
 * resubmission, or reject.
 *
 * What this route guarantees:
 *
 *   - It changes the review decision and, for a correction request, the
 *     applicant-facing application state. Payment and membership are never
 *     advanced here. Handoff readiness is derived transactionally only when
 *     both application approval and verified payment are present.
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
import {
  REASON_MAX,
  REASON_MIN,
  REVIEW_DECISIONS,
  REVIEW_STATES,
  requiresReason,
  type ReviewDecision,
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

    const { data, error: decisionError } = await admin.rpc(
      'record_application_review_atomic',
      {
        p_case_id: id,
        p_reviewer_id: auth.userId,
        p_decision: body.decision,
        p_reason: body.reason ?? null,
        p_expected_state: body.expected_review_state,
        p_idempotency_key: body.idempotency_key,
        p_is_reopen: false,
      },
    );
    if (decisionError) {
      if (
        decisionError.message.includes('already been recorded')
        || decisionError.message.includes('since it was loaded')
        || decisionError.message.includes('Invalid application review transition')
      ) {
        return conflict(decisionError.message);
      }
      throw new Error(`Failed to record decision: ${decisionError.message}`);
    }
    const result = Array.isArray(data) ? data[0] : data;
    if (!result) throw new Error('Failed to record decision: no result returned');

    return NextResponse.json(
      {
        reviewState: result.resulting_state,
        priorState: result.prior_state,
        // Restated so no client can infer that a decision moved anything else.
        paymentState: result.payment_state,
        prcHandoffState: result.prc_handoff_state,
        membershipState: result.membership_state,
        membershipChanged: false,
        paymentChanged: false,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return handleApiError(error, 'Application review decision');
  }
}
