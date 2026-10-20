/**
 * GET /api/content/storyboard
 *
 * Governed benefit storyboard content.
 *
 * This route does not fail when the content registry is unreachable. It
 * has safe, version-controlled fallback content, so returning 500 would
 * hide a working page behind an infrastructure problem the visitor can
 * do nothing about. The response says which content it is, and the UI
 * shows that to the ambassador.
 */

import { NextResponse } from 'next/server';
import { GovernedContentUnavailableError, loadStoryboard } from '@/lib/storyboard/governed';

export const dynamic = 'force-dynamic';

export async function GET(): Promise<NextResponse> {
  try {
    const { content, source, fallbackReason } = await loadStoryboard();

    return NextResponse.json(
      { content, source, fallbackReason: fallbackReason ?? null },
      {
        status: 200,
        headers: {
          // Public, non-personal content. A short cache keeps a slow
          // registry from being hit on every page view.
          'Cache-Control': 'public, max-age=60, stale-while-revalidate=600',
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof GovernedContentUnavailableError ? error.message : 'Governed benefit content is unavailable.' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
