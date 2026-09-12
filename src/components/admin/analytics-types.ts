/**
 * Shapes returned by public.admin_campaign_analytics.
 *
 * Every measure is a discriminated result rather than a bare number, so
 * a suppressed cohort, an absent data source and a real zero stay
 * distinguishable all the way to the screen. Collapsing them into `0`
 * is how a dashboard starts lying.
 */

export type MeasureUnavailableReason =
  | "no_data"
  | "cohort_below_threshold"
  | "no_application_review_state"
  | "no_upload_telemetry"
  | "not_in_schema";

export type RateMeasure =
  | { available: true; suppressed: false; rate: number; cohort_size: number }
  | { available: false; suppressed: boolean; reason: MeasureUnavailableReason };

export type CountMeasure =
  | { available: true; suppressed: false; count: number }
  | { available: false; suppressed: boolean; reason: MeasureUnavailableReason };

export type HoursMeasure =
  | { available: true; suppressed: false; hours: number; cohort_size: number }
  | { available: false; suppressed: boolean; reason: MeasureUnavailableReason };

export interface AdminAnalytics {
  funnel: {
    started_to_submitted: RateMeasure;
    submitted_to_approved: RateMeasure;
    submitted_to_payment_verified: RateMeasure;
    submitted_to_active: RateMeasure;
  };
  review_aging: {
    under_24h: CountMeasure;
    one_to_three_days: CountMeasure;
    over_three_days: CountMeasure;
  };
  intake_trend: {
    last_7_days: CountMeasure;
    last_30_days: CountMeasure;
  };
  turnaround_hours: {
    application_review: HoursMeasure;
    payment_review: HoursMeasure;
  };
  evidence: {
    replacement_rate: RateMeasure;
    upload_success_rate: RateMeasure;
  };
  storyboard: CountMeasure;
  hotline_actions: CountMeasure;
  suppression_threshold: number;
}

/** Human-readable explanation for a measure that cannot be shown. */
export function unavailableLabel(reason: MeasureUnavailableReason, threshold: number): string {
  switch (reason) {
    case "cohort_below_threshold":
      return `Hidden — fewer than ${threshold} cases`;
    case "no_data":
      return "No data yet";
    case "no_application_review_state":
      return "Not tracked yet — awaiting application review states";
    case "no_upload_telemetry":
      return "Not tracked yet — no upload telemetry";
    case "not_in_schema":
      return "Not tracked yet";
    default:
      return "Not available";
  }
}

export function formatRate(measure: RateMeasure, threshold: number): string {
  return measure.available
    ? `${(measure.rate * 100).toFixed(1)}%`
    : unavailableLabel(measure.reason, threshold);
}

export function formatCount(measure: CountMeasure, threshold: number): string {
  return measure.available
    ? String(measure.count)
    : unavailableLabel(measure.reason, threshold);
}

export function formatHours(measure: HoursMeasure, threshold: number): string {
  return measure.available
    ? `${measure.hours.toFixed(1)} h`
    : unavailableLabel(measure.reason, threshold);
}
