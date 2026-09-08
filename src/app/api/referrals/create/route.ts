/**
 * POST /api/referrals/create
 *
 * Create a referral link for a sponsor.
 * Idempotent — same key returns existing link.
 * Validates campaign is active and sponsor exists.
 */

import { NextRequest } from 'next/server';
import { createReferralLink } from '@/lib/referrals';
import { createReferralLinkSchema } from '@/lib/validation/schemas';
import { requireAuth } from '@/lib/auth/session';
import { created, success, handleApiError } from '@/lib/api/response';
import { requireSponsorOwnership } from '@/lib/auth/permissions';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth();
    const body = await request.json();
    const parsed = createReferralLinkSchema.parse(body);
    const ownership = await requireSponsorOwnership(auth.userId, parsed.sponsor_id);
    if (!ownership.allowed) throw new Error('Permission denied: sponsor ownership required');

    const result = await createReferralLink({
      sponsorId: parsed.sponsor_id,
      campaignId: parsed.campaign_id,
      expiresAt: parsed.expires_at,
      idempotencyKey: parsed.idempotency_key,
      actorId: auth.userId,
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const referralUrl = `${appUrl}/r/${result.slug}`;

    if (result.status === 'exists') {
      return success({
        referralLinkId: result.id,
        slug: result.slug,
        url: referralUrl,
        status: 'exists',
      });
    }

    return created({
      referralLinkId: result.id,
      slug: result.slug,
      url: referralUrl,
      qrData: referralUrl, // Frontend generates QR from this URL
      status: 'created',
    });
  } catch (error) {
    return handleApiError(error, 'Referral link creation');
  }
}
