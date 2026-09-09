"use client";

/**
 * Campaign analytics.
 *
 * The review-aging bars are decorative: they are marked aria-hidden and
 * the same figures are published as a real table underneath, so a
 * screen-reader user reads the numbers rather than being told there is
 * a chart they cannot see. The table is visible to everyone — a sighted
 * reader checking an exact value should not have to hover a bar.
 */

import {
  type AdminAnalytics,
  type CountMeasure,
  formatCount,
  formatHours,
  formatRate,
} from "@/components/admin/analytics-types";

function agingValue(measure: CountMeasure): number | null {
  return measure.available ? measure.count : null;
}

export function AnalyticsPanel({ analytics }: { analytics: AdminAnalytics | null }) {
  if (!analytics) return null;
  const threshold = analytics.suppression_threshold;

  const agingRows = [
    { label: "Under 24 hours", measure: analytics.review_aging.under_24h },
    { label: "1–3 days", measure: analytics.review_aging.one_to_three_days },
    { label: "Over 3 days", measure: analytics.review_aging.over_three_days },
  ];
  const agingMax = Math.max(
    1,
    ...agingRows.map((row) => agingValue(row.measure) ?? 0),
  );

  const funnelRows = [
    { label: "Started → submitted", measure: analytics.funnel.started_to_submitted },
    { label: "Submitted → approved", measure: analytics.funnel.submitted_to_approved },
    {
      label: "Submitted → payment verified",
      measure: analytics.funnel.submitted_to_payment_verified,
    },
    { label: "Submitted → active", measure: analytics.funnel.submitted_to_active },
    { label: "Evidence replacement", measure: analytics.evidence.replacement_rate },
    { label: "Upload success", measure: analytics.evidence.upload_success_rate },
  ];

  return (
    <section className="analytics-section">
      <h2 className="section-title">Analytics</h2>
      <p className="muted-note">
        Cohorts smaller than {threshold} are hidden, including their complements, so a
        suppressed group cannot be recovered by subtraction.
      </p>

      <h3 className="subsection-title">Conversion</h3>
      <div className="table-wrap">
        <table className="admin-table">
          <caption className="visually-hidden">
            Conversion rates for the selected campaign
          </caption>
          <thead>
            <tr>
              <th scope="col">Measure</th>
              <th scope="col">Rate</th>
              <th scope="col">Cohort</th>
            </tr>
          </thead>
          <tbody>
            {funnelRows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                <td>{formatRate(row.measure, threshold)}</td>
                <td>{row.measure.available ? row.measure.cohort_size : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="subsection-title">Review aging</h3>
      <div className="aging-chart" aria-hidden="true">
        {agingRows.map((row) => {
          const value = agingValue(row.measure);
          return (
            <div className="aging-bar" key={row.label}>
              <span className="aging-bar-label">{row.label}</span>
              <span className="aging-bar-track">
                <span
                  className="aging-bar-fill"
                  style={{ width: value === null ? "0%" : `${(value / agingMax) * 100}%` }}
                />
              </span>
              <span className="aging-bar-value">
                {value === null ? "—" : value}
              </span>
            </div>
          );
        })}
      </div>
      <div className="table-wrap">
        <table className="admin-table">
          <caption>Cases awaiting review, by how long they have been waiting</caption>
          <thead>
            <tr>
              <th scope="col">Waiting</th>
              <th scope="col">Cases</th>
            </tr>
          </thead>
          <tbody>
            {agingRows.map((row) => (
              <tr key={row.label}>
                <th scope="row">{row.label}</th>
                <td>{formatCount(row.measure, threshold)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="subsection-title">Throughput</h3>
      <div className="table-wrap">
        <table className="admin-table">
          <caption className="visually-hidden">
            Intake, turnaround and support volume
          </caption>
          <thead>
            <tr>
              <th scope="col">Measure</th>
              <th scope="col">Value</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <th scope="row">Intake, last 7 days</th>
              <td>{formatCount(analytics.intake_trend.last_7_days, threshold)}</td>
            </tr>
            <tr>
              <th scope="row">Intake, last 30 days</th>
              <td>{formatCount(analytics.intake_trend.last_30_days, threshold)}</td>
            </tr>
            <tr>
              <th scope="row">Application review turnaround</th>
              <td>{formatHours(analytics.turnaround_hours.application_review, threshold)}</td>
            </tr>
            <tr>
              <th scope="row">Payment review turnaround</th>
              <td>{formatHours(analytics.turnaround_hours.payment_review, threshold)}</td>
            </tr>
            <tr>
              <th scope="row">Storyboard opens and completions</th>
              <td>{formatCount(analytics.storyboard, threshold)}</td>
            </tr>
            <tr>
              <th scope="row">Hotline 143 actions</th>
              <td>{formatCount(analytics.hotline_actions, threshold)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
