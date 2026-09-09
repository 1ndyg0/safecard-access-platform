/**
 * Campaign-scoped staff access for the operations console
 *
 * Every admin route resolves the caller's roles and the campaigns those
 * roles reach before touching case data. Role assignment itself is owned
 * by the authentication module; this module only reads the assignments
 * it publishes and never widens them.
 *
 * Cross-campaign access is denied here rather than filtered later, so a
 * case id from another campaign returns 403 instead of an empty result.
 * The distinction matters: a silent empty result still confirms that the
 * id does not belong to the caller's campaign, one guess at a time.
 */

import 'server-only';

import { getSupabaseAdminClient } from '@/lib/db/client';
import { requireStaffAuth } from '@/lib/auth/session';
import { writeAuditEvent } from '@/lib/audit';
import type { StaffRole } from '@/types/database';

export interface StaffScope {
  userId: string;
  roles: StaffRole[];
  /** Campaigns reachable directly or through an organization assignment. */
  campaignIds: string[];
  /** Effective roles resolved independently for every reachable campaign. */
  rolesByCampaign: Record<string, StaffRole[]>;
}

export class NoStaffAssignmentError extends Error {
  constructor() {
    super('No active staff assignment.');
    this.name = 'NoStaffAssignmentError';
  }
}

export class CampaignAccessError extends Error {
  constructor() {
    // Deliberately does not distinguish "campaign does not exist" from
    // "campaign exists but is not yours".
    super('Permission denied for this campaign.');
    this.name = 'CampaignAccessError';
  }
}

/**
 * Resolve the caller's staff scope.
 * Throws NoStaffAssignmentError when the user holds no active role.
 */
export async function resolveStaffScope(): Promise<StaffScope> {
  const auth = await requireStaffAuth();
  const admin = getSupabaseAdminClient();

  const { data: assignments, error } = await admin
    .from('role_assignments')
    .select('role,campaign_id,organization_id')
    .eq('user_id', auth.userId)
    .eq('is_active', true)
    .is('revoked_at', null);

  if (error) throw new Error(`Failed to resolve staff scope: ${error.message}`);
  if (!assignments || assignments.length === 0) throw new NoStaffAssignmentError();

  const roles = [...new Set(assignments.map((a) => a.role as StaffRole))];
  const directCampaignIds = assignments
    .map((a) => a.campaign_id)
    .filter((id): id is string => Boolean(id));
  const organizationIds = assignments
    // A campaign assignment may retain organization metadata for audit,
    // but it must never expand into every campaign in that organization.
    .filter((assignment) => !assignment.campaign_id)
    .map((a) => a.organization_id)
    .filter((id): id is string => Boolean(id));

  const campaignIds = new Set(directCampaignIds);
  const roleSetsByCampaign = new Map<string, Set<StaffRole>>();

  for (const assignment of assignments) {
    if (!assignment.campaign_id) continue;
    const campaignId = assignment.campaign_id as string;
    if (!roleSetsByCampaign.has(campaignId)) roleSetsByCampaign.set(campaignId, new Set());
    roleSetsByCampaign.get(campaignId)?.add(assignment.role as StaffRole);
  }

  if (organizationIds.length > 0) {
    const { data: orgCampaigns, error: orgError } = await admin
      .from('pilot_campaigns')
      .select('id,organization_id')
      .in('organization_id', organizationIds);
    if (orgError) throw new Error(`Failed to resolve campaign scope: ${orgError.message}`);
    orgCampaigns?.forEach((campaign) => {
      const campaignId = campaign.id as string;
      campaignIds.add(campaignId);
      if (!roleSetsByCampaign.has(campaignId)) roleSetsByCampaign.set(campaignId, new Set());
      assignments
        .filter((assignment) =>
          !assignment.campaign_id
          && assignment.organization_id === campaign.organization_id,
        )
        .forEach((assignment) => {
          roleSetsByCampaign.get(campaignId)?.add(assignment.role as StaffRole);
        });
    });
  }

  if (campaignIds.size === 0) throw new NoStaffAssignmentError();

  const rolesByCampaign = Object.fromEntries(
    [...roleSetsByCampaign].map(([campaignId, roleSet]) => [campaignId, [...roleSet]]),
  );

  return { userId: auth.userId, roles, campaignIds: [...campaignIds], rolesByCampaign };
}

/** Throw unless the campaign is inside the caller's scope. */
export function assertCampaignAccess(scope: StaffScope, campaignId: string): void {
  if (!scope.campaignIds.includes(campaignId)) throw new CampaignAccessError();
}

/** Return only the roles effective for one campaign. */
export function rolesForCampaign(scope: StaffScope, campaignId: string): StaffRole[] {
  assertCampaignAccess(scope, campaignId);
  return scope.rolesByCampaign[campaignId] ?? [];
}

/**
 * Campaigns the caller may select, for the console's campaign picker.
 */
export async function listAccessibleCampaigns(scope: StaffScope) {
  const admin = getSupabaseAdminClient();
  const { data, error } = await admin
    .from('pilot_campaigns')
    .select('id,name,organization_id,is_active,start_date,end_date')
    .in('id', scope.campaignIds)
    .order('start_date', { ascending: false });

  if (error) throw new Error(`Failed to list campaigns: ${error.message}`);
  return data ?? [];
}

/**
 * Record that a staff member opened an individual case.
 *
 * Aggregate and queue views are not logged per row; opening one person's
 * case is the access worth being able to answer for later.
 */
export async function logCaseAccess(params: {
  scope: StaffScope;
  caseId: string;
  campaignId: string;
  fieldsDisclosed: string[];
}): Promise<void> {
  await writeAuditEvent({
    event_type: 'staff_access',
    actor_id: params.scope.userId,
    actor_type: 'user',
    action: 'Opened case detail in operations console',
    target_type: 'recipient_case',
    target_id: params.caseId,
    case_id: params.caseId,
    campaign_id: params.campaignId,
    details: {
      roles: rolesForCampaign(params.scope, params.campaignId),
      // The field names disclosed, never the values.
      fields_disclosed: params.fieldsDisclosed,
    },
    severity: 'info',
  });
}
