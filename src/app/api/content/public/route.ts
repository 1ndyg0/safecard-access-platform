/**
 * GET /api/content/public?locale=tl&type=benefit
 *
 * Public endpoint — returns approved, published content.
 * No authentication required. Used by landing page, benefit
 * cards, consent forms, and education screens.
 *
 * Query params:
 * - locale: 'en' | 'tl' | 'ceb' (default: 'tl')
 * - type: content type filter (optional, returns all if omitted)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPublishedContent, getAllPublishedContent } from '@/lib/content';
import type { ContentType } from '@/types/database';
import { enforceRateLimit } from '@/lib/api/rate-limit';
import { handleApiError } from '@/lib/api/response';

const VALID_TYPES: ContentType[] = [
  'benefit', 'exclusion', 'eligibility', 'privacy_notice',
  'consent_text', 'support_text', 'claims_education', 'faq',
  'sponsor_briefing', 'invitation_script',
];

const VALID_LOCALES = ['en', 'tl', 'ceb'] as const;

export async function GET(request: NextRequest) {
  try {
    await enforceRateLimit(request, 'content.public', 60);
    const locale = (request.nextUrl.searchParams.get('locale') || 'tl') as typeof VALID_LOCALES[number];
    const type = request.nextUrl.searchParams.get('type') as ContentType | null;

    if (!VALID_LOCALES.includes(locale)) {
      return NextResponse.json(
        { error: 'Invalid locale. Use: en, tl, or ceb' },
        { status: 400 }
      );
    }

    if (type) {
      if (!VALID_TYPES.includes(type)) {
        return NextResponse.json(
          { error: `Invalid content type. Valid types: ${VALID_TYPES.join(', ')}` },
          { status: 400 }
        );
      }

      const content = await getPublishedContent(type, locale);
      if (!content) {
        return NextResponse.json(
          { error: 'Content not found or not yet approved' },
          { status: 404 }
        );
      }

      return NextResponse.json({ content });
    }

    // Return all published content for the locale
    const allContent = await getAllPublishedContent(locale);

    return NextResponse.json({
      content: allContent,
      locale,
      count: allContent.length,
    });
  } catch (error) {
    return handleApiError(error, 'Public content fetch');
  }
}
