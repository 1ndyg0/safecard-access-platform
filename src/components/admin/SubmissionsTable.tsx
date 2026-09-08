"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";

type CaseRow = { id: string; application_ref: string | null; application_state: string; payment_state: string; prc_handoff_state: string; membership_state: string; created_at: string };

export function SubmissionsTable() {
  const params = useSearchParams(); const router = useRouter();
  const [campaignId, setCampaignId] = useState(params.get("campaign_id") ?? "");
  const [rows, setRows] = useState<CaseRow[]>([]); const [state, setState] = useState(""); const [error, setError] = useState("");
  useEffect(() => {
    async function load() {
      let selected = campaignId;
      if (!selected) {
        const overview = await fetch("/api/admin/overview", { cache: "no-store" });
        if (overview.status === 401) { router.replace("/admin/login"); return; }
        const data = await overview.json(); selected = data.selectedCampaignId ?? ""; setCampaignId(selected);
      }
      if (!selected) { setError("No campaign is assigned to this account."); return; }
      const response = await fetch(`/api/admin/cases?campaign_id=${encodeURIComponent(selected)}${state ? `&state=${encodeURIComponent(state)}` : ""}`, { cache: "no-store" });
      const data = await response.json(); if (!response.ok) throw new Error(data.error); setRows(data.cases ?? []);
    }
    load().catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load."));
  }, [campaignId, router, state]);
  return <AdminShell><header className="admin-heading"><div><p className="eyebrow">Privacy-controlled queue</p><h1>Submissions</h1></div><select aria-label="Filter by state" value={state} onChange={(event) => setState(event.target.value)}><option value="">All states</option><option value="submitted">Submitted</option><option value="correction_needed">Correction needed</option><option value="verified_by_official_source">Payment verified</option><option value="active_confirmed">PRC-confirmed active</option></select></header>{error && <p className="form-message error">{error}</p>}<div className="table-wrap"><table className="admin-table"><thead><tr><th>Reference</th><th>Application</th><th>Payment</th><th>PRC handoff</th><th>Membership</th><th>Received</th></tr></thead><tbody>{rows.map((row) => <tr key={row.id}><td><Link href={`/admin/submissions/${row.id}`}>{row.application_ref ?? "Draft"}</Link></td><td>{row.application_state.replaceAll("_", " ")}</td><td>{row.payment_state.replaceAll("_", " ")}</td><td>{row.prc_handoff_state.replaceAll("_", " ")}</td><td>{row.membership_state.replaceAll("_", " ")}</td><td>{new Date(row.created_at).toLocaleDateString()}</td></tr>)}</tbody></table>{!rows.length && !error && <p className="empty-state">No submissions match this filter.</p>}</div></AdminShell>;
}
