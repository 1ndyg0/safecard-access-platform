export const ANALYTICS_SUPPRESSION_THRESHOLD = 5;

export type AnalyticsCase = {
  application_state: string;
  application_review_state: string;
  payment_state: string;
  prc_handoff_state: string;
  membership_state: string;
  created_at: string;
  updated_at: string;
};

function maskedCount(value: number, cohort: number) {
  if (cohort < ANALYTICS_SUPPRESSION_THRESHOLD) return null;
  return value > 0 && value < ANALYTICS_SUPPRESSION_THRESHOLD ? null : value;
}

function maskedRate(numerator: number, denominator: number) {
  if (denominator < ANALYTICS_SUPPRESSION_THRESHOLD || (numerator > 0 && numerator < ANALYTICS_SUPPRESSION_THRESHOLD)) return null;
  return denominator ? numerator / denominator : 0;
}

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function buildAdminAnalytics(cases: AnalyticsCase[], now = new Date()) {
  const submitted = cases.filter((item) => ['submitted', 'resubmitted'].includes(item.application_state));
  const approved = cases.filter((item) => item.application_review_state === 'approved');
  const paymentVerified = cases.filter((item) => item.payment_state === 'verified_by_official_source');
  const handoffReady = cases.filter((item) => item.prc_handoff_state === 'ready_for_export');
  const active = cases.filter((item) => item.membership_state === 'active_confirmed');
  const awaitingReview = submitted.filter((item) => item.application_review_state === 'pending');

  const trend = [30, 7].map((days) => {
    const points = Array.from({ length: days }, (_, index) => {
      const date = new Date(now);
      date.setUTCHours(0, 0, 0, 0);
      date.setUTCDate(date.getUTCDate() - (days - index - 1));
      const day = isoDay(date);
      const count = cases.filter((item) => item.created_at.slice(0, 10) === day).length;
      return { date: day, count: maskedCount(count, cases.length) };
    });
    return { days, points };
  });

  const ages = awaitingReview.map((item) => Math.max(0, now.getTime() - new Date(item.updated_at).getTime()));
  const dayMs = 86_400_000;
  const agingRaw = {
    under24Hours: ages.filter((age) => age < dayMs).length,
    oneToThreeDays: ages.filter((age) => age >= dayMs && age < dayMs * 3).length,
    overThreeDays: ages.filter((age) => age >= dayMs * 3).length,
  };

  return {
    suppressionThreshold: ANALYTICS_SUPPRESSION_THRESHOLD,
    cohortSize: cases.length,
    rates: {
      submittedPerStarted: maskedRate(submitted.length, cases.length),
      approvedPerSubmitted: maskedRate(approved.length, submitted.length),
      paymentVerifiedPerSubmitted: maskedRate(paymentVerified.length, submitted.length),
      activePerSubmitted: maskedRate(active.length, submitted.length),
    },
    aging: Object.fromEntries(Object.entries(agingRaw).map(([key, value]) => [key, maskedCount(value, awaitingReview.length)])),
    trend,
    summary: {
      awaitingReview: maskedCount(awaitingReview.length, cases.length),
      approved: maskedCount(approved.length, cases.length),
      paymentVerified: maskedCount(paymentVerified.length, cases.length),
      handoffReady: maskedCount(handoffReady.length, cases.length),
      active: maskedCount(active.length, cases.length),
    },
  };
}
