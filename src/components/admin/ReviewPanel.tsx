"use client";

/**
 * Staff application review controls.
 *
 * Three decisions, each requiring an explicit confirmation checkbox
 * before the button becomes usable. Requesting a resubmission and
 * rejecting also require a reason, which the applicant reads verbatim —
 * the field is labelled that way so a reviewer knows who the audience is
 * before they start typing.
 *
 * The review state the reviewer was shown is sent with the decision. If
 * someone else decided first, the server refuses rather than silently
 * overwriting their call.
 */

import { useId, useRef, useState } from "react";
import { newIdempotencyKey } from "@/lib/idempotency";

type Decision = "approved" | "resubmission_requested" | "rejected";

const DECISION_LABELS: Record<Decision, string> = {
  approved: "Approve application",
  resubmission_requested: "Request resubmission",
  rejected: "Reject application",
};

const REASON_REQUIRED: Decision[] = ["resubmission_requested", "rejected"];

export function ReviewPanel({
  caseId,
  reviewState,
  onDecided,
}: {
  caseId: string;
  reviewState: string;
  onDecided: () => void;
}) {
  const baseId = useId();
  const [decision, setDecision] = useState<Decision | null>(null);
  const [reason, setReason] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [failed, setFailed] = useState(false);
  const keyRef = useRef<string>("");

  const isFinal = reviewState === "rejected";
  const needsReason = decision ? REASON_REQUIRED.includes(decision) : false;
  const reasonOk = !needsReason || reason.trim().length >= 10;

  function start(next: Decision) {
    setDecision(next);
    setConfirmed(false);
    setReason("");
    setMessage("");
    setFailed(false);
    keyRef.current = newIdempotencyKey(caseId);
  }

  async function commit() {
    if (!decision) return;
    setBusy(true);
    setMessage("");
    setFailed(false);
    try {
      const response = await fetch(`/api/admin/cases/${caseId}/review`, {
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
        "Decision recorded. Payment, PRC handoff and membership are unchanged — only PRC confirmation can activate membership.",
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
          {(Object.keys(DECISION_LABELS) as Decision[]).map((option) => (
            <button
              key={option}
              type="button"
              className={option === "rejected" ? "button-quiet" : "button-primary"}
              onClick={() => start(option)}
            >
              {DECISION_LABELS[option]}
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
            <strong>{DECISION_LABELS[decision]}</strong>
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
              I confirm this decision. It does not verify payment and does not activate
              membership.
            </label>
          </div>

          <div className="decision-actions">
            <button
              type="submit"
              className="button-primary"
              disabled={!confirmed || !reasonOk || busy}
            >
              {busy ? "Recording…" : `Confirm: ${DECISION_LABELS[decision]}`}
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
