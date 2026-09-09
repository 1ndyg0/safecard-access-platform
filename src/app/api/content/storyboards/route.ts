import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceRateLimit } from '@/lib/api/rate-limit';
import { getStoryboardContent } from '@/lib/storyboard-content';
import { handleApiError } from '@/lib/api/response';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await enforceRateLimit(request, 'content.storyboards', 60);
    const locale = z.enum(['fil', 'en']).catch('fil').parse(request.nextUrl.searchParams.get('locale') ?? 'fil');
    const result = await getStoryboardContent(locale);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } });
  } catch (error) {
    return handleApiError(error, 'Storyboard content');
  }
}
