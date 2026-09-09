"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { PaymentCorrectionPanel, type PaymentCorrection } from "@/components/member/PaymentCorrectionPanel";

type StatusData = { reference: string; states: { application_state: string; application_review_state: string; payment_state: string; prc_handoff_state: string; membership_state: string; updated_at: string }; nextAction: string; applicationReview: { state: string; reason: string | null }; paymentCorrection: PaymentCorrection | null };
const steps = [{ key: "application_state", label: "Application" }, { key: "application_review_state", label: "Application review" }, { key: "payment_state", label: "Payment" }, { key: "prc_handoff_state", label: "PRC handoff" }, { key: "membership_state", label: "Membership" }] as const;

export default function MemberStatusPage() {
  const router = useRouter(); const [status, setStatus] = useState<StatusData>(); const [error, setError] = useState(""); const [notice, setNotice] = useState("");
  async function load() { const response = await fetch("/api/member/status", { cache: "no-store" }); const data = await response.json(); if (response.status === 401) { router.replace("/member"); return; } if (!response.ok) throw new Error(data.error); setStatus(data); }
  useEffect(() => { const timer = window.setTimeout(() => void load().catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load.")), 0); return () => window.clearTimeout(timer); }, [router]); // eslint-disable-line react-hooks/exhaustive-deps
  async function correctionComplete() { setNotice("Replacement evidence received. Staff verification is pending."); await load(); }
  return <main className="portal-page"><div className="portal-shell"><header className="portal-header"><Link href="/"><BrandMark /></Link><Link href="/member/card" className="button-quiet">Electronic card</Link></header><section className="portal-card"><p className="eyebrow">Status tracker</p><h1>{status?.reference ?? "Application status"}</h1>{error ? <p className="form-message error">{error}</p> : !status ? <p>Loading protected status…</p> : <><div className="status-timeline">{steps.map((step, index) => <article key={step.key}><span>{index + 1}</span><div><strong>{step.label}</strong><p>{status.states[step.key].replaceAll("_", " ")}</p></div></article>)}</div>{status.applicationReview.reason && <div className="notice-panel amber"><strong>Reviewer note</strong><span>{status.applicationReview.reason}</span></div>}{status.applicationReview.state === "resubmission_requested" && <div className="status-action"><Link className="button-primary" href="/member/correction">Correct and resubmit application →</Link></div>}<div className="notice-panel"><strong>What happens next</strong><span>{status.nextAction}</span></div>{status.paymentCorrection && <PaymentCorrectionPanel correction={status.paymentCorrection} onComplete={() => void correctionComplete()} />}{notice && <p className="form-message" role="status">{notice}</p>}<p className="portal-footnote">Last updated {new Date(status.states.updated_at).toLocaleString()}. For official questions, call <a href="tel:143">Hotline 143</a>.</p></>}</section></div></main>;
}
