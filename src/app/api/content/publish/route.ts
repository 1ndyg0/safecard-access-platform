/**
 * POST /api/content/publish
 *
 * School admin publishes an approved content version.
 * Unpublishes any previous version of the same (campaign, content_key, locale).
 * If the version is a material change, expires existing consent records.
 *
 * Persona: Aira (school admin) publishes after Elena's approval.
 */

import { NextRequest } from 'next/server';
import { publishContent } from '@/lib/content';
import { requireStaffAuth } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/auth/permissions';
import { success, forbidden, handleApiError } from '@/lib/api/response';
import { z } from 'zod';

const publishContentSchema = z.object({
  content_version_id: z.string().uuid(),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaffAuth();

    const roleCheck = await requireAnyRole(auth.userId, ['school_admin', 'privacy_admin_owner']);
    if (!roleCheck.allowed) return forbidden('Only school admin can publish content');

    const body = await request.json();
    const parsed = publishContentSchema.parse(body);

    const result = await publishContent(parsed.content_version_id, auth.userId);

    return success({
      published: true,
      contentType: result.contentType,
      locale: result.locale,
      version: result.version,
      consentExpired: result.consentExpiredCount,
      message: result.consentExpiredCount
        ? `Published. ${result.consentExpiredCount} consent record(s) expired due to material change — recipients will need to re-consent.`
        : 'Published successfully',
    });
  } catch (error) {
    return handleApiError(error, 'Content publish');
  }
}
