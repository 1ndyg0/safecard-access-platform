"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import AppShell from "./AppShell";
import { createSponsorship, dataMode, listSponsorships } from "@/lib/data";
import { statusLabels, type Sponsorship } from "@/lib/types";

export default function Dashboard() {
  const [items, setItems] = useState<Sponsorship[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [created, setCreated] = useState<Sponsorship | null>(null);
  const [alias, setAlias] = useState("Student sponsor");
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    try { setItems(await listSponsorships()); }
    catch { setMessage("We couldn’t load sponsorships. Check the Supabase setup or switch to demo mode."); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const listener = () => load();
    window.addEventListener("safecard:data", listener);
    return () => window.removeEventListener("safecard:data", listener);
  }, []);

  const metrics = useMemo(() => ({
    waiting: items.filter((item) => ["invited", "informed", "consented"].includes(item.status)).length,
    complete: items.filter((item) => item.status === "completed").length,
  }), [items]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!agreed) return;
    setBusy(true); setMessage("");
    try {
      const result = await createSponsorship(alias.trim() || "Student sponsor");
      setCreated(result); await load();
    } catch { setMessage("The invitation could not be created. Please try again."); }
    finally { setBusy(false); }
  };

  const close = () => { setDialogOpen(false); setCreated(null); setAgreed(false); };
  const invitationUrl = created ? `${window.location.origin}/invite/${created.inviteCode}` : "";

  return <AppShell>
    <div className="content">
      <header className="page-head">
        <div><p className="eyebrow">Sponsor overview</p><h1>Support, without pressure.</h1><p className="lede">Invite someone to learn about Safe Card, decide privately, and complete the official process only if they choose.</p></div>
        <button className="button" type="button" onClick={() => setDialogOpen(true)}>Start a sponsorship</button>
      </header>

      <div className="notice" role="note"><span aria-hidden="true">●</span><span><b>{dataMode === "demo" ? "Demo mode." : "Supabase mode."}</b> This school project is not an official Philippine Red Cross service. Use synthetic information until all pilot approvals are complete.</span></div>
      {message && <div className="error-banner" role="alert">{message}</div>}

      <section className="summary-grid" aria-label="Pilot summary">
        <article className="card status-card"><h2>Your private pilot activity</h2><p>Only high-level progress is visible to a sponsor.</p><strong className="status-number">{loading ? "—" : items.length} {items.length === 1 ? "case" : "cases"}</strong></article>
        <article className="card metric"><span>Waiting on recipient</span><b>{loading ? "—" : metrics.waiting}</b></article>
        <article className="card metric"><span>Completed</span><b>{loading ? "—" : metrics.complete}</b></article>
      </section>

      <div className="section-row" id="sponsorships"><h2>Recent sponsorships</h2><span className="section-note">Status only—no recipient details</span></div>
      <section className="card case-list" aria-label="Recent sponsorships">
        {loading ? <div className="empty-state">Loading sponsorships…</div> : items.length === 0 ? <div className="empty-state"><strong>No sponsorships yet.</strong><span>Create a private invitation when you are ready.</span></div> : items.map((item) => <article className="case" key={item.id}>
          <div><strong>SC-{item.inviteCode.slice(0, 8)}</strong><small>{new Date(item.updatedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</small></div>
          <small>{item.status === "invited" ? "Recipient has not responded" : item.status === "completed" ? "Demo journey completed" : "Recipient controls the next step"}</small>
          <span className={`pill ${item.status}`}>{statusLabels[item.status]}</span>
          <Link className="text-link" href={`/invite/${item.inviteCode}`}>Open</Link>
        </article>)}
      </section>

      <div className="section-row" id="learn"><h2>Before you invite</h2></div>
      <section className="quick-grid">
        <article className="card quick"><span className="num">1</span><h3>Know the basics</h3><p>The working baseline is ₱1,200 for one year, ages 3–85. Every amount and condition still requires current PRC approval.</p></article>
        <article className="card quick"><span className="num">2</span><h3>Respect the choice</h3><p>A sponsorship is an offer. Payment never replaces the recipient’s informed agreement.</p></article>
        <article className="card quick"><span className="num">3</span><h3>Protect their privacy</h3><p>You see progress only—not identity documents, health information, or claims activity.</p></article>
      </section>

      <section className="help-panel" id="help">
        <div><p className="eyebrow">Need help?</p><h2>Know who owns the answer.</h2></div>
        <p>Platform navigation belongs to the school project team. Eligibility, benefits, activation, payment disputes, and claims must go to Philippine Red Cross through an approved official route.</p>
      </section>
    </div>

    {dialogOpen && <div className="dialog-backdrop" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <button className="dialog-close" onClick={close} aria-label="Close">×</button>
        {!created ? <form onSubmit={submit}>
          <p className="eyebrow">Private invitation</p><h2 id="dialog-title">Start with a respectful offer</h2>
          <p className="dialog-copy">This creates a link to the learning and consent flow. Do not enter the recipient’s name or personal information.</p>
          <label className="field"><span>Your display label</span><input value={alias} onChange={(e) => setAlias(e.target.value)} maxLength={40} placeholder="Student sponsor" /></label>
          <label className="check"><input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} /><span>I will make clear that participation is voluntary, give the recipient privacy to decide, and avoid promising any claim outcome.</span></label>
          <button className="button wide" disabled={!agreed || busy}>{busy ? "Creating…" : "Create invitation"}</button>
        </form> : <div>
          <p className="eyebrow">Invitation ready</p><h2 id="dialog-title">Let them decide privately</h2>
          <p className="dialog-copy">Share this link directly. Opening it does not enroll anyone or create an official PRC record.</p>
          <div className="copy-box"><span>{invitationUrl}</span><button type="button" onClick={async () => { await navigator.clipboard.writeText(invitationUrl); setMessage("Invitation link copied."); }}>Copy</button></div>
          <div className="dialog-actions"><Link className="button" href={`/invite/${created.inviteCode}`}>Preview recipient flow</Link><button className="button secondary" type="button" onClick={close}>Done</button></div>
        </div>}
      </section>
    </div>}
  </AppShell>;
}
