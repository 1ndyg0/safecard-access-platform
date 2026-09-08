/**
 * GET /api/consent/status?case_id=xxx
 *
 * Returns current consent state and consent record details.
 * Includes which content versions were shown at consent time.
 */

import { NextRequest } from 'next/server';
import { requireAuth } from '@/lib/auth/session';
import { requireCaseOwnership } from '@/lib/auth/permissions';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { success, badRequest, forbidden, handleApiError } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    const caseId = request.nextUrl.searchParams.get('case_id');

    if (!caseId) return badRequest('case_id is required');

    const ownership = await requireCaseOwnership(auth.userId, caseId);
    if (!ownership.allowed) return forbidden(ownership.reason);

    const admin = getSupabaseAdminClient();

    const { data: caseRecord } = await admin
      .from('recipient_cases')
      .select('consent_state')
      .eq('id', caseId)
      .single();

    if (!caseRecord) return badRequest('Case not found');

    const { data: consents } = await admin
      .from('consent_records')
      .select(`
        id, consent_type, locale, state,
        agreed_at, withdrawn_at, expired_at,
        consent_content_version_id, privacy_notice_version_id
      `)
      .eq('case_id', caseId)
      .order('created_at', { ascending: false });

    return success({
      consentState: caseRecord.consent_state,
      records: consents ?? [],
    });
  } catch (error) {
    return handleApiError(error, 'Consent status');
  }
}
