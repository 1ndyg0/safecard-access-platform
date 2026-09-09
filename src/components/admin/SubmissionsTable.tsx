"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";

type CaseRow = {
  id: string;
  application_ref: string | null;
  application_state: string;
  payment_state: string;
  prc_handoff_state: string;
  membership_state: string;
  created_at: string;
};

type Pagination = {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
};

export function SubmissionsTable() {
  const params = useSearchParams();
  const router = useRouter();
  const [campaignId, setCampaignId] = useState(params.get("campaign_id") ?? "");
  const [rows, setRows] = useState<CaseRow[]>([]);
  const [state, setState] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 25, total: 0, totalPages: 1 });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError("");
      let selected = campaignId;
      if (!selected) {
        const overview = await fetch("/api/admin/overview", { cache: "no-store" });
        if (overview.status === 401) {
          router.replace("/admin/login");
          return;
        }
        const data = await overview.json();
        selected = data.selectedCampaignId ?? "";
        setCampaignId(selected);
      }
      if (!selected) {
        setError("No campaign is assigned to this account.");
        setLoading(false);
        return;
      }
      const queryParams = new URLSearchParams({
        campaign_id: selected,
        page: page.toString(),
        limit: "25",
      });
      if (state) queryParams.set("state", state);
      if (search.trim()) queryParams.set("search", search.trim());

      const response = await fetch(`/api/admin/cases?${queryParams.toString()}`, { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to fetch submissions");
      setRows(data.cases ?? []);
      if (data.pagination) setPagination(data.pagination);
    }
    load()
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load."))
      .finally(() => setLoading(false));
  }, [campaignId, page, router, search, state]);

  return (
    <AdminShell>
      <header className="admin-heading">
        <div>
          <p className="eyebrow">Privacy-controlled queue</p>
          <h1>Submissions</h1>
        </div>
        <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
          <input
            type="text"
            placeholder="Search Reference (e.g. SC-2026)..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            aria-label="Search by Reference"
            style={{ padding: "0.5rem 0.75rem", borderRadius: "0.375rem", border: "1px solid var(--border)", background: "var(--card)" }}
          />
          <select
            aria-label="Filter by state"
            value={state}
            onChange={(event) => {
              setState(event.target.value);
              setPage(1);
            }}
            style={{ padding: "0.5rem 0.75rem", borderRadius: "0.375rem", border: "1px solid var(--border)", background: "var(--card)" }}
          >
            <option value="">All states</option>
            <option value="submitted">Submitted</option>
            <option value="correction_needed">Correction needed</option>
            <option value="official_handoff_opened">Payment Handoff Opened</option>
            <option value="payer_marked_paid">Payer Marked Paid</option>
            <option value="verified_by_official_source">Payment Verified</option>
            <option value="ready_for_export">Ready for PRC Export</option>
            <option value="exported">Exported to PRC</option>
            <option value="active_confirmed">PRC-confirmed Active</option>
          </select>
        </div>
      </header>
      {error && <p className="form-message error">{error}</p>}
      <div className="table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Reference</th>
              <th>Application</th>
              <th>Payment</th>
              <th>PRC handoff</th>
              <th>Membership</th>
              <th>Received</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>
                  <Link href={`/admin/submissions/${row.id}`}>{row.application_ref ?? "Draft"}</Link>
                </td>
                <td>{row.application_state.replaceAll("_", " ")}</td>
                <td>{row.payment_state.replaceAll("_", " ")}</td>
                <td>{row.prc_handoff_state.replaceAll("_", " ")}</td>
                <td>{row.membership_state.replaceAll("_", " ")}</td>
                <td>{new Date(row.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {loading && <p className="empty-state">Loading cases...</p>}
        {!rows.length && !error && !loading && <p className="empty-state">No submissions match this filter.</p>}
      </div>
      {pagination.totalPages > 1 && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1rem" }}>
          <p style={{ fontSize: "0.875rem", color: "var(--muted-foreground)" }}>
            Showing page {pagination.page} of {pagination.totalPages} ({pagination.total} total cases)
          </p>
          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
              className="button-quiet"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              ← Previous
            </button>
            <button
              type="button"
              className="button-quiet"
              disabled={page >= pagination.totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </AdminShell>
  );
}
