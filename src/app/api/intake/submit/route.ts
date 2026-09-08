/**
 * POST /api/intake/submit
 *
 * Idempotent application submission endpoint.
 * Requires active consent. Validates all fields.
 * Generates SC-YYYY-XXXXXXXX reference on success.
 *
 * Same idempotency key + same payload = same result (no duplicate).
 * Same idempotency key + changed payload = conflict error.
 */

import { NextRequest, NextResponse } from 'next/server';
import { submitApplication } from '@/lib/intake';
import { submitApplicationSchema } from '@/lib/validation/schemas';
import { requireAuth } from '@/lib/auth/session';
import { requireCaseOwnership } from '@/lib/auth/permissions';
import { assertProfileDataAllowed } from '@/lib/safety/data-mode';
import { enforceRateLimit } from '@/lib/api/rate-limit';
import { handleApiError } from '@/lib/api/response';

export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit(request, 'intake.submit');
    const body = await request.json();
    const parsed = submitApplicationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    // Verify the submitter owns this case (or is anonymous but linked)
    const auth = await requireAuth();
    const ownership = await requireCaseOwnership(auth.userId, parsed.data.case_id);
    if (!ownership.allowed) {
      return NextResponse.json(
        { error: 'You do not have access to this application' },
        { status: 403 }
      );
    }
    assertProfileDataAllowed(parsed.data.data_mode, parsed.data.profile_data);

    const result = await submitApplication({
      caseId: parsed.data.case_id,
      consentRecordId: parsed.data.consent_record_id,
      contentVersionsSeen: parsed.data.content_versions_seen,
      privacyNoticeVersionId: parsed.data.privacy_notice_version_id,
      profileData: parsed.data.profile_data,
      submittedBy: parsed.data.submitted_by,
      assistedByName: parsed.data.assisted_by_name,
      idempotencyKey: parsed.data.idempotency_key,
    });

    const statusCode = result.status === 'created' ? 201 : 200;

    return NextResponse.json(
      {
        submissionId: result.submissionId,
        applicationRef: result.applicationRef,
        status: result.status,
        message:
          result.status === 'created'
            ? 'Application submitted successfully / Matagumpay na naisumite ang aplikasyon'
            : 'Application already submitted with this reference',
      },
      { status: statusCode }
    );
  } catch (error) {
    return handleApiError(error, 'Application submit');
  }
}
