/**
 * GET /api/admin/overview?campaign_id=<uuid>
 *
 * Operations dashboard: the caller's identity, the campaigns they may
 * select, and the eleven operational counts for the selected campaign.
 *
 * Counts come from public.admin_dashboard_counts, which aggregates in
 * the database. The route never loads case rows to count them.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { badRequest } from '@/lib/api/response';
import {
  assertCampaignAccess,
  listAccessibleCampaigns,
  resolveStaffScope,
  rolesForCampaign,
} from '@/lib/admin/access';
import { handleAdminError, PRIVATE_NO_STORE } from '@/lib/admin/respond';
import { COMPLETE_PAYMENT_STATES } from '@/lib/admin/queue';

export const dynamic = 'force-dynamic';

const DASHBOARD_COUNT_KEYS = [
  'total_cases',
  'draft_or_incomplete',
  'submitted',
  'awaiting_application_review',
  'correction_requested',
  'payment_evidence_pending',
  'payment_verified',
  'ready_for_prc_handoff',
  'sent_or_acknowledged_by_prc',
  'prc_confirmed_active',
  'prc_declined',
] as const;

type DashboardCounts = Record<(typeof DASHBOARD_COUNT_KEYS)[number], number>;

function emptyCounts(): DashboardCounts {
  return Object.fromEntries(DASHBOARD_COUNT_KEYS.map((key) => [key, 0])) as DashboardCounts;
}

/**
 * The database function counts every case, including applications still in
 * progress. Staff only receive complete applications (details plus proof of
 * payment), so the buckets that include in-progress cases are recounted
 * with that restriction.
 */
async function restrictToCompleteApplications(
  admin: ReturnType<typeof getSupabaseAdminClient>,
  campaignId: string,
  counts: DashboardCounts,
): Promise<DashboardCounts> {
  const count = async (applyFilter?: (query: any) => any): Promise<number> => { // eslint-disable-line @typescript-eslint/no-explicit-any
    let query = admin
      .from('recipient_cases')
      .select('id', { count: 'exact', head: true })
      .eq('campaign_id', campaignId)
      .eq('is_active', true)
      .in('payment_state', [...COMPLETE_PAYMENT_STATES]);
    if (applyFilter) query = applyFilter(query);
    const { count: total, error } = await query;
    if (error) throw new Error(`Failed to count complete applications: ${error.message}`);
    return total ?? 0;
  };
  const [total, submitted, awaiting, correction, pending] = await Promise.all([
    count(),
    count((q) => q.in('application_state', ['submitted', 'resubmitted'])),
    count((q) => q.in('application_state', ['ready_for_review', 'submitted', 'resubmitted'])),
    count((q) => q.eq('application_state', 'correction_needed')),
    count((q) => q.eq('payment_state', 'verification_pending')),
  ]);
  return {
    ...counts,
    total_cases: total,
    draft_or_incomplete: 0,
    submitted,
    awaiting_application_review: awaiting,
    correction_requested: correction,
    payment_evidence_pending: pending,
  };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const scope = await resolveStaffScope();
    const admin = getSupabaseAdminClient();

    const requested = request.nextUrl.searchParams.get('campaign_id');
    if (requested && !z.string().uuid().safeParse(requested).success) {
      return badRequest('campaign_id must be a UUID.');
    }

    const campaigns = await listAccessibleCampaigns(scope);
    const selectedCampaignId = requested ?? campaigns[0]?.id ?? null;
    if (selectedCampaignId) assertCampaignAccess(scope, selectedCampaignId);

    const { data: user, error: userError } = await admin
      .from('users')
      .select('full_name,email')
      .eq('id', scope.userId)
      .maybeSingle();
    if (userError) throw new Error(`Failed to load staff user: ${userError.message}`);

    let counts = emptyCounts();
    if (selectedCampaignId) {
      const { data, error } = await admin.rpc('admin_dashboard_counts', {
        p_campaign_id: selectedCampaignId,
      });
      if (error) throw new Error(`Failed to load dashboard counts: ${error.message}`);
      // Postgres returns bigint counts as strings over PostgREST.
      counts = Object.fromEntries(
        DASHBOARD_COUNT_KEYS.map((key) => [key, Number((data ?? {})[key] ?? 0)]),
      ) as DashboardCounts;
      counts = await restrictToCompleteApplications(admin, selectedCampaignId, counts);
    }

    return NextResponse.json(
      {
        user: user ?? null,
        roles: selectedCampaignId ? rolesForCampaign(scope, selectedCampaignId) : [],
        campaigns,
        selectedCampaignId,
        counts,
      },
      { headers: PRIVATE_NO_STORE },
    );
  } catch (error) {
    return handleAdminError(error, 'Admin overview');
  }
}
