/**
 * POST /api/content/rollback
 *
 * Rollback to a previous content version by unpublishing the current
 * published version and re-publishing the specified older version.
 *
 * This is essentially: unpublish current → publish target (which must
 * already be in 'approved' or was previously 'published' status).
 *
 * If the rollback target was a material change, consent is expired.
 */

import { NextRequest } from 'next/server';
import { requireStaffAuth } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/auth/permissions';
import { writeAuditEvent } from '@/lib/audit';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { publishContent } from '@/lib/content';
import { success, badRequest, forbidden, notFound, handleApiError } from '@/lib/api/response';
import { z } from 'zod';

const rollbackSchema = z.object({
  content_version_id: z.string().uuid('Target version ID required'),
  reason: z.string().min(5, 'Reason for rollback is required').max(1000),
});

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaffAuth();

    const roleCheck = await requireAnyRole(auth.userId, ['school_admin', 'privacy_admin_owner']);
    if (!roleCheck.allowed) return forbidden('Only school admin can rollback content');

    const body = await request.json();
    const parsed = rollbackSchema.parse(body);

    const admin = getSupabaseAdminClient();

    // Get the target version
    const { data: target } = await admin
      .from('content_versions')
      .select('id, content_type, locale, version, approved_at')
      .eq('id', parsed.content_version_id)
      .single();

    if (!target) return notFound('Content version not found');

    // Target must have been approved (either still approved, or was published before)
    if (!target.approved_at) {
      return badRequest('Cannot rollback to a version that was never approved by PRC');
    }

    // Find the currently published version for audit context.
    const { data: currentPublished } = await admin
      .from('content_versions')
      .select('id, version')
      .eq('content_type', target.content_type)
      .eq('locale', target.locale)
      .eq('is_published', true)
      .maybeSingle();

    const result = await publishContent(parsed.content_version_id, auth.userId);

    await writeAuditEvent({
      event_type: 'content_rollback',
      actor_id: auth.userId,
      actor_type: 'user',
      action: `Rolled back ${target.content_type}/${target.locale} to v${target.version}`,
      target_type: 'content_version',
      target_id: parsed.content_version_id,
      details: {
        reason: parsed.reason,
        previous_version_id: currentPublished?.id,
        previous_version: currentPublished?.version,
        rollback_version: target.version,
        consent_expired_count: result.consentExpiredCount,
      },
      severity: 'warning',
    });

    return success({
      rolledBack: true,
      contentType: target.content_type,
      locale: target.locale,
      restoredVersion: target.version,
      consentExpired: result.consentExpiredCount,
      reason: parsed.reason,
    });
  } catch (error) {
    return handleApiError(error, 'Content rollback');
  }
}
