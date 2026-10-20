"use client";

/**
 * Staff application review controls.
 *
 * Approve (which also verifies the payment proof shown above), request a
 * resubmission, ask for a new payment proof, or reject. Each requires an
 * explicit confirmation checkbox before the button becomes usable. All but
 * approving also require a reason, which the applicant reads verbatim —
 * the field is labelled that way so a reviewer knows who the audience is
 * before they start typing.
 *
 * The review state the reviewer was shown is sent with the decision. If
 * someone else decided first, the server refuses rather than silently
 * overwriting their call.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { newIdempotencyKey } from "@/lib/idempotency";

type Decision = "approved" | "resubmission_requested" | "rejected" | "request_payment_proof";

const DECISION_LABELS: Record<Decision, string> = {
  approved: "Approve application",
  resubmission_requested: "Request resubmission",
  rejected: "Reject application",
  request_payment_proof: "Ask for a new payment proof",
};

/** The four buttons, in order. The payment-proof request only exists while a proof is waiting. */
const DECISION_OPTIONS: Decision[] = ["approved", "resubmission_requested", "request_payment_proof", "rejected"];

const REASON_REQUIRED: Decision[] = ["resubmission_requested", "rejected", "request_payment_proof"];

/** A pending payment proof the signed-in reviewer may verify together with the approval. */
export type PendingPayment = { intentId: string; paymentState: string; evidenceId: string; contentType: string };

/**
 * The uploaded payment proof, shown inline where the decision is made. It loads through the same
 * audited, short-lived signed-URL route as the payment screen, so each view is logged.
 */
function ProofPreview({ evidenceId, contentType, onLoaded }: { evidenceId: string; contentType: string; onLoaded: (loaded: boolean) => void }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setError(""); setUrl(""); onLoaded(false);
    try {
      const response = await fetch(`/api/payment/evidence/${evidenceId}`, { cache: "no-store" });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "The payment proof could not be opened.");
      setUrl(body.signedUrl);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The payment proof could not be opened.");
    }
  }, [evidenceId, onLoaded]);
  useEffect(() => {
    // Fetch the signed URL once when the proof is first shown.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);
  return (
    <div className="evidence-preview" aria-live="polite">
      <p className="eyebrow">Payment proof uploaded by the applicant</p>
      {error && <p className="form-message error">{error}</p>}
      {!url && !error && <p className="muted-note">Loading the payment proof…</p>}
      {url && (contentType === "application/pdf"
        ? <iframe src={url} title="Uploaded payment proof" className="receipt-preview" sandbox="" referrerPolicy="no-referrer" onLoad={() => onLoaded(true)} />
        : <Image src={url} alt="Uploaded payment proof" width={960} height={960} unoptimized onLoad={() => onLoaded(true)} onError={() => { setError("The payment proof image could not be displayed."); onLoaded(false); }} style={{ width: "100%", height: "auto", maxWidth: 480 }} />)}
      <button type="button" className="link-button" onClick={() => void load()}>Reload proof</button>
    </div>
  );
}

/** The latest uploaded proof, for any reviewer who may view payments. */
export type ProofRef = { evidenceId: string; contentType: string };

export function ReviewPanel({
  caseId,
  reviewState,
  onDecided,
  pendingPayment,
  proof,
}: {
  caseId: string;
  reviewState: string;
  onDecided: () => void;
  pendingPayment?: PendingPayment;
  proof?: ProofRef;
}) {
  const baseId = useId();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const keyRef = useRef<string>("");
  const [proofLoaded, setProofLoaded] = useState(false);

  const isFinal = reviewState === "rejected";
  // Approving again is refused by the server, so do not offer it.
  const alreadyApproved = reviewState === "approved";
  const needsReason = decision ? REASON_REQUIRED.includes(decision) : false;
  const reasonOk = !needsReason || reason.trim().length >= 10;
  const shownProof: ProofRef | undefined = pendingPayment
    ? { evidenceId: pendingPayment.evidenceId, contentType: pendingPayment.contentType }
    : proof;
  const handleProofLoaded = useCallback((loaded: boolean) => setProofLoaded(loaded), []);

  function start(next: Decision) {
    setDecision(next);
    setConfirmed(false);
    setReason("");
    setMessage("");
    setFailed(false);
    keyRef.current = newIdempotencyKey(caseId);
  }

  // Approving together with the payment proof the reviewer is looking at.
  const withPayment = decision === "approved" && Boolean(pendingPayment);

  async function commit() {
    if (!decision) return;
    setBusy(true);
    setMessage("");
    setFailed(false);
    try {
      const response = decision === "request_payment_proof" && pendingPayment
        ? await fetch(`/api/admin/cases/${caseId}/request-payment-proof`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              confirm: true,
              payment_intent_id: pendingPayment.intentId,
              evidence_id: pendingPayment.evidenceId,
              expected_payment_state: pendingPayment.paymentState,
              reason: reason.trim(),
            }),
          })
        : withPayment && pendingPayment
        ? await fetch(`/api/admin/cases/${caseId}/approve-with-payment`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              confirm: true,
              expected_review_state: reviewState,
              payment_intent_id: pendingPayment.intentId,
              evidence_id: pendingPayment.evidenceId,
              expected_payment_state: pendingPayment.paymentState,
              idempotency_key: keyRef.current,
            }),
          })
        : await fetch(`/api/admin/cases/${caseId}/review`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              decision,
              confirm: true,
              reason: needsReason ? reason.trim() : undefined,
              expected_review_state: reviewState,
              idempotency_key: keyRef.current,
            }),
          });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "The decision could not be recorded.");
      setMessage(
        decision === "request_payment_proof"
          ? "The applicant has been asked for a new payment proof. The application is unchanged."
          : withPayment
            ? "Application approved and payment verified. The member can now sign in and see their approved SafeCard."
            : "Decision recorded. Payment is unchanged; it is verified when an application is approved with its payment proof.",
      );
      setDecision(null);
      setConfirmed(false);
      setReason("");
      onDecided();
    } catch (caught) {
      setFailed(true);
      setMessage(
        caught instanceof Error ? caught.message : "The decision could not be recorded.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="admin-panel stack">
      <p className="eyebrow">Application review</p>
      <p>
        Current review state: <strong>{reviewState.replaceAll("_", " ")}</strong>
      </p>

      {shownProof && !isFinal && (
        <ProofPreview evidenceId={shownProof.evidenceId} contentType={shownProof.contentType} onLoaded={handleProofLoaded} />
      )}

      <div aria-live="polite" role="status">
        {message && <p className={failed ? "form-message error" : "form-message"}>{message}</p>}
      </div>

      {isFinal ? (
        <p className="muted-note">
          This application was rejected. Rejection is final; reopening it is a separate
          privileged action available to a privacy administrator.
        </p>
      ) : !decision ? (
        <div className="decision-actions">
          {alreadyApproved && (
            <p className="muted-note">This application is already approved. Nothing more to approve.</p>
          )}
          {DECISION_OPTIONS.filter((option) => !(alreadyApproved && option === "approved") && (option !== "request_payment_proof" || Boolean(pendingPayment))).map((option) => (
            <button
              key={option}
              type="button"
              className={option === "rejected" || option === "request_payment_proof" ? "button-quiet" : "button-primary"}
              onClick={() => start(option)}
            >
              {option === "approved" && pendingPayment ? "Approve application and verify payment" : DECISION_LABELS[option]}
            </button>
          ))}
        </div>
      ) : (
        <form
          className="review-decision"
          onSubmit={(event) => {
            event.preventDefault();
            void commit();
          }}
        >
          <p>
            <strong>{withPayment ? "Approve application and verify payment" : DECISION_LABELS[decision]}</strong>
          </p>

          {needsReason && (
            <div className="field-block">
              <label htmlFor={`${baseId}-reason`}>Reason the applicant will read</label>
              <textarea
                id={`${baseId}-reason`}
                value={reason}
                minLength={10}
                maxLength={500}
                required
                onChange={(event) => setReason(event.target.value)}
                aria-describedby={`${baseId}-reason-hint`}
              />
              <p id={`${baseId}-reason-hint`} className="field-hint">
                Written to the applicant exactly as typed. Say what they need to do.
              </p>
            </div>
          )}

          <div className="checkbox-row">
            <input
              id={`${baseId}-confirm`}
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <label htmlFor={`${baseId}-confirm`}>
              {withPayment
                ? "I confirm this decision. I looked at the payment proof shown above and verify it with this approval."
                : decision === "request_payment_proof"
                  ? "I confirm I want the applicant to upload a new payment proof. The application stays as it is."
                  : "I confirm this decision. It does not verify payment."}
            </label>
          </div>

          <div className="decision-actions">
            <button
              type="submit"
              className="button-primary"
              disabled={!confirmed || !reasonOk || busy || (withPayment && !proofLoaded)}
            >
              {busy ? "Recording…" : withPayment ? "Confirm: approve and verify payment" : `Confirm: ${DECISION_LABELS[decision]}`}
            </button>
            <button
              type="button"
              className="link-button"
              onClick={() => setDecision(null)}
              disabled={busy}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
