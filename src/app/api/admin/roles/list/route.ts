/**
 * GET /api/admin/roles/list?campaign_id=xxx
 *
 * Staff-only: list all role assignments for a campaign.
 */

import { NextRequest } from 'next/server';
import { requireStaffAuth } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/auth/permissions';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { success, badRequest, forbidden, handleApiError } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaffAuth();

    const campaignId = request.nextUrl.searchParams.get('campaign_id');
    if (!campaignId) return badRequest('campaign_id is required');
    const roleCheck = await requireAnyRole(auth.userId, ['privacy_admin_owner', 'school_admin'], campaignId);
    if (!roleCheck.allowed) return forbidden(roleCheck.reason);

    const admin = getSupabaseAdminClient();
    const { data: campaign } = await admin
      .from('pilot_campaigns')
      .select('organization_id')
      .eq('id', campaignId)
      .maybeSingle();
    if (!campaign) return badRequest('Campaign not found');

    const { data, error } = await admin
      .from('role_assignments')
      .select(`
        id, role, is_active, granted_at, revoked_at, reason,
        users!inner (id, email, full_name, mfa_enabled)
      `)
      .or(
        `campaign_id.eq.${campaignId},and(campaign_id.is.null,organization_id.eq.${campaign.organization_id})`,
      )
      .order('granted_at', { ascending: false });

    if (error) throw new Error(`Failed to list roles: ${error.message}`);

    return success({ assignments: data ?? [] });
  } catch (error) {
    return handleApiError(error, 'Role list');
  }
}
