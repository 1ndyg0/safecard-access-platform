"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";

type CaseRow = {
  id: string;
  application_ref: string | null;
  application_state: string;
  application_review_state: string;
  payment_state: string;
  prc_handoff_state: string;
  membership_state: string;
  created_at: string;
};
type PageInfo = { page: number; total: number; totalPages: number };

export function SubmissionsTable() {
  const initialParams = useSearchParams();
  const router = useRouter();
  const [campaignId, setCampaignId] = useState(initialParams.get("campaign_id") ?? "");
  const [rows, setRows] = useState<CaseRow[]>([]);
  const [state, setState] = useState("");
  const [reviewState, setReviewState] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [query, setQuery] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState<PageInfo>({ page: 1, total: 0, totalPages: 1 });
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setError("");
      let selected = campaignId;
      if (!selected) {
        const overview = await fetch("/api/admin/overview", { cache: "no-store", signal: controller.signal });
        if (overview.status === 401) { router.replace("/admin/login"); return; }
        const data = await overview.json();
        selected = data.selectedCampaignId ?? "";
        setCampaignId(selected);
      }
      if (!selected) { setError("No campaign is assigned to this account."); return; }
      const params = new URLSearchParams({ campaign_id: selected, page: String(page), limit: "25", sort });
      if (state) params.set("state", state);
      if (reviewState) params.set("review_state", reviewState);
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (query) params.set("q", query);
      const response = await fetch(`/api/admin/cases?${params}`, { cache: "no-store", signal: controller.signal });
      const data = await response.json();
      if (response.status === 401) { router.replace("/admin/login"); return; }
      if (!response.ok) throw new Error(data.error);
      setRows(data.cases ?? []);
      setPagination(data.pagination ?? { page, total: 0, totalPages: 1 });
    }
    void load().catch((caught) => {
      if ((caught as Error).name !== "AbortError") setError(caught instanceof Error ? caught.message : "Unable to load.");
    });
    return () => controller.abort();
  }, [campaignId, router, state, reviewState, from, to, query, sort, page]);

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    setPage(1);
    setQuery(search.trim());
  }

  function resetFilters() {
    setState(""); setReviewState(""); setFrom(""); setTo(""); setSearch(""); setQuery(""); setSort("newest"); setPage(1);
  }

  return <AdminShell>
    <header className="admin-heading"><div><p className="eyebrow">Privacy-controlled queue</p><h1>Submissions</h1></div></header>
    <section className="queue-controls" aria-label="Submission filters">
      <form onSubmit={submitSearch}><label htmlFor="case-search"><span>Application reference</span><input id="case-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Exact reference" /></label><button className="button-quiet" type="submit">Search</button></form>
      <label><span>Workflow state</span><select value={state} onChange={(event) => { setState(event.target.value); setPage(1); }}><option value="">All states</option><option value="submitted">Submitted</option><option value="correction_needed">Correction needed</option><option value="verification_pending">Payment proof pending</option><option value="verified_by_official_source">Payment verified</option><option value="active_confirmed">PRC-confirmed active</option></select></label>
      <label><span>Application review</span><select value={reviewState} onChange={(event) => { setReviewState(event.target.value); setPage(1); }}><option value="">All review states</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="resubmission_requested">Resubmission requested</option><option value="rejected">Rejected</option></select></label>
      <label><span>From</span><input type="date" value={from} max={to || undefined} onChange={(event) => { setFrom(event.target.value); setPage(1); }} /></label>
      <label><span>To</span><input type="date" value={to} min={from || undefined} onChange={(event) => { setTo(event.target.value); setPage(1); }} /></label>
      <label><span>Sort</span><select value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="longest_waiting">Longest waiting</option></select></label>
      <button className="button-quiet" type="button" onClick={resetFilters}>Reset filters</button>
    </section>
    {error && <p className="form-message error" role="alert">{error}</p>}
    <div className="table-wrap"><table className="admin-table"><thead><tr><th>Reference</th><th>Application</th><th>Review</th><th>Payment</th><th>PRC handoff</th><th>Membership</th><th>Received</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><Link href={`/admin/submissions/${row.id}`}>{row.application_ref ?? "Draft"}</Link></td><td>{formatState(row.application_state)}</td><td>{formatState(row.application_review_state)}</td><td>{formatState(row.payment_state)}</td><td>{formatState(row.prc_handoff_state)}</td><td>{formatState(row.membership_state)}</td><td>{new Date(row.created_at).toLocaleDateString()}</td></tr>)}</tbody></table>{!rows.length && !error && <p className="empty-state">No submissions match these filters.</p>}</div>
    <div className="queue-pagination"><span>{pagination.total} case{pagination.total === 1 ? "" : "s"}</span><button className="button-quiet" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {pagination.page} of {Math.max(1, pagination.totalPages)}</span><button className="button-quiet" disabled={page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)}>Next</button></div>
  </AdminShell>;
}

function formatState(value?: string) {
  return value?.replaceAll("_", " ") ?? "—";
}
