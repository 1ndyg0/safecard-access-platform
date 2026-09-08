/**
 * GET /api/metrics/campaign?campaign_id=xxx&from=xxx&to=xxx
 *
 * Campaign-level metrics dashboard.
 * Staff-only. Returns aggregated metrics with small-cohort suppression.
 *
 * Persona: Aira views campaign health; Elena sees PRC-side metrics.
 */

import { NextRequest } from 'next/server';
import { getCampaignMetrics } from '@/lib/metrics';
import { requireStaffAuth } from '@/lib/auth/session';
import { requireAnyRole } from '@/lib/auth/permissions';
import { success, badRequest, forbidden, handleApiError } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireStaffAuth();

    const campaignId = request.nextUrl.searchParams.get('campaign_id');
    if (!campaignId) return badRequest('campaign_id is required');
    const roleCheck = await requireAnyRole(auth.userId, [
      'privacy_admin_owner', 'school_admin', 'prc_liaison', 'support_agent', 'finance_export',
    ], campaignId);
    if (!roleCheck.allowed) return forbidden(roleCheck.reason);

    const from = request.nextUrl.searchParams.get('from');
    const to = request.nextUrl.searchParams.get('to');

    const metrics = await getCampaignMetrics(campaignId, from ?? undefined, to ?? undefined);

    return success({
      campaignId,
      period: { from: from ?? 'all', to: to ?? 'now' },
      metrics,
      note: 'Values showing null are suppressed to protect privacy (cohort size < 5)',
    });
  } catch (error) {
    return handleApiError(error, 'Campaign metrics');
  }
}
