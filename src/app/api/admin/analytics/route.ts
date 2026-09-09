/**
 * GET /api/admin/analytics?campaign_id=<uuid>
 *
 * Campaign analytics: funnel rates, review aging, intake trends,
 * turnarounds, evidence replacement and hotline volume.
 *
 * Everything is aggregated and suppressed inside PostgreSQL by
 * public.admin_campaign_analytics. This route authorizes the caller,
 * calls the function and returns the result. It never sees a case row,
 * which is the point: an analytics endpoint that reads whole cases into
 * the application server is one bug away from serving them.
 *
 * Measures without a source of truth in the current schema come back as
 * `available: false` with a reason rather than as a plausible number.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { badRequest } from '@/lib/api/response';
import { assertCampaignAccess, resolveStaffScope } from '@/lib/admin/access';
import { handleAdminError, PRIVATE_NO_STORE } from '@/lib/admin/respond';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const scope = await resolveStaffScope();

    const campaignId = request.nextUrl.searchParams.get('campaign_id');
    if (!campaignId || !z.string().uuid().safeParse(campaignId).success) {
      return badRequest('campaign_id must be a UUID.');
    }
    assertCampaignAccess(scope, campaignId);

    const admin = getSupabaseAdminClient();
    const { data, error } = await admin.rpc('admin_campaign_analytics', {
      p_campaign_id: campaignId,
    });
    if (error) throw new Error(`Failed to load analytics: ${error.message}`);

    return NextResponse.json(
      { campaignId, analytics: data },
      { headers: PRIVATE_NO_STORE },
    );
  } catch (error) {
    return handleAdminError(error, 'Admin analytics');
  }
}
