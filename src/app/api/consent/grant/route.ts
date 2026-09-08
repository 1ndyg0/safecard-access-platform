/**
 * POST /api/consent/grant
 *
 * Record recipient consent with version evidence.
 * Idempotent — same key returns the same result.
 *
 * Captures: which content version they saw, which privacy notice,
 * locale, timestamp, and hashed device info.
 */

import { NextRequest, NextResponse } from 'next/server';
import { grantConsent } from '@/lib/intake';
import { grantConsentSchema } from '@/lib/validation/schemas';
import { requireAuth } from '@/lib/auth/session';
import { requireCaseOwnership } from '@/lib/auth/permissions';
import { enforceRateLimit } from '@/lib/api/rate-limit';
import { hashSensitiveIdentifier } from '@/lib/audit';
import { handleApiError } from '@/lib/api/response';

export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit(request, 'consent.grant');
    const body = await request.json();
    const parsed = grantConsentSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const auth = await requireAuth();
    const ownership = await requireCaseOwnership(auth.userId, parsed.data.case_id);
    if (!ownership.allowed) {
      return NextResponse.json({ error: ownership.reason }, { status: 403 });
    }

    // Hash IP and user agent for evidence (never store raw)
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
    const ua = request.headers.get('user-agent');

    const result = await grantConsent({
      caseId: parsed.data.case_id,
      consentType: parsed.data.consent_type,
      consentContentVersionId: parsed.data.consent_content_version_id,
      privacyNoticeVersionId: parsed.data.privacy_notice_version_id,
      locale: parsed.data.locale,
      idempotencyKey: parsed.data.idempotency_key,
      ipHash: ip ? hashSensitiveIdentifier(ip) : undefined,
      userAgentHash: ua ? hashSensitiveIdentifier(ua) : undefined,
    });

    return NextResponse.json(
      {
        consentRecordId: result.consentRecordId,
        status: result.status,
      },
      { status: result.status === 'created' ? 201 : 200 }
    );
  } catch (error) {
    return handleApiError(error, 'Consent grant');
  }
}
