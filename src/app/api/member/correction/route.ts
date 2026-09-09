/**
 * GET  /api/member/correction — the stored approved fields to correct.
 * POST /api/member/correction — submit a new immutable application version.
 *
 * The case id comes only from the signed session cookie, so a member can
 * only ever reach their own case; there is no id parameter to change.
 *
 * A correction creates a NEW submission row and marks the previous one
 * superseded. The previous submission is preserved, not overwritten —
 * what someone originally declared is evidence, and a correction is a
 * second statement rather than a retraction of the first.
 *
 * It resets the review state to pending and touches nothing else.
 * Payment, PRC handoff and membership state are read and re-asserted in
 * the response.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { requireMemberSession } from '@/lib/auth/member-session';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { badRequest, conflict, handleApiError, notFound } from '@/lib/api/response';
import { enforceRateLimit } from '@/lib/api/rate-limit';
import { recipientProfileSchema } from '@/lib/validation/schemas';
import { assertProfileDataAllowed, resolveDataMode } from '@/lib/safety/data-mode';
import {
  CORRECTABLE_FIELDS,
  CORRECTABLE_SELECT,
  evaluateCorrectionEligibility,
  type UiLocale,
} from '@/lib/member/correction';

export const dynamic = 'force-dynamic';

const CASE_COLUMNS =
  'id,campaign_id,application_ref,consent_state,application_state,application_review_state,payment_state,prc_handoff_state,membership_state,consent_content_version_id,privacy_notice_version_id';

function localeOf(request: NextRequest): UiLocale {
  return request.nextUrl.searchParams.get('locale') === 'en' ? 'en' : 'fil';
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { caseId } = await requireMemberSession();
    const admin = getSupabaseAdminClient();

    const { data: caseRecord, error } = await admin
      .from('recipient_cases')
      .select(CASE_COLUMNS)
      .eq('id', caseId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!caseRecord) return notFound('Application not found.');

    const eligibility = await evaluateCorrectionEligibility(
      admin,
      caseRecord as never,
      localeOf(request),
    );

    // Only the fields the correction form may edit.
    const { data: profile } = await admin
      .from('recipient_profiles')
      .select(CORRECTABLE_SELECT)
      .eq('case_id', caseId)
      .maybeSingle();

    const [{ data: decision }, { data: prcCorrection }] = await Promise.all([
      admin
        .from('application_review_decisions')
        .select('reason,decided_at')
        .eq('case_id', caseId)
        .order('decided_at', { ascending: false })
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

    return NextResponse.json(
      {
        reference: caseRecord.application_ref,
        eligibility,
        reviewReason:
          caseRecord.prc_handoff_state === 'correction_requested'
            ? prcCorrection?.correction_reason ?? decision?.reason ?? null
            : decision?.reason ?? null,
        fields: CORRECTABLE_FIELDS,
        values: profile ?? null,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch {
    return NextResponse.json({ error: 'Member authentication required.' }, { status: 401 });
  }
}

const submitSchema = z.object({
  profile: recipientProfileSchema,
  /** The member confirms they read every field, not just the changed one. */
  reviewed_all_fields: z.literal(true),
  locale: z.enum(['fil', 'en']).default('fil'),
  /** Stable per attempt so a double submit lands once. */
  idempotency_key: z.string().min(8).max(200),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const { caseId } = await requireMemberSession();
    await enforceRateLimit(request, 'member-correction', 10, 600);

    const parsed = submitSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) {
      return badRequest(
        'A correction needs every approved field, a confirmation that you reviewed them all, and an idempotency key.',
      );
    }
    const body = parsed.data;

    const admin = getSupabaseAdminClient();
    const { data: caseRecord, error } = await admin
      .from('recipient_cases')
      .select(CASE_COLUMNS)
      .eq('id', caseId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!caseRecord) return notFound('Application not found.');

    // Re-checked at submit time, not only when the form was rendered.
    // Consent can lapse while a form sits open.
    const eligibility = await evaluateCorrectionEligibility(
      admin,
      caseRecord as never,
      body.locale,
    );
    if (!eligibility.allowed) {
      return NextResponse.json(
        { error: 'This correction cannot be submitted.', eligibility },
        { status: 409 },
      );
    }

    // Synthetic-mode guard: before the launch gates pass, refuse
    // real-looking details. The mode is derived from the deployment's own
    // configuration, never from the request body, so a client cannot
    // declare itself into live mode.
    assertProfileDataAllowed(resolveDataMode(), body.profile);

    const requestHash = createHash('sha256')
      .update(JSON.stringify(body.profile))
      .digest('hex');
    const { data, error: correctionError } = await admin.rpc(
      'submit_member_correction_atomic',
      {
        p_case_id: caseId,
        p_profile_data: body.profile,
        p_idempotency_key: body.idempotency_key,
        p_request_hash: requestHash,
      },
    );
    if (correctionError) {
      if (
        correctionError.message.includes('already been submitted')
        || correctionError.message.includes('has not been requested')
        || correctionError.message.includes('Active consent is required')
        || correctionError.message.includes('There is no submission to correct')
      ) {
        return conflict(correctionError.message);
      }
      throw new Error(`Failed to record correction: ${correctionError.message}`);
    }
    const result = Array.isArray(data) ? data[0] : data;
    if (!result) throw new Error('Failed to record correction: no result returned');

    return NextResponse.json(
      {
        submitted: true,
        submissionId: result.submission_id,
        previousSubmissionId: result.previous_submission_id,
        reviewState: result.review_state,
        // Restated so nothing can be inferred as having advanced.
        paymentState: result.payment_state,
        prcHandoffState: result.prc_handoff_state,
        membershipState: result.membership_state,
        membershipChanged: false,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return handleApiError(error, 'Member correction');
  }
}
