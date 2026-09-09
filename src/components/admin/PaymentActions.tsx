"use client";

/**
 * Finance actions on a single payment intent.
 *
 * Both actions require an explicit confirmation checkbox, and both send
 * the payment state the reviewer was looking at. If the state moved
 * since the page loaded — another reviewer got there first — the server
 * rejects the request rather than applying a decision made against a
 * stale screen.
 *
 * These controls only ever act on the one intent they were rendered
 * for. There is no bulk verify: verifying a payment means a person
 * looked at a receipt, and a checkbox on twenty rows is not that.
 */

import { useId, useState } from "react";

type Evidence = {
  id: string;
  evidence_type: string;
  reference_number: string | null;
  amount_confirmed: string | number | null;
  is_verified: boolean;
  created_at: string;
};

export function PaymentActions({
  caseId,
  paymentIntentId,
  paymentState,
  evidence = [],
  onCompleted,
}: {
  caseId: string;
  paymentIntentId: string;
  paymentState: string;
  evidence?: Evidence[];
  onCompleted: () => void;
}) {
  const baseId = useId();
  const [mode, setMode] = useState<"idle" | "verify" | "reupload">("idle");
  const [evidenceId, setEvidenceId] = useState(evidence[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);

  function reset() {
    setMode("idle");
    setConfirmed(false);
    setReason("");
    setBusy(false);
  }

  async function submit(action: "verify_payment" | "request_reupload") {
    setBusy(true);
    setMessage("");
    setFailed(false);
    try {
      const payload =
        action === "verify_payment"
          ? {
              action,
              payment_intent_id: paymentIntentId,
              confirm: true as const,
              evidence_id: evidenceId,
              expected_payment_state: paymentState,
            }
          : {
              action,
              payment_intent_id: paymentIntentId,
              confirm: true as const,
              reason,
              expected_payment_state: paymentState,
            };

      const response = await fetch(`/api/admin/cases/${caseId}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "The action could not be completed.");

      setMessage(
        action === "verify_payment"
          ? "Payment verified. Membership is unchanged — only PRC confirmation can activate it."
          : "Replacement evidence requested. The applicant will see your reason.",
      );
      reset();
      onCompleted();
    } catch (caught) {
      setFailed(true);
      setMessage(caught instanceof Error ? caught.message : "The action could not be completed.");
      setBusy(false);
    }
  }

  return (
    <div className="payment-actions">
      <div aria-live="polite" role="status">
        {message && (
          <p className={failed ? "form-message error" : "form-message"}>{message}</p>
        )}
      </div>

      {mode === "idle" && (
        <div className="filter-actions">
          <button
            type="button"
            className="button-primary"
            onClick={() => setMode("verify")}
            disabled={evidence.length === 0}
          >
            Verify payment
          </button>
          <button type="button" className="button-quiet" onClick={() => setMode("reupload")}>
            Request replacement evidence
          </button>
          {evidence.length === 0 && (
            <p className="field-hint">No evidence has been submitted to verify yet.</p>
          )}
        </div>
      )}

      {mode === "verify" && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit("verify_payment");
          }}
        >
          <div className="field-block compact">
            <label htmlFor={`${baseId}-evidence`}>Evidence reviewed</label>
            <select
              id={`${baseId}-evidence`}
              value={evidenceId}
              onChange={(event) => setEvidenceId(event.target.value)}
              required
            >
              {evidence.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.evidence_type.replaceAll("_", " ")} ·{" "}
                  {item.reference_number ?? "no reference"} ·{" "}
                  {new Date(item.created_at).toISOString().slice(0, 10)}
                </option>
              ))}
            </select>
          </div>

          <div className="checkbox-row">
            <input
              id={`${baseId}-confirm-verify`}
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <label htmlFor={`${baseId}-confirm-verify`}>
              I have opened this evidence and it matches the expected payment.
            </label>
          </div>

          <div className="filter-actions">
            <button type="submit" className="button-primary" disabled={!confirmed || busy}>
              {busy ? "Verifying…" : "Confirm verification"}
            </button>
            <button type="button" className="link-button" onClick={reset} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {mode === "reupload" && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit("request_reupload");
          }}
        >
          <div className="field-block compact">
            <label htmlFor={`${baseId}-reason`}>Reason shown to the applicant</label>
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
              Write what the applicant needs to do differently. They will read this exactly
              as written.
            </p>
          </div>

          <div className="checkbox-row">
            <input
              id={`${baseId}-confirm-reupload`}
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
            />
            <label htmlFor={`${baseId}-confirm-reupload`}>
              I confirm this reason is accurate and safe to send.
            </label>
          </div>

          <div className="filter-actions">
            <button
              type="submit"
              className="button-primary"
              disabled={!confirmed || busy || reason.trim().length < 10}
            >
              {busy ? "Sending…" : "Request replacement"}
            </button>
            <button type="button" className="link-button" onClick={reset} disabled={busy}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
