/**
 * POST /api/analytics/storyboard
 *
 * Collect benefit storyboard telemetry.
 *
 * Returns 204 with no body. Telemetry is fire-and-forget by design: the
 * page must never wait on it, and there is nothing useful to tell a
 * visitor about an analytics write.
 *
 * Invalid events are rejected rather than coerced. A batch containing
 * one bad event is refused whole, so a malformed client cannot half-log.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { enforceRateLimit, RateLimitError } from '@/lib/api/rate-limit';
import { storyboardEventBatchSchema } from '@/lib/storyboard/events';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Generous enough for real reading, tight enough that the endpoint
    // is not a free write channel.
    await enforceRateLimit(request, 'storyboard-analytics', 60, 300);
  } catch (error) {
    if (error instanceof RateLimitError) {
      return new NextResponse(null, { status: 429 });
    }
    // The limiter itself failed — its backing store is unreachable. That
    // must not disable input validation: returning early here would mean
    // a limiter outage silently accepts anything a client sends. Fall
    // through and validate; only the write below is best-effort.
  }

  const parsed = storyboardEventBatchSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid analytics payload.' }, { status: 400 });
  }

  try {
    await getSupabaseAdminClient()
      .from('storyboard_events')
      .insert(
        parsed.data.events.map((event) => ({
          benefit_id: event.benefit_id,
          event_name: event.event_name,
          locale: event.locale,
          duration_ms: event.duration_ms ?? null,
          visit_id: event.visit_id,
        })),
      );
  } catch {
    // A telemetry failure is never the visitor's problem.
  }

  return new NextResponse(null, { status: 204 });
}
