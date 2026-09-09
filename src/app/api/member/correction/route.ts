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
import { writeAuditEvent } from '@/lib/audit';
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

    const { data: decision } = await admin
      .from('application_review_decisions')
      .select('reason,decided_at')
      .eq('case_id', caseId)
      .order('decided_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json(
      {
        reference: caseRecord.application_ref,
        eligibility,
        reviewReason: decision?.reason ?? null,
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

    const { data: current } = await admin
      .from('application_submissions')
      .select('id,application_ref,consent_record_id,privacy_notice_version_id')
      .eq('case_id', caseId)
      .eq('is_current', true)
      .maybeSingle();
    if (!current) return conflict('There is no submission to correct.');

    const requestHash = createHash('sha256')
      .update(JSON.stringify(body.profile))
      .digest('hex');

    // Supersede first so the partial unique index on is_current cannot
    // reject the insert, then insert the new version.
    const { error: supersedeError } = await admin
      .from('application_submissions')
      .update({ is_current: false })
      .eq('id', current.id);
    if (supersedeError) throw new Error(`Failed to supersede: ${supersedeError.message}`);

    const { data: inserted, error: insertError } = await admin
      .from('application_submissions')
      .insert({
        case_id: caseId,
        application_ref: current.application_ref,
        submitted_data: body.profile,
        consent_record_id: current.consent_record_id,
        privacy_notice_version_id: current.privacy_notice_version_id,
        submitted_at: new Date().toISOString(),
        submitted_by: 'recipient',
        original_submission_id: current.id,
        idempotency_key: body.idempotency_key,
        request_hash: requestHash,
        is_current: true,
      })
      .select('id')
      .single();

    if (insertError) {
      // Put the previous version back if the new one did not land, so a
      // failed correction never leaves the case with no current version.
      await admin
        .from('application_submissions')
        .update({ is_current: true })
        .eq('id', current.id);
      if (insertError.code === '23505') {
        return conflict('This correction has already been submitted.');
      }
      throw new Error(`Failed to record correction: ${insertError.message}`);
    }

    // The profile of record follows the accepted correction.
    await admin.from('recipient_profiles').update(body.profile).eq('case_id', caseId);

    // Application state moves back into review; review state resets to
    // pending. Payment, handoff and membership are deliberately untouched.
    await admin
      .from('recipient_cases')
      .update({ application_state: 'resubmitted', application_review_state: 'pending' })
      .eq('id', caseId);

    await writeAuditEvent({
      event_type: 'application_submit',
      actor_id: null,
      actor_type: 'anonymous',
      action: 'Applicant submitted a correction',
      target_type: 'application_submission',
      target_id: inserted.id as string,
      case_id: caseId,
      campaign_id: caseRecord.campaign_id as string,
      details: {
        prior_state: caseRecord.application_review_state,
        resulting_state: 'pending',
        superseded_submission_id: current.id,
        // Field names only; the values live in the submission row.
        fields_submitted: Object.keys(body.profile),
      },
      severity: 'info',
    });

    return NextResponse.json(
      {
        submitted: true,
        submissionId: inserted.id,
        previousSubmissionId: current.id,
        reviewState: 'pending',
        // Restated so nothing can be inferred as having advanced.
        paymentState: caseRecord.payment_state,
        prcHandoffState: caseRecord.prc_handoff_state,
        membershipState: caseRecord.membership_state,
        membershipChanged: false,
      },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (error) {
    return handleApiError(error, 'Member correction');
  }
}
