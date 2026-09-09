"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";

type Evidence = { id: string; payment_intent_id: string; version_number: number; content_type: string; file_size_bytes: number; sha256: string; state: string; uploaded_at: string; reviewed_at?: string | null };
type Detail = { case: Record<string, string>; profile: Record<string, string> | null; payments: Array<Record<string, string>>; evidence: Evidence[] };

export function CaseDetail({ id }: { id: string }) {
  const router = useRouter(); const [data, setData] = useState<Detail>(); const [error, setError] = useState(""); const [actionMessage, setActionMessage] = useState(""); const [busyId, setBusyId] = useState("");
  useEffect(() => { fetch(`/api/admin/cases/${id}`, { cache: "no-store" }).then(async (response) => { const body = await response.json(); if (response.status === 401) { router.replace("/admin/login"); return; } if (!response.ok) throw new Error(body.error); setData(body); }).catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load.")); }, [id, router]);
  const profile = data?.profile;
  async function evidenceAction(evidence: Evidence, action: "verify" | "reupload") {
    setBusyId(evidence.id); setError(""); setActionMessage("");
    try {
      if (action === "verify") {
        const response = await fetch("/api/payment/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payment_intent_id: evidence.payment_intent_id, evidence_version_id: evidence.id, verification_source: "manual_prc_reconciliation" }) });
        const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Verification failed.");
        setActionMessage("Payment proof verified. Membership remains inactive until PRC confirms.");
      } else {
        const reason = window.prompt("Reason the applicant should replace this proof:", "The receipt is not legible or does not show the required reference.");
        if (!reason) return;
        const response = await fetch("/api/payment/evidence/request-reupload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ evidence_version_id: evidence.id, reason }) });
        const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Replacement request failed.");
        setActionMessage("Replacement proof requested; the prior evidence remains in the immutable history.");
      }
      const refreshed = await fetch(`/api/admin/cases/${id}`, { cache: "no-store" }); setData(await refreshed.json());
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The review action failed."); }
    finally { setBusyId(""); }
  }
  async function requestCorrection() {
    const reason = window.prompt("Recipient-safe correction reason:", "Please review and correct the highlighted application fields.");
    if (!reason) return;
    setBusyId("case"); setError("");
    try {
      const response = await fetch(`/api/admin/cases/${id}/correction`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
      const body = await response.json(); if (!response.ok) throw new Error(body.error ?? "Correction request failed.");
      setActionMessage("Correction requested. The recipient-safe reason is recorded in the audit history.");
      const refreshed = await fetch(`/api/admin/cases/${id}`, { cache: "no-store" }); setData(await refreshed.json());
    } catch (caught) { setError(caught instanceof Error ? caught.message : "The correction request failed."); }
    finally { setBusyId(""); }
  }
  async function openEvidence(evidenceId: string) {
    const response = await fetch(`/api/payment/evidence/${evidenceId}`, { cache: "no-store" }); const body = await response.json();
    if (!response.ok) { setError(body.error ?? "Evidence preview unavailable."); return; }
    window.open(body.signedUrl, "_blank", "noopener,noreferrer");
  }
  return <AdminShell><header className="admin-heading"><div><p className="eyebrow">Authorized case detail</p><h1>{data?.case.application_ref ?? "Submission"}</h1></div><div className="wizard-actions"><button className="button-quiet" type="button" disabled={busyId === "case" || data?.case.application_state === "correction_needed"} onClick={requestCorrection}>Request correction</button><Link href="/admin/submissions" className="button-quiet">Back to queue</Link></div></header>{error && <p className="form-message error" role="alert">{error}</p>}{actionMessage && <p className="form-message" role="status">{actionMessage}</p>}{data && <><div className="state-grid">{["consent_state", "application_state", "payment_state", "prc_handoff_state", "membership_state"].map((key) => <article key={key}><span>{key.replaceAll("_", " ")}</span><strong>{data.case[key]?.replaceAll("_", " ")}</strong></article>)}</div><section className="admin-panel stack"><p className="eyebrow">Minimum necessary profile</p>{profile ? <dl className="review-list"><div><dt>Name</dt><dd>{[profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(" ")}</dd></div><div><dt>Date of birth</dt><dd>{profile.date_of_birth}</dd></div><div><dt>Mobile</dt><dd>{profile.mobile_number}</dd></div><div><dt>Address</dt><dd>{[profile.address_line1, profile.address_line2, profile.city, profile.province, profile.zip_code].filter(Boolean).join(", ")}</dd></div></dl> : <p>No profile has been submitted.</p>}</section><section className="admin-panel stack"><p className="eyebrow">Payment evidence</p>{data.payments.length ? data.payments.map((payment) => <article key={payment.id} className="payment-row"><strong>{payment.state?.replaceAll("_", " ")}</strong><span>{payment.payment_route} · {payment.expected_amount} PHP</span>{data.evidence.filter((item) => item.payment_intent_id === payment.id).map((item) => <span className="evidence-actions" key={item.id}><span>{item.state.replaceAll("_", " ")} · {Math.round(item.file_size_bytes / 1024)} KB</span><button className="button-quiet" type="button" onClick={() => openEvidence(item.id)}>View securely</button>{item.state === "verification_pending" && <><button className="button-primary" type="button" disabled={busyId === item.id} onClick={() => evidenceAction(item, "verify")}>{busyId === item.id ? "Saving…" : "Verify"}</button><button className="button-quiet" type="button" disabled={busyId === item.id} onClick={() => evidenceAction(item, "reupload")}>Request replacement</button></>}</span>)}</article>) : <p>No payment intent. Manual payment is controlled by the pilot configuration.</p>}</section></>}</AdminShell>;
}
