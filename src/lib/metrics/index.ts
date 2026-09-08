/**
 * Privacy-safe aggregate metrics service
 *
 * Allowed metrics (from spec):
 * - Referral visits
 * - Start rate
 * - Comprehension completion and pass rate
 * - Consent-to-submit rate
 * - Submitted-to-confirmed rate
 * - Time between major states
 * - Support categories
 * - Aggregate error rate
 *
 * Must NOT include: names, contact details, address, DOB,
 * free-text notes, consent responses, payment evidence details,
 * claims/medical information.
 *
 * Small-cohort suppression: if group < threshold, show "not enough data"
 */

import { getSupabaseAdminClient } from '@/lib/db/client';
import type { SupabaseClient } from '@supabase/supabase-js';

const SUPPRESSION_THRESHOLD = 5;

export interface CampaignMetrics {
  campaignId: string;
  date: string;
  referralVisits: number | null;
  casesStarted: number | null;
  comprehensionPassRate: number | null;
  consentToSubmitRate: number | null;
  submittedToConfirmedRate: number | null;
  supportCategoryCounts: Record<string, number> | null;
  isSuppressed: boolean;
}

/**
 * Calculate and store daily metrics for a campaign.
 */
export async function calculateDailyMetrics(campaignId: string): Promise<void> {
  const admin = getSupabaseAdminClient();
  const today = new Date().toISOString().split('T')[0];

  // Total referral visits
  const { data: referralData } = await admin
    .from('referral_links')
    .select('total_visits')
    .eq('campaign_id', campaignId);

  const totalVisits = referralData?.reduce((sum, r) => sum + (r.total_visits ?? 0), 0) ?? 0;

  await upsertMetric(admin, campaignId, today, 'referral_visits', totalVisits);

  // Cases started (all cases created)
  const { count: casesStarted } = await admin
    .from('recipient_cases')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId);

  await upsertMetric(admin, campaignId, today, 'cases_started', casesStarted ?? 0);

  // Comprehension pass rate
  const { data: comprehensionData } = await admin
    .from('application_submissions')
    .select('comprehension_passed, recipient_cases!inner(campaign_id)')
    .eq('is_current', true)
    .eq('recipient_cases.campaign_id', campaignId)
    .not('comprehension_passed', 'is', null);

  if (comprehensionData && comprehensionData.length >= SUPPRESSION_THRESHOLD) {
    const passed = comprehensionData.filter((s) => s.comprehension_passed).length;
    const rate = passed / comprehensionData.length;
    await upsertMetricRate(admin, campaignId, today, 'comprehension_pass_rate', rate, comprehensionData.length);
  } else {
    await upsertSuppressed(admin, campaignId, today, 'comprehension_pass_rate', comprehensionData?.length ?? 0);
  }

  // Consent-to-submit rate
  const { count: consented } = await admin
    .from('recipient_cases')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('consent_state', 'agreed');

  const { count: submitted } = await admin
    .from('recipient_cases')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .in('application_state', ['submitted', 'resubmitted']);

  const consentCount = consented ?? 0;
  const submitCount = submitted ?? 0;

  if (consentCount >= SUPPRESSION_THRESHOLD) {
    const rate = consentCount > 0 ? submitCount / consentCount : 0;
    await upsertMetricRate(admin, campaignId, today, 'consent_to_submit_rate', rate, consentCount);
  } else {
    await upsertSuppressed(admin, campaignId, today, 'consent_to_submit_rate', consentCount);
  }

  // Submitted-to-confirmed rate
  const { count: confirmed } = await admin
    .from('recipient_cases')
    .select('id', { count: 'exact', head: true })
    .eq('campaign_id', campaignId)
    .eq('membership_state', 'active_confirmed');

  if (submitCount >= SUPPRESSION_THRESHOLD) {
    const rate = submitCount > 0 ? (confirmed ?? 0) / submitCount : 0;
    await upsertMetricRate(admin, campaignId, today, 'submitted_to_confirmed_rate', rate, submitCount);
  } else {
    await upsertSuppressed(admin, campaignId, today, 'submitted_to_confirmed_rate', submitCount);
  }

  // Support category counts
  const { data: supportData } = await admin
    .from('support_cases')
    .select('category')
    .eq('campaign_id', campaignId);

  if (supportData && supportData.length > 0) {
    const counts: Record<string, number> = {};
    for (const sc of supportData) {
      counts[sc.category] = (counts[sc.category] ?? 0) + 1;
    }
    await upsertMetricJson(admin, campaignId, today, 'support_categories', counts, supportData.length);
  }
}

// ============================================================
// Metric upsert helpers
// ============================================================

async function upsertMetric(
  admin: SupabaseClient,
  campaignId: string,
  date: string,
  metricType: string,
  count: number,
): Promise<void> {
  await admin.rpc('upsert_metric', {
    p_campaign_id: campaignId,
    p_metric_date: date,
    p_metric_type: metricType,
    p_count: count,
    p_cohort_size: count,
    p_threshold: SUPPRESSION_THRESHOLD,
  });
}

async function upsertMetricRate(
  admin: SupabaseClient,
  campaignId: string,
  date: string,
  metricType: string,
  rate: number,
  cohortSize: number,
): Promise<void> {
  await admin.rpc('upsert_metric', {
    p_campaign_id: campaignId,
    p_metric_date: date,
    p_metric_type: metricType,
    p_rate: rate,
    p_cohort_size: cohortSize,
    p_threshold: SUPPRESSION_THRESHOLD,
  });
}

async function upsertMetricJson(
  admin: SupabaseClient,
  campaignId: string,
  date: string,
  metricType: string,
  jsonValue: Record<string, unknown>,
  cohortSize: number,
): Promise<void> {
  await admin.rpc('upsert_metric', {
    p_campaign_id: campaignId,
    p_metric_date: date,
    p_metric_type: metricType,
    p_json: jsonValue,
    p_cohort_size: cohortSize,
    p_threshold: SUPPRESSION_THRESHOLD,
  });
}

async function upsertSuppressed(
  admin: SupabaseClient,
  campaignId: string,
  date: string,
  metricType: string,
  cohortSize: number,
): Promise<void> {
  await admin.rpc('upsert_metric', {
    p_campaign_id: campaignId,
    p_metric_date: date,
    p_metric_type: metricType,
    p_cohort_size: cohortSize,
    p_threshold: SUPPRESSION_THRESHOLD,
  });
}

/**
 * Get metrics for a campaign (used by admin dashboard).
 */
export async function getCampaignMetrics(
  campaignId: string,
  fromDate?: string,
  toDate?: string,
): Promise<Record<string, unknown>[]> {
  const admin = getSupabaseAdminClient();

  let query = admin
    .from('aggregate_metrics')
    .select('metric_date, metric_type, count_value, rate_value, json_value, cohort_size, is_suppressed, suppression_threshold, created_at')
    .eq('campaign_id', campaignId)
    .order('metric_date', { ascending: false });

  if (fromDate) {
    query = query.gte('metric_date', fromDate);
  }
  if (toDate) {
    query = query.lte('metric_date', toDate);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to fetch metrics: ${error.message}`);
  }

  // Replace suppressed values with "not enough data"
  return (data ?? []).map((m) => ({
    ...m,
    count_value: m.is_suppressed ? null : m.count_value,
    rate_value: m.is_suppressed ? null : m.rate_value,
    json_value: m.is_suppressed ? null : m.json_value,
    display_note: m.is_suppressed ? 'Not enough data to display' : null,
  }));
}
