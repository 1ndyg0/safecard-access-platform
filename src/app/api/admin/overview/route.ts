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
} from '@/lib/admin/access';
import { handleAdminError, PRIVATE_NO_STORE } from '@/lib/admin/respond';

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
    }

    return NextResponse.json(
      {
        user: user ?? null,
        roles: scope.roles,
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
