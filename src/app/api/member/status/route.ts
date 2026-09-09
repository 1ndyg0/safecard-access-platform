/**
 * GET /api/member/status
 *
 * The applicant's own case: every workflow state, the review outcome,
 * and the reviewer's reason where one exists.
 *
 * Cross-case access is structurally impossible here. The case id comes
 * from the signed session cookie and is never read from the request, so
 * there is no parameter to tamper with. The route selects a fixed
 * column list — the states the screen renders — and no profile field,
 * because the status screen does not display personal data.
 */

import { NextResponse } from 'next/server';
import { requireMemberSession } from '@/lib/auth/member-session';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { memberNextAction } from '@/lib/member/status';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // The only source of the case id.
    const { caseId } = await requireMemberSession();
    const admin = getSupabaseAdminClient();

    const { data, error } = await admin
      .from('recipient_cases')
      .select(
        'application_ref, application_state, application_review_state, payment_state, prc_handoff_state, membership_state, updated_at',
      )
      .eq('id', caseId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return NextResponse.json({ error: 'Application not found.' }, { status: 404 });

    // The latest decision's reason, scoped to this case.
    const { data: decision } = await admin
      .from('application_review_decisions')
      .select('decision,reason,decided_at')
      .eq('case_id', caseId)
      .order('decided_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    // A payment reviewer's replacement request, if one is outstanding.
    const { data: paymentEvent } = await admin
      .from('audit_events')
      .select('details,created_at')
      .eq('case_id', caseId)
      .eq('event_type', 'payment_status_change')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const paymentDetails = (paymentEvent?.details ?? null) as Record<string, unknown> | null;
    const paymentReason =
      typeof paymentDetails?.reason === 'string' ? paymentDetails.reason : null;
    const replacementRequested =
      data.payment_state === 'official_handoff_opened' && Boolean(paymentReason);

    return NextResponse.json(
      {
        reference: data.application_ref,
        states: {
          application_state: data.application_state,
          application_review_state: data.application_review_state,
          payment_state: data.payment_state,
          prc_handoff_state: data.prc_handoff_state,
          membership_state: data.membership_state,
          updated_at: data.updated_at,
        },
        review: {
          state: data.application_review_state,
          // Applicant-safe text written by the reviewer.
          reason: decision?.reason ?? null,
          decidedAt: decision?.decided_at ?? null,
          correctionRequested: data.application_review_state === 'resubmission_requested',
          rejected: data.application_review_state === 'rejected',
        },
        payment: {
          replacementRequested,
          reason: replacementRequested ? paymentReason : null,
        },
        nextAction: memberNextAction(data),
        hotline: '143',
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch {
    return NextResponse.json({ error: 'Member authentication required.' }, { status: 401 });
  }
}
