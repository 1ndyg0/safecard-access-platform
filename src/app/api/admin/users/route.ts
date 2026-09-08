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
import { writeAuditEvent } from '@/lib/audit';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { success, created, badRequest, forbidden, conflict, handleApiError } from '@/lib/api/response';
import { z } from 'zod';

const createUserSchema = z.object({
  organization_id: z.string().uuid(),
  email: z.string().email('Valid email required'),
  full_name: z.string().min(2, 'Full name required').max(200),
});

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaffAuth();

    const campaignId = request.nextUrl.searchParams.get('campaign_id');
    if (!campaignId) return badRequest('campaign_id is required');
    const roleCheck = await requireAnyRole(auth.userId, ['privacy_admin_owner', 'school_admin'], campaignId);
    if (!roleCheck.allowed) return forbidden(roleCheck.reason);

    const admin = getSupabaseAdminClient();

    // Get all users who have role assignments in this campaign
    const { data: assignments, error } = await admin
      .from('role_assignments')
      .select(`
        role, is_active,
        users!inner (id, email, full_name, mfa_enabled, is_active, created_at)
      `)
      .eq('campaign_id', campaignId)
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
      undefined,
      parsed.organization_id,
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

    const { data, error } = await admin
      .from('users')
      .insert({
        id: invitation.user.id,
        email: parsed.email,
        full_name: parsed.full_name,
      })
      .select('id, email, full_name')
      .single();

    if (error) {
      await admin.auth.admin.deleteUser(invitation.user.id);
      throw new Error(`Failed to create user profile: ${error.message}`);
    }

    await writeAuditEvent({
      event_type: 'user_created',
      actor_id: auth.userId,
      actor_type: 'user',
      action: 'Invited staff user',
      target_type: 'user',
      target_id: data.id,
      details: { organization_id: parsed.organization_id },
    });

    return created({
      userId: data.id,
      email: data.email,
      fullName: data.full_name,
    });
  } catch (error) {
    return handleApiError(error, 'User creation');
  }
}
