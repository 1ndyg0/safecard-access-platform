/**
 * GET /api/referrals/list?campaign_id=xxx&page=1&limit=20
 *
 * Staff-only: list all referral links for a campaign.
 * Includes sponsor display name, activation status, visit counts.
 */

import { NextRequest } from 'next/server';
import { requireStaffAuth } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/auth/permissions';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { success, badRequest, forbidden, handleApiError } from '@/lib/api/response';
import { paginationSchema } from '@/lib/validation/schemas';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaffAuth();

    const campaignId = request.nextUrl.searchParams.get('campaign_id');
    if (!campaignId) return badRequest('campaign_id is required');

    const roleCheck = await requireAnyRole(auth.userId, ['school_admin', 'prc_liaison', 'support_agent'], campaignId);
    if (!roleCheck.allowed) return forbidden(roleCheck.reason);

    const pagination = paginationSchema.parse({
      page: request.nextUrl.searchParams.get('page'),
      limit: request.nextUrl.searchParams.get('limit'),
    });

    const admin = getSupabaseAdminClient();
    const offset = (pagination.page - 1) * pagination.limit;

    const { data, error, count } = await admin
      .from('referral_links')
      .select(`
        id, slug, is_active, activated_at, expires_at, revoked_at,
        total_visits, total_starts, created_at,
        sponsors!inner (id, display_name, is_minor, guardian_approved)
      `, { count: 'exact' })
      .eq('campaign_id', campaignId)
      .order('created_at', { ascending: false })
      .range(offset, offset + pagination.limit - 1);

    if (error) throw new Error(`Failed to list referrals: ${error.message}`);

    return success({
      referrals: data ?? [],
      total: count ?? 0,
      page: pagination.page,
      limit: pagination.limit,
    });
  } catch (error) {
    return handleApiError(error, 'Referral list');
  }
}
