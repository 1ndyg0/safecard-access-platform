/**
 * GET /api/referrals/:slug
 *
 * Public endpoint — resolve a referral slug.
 * Used when recipient opens a referral link/QR code.
 *
 * Returns campaign content and sponsor display name.
 * Invalid/expired slugs return fallback with general landing content.
 *
 * Journey phase 2: Explain and Invite
 */

import { NextRequest } from 'next/server';
import { validateReferralSlug } from '@/lib/referrals';
import { getAllPublishedContent } from '@/lib/content';
import { success, handleApiError } from '@/lib/api/response';
import { enforceRateLimit } from '@/lib/api/rate-limit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    await enforceRateLimit(request, 'referrals.resolve');
    const { slug } = await params;
    const locale = (request.nextUrl.searchParams.get('locale') || 'tl') as 'en' | 'tl' | 'ceb';

    const validation = await validateReferralSlug(slug);

    if (!validation.valid) {
      // Safe fallback: return general landing content without attribution
      const content = await getAllPublishedContent(locale);
      return success({
        valid: false,
        reason: validation.reason,
        fallback: true,
        content,
        message: 'This referral link is no longer active. You can still learn about Safe Card.',
      });
    }

    // Valid referral — return campaign content with sponsor attribution
    const content = await getAllPublishedContent(locale);

    return success({
      valid: true,
      campaignId: validation.campaignId,
      sponsorDisplayName: validation.sponsorDisplayName,
      content,
      attribution: {
        notice: 'This link was shared by a sponsor to help you learn about Safe Card. Opening this page creates no obligation.',
      },
    });
  } catch (error) {
    return handleApiError(error, 'Referral slug resolution');
  }
}
