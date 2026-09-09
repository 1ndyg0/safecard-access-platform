"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";

type Evidence = {
  id: string;
  payment_intent_id: string;
  version_number: number;
  file_size_bytes: number;
  state: string;
};

type AuditEvent = {
  id: string;
  event_type: string;
  action: string;
  severity: string;
  created_at: string;
};

type Detail = {
  case: Record<string, unknown>;
  profile: Record<string, string> | null;
  payments: Array<Record<string, unknown>>;
  evidence: Evidence[];
  auditEvents: AuditEvent[];
};

type ReviewAction = {
  kind: "approve" | "resubmit" | "reject" | "verify" | "reupload";
  evidence?: Evidence;
};

const actionCopy: Record<ReviewAction["kind"], { title: string; description: string; confirm: string; reasonRequired: boolean }> = {
  approve: { title: "Approve this application?", description: "This confirms application review only. PRC handoff still requires verified payment, and membership remains inactive.", confirm: "Approve application", reasonRequired: false },
  resubmit: { title: "Request a corrected resubmission?", description: "Give the applicant a clear, recipient-safe explanation of what must be corrected.", confirm: "Request resubmission", reasonRequired: true },
  reject: { title: "Reject this application?", description: "This records an explicit review rejection without deleting the application.", confirm: "Reject application", reasonRequired: true },
  verify: { title: "Verify this payment evidence?", description: "Continue only after reconciling the receipt with the official PRC payment record. Membership remains inactive.", confirm: "Verify payment", reasonRequired: false },
  reupload: { title: "Request replacement evidence?", description: "The current evidence remains in immutable history. Explain exactly what must be replaced.", confirm: "Request replacement", reasonRequired: true },
};

export function CaseDetail({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = useState<Detail>();
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [dialog, setDialog] = useState<ReviewAction | null>(null);
  const [reason, setReason] = useState("");

  async function load() {
    const response = await fetch(`/api/admin/cases/${id}`, { cache: "no-store" });
    const body = await response.json();
    if (response.status === 401) {
      router.replace("/admin/login");
      return;
    }
    if (!response.ok) throw new Error(body.error);
    setData(body);
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load().catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load.")), 0);
    return () => window.clearTimeout(timer);
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  function begin(action: ReviewAction) {
    setError("");
    setReason(action.kind === "reupload" ? "The receipt is not legible or does not show the required reference." : "");
    setDialog(action);
  }

  async function submitAction(event: FormEvent) {
    event.preventDefault();
    if (!dialog) return;
    const copy = actionCopy[dialog.kind];
    if (copy.reasonRequired && reason.trim().length < 5) {
      setError("Please provide a clear reason of at least 5 characters.");
      return;
    }
    setBusy(true);
    setError("");
    setActionMessage("");
    try {
      let response: Response;
      if (dialog.kind === "verify" && dialog.evidence) {
        response = await fetch("/api/payment/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            payment_intent_id: dialog.evidence.payment_intent_id,
            evidence_version_id: dialog.evidence.id,
            verification_source: "manual_prc_reconciliation",
          }),
        });
      } else if (dialog.kind === "reupload" && dialog.evidence) {
        response = await fetch("/api/payment/evidence/request-reupload", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ evidence_version_id: dialog.evidence.id, reason: reason.trim() }),
        });
      } else {
        const decision = dialog.kind === "approve" ? "approved" : dialog.kind === "resubmit" ? "resubmission_requested" : "rejected";
        response = await fetch(`/api/admin/cases/${id}/decision`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision, ...(reason.trim() ? { reason: reason.trim() } : {}) }),
        });
      }
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "The review action failed.");
      setActionMessage(dialog.kind === "verify"
        ? "Payment evidence verified. Membership remains inactive until PRC confirms."
        : `${copy.confirm} recorded in the audit history.`);
      setDialog(null);
      setReason("");
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The review action failed.");
    } finally {
      setBusy(false);
    }
  }

  async function openEvidence(evidenceId: string) {
    setError("");
    const response = await fetch(`/api/payment/evidence/${evidenceId}`, { cache: "no-store" });
    const body = await response.json();
    if (!response.ok) {
      setError(body.error ?? "Evidence preview unavailable.");
      return;
    }
    window.open(body.signedUrl, "_blank", "noopener,noreferrer");
  }

  const profile = data?.profile;
  const reviewState = String(data?.case.application_review_state ?? "pending");

  return <AdminShell>
    <header className="admin-heading">
      <div><p className="eyebrow">Authorized case detail</p><h1>{String(data?.case.application_ref ?? "Submission")}</h1></div>
      <Link href="/admin/submissions" className="button-quiet">Back to queue</Link>
    </header>
    {error && <p className="form-message error" role="alert">{error}</p>}
    {actionMessage && <p className="form-message" role="status">{actionMessage}</p>}
    {data && <>
      <div className="state-grid">
        {["consent_state", "application_state", "application_review_state", "payment_state", "prc_handoff_state", "membership_state"].map((key) => <article key={key}><span>{formatState(key)}</span><strong>{formatState(String(data.case[key] ?? "—"))}</strong></article>)}
      </div>
      <section className="admin-panel stack">
        <div><p className="eyebrow">Application review</p><h2>Make an explicit decision</h2><p>Approval and payment verification are separate. Neither activates membership.</p></div>
        {data.case.application_review_reason ? <p className="review-reason"><strong>Latest reason:</strong> {String(data.case.application_review_reason)}</p> : null}
        <div className="review-actions">
          <button className="button-primary" type="button" disabled={reviewState === "approved"} onClick={() => begin({ kind: "approve" })}>Approve</button>
          <button className="button-quiet" type="button" disabled={reviewState === "resubmission_requested"} onClick={() => begin({ kind: "resubmit" })}>Request resubmission</button>
          <button className="button-danger" type="button" disabled={reviewState === "rejected"} onClick={() => begin({ kind: "reject" })}>Reject</button>
        </div>
      </section>
      <section className="admin-panel stack">
        <p className="eyebrow">Minimum necessary profile</p>
        {profile ? <dl className="review-list">
          <div><dt>Name</dt><dd>{[profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(" ")}</dd></div>
          <div><dt>Date of birth</dt><dd>{profile.date_of_birth}</dd></div>
          <div><dt>Mobile</dt><dd>{profile.mobile_number}</dd></div>
          <div><dt>Address</dt><dd>{[profile.address_line1, profile.address_line2, profile.city, profile.province, profile.zip_code].filter(Boolean).join(", ")}</dd></div>
        </dl> : <p>No profile has been submitted.</p>}
      </section>
      <PaymentEvidence payments={data.payments} evidence={data.evidence} onOpen={openEvidence} onAction={begin} />
      <AuditTimeline events={data.auditEvents} />
    </>}
    {dialog && <ConfirmationDialog action={dialog} reason={reason} busy={busy} onReason={setReason} onCancel={() => setDialog(null)} onSubmit={submitAction} />}
  </AdminShell>;
}

function PaymentEvidence({ payments, evidence, onOpen, onAction }: {
  payments: Array<Record<string, unknown>>;
  evidence: Evidence[];
  onOpen: (id: string) => Promise<void>;
  onAction: (action: ReviewAction) => void;
}) {
  return <section className="admin-panel stack">
    <p className="eyebrow">Payment evidence</p>
    {payments.length ? payments.map((payment) => <article key={String(payment.id)} className="payment-row">
      <strong>{formatState(String(payment.state))}</strong>
      <span>{String(payment.payment_route)} · {String(payment.expected_amount)} PHP</span>
      {evidence.filter((item) => item.payment_intent_id === payment.id).map((item) => <span className="evidence-actions" key={item.id}>
        <span>Version {item.version_number} · {formatState(item.state)} · {Math.round(item.file_size_bytes / 1024)} KB</span>
        <button className="button-quiet" type="button" onClick={() => void onOpen(item.id)}>View securely</button>
        {item.state === "verification_pending" && <>
          <button className="button-primary" type="button" onClick={() => onAction({ kind: "verify", evidence: item })}>Verify</button>
          <button className="button-quiet" type="button" onClick={() => onAction({ kind: "reupload", evidence: item })}>Request replacement</button>
        </>}
      </span>)}
    </article>) : <p>No payment intent. Manual payment is controlled by the pilot configuration.</p>}
  </section>;
}

function AuditTimeline({ events }: { events: AuditEvent[] }) {
  return <section className="admin-panel stack">
    <div><p className="eyebrow">Immutable history</p><h2>Audit timeline</h2></div>
    {events.length ? <ol className="audit-timeline">{events.map((event) => <li key={event.id}>
      <span className={`audit-marker ${event.severity}`} aria-hidden="true" />
      <div><strong>{event.action}</strong><span>{formatState(event.event_type)} · {new Date(event.created_at).toLocaleString()}</span></div>
    </li>)}</ol> : <p>No audit events recorded for this case.</p>}
  </section>;
}

function ConfirmationDialog({ action, reason, busy, onReason, onCancel, onSubmit }: {
  action: ReviewAction;
  reason: string;
  busy: boolean;
  onReason: (value: string) => void;
  onCancel: () => void;
  onSubmit: (event: FormEvent) => Promise<void>;
}) {
  const copy = actionCopy[action.kind];
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onCancel(); }}>
    <form className="confirmation-dialog" role="dialog" aria-modal="true" aria-labelledby="review-dialog-title" onSubmit={(event) => void onSubmit(event)}>
      <p className="eyebrow">Confirmation required</p>
      <h2 id="review-dialog-title">{copy.title}</h2>
      <p>{copy.description}</p>
      {copy.reasonRequired && <label className="field-block"><span>Reason shown to the applicant</span><textarea autoFocus value={reason} minLength={5} maxLength={500} required onChange={(event) => onReason(event.target.value)} /></label>}
      <label className="confirmation-check"><input type="checkbox" required /><span>I reviewed the application or official payment record and understand the effect of this action.</span></label>
      <div className="dialog-actions"><button className="button-quiet" type="button" disabled={busy} onClick={onCancel}>Cancel</button><button className={action.kind === "reject" ? "button-danger" : "button-primary"} type="submit" disabled={busy}>{busy ? "Saving…" : copy.confirm}</button></div>
    </form>
  </div>;
}

function formatState(value?: string) {
  return value?.replaceAll("_", " ") ?? "—";
}
