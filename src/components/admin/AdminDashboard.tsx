"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";

type Overview = { user: { full_name: string; email: string }; roles: string[]; campaigns: Array<{ id: string; name: string; is_active: boolean; max_applications: number }>; selectedCampaignId: string | null; metrics: Record<string, number> };

export function AdminDashboard() {
  const router = useRouter();
  const [data, setData] = useState<Overview>();
  const [error, setError] = useState("");
  useEffect(() => {
    fetch("/api/admin/overview", { cache: "no-store" }).then(async (response) => {
      const body = await response.json();
      if (response.status === 401) { router.replace("/admin/login"); return; }
      if (!response.ok) throw new Error(body.error);
      setData(body);
    }).catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load."));
  }, [router]);
  const metrics = [
    ["Total cases", "cases"], ["Draft / incomplete", "drafts"], ["Submitted", "submitted"], ["Awaiting review", "awaitingReview"],
    ["Correction requested", "correction"], ["Payment evidence pending", "paymentPending"], ["Payment verified", "paymentVerified"],
    ["Ready for PRC handoff", "readyForHandoff"], ["Sent / acknowledged", "sentToPrc"], ["PRC-confirmed active", "active"], ["PRC-declined", "declined"],
  ] as const;
  return <AdminShell><header className="admin-heading"><div><p className="eyebrow">Operations console</p><h1>{data ? "Welcome, " + data.user.full_name : "SafeCard pilot"}</h1></div><span className="status-pill">Controlled pilot</span></header>{error && <p className="form-message error">{error}</p>}<div className="metric-grid">{metrics.map(([label, key]) => <article key={key}><span>{label}</span><strong>{data?.metrics[key] ?? "—"}</strong></article>)}</div><section className="admin-panel"><div><p className="eyebrow">Current campaign</p><h2>{data?.campaigns[0]?.name ?? "No assigned campaign"}</h2><p>Roles: {data?.roles.join(", ") || "—"}</p><p className="content-footnote">Aggregates are server-computed; no recipient names appear in this dashboard.</p></div>{data?.selectedCampaignId && <Link className="button-primary" href={"/admin/submissions?campaign_id=" + data.selectedCampaignId}>Open submission queue →</Link>}</section></AdminShell>;
}
