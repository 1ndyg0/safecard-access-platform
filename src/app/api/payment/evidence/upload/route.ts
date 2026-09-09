import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

/**
 * The legacy multipart endpoint is intentionally disabled. Receipt images go
 * directly to a unique signed path in private Supabase Storage, then the BFF
 * validates and finalizes them. This keeps large bodies out of Vercel Functions.
 */
export async function POST() {
  return NextResponse.json({
    error: 'This upload method is no longer supported. Refresh the page and try again.',
  }, { status: 410, headers: { 'Cache-Control': 'no-store' } });
}
