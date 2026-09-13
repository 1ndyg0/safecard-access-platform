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
import { handleApiError } from '@/lib/api/response';

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

    const [{ data: paymentIntent }, { data: prcCorrection }] = await Promise.all([
      admin
      .from('payment_intents')
      .select('id,state')
      .eq('case_id', caseId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
      admin
        .from('prc_export_items')
        .select('correction_reason,prc_responded_at')
        .eq('case_id', caseId)
        .eq('prc_status', 'correction_requested')
        .order('prc_responded_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const { data: evidence } = paymentIntent
      ? await admin
          .from('payment_evidence_versions')
          .select('state,metadata')
          .eq('payment_intent_id', paymentIntent.id)
          .order('version_number', { ascending: false })
          .limit(1)
          .maybeSingle()
      : { data: null };
    const evidenceMetadata = (evidence?.metadata ?? null) as Record<string, unknown> | null;
    const paymentReason = typeof evidenceMetadata?.reupload_reason === 'string'
      ? evidenceMetadata.reupload_reason
      : null;
    const replacementRequested = evidence?.state === 'reupload_requested';

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
          reason:
            data.prc_handoff_state === 'correction_requested'
              ? prcCorrection?.correction_reason ?? decision?.reason ?? null
              : decision?.reason ?? null,
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
  } catch (error) {
    return handleApiError(error, 'Member status');
  }
}
