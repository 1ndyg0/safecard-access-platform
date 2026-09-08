/**
 * GET /api/sponsors/status?sponsor_id=xxx
 *
 * Privacy-safe referral status for sponsors.
 * Shows: referral links, visit counts, and high-level case stages.
 * Does NOT show: recipient names, personal data, PRC notes.
 *
 * Persona: Bea sees "submitted", "payment pending", "confirmed" — never Tess's address.
 */

import { NextRequest } from 'next/server';
import { getSponsorReferralStatus } from '@/lib/sponsors';
import { requireAuth } from '@/lib/auth/session';
import { success, badRequest, forbidden, handleApiError } from '@/lib/api/response';
import { getSupabaseAdminClient } from '@/lib/db/client';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth();
    const sponsorId = request.nextUrl.searchParams.get('sponsor_id');

    if (!sponsorId) {
      return badRequest('sponsor_id is required');
    }

    // Verify the requesting user owns this sponsor record
    const admin = getSupabaseAdminClient();
    const { data: sponsor } = await admin
      .from('sponsors')
      .select('id, auth_user_id')
      .eq('id', sponsorId)
      .single();

    if (!sponsor) {
      return badRequest('Sponsor not found');
    }

    if (sponsor.auth_user_id !== auth.userId) {
      return forbidden('You can only view your own referral status');
    }

    const statuses = await getSponsorReferralStatus(sponsorId);

    const referrals = statuses.map(({ cases, ...referral }) => ({
      ...referral,
      stageCounts: cases.reduce<Record<string, number>>((counts, item) => {
        counts[item.stage] = (counts[item.stage] ?? 0) + 1;
        return counts;
      }, {}),
    }));
    const shared = statuses.reduce((sum, item) => sum + item.totalStarts, 0);
    const enrolled = statuses.reduce(
      (sum, item) => sum + item.cases.filter((entry) => entry.stage === 'confirmed').length,
      0,
    );

    return success({ summary: { shared, enrolled }, referrals });
  } catch (error) {
    return handleApiError(error, 'Sponsor status');
  }
}
