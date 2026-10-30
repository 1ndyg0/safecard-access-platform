"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { MemberNav } from "@/components/member/MemberNav";
import "./card.css";

type Benefit = { id: string; icon: string; title: { fil: string; en: string }; summary: { fil: string; en: string } };
type CardData = { approved?: boolean; mobileMasked?: string; location?: string; approvedAt?: string | null; benefits?: Benefit[]; name?: string; reference: string };

const titleCase = (value: string) => value.toLowerCase().replace(/(^|[\s,.-])(\p{L})/gu, (_, lead: string, letter: string) => lead + letter.toUpperCase());
const formatDate = (iso: string) => new Date(iso).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });

export default function MemberCardPage() {
  const router = useRouter(); const [card, setCard] = useState<CardData>(); const [error, setError] = useState("");
  useEffect(() => { fetch("/api/member/card", { cache: "no-store" }).then(async (response) => { const data = await response.json(); if (response.status === 401) { router.replace("/member"); return; } if (!response.ok) throw new Error(data.error); setCard(data); }).catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load.")); }, [router]);
  async function logout() { await fetch("/api/member/logout", { method: "POST" }); router.replace("/member"); router.refresh(); }
  return (
    <main className="portal-page dark">
      <div className="portal-shell">
        <header className="portal-header"><Link href="/" aria-label="SafeCard"><BrandMark /></Link><button className="button-quiet" onClick={logout}>Sign out</button></header>
        <div className="library-wrap"><MemberNav current="card" /></div>
        {error ? <section className="portal-card"><h1>Card unavailable</h1><p>{error}</p></section>
          : !card ? <section className="portal-card"><p>Loading secure card…</p></section>
          : card.approved ? (
            <div className="member-card-view">
              <article className="safecard" aria-label="Electronic SafeCard">
                <div className="safecard-top">
                  <span className="safecard-brand"><span aria-hidden="true"><svg viewBox="0 0 24 24" width="17" height="17" focusable="false"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" /></svg></span> SafeCard</span>
                  <span className="status-pill active">Approved</span>
                </div>
                <div className="safecard-chip-row">
                  <span className="safecard-chip" aria-hidden="true" />
                  <span className="safecard-label">Electronic SafeCard</span>
                </div>
                <p className="safecard-ref" aria-label="Application reference">{card.reference}</p>
                <div className="safecard-bottom">
                  <div className="safecard-holder"><span>Member</span><strong>{card.name ? titleCase(card.name) : ""}</strong></div>
                  <dl className="safecard-meta">
                    <div><dt>Mobile</dt><dd>{card.mobileMasked}</dd></div>
                    {card.approvedAt && <div><dt>Approved</dt><dd>{formatDate(card.approvedAt)}</dd></div>}
                    {card.location && <div><dt>Location</dt><dd>{titleCase(card.location)}</dd></div>}
                  </dl>
                </div>
              </article>
              <p className="safecard-note">Approved by SafeCard administration. Emergency guidance: <strong>Hotline 143</strong></p>
              {card.benefits && card.benefits.length > 0 && (
                <section className="card-benefits" aria-labelledby="card-benefits-heading">
                  <h2 id="card-benefits-heading">Your SafeCard benefits</h2>
                  <ul>{card.benefits.map((benefit) => <li key={benefit.id}><span aria-hidden="true">{benefit.icon}</span><div><strong>{benefit.title.en}</strong><p>{benefit.summary.en}</p></div></li>)}</ul>
                  <p className="card-benefits-note">Benefits are subject to availability, eligibility and official PRC rules. They are not a guarantee of any amount or outcome.</p>
                </section>
              )}
            </div>
          ) : <section className="portal-card"><p className="eyebrow">Application received</p><h1>Your electronic SafeCard is not ready yet.</h1><p>A submitted application or payment is not an approval. This card appears once an administrator approves your application and verifies your payment proof.</p><div className="reference-box"><span>Application reference</span><strong>{card.reference}</strong></div><Link className="button-primary" href="/member/status">View status →</Link></section>}
      </div>
    </main>
  );
}
