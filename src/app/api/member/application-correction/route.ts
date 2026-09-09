import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireMemberSession } from '@/lib/auth/member-session';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { enforceRateLimit } from '@/lib/api/rate-limit';
import { handleApiError } from '@/lib/api/response';
import { assertProfileDataAllowed } from '@/lib/safety/data-mode';
import { submitApplication } from '@/lib/intake';
import { idempotencyKeySchema, recipientProfileSchema } from '@/lib/validation/schemas';

const correctionSchema = z.object({
  profile_data: recipientProfileSchema,
  idempotency_key: idempotencyKeySchema,
});

async function memberCaseId() {
  try {
    return (await requireMemberSession()).caseId;
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const caseId = await memberCaseId();
    if (!caseId) return NextResponse.json({ error: 'Member authentication required.' }, { status: 401 });
    const admin = getSupabaseAdminClient();
    const { data: caseRecord, error: caseError } = await admin.from('recipient_cases')
      .select('id,application_ref,application_state,application_review_state,application_review_reason,is_active')
      .eq('id', caseId)
      .maybeSingle();
    if (caseError) throw new Error(`Application could not be loaded: ${caseError.message}`);
    if (!caseRecord?.is_active) return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
    if (caseRecord.application_state !== 'correction_needed' || caseRecord.application_review_state !== 'resubmission_requested') {
      return NextResponse.json({ error: 'This application does not currently require a resubmission.' }, { status: 409 });
    }
    const { data: profile, error: profileError } = await admin.from('recipient_profiles')
      .select('first_name,middle_name,last_name,date_of_birth,sex,civil_status,address_line1,address_line2,city,province,zip_code,mobile_number,email')
      .eq('case_id', caseId)
      .single();
    if (profileError || !profile) throw new Error(`Application profile could not be loaded: ${profileError?.message ?? 'not found'}`);
    return NextResponse.json({
      reference: caseRecord.application_ref,
      reason: caseRecord.application_review_reason,
      profile,
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return handleApiError(error, 'Member application correction fetch');
  }
}

export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit(request, 'member.application-correction', 5, 300);
    const caseId = await memberCaseId();
    if (!caseId) return NextResponse.json({ error: 'Member authentication required.' }, { status: 401 });
    const parsed = correctionSchema.parse(await request.json());
    const dataMode = process.env.LAUNCH_GATES_COMPLETE === 'true' ? 'live' : 'synthetic';
    assertProfileDataAllowed(dataMode, parsed.profile_data);

    const admin = getSupabaseAdminClient();
    const { data: caseRecord, error: caseError } = await admin.from('recipient_cases')
      .select('application_state,application_review_state,is_active')
      .eq('id', caseId)
      .maybeSingle();
    if (caseError) throw new Error(`Application could not be loaded: ${caseError.message}`);
    if (!caseRecord?.is_active) return NextResponse.json({ error: 'Application not found.' }, { status: 404 });
    if (caseRecord.application_state !== 'correction_needed' || caseRecord.application_review_state !== 'resubmission_requested') {
      return NextResponse.json({ error: 'This application does not currently require a resubmission.' }, { status: 409 });
    }

    const { data: submission, error: submissionError } = await admin.from('application_submissions')
      .select('consent_record_id,content_versions_seen,privacy_notice_version_id')
      .eq('case_id', caseId)
      .eq('is_current', true)
      .maybeSingle();
    if (submissionError) throw new Error(`Current submission could not be loaded: ${submissionError.message}`);
    if (!submission) return NextResponse.json({ error: 'Current application submission not found.' }, { status: 404 });
    const contentVersionsSeen = Array.isArray(submission.content_versions_seen)
      ? submission.content_versions_seen.filter((value): value is string => typeof value === 'string')
      : [];

    const result = await submitApplication({
      caseId,
      consentRecordId: submission.consent_record_id,
      contentVersionsSeen,
      privacyNoticeVersionId: submission.privacy_notice_version_id,
      profileData: parsed.profile_data,
      submittedBy: 'recipient',
      idempotencyKey: parsed.idempotency_key,
    });
    return NextResponse.json({
      resubmitted: true,
      applicationRef: result.applicationRef,
      submissionId: result.submissionId,
      message: 'Corrections submitted for a new staff review. Payment and membership states were not changed.',
    }, { status: result.status === 'created' ? 201 : 200, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return handleApiError(error, 'Member application correction submit');
  }
}
