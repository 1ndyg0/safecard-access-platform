"use client";

/**
 * Dashboard: how many applications are waiting, approved and rejected, and
 * one clear way into the list. Every number comes from the server for the
 * selected campaign; nothing is hard-coded.
 */

import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { readJson, useAsyncLoad } from "@/components/admin/use-async-load";

type Campaign = { id: string; name: string; is_active: boolean };

type Overview = {
  user: { full_name: string; email: string } | null;
  campaigns: Campaign[];
  selectedCampaignId: string | null;
  counts: { awaiting_review: number; approved: number; rejected: number; total: number };
};

export function AdminDashboard() {
  const router = useRouter();
  const [overview, setOverview] = useState<Overview | null>(null);
  /** The reviewer's explicit choice. Empty means "whatever the server picks". */
  const [chosenCampaignId, setChosenCampaignId] = useState("");

  const loader = useCallback(
    async (isActive: () => boolean) => {
      const query = chosenCampaignId ? `?campaign_id=${encodeURIComponent(chosenCampaignId)}` : "";
      const response = await fetch(`/api/admin/overview${query}`, { cache: "no-store" });
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const body: Overview = await readJson(response, "Unable to load the dashboard.");
      if (!isActive()) return;
      setOverview(body);
    },
    [chosenCampaignId, router],
  );

  const { status, error, reload } = useAsyncLoad(loader, "Unable to load the dashboard.");
  const selectedCampaignId = overview?.selectedCampaignId ?? "";
  const campaignQuery = selectedCampaignId ? `&campaign_id=${selectedCampaignId}` : "";
  const counts = overview?.counts;

  return (
    <AdminShell>
      <header className="admin-heading">
        <div>
          <p className="eyebrow">Administration</p>
          <h1>{overview?.user ? `Welcome, ${overview.user.full_name}` : "Overview"}</h1>
        </div>
        {overview && overview.campaigns.length > 1 && (
          <div className="field-block compact">
            <label htmlFor="campaign-selector">Campaign</label>
            <select
              id="campaign-selector"
              value={chosenCampaignId || selectedCampaignId}
              onChange={(event) => setChosenCampaignId(event.target.value)}
            >
              {overview.campaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                  {campaign.is_active ? "" : " (inactive)"}
                </option>
              ))}
            </select>
          </div>
        )}
      </header>

      <div aria-live="polite" role="status">
        {status === "loading" && <p className="form-message">Loading…</p>}
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

      {status === "ready" && counts && overview?.selectedCampaignId && (
        <>
          <ul className="count-grid" aria-label="Applications by status">
            <li>
              <Link className="count-card count-card-primary" href={`/admin/applications?status=awaiting_review${campaignQuery}`}>
                <span className="count-label">Awaiting review</span>
                <strong className="count-value" data-testid="count-awaiting_review">{counts.awaiting_review}</strong>
                <span className="count-hint">Need a decision</span>
              </Link>
            </li>
            <li>
              <Link className="count-card" href={`/admin/applications?status=approved${campaignQuery}`}>
                <span className="count-label">Approved</span>
                <strong className="count-value" data-testid="count-approved">{counts.approved}</strong>
                <span className="count-hint">Payment verified</span>
              </Link>
            </li>
            <li>
              <Link className="count-card" href={`/admin/applications?status=rejected${campaignQuery}`}>
                <span className="count-label">Rejected</span>
                <strong className="count-value" data-testid="count-rejected">{counts.rejected}</strong>
                <span className="count-hint">Applicant was told why</span>
              </Link>
            </li>
          </ul>

          <p className="count-total">
            <span data-testid="count-total">{counts.total}</span> complete application{counts.total === 1 ? "" : "s"} received in total.
          </p>

          <Link className="button-primary admin-cta" href={`/admin/applications?status=awaiting_review${campaignQuery}`}>
            Review applications →
          </Link>
        </>
      )}
    </AdminShell>
  );
}
