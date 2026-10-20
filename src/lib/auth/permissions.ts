/**
 * Server-side permission checks
 *
 * RLS handles row-level access at the database layer.
 * These functions add application-level authorization:
 * - Role verification before sensitive operations
 * - Reauthentication checks
 *
 * All checks happen server-side. Never trust the client.
 */

import { getSupabaseAdminClient } from '@/lib/db/client';
import { writeAuditEvent } from '@/lib/audit';
import type { StaffRole } from '@/types/database';

export interface AuthContext {
  userId: string;
  isAnonymous: boolean;
  email?: string;
  ip?: string;
}

export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Verify the current user has a specific staff role.
 */
export async function requireRole(
  userId: string,
  role: StaffRole,
  campaignId?: string,
): Promise<PermissionCheckResult> {
  return requireAnyRole(userId, [role], campaignId);
}

/**
 * Verify the user has ANY active staff role.
 */
export async function requireAnyStaffRole(
  userId: string,
): Promise<PermissionCheckResult> {
  const admin = getSupabaseAdminClient();

  const { data, error } = await admin
    .from('role_assignments')
    .select('id')
    .eq('user_id', userId)
    .eq('is_active', true)
    .is('revoked_at', null)
    .limit(1);

  if (error || !data || data.length === 0) {
    return { allowed: false, reason: 'User does not have any staff role' };
  }

  return { allowed: true };
}

/**
 * Verify the user has one of several acceptable roles.
 */
export async function requireAnyRole(
  userId: string,
  roles: StaffRole[],
  campaignId?: string,
  organizationId?: string,
): Promise<PermissionCheckResult> {
  const admin = getSupabaseAdminClient();
  let scopeOrganizationId = organizationId;
  if (campaignId) {
    const { data: campaign, error } = await admin
      .from('pilot_campaigns')
      .select('organization_id')
      .eq('id', campaignId)
      .single();
    if (error || !campaign) return { allowed: false, reason: 'Campaign not found' };
    scopeOrganizationId = campaign.organization_id;
  }

  const { data, error } = await admin
    .from('role_assignments')
    .select('id,role,campaign_id,organization_id')
    .eq('user_id', userId)
    .in('role', roles)
    .eq('is_active', true)
    .is('revoked_at', null);

  const allowed = !error && data?.some((assignment) => {
    if (campaignId) {
      return assignment.campaign_id === campaignId
        || (assignment.campaign_id === null && assignment.organization_id === scopeOrganizationId);
    }
    if (organizationId) {
      return assignment.campaign_id === null && assignment.organization_id === organizationId;
    }
    return true;
  });
  return allowed
    ? { allowed: true }
    : { allowed: false, reason: `User does not have any of these roles in this scope: ${roles.join(', ')}` };

}

/**
 * Log a permission denial in the audit trail.
 */
export async function logPermissionDenial(
  userId: string,
  action: string,
  reason: string,
  ip?: string,
): Promise<void> {
  await writeAuditEvent({
    event_type: 'permission_denied',
    actor_id: userId,
    actor_type: 'user',
    action,
    details: { reason },
    severity: 'warning',
    actor_ip: ip,
  });
}

/**
 * Verify the recipient owns the case they're trying to access.
 */
export async function requireCaseOwnership(
  authUserId: string,
  caseId: string,
): Promise<PermissionCheckResult> {
  const admin = getSupabaseAdminClient();

  const { data, error } = await admin
    .from('recipient_cases')
    .select('id')
    .eq('id', caseId)
    .eq('auth_user_id', authUserId)
    .limit(1);

  if (error || !data || data.length === 0) {
    return { allowed: false, reason: 'You do not have access to this case' };
  }

  return { allowed: true };
}

/**
 * Check if a campaign is active and accepting applications.
 */
export async function requireActiveCampaign(
  campaignId: string,
): Promise<PermissionCheckResult> {
  const admin = getSupabaseAdminClient();

  const { data, error } = await admin
    .from('pilot_campaigns')
    .select('id, is_active, start_date, end_date, max_applications')
    .eq('id', campaignId)
    .single();

  if (error || !data) {
    return { allowed: false, reason: 'Campaign not found' };
  }

  if (!data.is_active) {
    return { allowed: false, reason: 'This campaign is not currently active' };
  }

  const now = new Date();
  const start = new Date(data.start_date);
  if (now < start) {
    return { allowed: false, reason: 'This campaign has not started yet' };
  }

  if (data.end_date) {
    const end = new Date(`${data.end_date}T23:59:59.999Z`);
    if (now > end) {
      return { allowed: false, reason: 'This campaign has ended' };
    }
  }

  const { count, error: countError } = await admin
    .from('recipient_cases')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('is_active', true);
  if (countError) return { allowed: false, reason: 'Unable to verify campaign capacity' };
  if ((count ?? 0) >= data.max_applications) {
    return { allowed: false, reason: 'This campaign has reached its application limit' };
  }

  return { allowed: true };
}

export async function requirePaymentAccess(
  authUserId: string,
  paymentIntentId: string,
): Promise<PermissionCheckResult> {
  const { data, error } = await getSupabaseAdminClient()
    .from('payment_intents')
    .select('case_id, recipient_cases!inner(auth_user_id)')
    .eq('id', paymentIntentId)
    .maybeSingle();

  if (error || !data) return { allowed: false, reason: 'Payment intent not found' };
  const recipient = Array.isArray(data.recipient_cases)
    ? data.recipient_cases[0]
    : data.recipient_cases;
  return recipient?.auth_user_id === authUserId
    ? { allowed: true }
    : { allowed: false, reason: 'You do not have access to this payment' };
}
