/**
 * GET /api/jobs/cron
 *
 * Vercel cron endpoint that triggers job processing.
 * Configured in vercel.json with the desired schedule.
 *
 * This is the trigger only — durable job state lives in the database.
 * A cron trigger alone is not proof a job happened exactly once.
 */

import { NextRequest, NextResponse } from 'next/server';
import { processJobs, enqueueJob } from '@/lib/jobs';

export async function GET(request: NextRequest) {
  // Verify this is from Vercel cron (CRON_SECRET header)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const workerId = `cron-${Date.now()}`;

    // Enqueue periodic maintenance jobs if not already queued
    const now = new Date();
    const today = now.toISOString().split('T')[0];

    await enqueueJob({
      jobType: 'check_content_expiry',
      idempotencyKey: `content-expiry-${today}`,
    });

    await enqueueJob({
      jobType: 'deactivate_expired_referrals',
      idempotencyKey: `expired-referrals-${today}`,
    });

    await enqueueJob({
      jobType: 'release_stale_locks',
      idempotencyKey: `stale-locks-${today}-${now.getHours()}`,
    });

    await enqueueJob({
      jobType: 'aggregate_metrics',
      idempotencyKey: `metrics-${today}`,
    });

    // Process all pending jobs
    const result = await processJobs(workerId);

    return NextResponse.json({
      ok: true,
      processed: result.processed,
      failed: result.failed,
      worker: workerId,
    });
  } catch (error) {
    console.error('[CRON] Job processing error:', error);
    return NextResponse.json(
      { error: 'Job processing failed' },
      { status: 500 }
    );
  }
}
