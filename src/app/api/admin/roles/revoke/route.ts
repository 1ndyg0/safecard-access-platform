/**
 * POST /api/admin/roles/revoke
 *
 * Revoke a staff role. Requires reason.
 * Only privacy_admin_owner and school_admin can revoke.
 */

import { NextRequest } from 'next/server';
import { requireStaffAuth } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/auth/permissions';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { revokeRoleSchema } from '@/lib/validation/schemas';
import { success, forbidden, notFound, handleApiError } from '@/lib/api/response';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaffAuth();

    const body = await request.json();
    const parsed = revokeRoleSchema.parse(body);

    const admin = getSupabaseAdminClient();
    const { data: assignment } = await admin
      .from('role_assignments')
      .select('id,user_id,role,campaign_id,organization_id')
      .eq('id', parsed.role_assignment_id)
      .eq('is_active', true)
      .is('revoked_at', null)
      .maybeSingle();
    if (!assignment) return notFound('Active role assignment not found');
    if (assignment.user_id === auth.userId) {
      return forbidden('Administrators cannot revoke their own active role');
    }
    const scopedAdmin = await requireAnyRole(
      auth.userId,
      ['privacy_admin_owner', 'school_admin'],
      assignment.campaign_id ?? undefined,
      assignment.campaign_id ? undefined : assignment.organization_id ?? undefined,
    );
    if (!scopedAdmin.allowed) return forbidden('Only administrators for this scope can revoke roles');
    if (['privacy_admin_owner', 'school_admin', 'prc_liaison'].includes(assignment.role)) {
      const privacyAdmin = await requireAnyRole(
        auth.userId,
        ['privacy_admin_owner'],
        assignment.campaign_id ?? undefined,
        assignment.campaign_id ? undefined : assignment.organization_id ?? undefined,
      );
      if (!privacyAdmin.allowed) {
        return forbidden('Only a privacy admin can revoke privileged administrator or PRC roles');
      }
    }

    const { data, error } = await admin.rpc('revoke_staff_role_atomic', {
      p_actor_id: auth.userId,
      p_role_assignment_id: parsed.role_assignment_id,
      p_reason: parsed.reason,
    });
    if (error) throw new Error(`Failed to revoke role: ${error.message}`);
    const result = Array.isArray(data) ? data[0] : data;
    if (!result) throw new Error('Failed to revoke role: no result returned');

    return success({ revoked: true, roleAssignmentId: result.role_assignment_id });
  } catch (error) {
    return handleApiError(error, 'Role revocation');
  }
}
