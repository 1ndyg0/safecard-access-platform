/**
 * POST /api/admin/roles/revoke
 *
 * Revoke a staff role. Requires reason.
 * Only privacy_admin_owner and school_admin can revoke.
 */

import { NextRequest } from 'next/server';
import { requireStaffAuth } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/auth/permissions';
import { writeAuditEvent } from '@/lib/audit';
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
      .select('id, user_id, role, campaign_id, organization_id')
      .eq('id', parsed.role_assignment_id)
      .eq('is_active', true)
      .single();

    if (!assignment) return notFound('Active role assignment not found');
    const roleCheck = await requireAnyRole(
      auth.userId,
      ['privacy_admin_owner', 'school_admin'],
      assignment.campaign_id ?? undefined,
      assignment.campaign_id ? undefined : assignment.organization_id ?? undefined,
    );
    if (!roleCheck.allowed) return forbidden('Only administrators for this scope can revoke roles');
    if (assignment.user_id === auth.userId) {
      return forbidden('Administrators cannot revoke their own active role');
    }

    await admin
      .from('role_assignments')
      .update({
        is_active: false,
        revoked_at: new Date().toISOString(),
        revoked_by: auth.userId,
        reason: parsed.reason,
      })
      .eq('id', parsed.role_assignment_id);

    await writeAuditEvent({
      event_type: 'role_change',
      actor_id: auth.userId,
      actor_type: 'user',
      action: `Revoked role ${assignment.role} from user ${assignment.user_id}`,
      target_type: 'role_assignment',
      target_id: parsed.role_assignment_id,
      details: {
        role: assignment.role,
        target_user_id: assignment.user_id,
        reason: parsed.reason,
      },
      severity: 'warning',
    });

    return success({ revoked: true });
  } catch (error) {
    return handleApiError(error, 'Role revocation');
  }
}
