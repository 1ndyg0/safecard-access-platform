"use client";
/* eslint-disable @next/next/no-img-element -- QR data URLs are generated locally and intentionally bypass image optimization. */

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";

type CardData = { active: boolean; name?: string; reference: string; membershipId?: string; effectiveDate?: string; expiryDate?: string; qrDataUrl?: string; membershipState?: string };

export default function MemberCardPage() {
  const router = useRouter(); const [card, setCard] = useState<CardData>(); const [error, setError] = useState("");
  useEffect(() => { fetch("/api/member/card", { cache: "no-store" }).then(async (response) => { const data = await response.json(); if (response.status === 401) { router.replace("/member"); return; } if (!response.ok) throw new Error(data.error); setCard(data); }).catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load.")); }, [router]);
  async function logout() { await fetch("/api/member/logout", { method: "POST" }); router.replace("/member"); router.refresh(); }
  return <main className="portal-page dark"><div className="portal-shell"><header className="portal-header"><Link href="/"><BrandMark /></Link><button className="button-quiet" onClick={logout}>Sign out</button></header>{error ? <section className="portal-card"><h1>Card unavailable</h1><p>{error}</p></section> : !card ? <section className="portal-card"><p>Loading secure card…</p></section> : card.active ? <section className="digital-card"><div className="digital-card-top"><div><p>PRC-confirmed membership</p><h1>Electronic SafeCard</h1></div><span className="status-pill active">Active</span></div><div className="digital-card-body"><div><span>Member</span><strong>{card.name}</strong><span>Membership ID</span><strong>{card.membershipId}</strong><div className="card-dates"><p><span>Effective</span>{card.effectiveDate}</p><p><span>Expires</span>{card.expiryDate}</p></div></div>{card.qrDataUrl && <img src={card.qrDataUrl} alt="QR containing the PRC-confirmed membership identifier" width="180" height="180" />}</div><div className="digital-card-footer"><span>Confirmation evidence is required before this card appears.</span><strong>Hotline 143</strong></div></section> : <section className="portal-card"><p className="eyebrow">Application received</p><h1>Your electronic SafeCard is not active yet.</h1><p>A submitted application or payment is not membership activation. This card appears only after PRC confirmation evidence is recorded.</p><div className="reference-box"><span>Application reference</span><strong>{card.reference}</strong></div><Link className="button-primary" href="/member/status">View status →</Link></section>}</div></main>;
}
