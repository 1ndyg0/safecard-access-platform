"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";

type CaseRow = { id: string; application_ref: string | null; application_state: string; payment_state: string; prc_handoff_state: string; membership_state: string; created_at: string };
type PageInfo = { page: number; total: number; totalPages: number };

export function SubmissionsTable() {
  const params = useSearchParams(); const router = useRouter();
  const [campaignId, setCampaignId] = useState(params.get("campaign_id") ?? "");
  const [rows, setRows] = useState<CaseRow[]>([]); const [state, setState] = useState(""); const [query, setQuery] = useState(""); const [search, setSearch] = useState(""); const [sort, setSort] = useState("newest"); const [page, setPage] = useState(1); const [pagination, setPagination] = useState<PageInfo>({ page: 1, total: 0, totalPages: 1 }); const [error, setError] = useState("");
  useEffect(() => {
    async function load() {
      let selected = campaignId;
      if (!selected) {
        const overview = await fetch("/api/admin/overview", { cache: "no-store" });
        if (overview.status === 401) { router.replace("/admin/login"); return; }
        const data = await overview.json(); selected = data.selectedCampaignId ?? ""; setCampaignId(selected);
      }
      if (!selected) { setError("No campaign is assigned to this account."); return; }
      const params = new URLSearchParams({ campaign_id: selected, page: String(page), limit: "25", sort });
      if (state) params.set("state", state); if (query) params.set("q", query);
      const response = await fetch(`/api/admin/cases?${params}`, { cache: "no-store" });
      const data = await response.json(); if (!response.ok) throw new Error(data.error); setRows(data.cases ?? []); setPagination(data.pagination ?? { page, total: 0, totalPages: 1 });
    }
    load().catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load."));
  }, [campaignId, router, state, query, sort, page]);
  function submitSearch(event: FormEvent) { event.preventDefault(); setPage(1); setQuery(search.trim()); }
  return <AdminShell><header className="admin-heading"><div><p className="eyebrow">Privacy-controlled queue</p><h1>Submissions</h1></div><div className="queue-controls"><form onSubmit={submitSearch}><label className="sr-only" htmlFor="case-search">Exact application reference</label><input id="case-search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Exact reference" /><button className="button-quiet" type="submit">Search</button></form><select aria-label="Filter by state" value={state} onChange={(event) => { setState(event.target.value); setPage(1); }}><option value="">All states</option><option value="submitted">Submitted</option><option value="correction_needed">Correction needed</option><option value="verification_pending">Payment proof pending</option><option value="verified_by_official_source">Payment verified</option><option value="active_confirmed">PRC-confirmed active</option></select><select aria-label="Sort submissions" value={sort} onChange={(event) => { setSort(event.target.value); setPage(1); }}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="longest_waiting">Longest waiting</option></select></div></header>{error && <p className="form-message error">{error}</p>}<div className="table-wrap"><table className="admin-table"><thead><tr><th>Reference</th><th>Application</th><th>Payment</th><th>PRC handoff</th><th>Membership</th><th>Received</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><Link href={`/admin/submissions/${row.id}`}>{row.application_ref ?? "Draft"}</Link></td><td>{row.application_state.replaceAll("_", " ")}</td><td>{row.payment_state.replaceAll("_", " ")}</td><td>{row.prc_handoff_state.replaceAll("_", " ")}</td><td>{row.membership_state.replaceAll("_", " ")}</td><td>{new Date(row.created_at).toLocaleDateString()}</td></tr>)}</tbody></table>{!rows.length && !error && <p className="empty-state">No submissions match this filter.</p>}</div><div className="queue-pagination"><span>{pagination.total} case{pagination.total === 1 ? "" : "s"}</span><button className="button-quiet" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button><span>Page {pagination.page} of {Math.max(1, pagination.totalPages)}</span><button className="button-quiet" disabled={page >= pagination.totalPages} onClick={() => setPage((current) => current + 1)}>Next</button></div></AdminShell>;
}
