/**
 * GET /api/admin/users?campaign_id=xxx
 * POST /api/admin/users
 *
 * GET: List users in a campaign (admin/school_admin only).
 * POST: Create a new staff user (admin only).
 */

import { NextRequest } from 'next/server';
import { requireStaffAuth } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/auth/permissions';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { success, created, badRequest, forbidden, conflict, handleApiError } from '@/lib/api/response';
import { z } from 'zod';

const createUserSchema = z.strictObject({
  organization_id: z.string().uuid(),
  campaign_id: z.string().uuid(),
  email: z.string().email('Valid email required'),
  full_name: z.string().min(2, 'Full name required').max(200),
  role: z.enum([
    'school_admin',
    'prc_liaison',
    'support_agent',
    'finance_export',
    'content_approver',
    'privacy_admin_owner',
  ]),
  reason: z.string().trim().min(10).max(500),
});

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

    // Campaign-specific assignments plus organization assignments that
    // are effective for every campaign in this organization.
    const { data: assignments, error } = await admin
      .from('role_assignments')
      .select(`
        role, is_active,
        users!inner (id, email, full_name, mfa_enabled, is_active, created_at)
      `)
      .or(
        `campaign_id.eq.${campaignId},and(campaign_id.is.null,organization_id.eq.${campaign.organization_id})`,
      )
      .order('granted_at', { ascending: false });

    if (error) throw new Error(`Failed to list users: ${error.message}`);

    // Deduplicate users (a user may have multiple roles)
    const userMap = new Map<string, { user: Record<string, unknown>; roles: string[] }>();
    for (const assignment of assignments ?? []) {
      const user = assignment.users as unknown as Record<string, unknown>;
      const userId = user.id as string;
      if (!userMap.has(userId)) {
        userMap.set(userId, { user, roles: [] });
      }
      if (assignment.is_active) {
        userMap.get(userId)!.roles.push(assignment.role);
      }
    }

    const users = Array.from(userMap.values()).map(({ user, roles }) => ({
      ...user,
      active_roles: roles,
    }));

    return success({ users });
  } catch (error) {
    return handleApiError(error, 'User list');
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireStaffAuth();

    const body = await request.json();
    const parsed = createUserSchema.parse(body);
    const roleCheck = await requireAnyRole(
      auth.userId,
      ['privacy_admin_owner'],
      parsed.campaign_id,
    );
    if (!roleCheck.allowed) return forbidden('Only the organization privacy admin can invite users');

    const admin = getSupabaseAdminClient();

    // Check for existing user by email
    const { data: existing } = await admin
      .from('users')
      .select('id')
      .eq('email', parsed.email)
      .maybeSingle();

    if (existing) return conflict('A user with this email already exists');

    const { data: campaign } = await admin
      .from('pilot_campaigns')
      .select('organization_id')
      .eq('id', parsed.campaign_id)
      .maybeSingle();
    if (!campaign || campaign.organization_id !== parsed.organization_id) {
      return forbidden('Campaign does not belong to the requested organization scope');
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) throw new Error('NEXT_PUBLIC_APP_URL is required to send staff invitations');

    const { data: invitation, error: invitationError } = await admin.auth.admin.inviteUserByEmail(
      parsed.email,
      {
        data: { full_name: parsed.full_name },
        redirectTo: `${new URL(appUrl).origin}/auth/callback`,
      },
    );
    if (invitationError || !invitation.user) {
      throw new Error(`Failed to invite staff user: ${invitationError?.message}`);
    }

    const { data, error } = await admin.rpc('provision_invited_staff_atomic', {
      p_actor_id: auth.userId,
      p_user_id: invitation.user.id,
      p_email: parsed.email,
      p_full_name: parsed.full_name,
      p_campaign_id: parsed.campaign_id,
      p_role: parsed.role,
      p_reason: parsed.reason,
    });
    const result = Array.isArray(data) ? data[0] : data;
    if (error || !result) {
      await admin.auth.admin.deleteUser(invitation.user.id);
      throw new Error(`Failed to provision invited staff: ${error?.message ?? 'no result returned'}`);
    }

    return created({
      userId: result.user_id,
      roleAssignmentId: result.role_assignment_id,
      email: parsed.email,
      fullName: parsed.full_name,
    });
  } catch (error) {
    return handleApiError(error, 'User creation');
  }
}
