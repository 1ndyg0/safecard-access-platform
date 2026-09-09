import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceRateLimit } from '@/lib/api/rate-limit';
import { getSupabaseAdminClient } from '@/lib/db/client';
import { handleApiError } from '@/lib/api/response';

const eventSchema = z.object({
  event: z.enum(['benefit_opened', 'benefit_closed', 'story_completed', 'hotline_action_selected']),
  benefitId: z.enum(['ambulance', 'blood', 'hospital', 'exclusions']),
  locale: z.enum(['fil', 'en']),
  durationMs: z.number().int().min(0).max(3_600_000).optional(),
}).strict();

export async function POST(request: NextRequest) {
  try {
    await enforceRateLimit(request, 'analytics.storyboard', 120);
    const parsed = eventSchema.parse(await request.json());
    const { error } = await getSupabaseAdminClient().from('storyboard_events').insert({
      event_type: parsed.event,
      benefit_id: parsed.benefitId,
      locale: parsed.locale,
      duration_ms: parsed.durationMs ?? null,
      data_mode: process.env.LAUNCH_GATES_COMPLETE === 'true' ? 'live' : 'synthetic',
    });
    if (error) throw new Error(`Storyboard event could not be recorded: ${error.message}`);
    return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return handleApiError(error, 'Storyboard analytics');
  }
}
