"use client";
/* eslint-disable @next/next/no-img-element -- QR data URLs are generated locally and intentionally bypass image optimization. */

import Link from "next/link";
import QRCode from "qrcode";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { createSupabaseBrowserClient } from "@/lib/db/browser";

type Referral = { id: string; slug: string; totalVisits: number; totalStarts: number; stageCounts: Record<string, number> };
type SponsorData = { sponsor: { id: string; campaign_id: string; display_name: string }; referrals: Referral[] };

export function AmbassadorDashboard({ shareOnly = false }: { shareOnly?: boolean }) {
  const router = useRouter(); const [data, setData] = useState<SponsorData>(); const [error, setError] = useState(""); const [busy, setBusy] = useState(false); const [qr, setQr] = useState("");
  async function load() { const response = await fetch("/api/sponsors/me", { cache: "no-store" }); const body = await response.json(); if (response.status === 401) { router.replace("/ambassador/login"); return; } if (!response.ok) throw new Error(body.error); setData(body); }
  useEffect(() => {
    fetch("/api/sponsors/me", { cache: "no-store" }).then(async (response) => {
      const body = await response.json();
      if (response.status === 401) { router.replace("/ambassador/login"); return; }
      if (!response.ok) throw new Error(body.error);
      setData(body);
    }).catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load."));
  }, [router]);
  const referral = data?.referrals[0];
  useEffect(() => { if (!referral) return; const url = `${window.location.origin}/r/${referral.slug}`; QRCode.toDataURL(url, { width: 420, margin: 2, errorCorrectionLevel: "M" }).then(setQr).catch(() => setError("Unable to create the QR image.")); }, [referral]);
  async function createReferral() { if (!data) return; setBusy(true); setError(""); try { const response = await fetch("/api/referrals/create", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sponsor_id: data.sponsor.id, campaign_id: data.sponsor.campaign_id, idempotency_key: `referral-${crypto.randomUUID()}` }) }); const body = await response.json(); if (!response.ok) throw new Error(body.error); await load(); } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to create."); } finally { setBusy(false); } }
  async function signOut() { await createSupabaseBrowserClient().auth.signOut(); router.replace("/ambassador/login"); router.refresh(); }
  const link = referral ? `${typeof window === "undefined" ? "" : window.location.origin}/r/${referral.slug}` : "";
  return <main className="portal-page"><div className="portal-shell"><header className="portal-header"><Link href="/"><BrandMark /></Link><div><Link className="button-quiet" href={shareOnly ? "/ambassador" : "/ambassador/share"}>{shareOnly ? "Dashboard" : "Share card"}</Link><button className="button-quiet" onClick={signOut}>Sign out</button></div></header><section className="portal-card"><p className="eyebrow">Ambassador workspace</p><h1>{data ? `${data.sponsor.display_name}’s private referral` : "Your referral dashboard"}</h1><p>Only aggregate progress appears here. Recipient identity, answers, contact details, payments, and decisions are never disclosed.</p>{error && <p className="form-message error">{error}</p>}{!referral && data && <button className="button-primary" disabled={busy} onClick={createReferral}>{busy ? "Creating…" : "Create my referral link →"}</button>}{referral && <>{shareOnly && qr && <div className="qr-panel"><img src={qr} width="260" height="260" alt="QR code for ambassador referral link" /><strong>Scan to learn privately</strong><span>{link}</span><a className="button-primary" href={qr} download={`safecard-${referral.slug}.png`}>Download QR image</a></div>}{!shareOnly && <><div className="metric-grid"><article><span>Link visits</span><strong>{referral.totalVisits}</strong></article><article><span>Applications started</span><strong>{referral.totalStarts}</strong></article><article><span>PRC-confirmed</span><strong>{referral.stageCounts.confirmed ?? 0}</strong></article></div><div className="notice-panel"><strong>Privacy boundary</strong><span>A decline or ask-for-help decision never appears in this dashboard.</span></div></>}</>}</section></div></main>;
}
