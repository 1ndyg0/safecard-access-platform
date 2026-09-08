/**
 * Server-side permission checks
 *
 * RLS handles row-level access at the database layer.
 * These functions add application-level authorization:
 * - Role verification before sensitive operations
 * - MFA verification for export operations
 * - Reauthentication checks
 *
 * All checks happen server-side. Never trust the client.
 */

import { getSupabaseAdminClient } from '@/lib/db/client';
import { writeAuditEvent } from '@/lib/audit';
import { getSessionClient } from '@/lib/auth/session';
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
  const admin = getSupabaseAdminClient();

  let query = admin
    .from('role_assignments')
    .select('id')
    .eq('user_id', userId)
    .eq('role', role)
    .eq('is_active', true)
    .is('revoked_at', null);

  if (campaignId) {
    const { data: campaign } = await admin
      .from('pilot_campaigns')
      .select('organization_id')
      .eq('id', campaignId)
      .single();
    if (!campaign) return { allowed: false, reason: 'Campaign not found' };
    query = query.or(
      `campaign_id.eq.${campaignId},organization_id.eq.${campaign.organization_id}`,
    );
  }

  const { data, error } = await query.limit(1);

  if (error || !data || data.length === 0) {
    return { allowed: false, reason: `User does not have role: ${role}` };
  }

  return { allowed: true };
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

  let query = admin
    .from('role_assignments')
    .select('id, role')
    .eq('user_id', userId)
    .in('role', roles)
    .eq('is_active', true)
    .is('revoked_at', null);

  if (campaignId) {
    const { data: campaign } = await admin
      .from('pilot_campaigns')
      .select('organization_id')
      .eq('id', campaignId)
      .single();
    if (!campaign) return { allowed: false, reason: 'Campaign not found' };
    query = query.or(
      `campaign_id.eq.${campaignId},organization_id.eq.${campaign.organization_id}`,
    );
  } else if (organizationId) {
    query = query.eq('organization_id', organizationId);
  }

  const { data, error } = await query.limit(1);

  if (error || !data || data.length === 0) {
    return {
      allowed: false,
      reason: `User does not have any of these roles: ${roles.join(', ')}`,
    };
  }

  return { allowed: true };
}

/**
 * Verify the user has MFA enabled (required for export operations).
 */
export async function requireMfa(): Promise<PermissionCheckResult> {
  const supabase = await getSessionClient();
  const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (error || !data || data.currentLevel !== 'aal2') {
    return {
      allowed: false,
      reason: 'MFA is required for this operation. Please enable MFA in your account settings.',
    };
  }

  return { allowed: true };
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

export async function requireSponsorOwnership(
  authUserId: string,
  sponsorId: string,
): Promise<PermissionCheckResult> {
  const { data, error } = await getSupabaseAdminClient()
    .from('sponsors')
    .select('id')
    .eq('id', sponsorId)
    .eq('auth_user_id', authUserId)
    .eq('is_active', true)
    .maybeSingle();
  return error || !data
    ? { allowed: false, reason: 'You do not have access to this sponsor' }
    : { allowed: true };
}

export async function requirePaymentAccess(
  authUserId: string,
  paymentIntentId: string,
): Promise<PermissionCheckResult> {
  const { data, error } = await getSupabaseAdminClient()
    .from('payment_intents')
    .select('case_id, payer_sponsor_id, recipient_cases!inner(auth_user_id), sponsors(auth_user_id)')
    .eq('id', paymentIntentId)
    .maybeSingle();

  if (error || !data) return { allowed: false, reason: 'Payment intent not found' };
  const recipient = Array.isArray(data.recipient_cases)
    ? data.recipient_cases[0]
    : data.recipient_cases;
  const sponsor = Array.isArray(data.sponsors) ? data.sponsors[0] : data.sponsors;
  return recipient?.auth_user_id === authUserId || sponsor?.auth_user_id === authUserId
    ? { allowed: true }
    : { allowed: false, reason: 'You do not have access to this payment' };
}
