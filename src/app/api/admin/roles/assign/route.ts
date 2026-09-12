/**
 * POST /api/admin/roles/assign
 *
 * Assign a staff role to a user.
 * Only privacy_admin_owner and school_admin can assign roles.
 * Logged in audit trail.
 */

import { NextRequest } from 'next/server';
import { requireStaffAuth } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/auth/permissions';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { assignRoleSchema } from '@/lib/validation/schemas';
import { created, forbidden, handleApiError } from '@/lib/api/response';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaffAuth();

    const body = await request.json();
    const parsed = assignRoleSchema.parse(body);

    const roleCheck = await requireAnyRole(
      auth.userId,
      ['privacy_admin_owner', 'school_admin'],
      parsed.campaign_id,
      parsed.campaign_id ? undefined : parsed.organization_id,
    );
    if (!roleCheck.allowed) return forbidden('Only administrators for this scope can assign roles');
    const privacyAdmin = await requireAnyRole(
      auth.userId,
      ['privacy_admin_owner'],
      parsed.campaign_id,
      parsed.campaign_id ? undefined : parsed.organization_id,
    );
    if (!privacyAdmin.allowed && ['privacy_admin_owner', 'school_admin', 'prc_liaison'].includes(parsed.role)) {
      return forbidden('Only a privacy admin can assign privileged administrator or PRC roles');
    }

    const admin = getSupabaseAdminClient();

    const { data: targetUser } = await admin
      .from('users')
      .select('id')
      .eq('id', parsed.user_id)
      .eq('is_active', true)
      .maybeSingle();
    if (!targetUser) return forbidden('Target staff user is not active');

    const { data, error } = await admin.rpc('assign_staff_role_atomic', {
      p_actor_id: auth.userId,
      p_user_id: parsed.user_id,
      p_role: parsed.role,
      p_organization_id: parsed.organization_id ?? null,
      p_campaign_id: parsed.campaign_id ?? null,
      p_reason: parsed.reason,
    });
    if (error) throw new Error(`Failed to assign role: ${error.message}`);
    const result = Array.isArray(data) ? data[0] : data;
    if (!result) throw new Error('Failed to assign role: no result returned');

    return created({
      roleAssignmentId: result.role_assignment_id,
      status: result.status,
      message: result.status === 'already_assigned'
        ? 'User already has this role'
        : `Role ${parsed.role} assigned successfully`,
    });
  } catch (error) {
    return handleApiError(error, 'Role assignment');
  }
}
