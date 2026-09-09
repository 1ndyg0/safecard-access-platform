"use client";

/**
 * Operations dashboard.
 *
 * Every number here is fetched from the server for the selected
 * campaign. Nothing is hard-coded, and a value the platform cannot
 * compute says so rather than rendering a zero that reads as a fact.
 */

import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { AnalyticsPanel } from "@/components/admin/AnalyticsPanel";
import { readJson, useAsyncLoad } from "@/components/admin/use-async-load";
import type { AdminAnalytics } from "@/components/admin/analytics-types";

type Campaign = { id: string; name: string; is_active: boolean };

type Overview = {
  user: { full_name: string; email: string } | null;
  roles: string[];
  campaigns: Campaign[];
  selectedCampaignId: string | null;
  counts: Record<string, number>;
};

/** Order and labels for the eleven operational counts. */
const COUNT_CARDS: Array<{ key: string; label: string }> = [
  { key: "total_cases", label: "Total cases" },
  { key: "draft_or_incomplete", label: "Draft or incomplete" },
  { key: "submitted", label: "Submitted" },
  { key: "awaiting_application_review", label: "Awaiting application review" },
  { key: "correction_requested", label: "Correction requested" },
  { key: "payment_evidence_pending", label: "Payment evidence pending" },
  { key: "payment_verified", label: "Payment verified" },
  { key: "ready_for_prc_handoff", label: "Ready for PRC handoff" },
  { key: "sent_or_acknowledged_by_prc", label: "Sent to or acknowledged by PRC" },
  { key: "prc_confirmed_active", label: "PRC-confirmed active" },
  { key: "prc_declined", label: "PRC-declined" },
];

export function AdminDashboard() {
  const router = useRouter();
  const [overview, setOverview] = useState<Overview | null>(null);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  /** The reviewer's explicit choice. Empty means "whatever the server picks". */
  const [chosenCampaignId, setChosenCampaignId] = useState("");

  const loader = useCallback(
    async (isActive: () => boolean) => {
      const query = chosenCampaignId
        ? `?campaign_id=${encodeURIComponent(chosenCampaignId)}`
        : "";
      const response = await fetch(`/api/admin/overview${query}`, { cache: "no-store" });
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const body: Overview = await readJson(response, "Unable to load the dashboard.");
      if (!isActive()) return;
      setOverview(body);

      if (!body.selectedCampaignId) {
        setAnalytics(null);
        return;
      }
      const analyticsResponse = await fetch(
        `/api/admin/analytics?campaign_id=${encodeURIComponent(body.selectedCampaignId)}`,
        { cache: "no-store" },
      );
      const analyticsBody = await readJson(analyticsResponse, "Unable to load analytics.");
      if (!isActive()) return;
      setAnalytics(analyticsBody.analytics);
    },
    [chosenCampaignId, router],
  );

  const { status, error, reload } = useAsyncLoad(loader, "Unable to load the dashboard.");
  const selectedCampaignId = overview?.selectedCampaignId ?? "";

  return (
    <AdminShell>
      <header className="admin-heading">
        <div>
          <p className="eyebrow">Operations console</p>
          <h1>{overview?.user ? `Welcome, ${overview.user.full_name}` : "SafeCard pilot"}</h1>
          <p className="muted-note">Roles: {overview?.roles.join(", ") || "—"}</p>
        </div>
        <div className="field-block compact">
          <label htmlFor="campaign-selector">Campaign</label>
          <select
            id="campaign-selector"
            value={chosenCampaignId || selectedCampaignId}
            onChange={(event) => setChosenCampaignId(event.target.value)}
            disabled={!overview || overview.campaigns.length === 0}
          >
            {overview && overview.campaigns.length === 0 && (
              <option value="">No campaigns</option>
            )}
            {(overview?.campaigns ?? []).map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
                {campaign.is_active ? "" : " (inactive)"}
              </option>
            ))}
          </select>
        </div>
      </header>

      {/* Status is announced rather than silently swapped in. */}
      <div aria-live="polite" role="status">
        {status === "loading" && <p className="form-message">Loading dashboard…</p>}
        {status === "error" && (
          <p className="form-message error">
            {error}{" "}
            <button type="button" className="link-button" onClick={reload}>
              Try again
            </button>
          </p>
        )}
      </div>

      {status === "ready" && overview && !overview.selectedCampaignId && (
        <p className="empty-state">
          No campaign is assigned to this account. Ask a privacy administrator for a
          campaign-scoped role.
        </p>
      )}

      {status === "ready" && overview?.selectedCampaignId && (
        <>
          <h2 className="section-title">Operational counts</h2>
          <div className="metric-grid metric-grid-wide">
            {COUNT_CARDS.map((card) => (
              <article key={card.key}>
                <span>{card.label}</span>
                <strong>{overview.counts[card.key] ?? 0}</strong>
              </article>
            ))}
          </div>

          <AnalyticsPanel analytics={analytics} />

          <section className="admin-panel">
            <div>
              <p className="eyebrow">Next step</p>
              <h2>Work the submission queue</h2>
              <p className="muted-note">
                Filter by any single workflow state, or sort by longest waiting to reach the
                cases that have been waiting on review the longest.
              </p>
            </div>
            <Link
              className="button-primary"
              href={`/admin/submissions?campaign_id=${overview.selectedCampaignId}`}
            >
              Open submission queue →
            </Link>
          </section>
        </>
      )}
    </AdminShell>
  );
}
