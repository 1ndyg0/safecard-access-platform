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
import { writeAuditEvent } from '@/lib/audit';
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

    if (parsed.campaign_id && parsed.organization_id) {
      const { data: campaign } = await admin
        .from('pilot_campaigns')
        .select('organization_id')
        .eq('id', parsed.campaign_id)
        .maybeSingle();
      if (!campaign || campaign.organization_id !== parsed.organization_id) {
        return forbidden('Campaign does not belong to the requested organization scope');
      }
    }

    const { data: targetUser } = await admin
      .from('users')
      .select('id')
      .eq('id', parsed.user_id)
      .eq('is_active', true)
      .maybeSingle();
    if (!targetUser) return forbidden('Target staff user is not active');

    // Check if role already exists and is active
    const { data: existing } = await admin
      .from('role_assignments')
      .select('id')
      .eq('user_id', parsed.user_id)
      .eq('role', parsed.role)
      .eq('is_active', true)
      .is('revoked_at', null)
      .eq(parsed.campaign_id ? 'campaign_id' : 'organization_id', parsed.campaign_id ?? parsed.organization_id!)
      .maybeSingle();

    if (existing) {
      return created({
        roleAssignmentId: existing.id,
        status: 'already_assigned',
        message: 'User already has this role',
      });
    }

    const { data, error } = await admin
      .from('role_assignments')
      .insert({
        user_id: parsed.user_id,
        role: parsed.role,
        organization_id: parsed.organization_id ?? null,
        campaign_id: parsed.campaign_id ?? null,
        granted_by: auth.userId,
        reason: parsed.reason ?? null,
      })
      .select('id')
      .single();

    if (error) throw new Error(`Failed to assign role: ${error.message}`);

    await writeAuditEvent({
      event_type: 'role_change',
      actor_id: auth.userId,
      actor_type: 'user',
      action: `Assigned role ${parsed.role} to user ${parsed.user_id}`,
      target_type: 'role_assignment',
      target_id: data.id,
      details: {
        role: parsed.role,
        target_user_id: parsed.user_id,
        reason: parsed.reason,
      },
    });

    return created({
      roleAssignmentId: data.id,
      status: 'assigned',
      message: `Role ${parsed.role} assigned successfully`,
    });
  } catch (error) {
    return handleApiError(error, 'Role assignment');
  }
}
