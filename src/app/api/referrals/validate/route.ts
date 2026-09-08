/**
 * GET /api/referrals/validate?slug=XXXXXX
 *
 * Public endpoint — validates a referral slug and returns
 * campaign info + sponsor display name (no PII).
 *
 * Used by the landing page when a recipient opens a referral link.
 * Invalid/expired slugs return a safe fallback response.
 */

import { NextRequest, NextResponse } from 'next/server';
import { validateReferralSlug } from '@/lib/referrals';
import { validateReferralSlugSchema } from '@/lib/validation/schemas';
import { enforceRateLimit } from '@/lib/api/rate-limit';
import { handleApiError } from '@/lib/api/response';

export async function GET(request: NextRequest) {
  try {
    await enforceRateLimit(request, 'referrals.validate');
    const slug = request.nextUrl.searchParams.get('slug');

    const parsed = validateReferralSlugSchema.safeParse({ slug });
    if (!parsed.success) {
      // Safe fallback: show general landing page
      return NextResponse.json({
        valid: false,
        reason: 'invalid_format',
        fallback: true,
      });
    }

    const result = await validateReferralSlug(parsed.data.slug);

    if (!result.valid) {
      return NextResponse.json({
        valid: false,
        reason: result.reason,
        fallback: true,
      });
    }

    return NextResponse.json({
      valid: true,
      referralLinkId: result.referralLinkId,
      campaignId: result.campaignId,
      sponsorDisplayName: result.sponsorDisplayName,
    });
  } catch (error) {
    return handleApiError(error, 'Referral validation');
  }
}
