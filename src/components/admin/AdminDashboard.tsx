"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";

type Trend = { days: number; points: Array<{ date: string; count: number | null }> };
type Analytics = {
  suppressionThreshold: number;
  cohortSize: number;
  rates: Record<string, number | null>;
  aging: Record<string, number | null>;
  trend: Trend[];
};
type Overview = {
  user: { full_name: string; email: string };
  roles: string[];
  campaigns: Array<{ id: string; name: string; is_active: boolean; max_applications: number }>;
  selectedCampaignId: string | null;
  metrics: Record<string, number>;
  analytics: Analytics;
};

const metricDefinitions = [
  ["Total cases", "cases"], ["Draft / incomplete", "drafts"], ["Submitted", "submitted"], ["Awaiting review", "awaitingReview"],
  ["Correction requested", "correction"], ["Payment evidence pending", "paymentPending"], ["Payment verified", "paymentVerified"],
  ["Ready for PRC handoff", "readyForHandoff"], ["Sent / acknowledged", "sentToPrc"], ["PRC-confirmed active", "active"], ["PRC-declined", "declined"],
] as const;

const rateLabels: Record<string, string> = {
  submittedPerStarted: "Started → submitted",
  approvedPerSubmitted: "Submitted → approved",
  paymentVerifiedPerSubmitted: "Submitted → payment verified",
  activePerSubmitted: "Submitted → PRC active",
};

export function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<Overview>();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load(campaignId?: string) {
    setLoading(true);
    setError("");
    try {
      const query = campaignId ? `?campaign_id=${encodeURIComponent(campaignId)}` : "";
      const response = await fetch(`/api/admin/overview${query}`, { cache: "no-store" });
      const body = await response.json();
      if (response.status === 401) { router.replace("/admin/login"); return; }
      if (!response.ok) throw new Error(body.error);
      setData(body);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = data?.campaigns.find((campaign) => campaign.id === data.selectedCampaignId);
  const trend = data?.analytics.trend.find((item) => item.days === 30);

  return <AdminShell>
    <header className="admin-heading">
      <div><p className="eyebrow">Operations console</p><h1>{data ? `Welcome, ${data.user.full_name}` : "SafeCard pilot"}</h1></div>
      <span className="status-pill">Controlled pilot</span>
    </header>
    {error && <p className="form-message error" role="alert">{error}</p>}
    <section className="admin-toolbar" aria-label="Campaign controls">
      <label><span>Campaign</span><select value={data?.selectedCampaignId ?? ""} disabled={loading} onChange={(event) => void load(event.target.value)}>{data?.campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}</select></label>
      <p>Operational counts are exact for authorized staff. Analytics below suppress groups smaller than {data?.analytics.suppressionThreshold ?? 5}.</p>
    </section>
    <div className="metric-grid">{metricDefinitions.map(([label, key]) => <article key={key}><span>{label}</span><strong>{loading ? "…" : (data?.metrics[key] ?? "—")}</strong></article>)}</div>
    <div className="analytics-grid">
      <section className="admin-panel stack">
        <div><p className="eyebrow">30-day intake trend</p><h2>Applications started by day</h2></div>
        <TrendChart trend={trend} />
      </section>
      <section className="admin-panel stack">
        <div><p className="eyebrow">Conversion health</p><h2>Privacy-safe rates</h2></div>
        <dl className="analytics-list">{Object.entries(data?.analytics.rates ?? {}).map(([key, value]) => <div key={key}><dt>{rateLabels[key] ?? key}</dt><dd>{value === null ? "Not enough data" : `${Math.round(value * 100)}%`}</dd></div>)}</dl>
      </section>
      <section className="admin-panel stack">
        <div><p className="eyebrow">Review aging</p><h2>Time awaiting staff action</h2></div>
        <dl className="analytics-list">
          <div><dt>Under 24 hours</dt><dd>{displayCount(data?.analytics.aging.under24Hours)}</dd></div>
          <div><dt>1–3 days</dt><dd>{displayCount(data?.analytics.aging.oneToThreeDays)}</dd></div>
          <div><dt>Over 3 days</dt><dd>{displayCount(data?.analytics.aging.overThreeDays)}</dd></div>
        </dl>
      </section>
    </div>
    <section className="admin-panel">
      <div><p className="eyebrow">Current campaign</p><h2>{selected?.name ?? "No assigned campaign"}</h2><p>Roles: {data?.roles.join(", ") || "—"}</p></div>
      <div className="admin-panel-actions">{data?.selectedCampaignId && <Link className="button-primary" href={`/admin/submissions?campaign_id=${data.selectedCampaignId}`}>Open submission queue →</Link>}<Link className="button-quiet" href="/admin/users">Manage access</Link></div>
    </section>
  </AdminShell>;
}

function displayCount(value: number | null | undefined) {
  return value === null || value === undefined ? "Not enough data" : String(value);
}

function TrendChart({ trend }: { trend?: Trend }) {
  if (!trend) return <p className="empty-state">Loading trend…</p>;
  const visible = trend.points.filter((point) => point.count !== null);
  const max = Math.max(1, ...visible.map((point) => point.count ?? 0));
  return <div>
    <div className="trend-chart" aria-hidden="true">{trend.points.map((point) => <span key={point.date} style={{ height: point.count === null ? "8%" : `${Math.max(8, ((point.count ?? 0) / max) * 100)}%` }} data-suppressed={point.count === null} title={`${point.date}: ${point.count ?? "suppressed"}`} />)}</div>
    <p className="content-footnote">Daily values below the privacy threshold are suppressed.</p>
    <table className="sr-only"><caption>Thirty-day applications-started trend</caption><thead><tr><th>Date</th><th>Applications</th></tr></thead><tbody>{trend.points.map((point) => <tr key={point.date}><td>{point.date}</td><td>{point.count ?? "Not enough data"}</td></tr>)}</tbody></table>
  </div>;
}
