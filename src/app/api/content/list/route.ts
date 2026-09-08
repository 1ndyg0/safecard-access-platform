/**
 * GET /api/content/list?type=benefit&locale=tl&status=approved
 *
 * List content versions with optional filters.
 * Staff-only: shows draft, approved, published, expired versions.
 */

import { NextRequest } from 'next/server';
import { requireStaffAuth } from '@/lib/auth/session';
import { requireAnyStaffRole } from '@/lib/auth/permissions';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { success, forbidden, handleApiError } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaffAuth();

    const roleCheck = await requireAnyStaffRole(auth.userId);
    if (!roleCheck.allowed) return forbidden(roleCheck.reason);

    const contentType = request.nextUrl.searchParams.get('type');
    const locale = request.nextUrl.searchParams.get('locale');
    const status = request.nextUrl.searchParams.get('status');

    const admin = getSupabaseAdminClient();

    let query = admin
      .from('content_versions')
      .select(`
        id, content_type, locale, version, title, body, summary, source,
        is_material_change, change_summary, approval_status, approved_at,
        approved_by, is_published, published_at, published_by, expiry_date, created_at
      `)
      .order('content_type')
      .order('locale')
      .order('version', { ascending: false });

    if (contentType) query = query.eq('content_type', contentType);
    if (locale) query = query.eq('locale', locale);
    if (status) query = query.eq('approval_status', status);

    const { data, error } = await query;

    if (error) throw new Error(`Failed to list content: ${error.message}`);

    return success({ versions: data ?? [] });
  } catch (error) {
    return handleApiError(error, 'Content list');
  }
}
