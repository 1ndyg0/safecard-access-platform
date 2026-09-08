"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";

type Overview = { user: { full_name: string; email: string }; roles: string[]; campaigns: Array<{ id: string; name: string; is_active: boolean; max_applications: number }>; selectedCampaignId: string | null; metrics: { cases: number; submitted: number; active: number } };

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
  return <AdminShell><header className="admin-heading"><div><p className="eyebrow">Operations console</p><h1>{data ? "Welcome, " + data.user.full_name : "SafeCard pilot"}</h1></div><span className="status-pill">Controlled pilot</span></header>{error && <p className="form-message error">{error}</p>}<div className="metric-grid"><article><span>Total cases</span><strong>{data?.metrics.cases ?? "—"}</strong></article><article><span>Submitted</span><strong>{data?.metrics.submitted ?? "—"}</strong></article><article><span>PRC-confirmed active</span><strong>{data?.metrics.active ?? "—"}</strong></article></div><section className="admin-panel"><div><p className="eyebrow">Current campaign</p><h2>{data?.campaigns[0]?.name ?? "No assigned campaign"}</h2><p>Roles: {data?.roles.join(", ") || "—"}</p></div>{data?.selectedCampaignId && <Link className="button-primary" href={"/admin/submissions?campaign_id=" + data.selectedCampaignId}>Open submission queue →</Link>}</section></AdminShell>;
}
