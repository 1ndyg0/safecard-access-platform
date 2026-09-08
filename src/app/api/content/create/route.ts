/**
 * POST /api/content/create
 *
 * Create a new content version for bilingual content (benefits, exclusions,
 * privacy notice, consent text, etc.).
 *
 * Auto-increments version number within (campaign, content_key, locale).
 * Material changes are flagged — they will expire existing consent on publish.
 *
 * Persona: Aira (school admin) drafts content for PRC approval.
 */

import { NextRequest } from 'next/server';
import { createContentVersion } from '@/lib/content';
import { requireStaffAuth } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/auth/permissions';
import { createContentVersionSchema } from '@/lib/validation/schemas';
import { created, forbidden, handleApiError } from '@/lib/api/response';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaffAuth();

    const roleCheck = await requireAnyRole(auth.userId, ['school_admin', 'privacy_admin_owner']);
    if (!roleCheck.allowed) return forbidden('Only school admin or privacy admin can create content');

    const body = await request.json();
    const parsed = createContentVersionSchema.parse(body);

    const version = await createContentVersion({
      content_type: parsed.content_type,
      locale: parsed.locale,
      title: parsed.title,
      body: parsed.body,
      summary: parsed.summary,
      source: parsed.source,
      source_last_updated: parsed.source_last_updated,
      review_date: parsed.review_date,
      expiry_date: parsed.expiry_date,
      affected_surfaces: parsed.affected_surfaces,
      supersedes_id: parsed.supersedes_id,
      change_summary: parsed.change_summary,
      is_material_change: parsed.is_material_change,
      created_by: auth.userId,
    });

    return created({
      contentVersionId: version.id,
      contentType: version.contentType,
      locale: version.locale,
      version: version.version,
      isMaterialChange: version.isMaterialChange,
      status: 'draft — awaiting PRC approval',
    });
  } catch (error) {
    return handleApiError(error, 'Content creation');
  }
}
