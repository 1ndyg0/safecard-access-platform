/**
 * POST /api/intake/profile — Save profile draft (after consent)
 * GET  /api/intake/profile?case_id=xxx — Get current profile data
 *
 * Requires active consent before any profile data can be saved.
 * Only approved fields are accepted and stored.
 *
 * Shared-device safety:
 * - Server-side draft saving only after consent
 * - No persistent PII in browser storage
 * - Recipient can clear their info at any time
 */

import { NextRequest } from 'next/server';
import { saveProfileDraft } from '@/lib/intake';
import { recipientProfileSchema } from '@/lib/validation/schemas';
import { requireAuth } from '@/lib/auth/session';
import { requireCaseOwnership } from '@/lib/auth/permissions';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { success, badRequest, forbidden, handleApiError } from '@/lib/api/response';
import { z } from 'zod';
import { dataModeSchema, assertProfileDataAllowed } from '@/lib/safety/data-mode';
import { enforceRateLimit } from '@/lib/api/rate-limit';

const saveProfileBodySchema = z.object({
  case_id: z.string().uuid(),
  profile_data: recipientProfileSchema.partial(),
  data_mode: dataModeSchema,
  // Partial for draft saves — full validation happens on submit
});

export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit(request, 'intake.profile', 30);
    const auth = await requireAuth();
    const body = await request.json();
    const parsed = saveProfileBodySchema.parse(body);

    const ownership = await requireCaseOwnership(auth.userId, parsed.case_id);
    if (!ownership.allowed) return forbidden(ownership.reason);
    assertProfileDataAllowed(parsed.data_mode, parsed.profile_data, true);

    await saveProfileDraft({
      caseId: parsed.case_id,
      profileData: parsed.profile_data,
    });

    return success({ saved: true, message: 'Profile draft saved' });
  } catch (error) {
    return handleApiError(error, 'Profile save');
  }
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    const caseId = request.nextUrl.searchParams.get('case_id');

    if (!caseId) return badRequest('case_id is required');

    const ownership = await requireCaseOwnership(auth.userId, caseId);
    if (!ownership.allowed) return forbidden(ownership.reason);

    const admin = getSupabaseAdminClient();
    const { data, error } = await admin
      .from('recipient_profiles')
      .select(`
        first_name, middle_name, last_name, date_of_birth, sex, civil_status,
        address_line1, address_line2, city, province, zip_code,
        mobile_number, email, fields_completed, updated_at
      `)
      .eq('case_id', caseId)
      .single();

    if (error || !data) {
      return badRequest('Profile not found');
    }

    return success({ profile: data });
  } catch (error) {
    return handleApiError(error, 'Profile fetch');
  }
}
