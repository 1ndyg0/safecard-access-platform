/**
 * Background job queue service
 *
 * Durable, database-backed job queue.
 * Vercel cron triggers execution; durable state is in the database.
 *
 * Job types:
 * - send_notification: Send SMS/email notifications (if approved)
 * - aggregate_metrics: Calculate daily privacy-safe metrics
 * - check_content_expiry: Expire stale content, alert on upcoming expiry
 * - deactivate_expired_referrals: Clean up expired referral links
 * - release_stale_locks: Recover jobs stuck in 'running' state
 */

import { getSupabaseAdminClient } from '@/lib/db/client';
import { checkContentExpiry } from '@/lib/content';
import { deactivateExpiredLinks } from '@/lib/referrals';
import { calculateDailyMetrics } from '@/lib/metrics';
import { cleanupExpiredPaymentUploads, purgeDuePaymentEvidence } from '@/lib/payment/evidence';
import { v4 as uuidv4 } from 'uuid';

// ============================================================
// Enqueue a job
// ============================================================

export interface EnqueueJobInput {
  jobType: string;
  payload?: Record<string, unknown>;
  scheduledFor?: Date;
  campaignId?: string;
  caseId?: string;
  idempotencyKey?: string;
  maxAttempts?: number;
}

export async function enqueueJob(input: EnqueueJobInput): Promise<string> {
  const admin = getSupabaseAdminClient();

  // Idempotency check
  if (input.idempotencyKey) {
    const { data: existing } = await admin
      .from('jobs')
      .select('id')
      .eq('idempotency_key', input.idempotencyKey)
      .maybeSingle();

    if (existing) return existing.id;
  }

  const jobId = uuidv4();

  const { error } = await admin.from('jobs').insert({
    id: jobId,
    job_type: input.jobType,
    status: 'pending',
    payload: input.payload ?? {},
    scheduled_for: (input.scheduledFor ?? new Date()).toISOString(),
    campaign_id: input.campaignId ?? null,
    case_id: input.caseId ?? null,
    idempotency_key: input.idempotencyKey ?? null,
    max_attempts: input.maxAttempts ?? 3,
  });

  if (error) {
    throw new Error(`Failed to enqueue job: ${error.message}`);
  }

  return jobId;
}

// ============================================================
// Process pending jobs (called by Vercel cron)
// ============================================================

export async function processJobs(workerId: string): Promise<{
  processed: number;
  failed: number;
}> {
  const admin = getSupabaseAdminClient();
  let processed = 0;
  let failed = 0;

  // Process up to 10 jobs per invocation
  for (let i = 0; i < 10; i++) {
    // Acquire a job using the database function
    const { data: jobs } = await admin.rpc('acquire_job', {
      p_job_type: null,
      p_worker_id: workerId,
      p_lock_duration: '5 minutes',
    });

    if (!jobs || jobs.length === 0) break;

    const job = jobs[0];

    try {
      await executeJob(job.job_type, job.payload, job.id);

      await admin.rpc('complete_job', {
        p_job_id: job.id,
        p_result: { completed_by: workerId },
      });

      processed++;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      await admin.rpc('fail_job', {
        p_job_id: job.id,
        p_error: errorMessage,
      });

      failed++;
    }
  }

  return { processed, failed };
}

// ============================================================
// Job execution dispatcher
// ============================================================

async function executeJob(
  jobType: string,
  payload: Record<string, unknown>,
  jobId: string,
): Promise<void> {
  switch (jobType) {
    case 'check_content_expiry':
      await checkContentExpiry();
      break;

    case 'deactivate_expired_referrals':
      await deactivateExpiredLinks();
      break;

    case 'release_stale_locks': {
      const admin = getSupabaseAdminClient();
      await admin.rpc('release_stale_locks');
      break;
    }

    case 'aggregate_metrics': {
      const admin = getSupabaseAdminClient();
      const { data: campaigns, error } = await admin
        .from('pilot_campaigns')
        .select('id')
        .eq('is_active', true);
      if (error) throw new Error(`Failed to load active campaigns: ${error.message}`);
      for (const campaign of campaigns ?? []) {
        await calculateDailyMetrics(campaign.id);
      }
      break;
    }

    case 'cleanup_payment_uploads':
      await cleanupExpiredPaymentUploads();
      break;

    case 'purge_payment_evidence':
      await purgeDuePaymentEvidence(jobId);
      break;

    case 'send_notification':
      throw new Error(`Notification provider is not configured for job ${jobId}`);

    default:
      throw new Error(`Unknown job type: ${jobType}`);
  }
}
