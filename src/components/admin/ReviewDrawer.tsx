"use client";

/**
 * Review slide-over.
 *
 * Opens from the right (full screen on phones) over the applications list and
 * shows one complete application: who applied, the application reference, when
 * it was received and the proof of payment. The administrator can do two
 * things: approve (which also verifies the payment) or reject (with a reason
 * the applicant will read). Both ask for a confirmation first.
 *
 * It is a native <dialog> opened with showModal(), so the browser provides the
 * modal behaviour: focus is trapped inside, the page behind is inert, Escape
 * closes it and focus returns to where it came from. Escape while a
 * confirmation is open backs out of the confirmation first. The slide-in is
 * switched off for people who prefer reduced motion.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { formatCalendarDate, formatDateTime, formatMoney, humanize } from "@/components/admin/format";
import { newIdempotencyKey } from "@/lib/idempotency";
import type { ApplicationStatus } from "@/lib/admin/queue";
import { REASON_MAX, REASON_MIN } from "@/lib/review/state";

export type DecisionResult = { status: ApplicationStatus; reason: string | null };

type Detail = {
  application: {
    id: string;
    application_ref: string | null;
    status: ApplicationStatus;
    review_state: string;
    received_at: string;
    rejection_reason: string | null;
    reviewed_at: string | null;
  };
  applicant: Record<string, string | null> | null;
  payment: {
    intent_id: string;
    state: string;
    route: string | null;
    reference: string | null;
    amount: string | number | null;
    currency: string;
    paid_on: string | null;
    proof: { evidence_id: string; content_type: string; uploaded_at: string; verified: boolean } | null;
  } | null;
  capabilities: { canDecide: boolean; canApprove: boolean; profileFields: string[] };
};

type Step = "idle" | "approve" | "reject";

const ROUTE_LABELS: Record<string, string> = {
  gcash: "GCash",
  bank_transfer: "Bank transfer",
  manual_prc: "Paid at a Red Cross chapter",
};

function applicantName(applicant: Detail["applicant"]): string {
  if (!applicant) return "";
  return [applicant.first_name, applicant.middle_name, applicant.last_name].filter(Boolean).join(" ");
}

function applicantAddress(applicant: NonNullable<Detail["applicant"]>): string {
  return [applicant.address_line1, applicant.address_line2, applicant.city, applicant.province, applicant.zip_code]
    .filter(Boolean)
    .join(", ");
}

export function ReviewDrawer({
  applicationId,
  onDecided,
  onClose,
}: {
  applicationId: string;
  onDecided: (id: string, result: DecisionResult) => void;
  onClose: () => void;
}) {
  const router = useRouter();
  const baseId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const approveButtonRef = useRef<HTMLButtonElement>(null);
  const rejectButtonRef = useRef<HTMLButtonElement>(null);
  const confirmGroupRef = useRef<HTMLDivElement>(null);
  const keyRef = useRef("");

  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadError, setLoadError] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<DecisionResult | null>(null);
  const [notice, setNotice] = useState("");
  const [proofShown, setProofShown] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);

  // Open as a modal dialog, lock page scroll behind it, and put focus on the
  // title so a screen reader starts at the top of the panel.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    titleRef.current?.focus();
    document.documentElement.classList.add("drawer-open");
    return () => document.documentElement.classList.remove("drawer-open");
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      await Promise.resolve();
      try {
        const response = await fetch(`/api/admin/cases/${applicationId}`, { cache: "no-store" });
        if (response.status === 401) {
          router.replace("/admin/login");
          return;
        }
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error ?? "This application could not be opened.");
        if (active) {
          setDetail(body as Detail);
          setLoadError("");
        }
      } catch (caught) {
        if (active) setLoadError(caught instanceof Error ? caught.message : "This application could not be opened.");
      }
    })();
    return () => {
      active = false;
    };
  }, [applicationId, reloadToken, router]);

  const status: ApplicationStatus = done?.status ?? detail?.application.status ?? "awaiting_review";
  const awaiting = status === "awaiting_review" && !done;
  const payment = detail?.payment ?? null;
  const canApprove = Boolean(
    awaiting && detail?.capabilities.canApprove && payment?.proof && ["verification_pending", "payer_marked_paid"].includes(payment.state),
  );
  const canReject = Boolean(awaiting && detail?.capabilities.canDecide);

  const requestClose = useCallback(() => {
    if (!busy) onClose();
  }, [busy, onClose]);

  function beginStep(next: Step) {
    setStep(next);
    setError("");
    setReason("");
    keyRef.current = newIdempotencyKey(applicationId);
  }

  function backToActions(focusRejectButton = false) {
    const previous = step;
    setStep("idle");
    setError("");
    window.setTimeout(() => {
      (previous === "reject" || focusRejectButton ? rejectButtonRef : approveButtonRef).current?.focus();
    }, 0);
  }

  // Focus the confirmation when it opens so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (step === "approve") confirmGroupRef.current?.focus();
  }, [step]);

  async function submit(path: "approve-with-payment" | "reject") {
    if (!detail) return;
    setBusy(true);
    setError("");
    try {
      const body =
        path === "reject"
          ? { confirm: true, reason: reason.trim(), idempotency_key: keyRef.current }
          : {
              confirm: true,
              expected_review_state: detail.application.review_state,
              payment_intent_id: payment?.intent_id,
              evidence_id: payment?.proof?.evidence_id,
              expected_payment_state: payment?.state,
              idempotency_key: keyRef.current,
            };
      const response = await fetch(`/api/admin/cases/${applicationId}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        if (result?.reviewState === "approved") {
          // Approved, but verifying the payment failed: show what really happened.
          const outcome: DecisionResult = { status: "approved", reason: null };
          setDone(outcome);
          onDecided(applicationId, outcome);
        }
        throw new Error(result?.error ?? "The decision could not be recorded.");
      }
      const outcome: DecisionResult =
        path === "reject" ? { status: "rejected", reason: reason.trim() } : { status: "approved", reason: null };
      setDone(outcome);
      setStep("idle");
      setNotice(
        path === "reject"
          ? "Application rejected. The applicant can read your reason on their status page."
          : "Application approved and payment verified. The member can now see their approved SafeCard.",
      );
      onDecided(applicationId, outcome);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The decision could not be recorded.");
    } finally {
      setBusy(false);
    }
  }

  const reasonLength = reason.trim().length;
  const reasonValid = reasonLength >= REASON_MIN && reasonLength <= REASON_MAX;
  const applicant = detail?.applicant ?? null;
  const name = applicantName(applicant);
  const reviewedReason = done ? done.reason : detail?.application.rejection_reason ?? null;
  const decided = status === "approved" || status === "rejected";

  return (
    <dialog
      ref={dialogRef}
      className="review-drawer"
      aria-modal="true"
      aria-labelledby={`${baseId}-title`}
      onCancel={(event) => {
        // Escape: back out of a confirmation first, then close the panel.
        event.preventDefault();
        if (busy) return;
        if (step !== "idle") backToActions();
        else onClose();
      }}
      onKeyDown={(event) => {
        // Keep Tab inside the panel: wrap from the last control to the first
        // (and back) instead of leaving for the browser's own interface.
        if (event.key !== "Tab") return;
        const dialog = event.currentTarget;
        const focusable = Array.from(
          dialog.querySelectorAll<HTMLElement>(
            'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter((element) => element.offsetParent !== null);
        if (focusable.length === 0) return;
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (event.shiftKey && (active === first || active === titleRef.current)) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }}
      onClick={(event) => {
        // A click on the dimmed area outside the panel.
        if (event.target === event.currentTarget) requestClose();
      }}
    >
      <div className="drawer-surface">
        <header className="drawer-header">
          <div className="drawer-heading">
            <p className="eyebrow">Application</p>
            <h2 id={`${baseId}-title`} ref={titleRef} tabIndex={-1}>
              {name || detail?.application.application_ref || "Loading…"}
            </h2>
            {detail && (
              <p className="drawer-ref">
                <span className="apps-ref">{detail.application.application_ref}</span>
                <StatusBadge status={status} />
              </p>
            )}
          </div>
          <button type="button" className="drawer-close" onClick={requestClose} disabled={busy} aria-label="Close review panel">
            <span aria-hidden="true">×</span>
          </button>
        </header>

        <div className="drawer-body">
          {!detail && !loadError && <p className="form-message" role="status">Loading application…</p>}
          {loadError && (
            <p className="form-message error" role="alert">
              {loadError}{" "}
              <button type="button" className="link-button" onClick={() => { setLoadError(""); setReloadToken((value) => value + 1); }}>
                Try again
              </button>
            </p>
          )}

          {detail && (
            <>
              {decided && (
                <section aria-labelledby={`${baseId}-decision`} className="drawer-section">
                  <h3 id={`${baseId}-decision`}>Decision</h3>
                  <dl className="drawer-dl">
                    <div><dt>Outcome</dt><dd>{status === "approved" ? "Approved" : "Rejected"}</dd></div>
                    {detail.application.reviewed_at && !done && (
                      <div><dt>Decided</dt><dd>{formatDateTime(detail.application.reviewed_at)}</dd></div>
                    )}
                    {status === "rejected" && (
                      <div><dt>Reason for rejection</dt><dd className="drawer-wrap" data-testid="rejection-reason">{reviewedReason ?? "—"}</dd></div>
                    )}
                  </dl>
                </section>
              )}

              <section aria-labelledby={`${baseId}-applicant`} className="drawer-section">
                <h3 id={`${baseId}-applicant`}>Applicant</h3>
                {applicant ? (
                  <dl className="drawer-dl">
                    <div><dt>Name</dt><dd>{name || "—"}</dd></div>
                    <div><dt>Date of birth</dt><dd>{formatCalendarDate(applicant.date_of_birth)}</dd></div>
                    <div><dt>Sex</dt><dd>{humanize(applicant.sex)}</dd></div>
                    <div><dt>Mobile</dt><dd>{applicant.mobile_number ?? "—"}</dd></div>
                    <div><dt>Email</dt><dd className="drawer-wrap">{applicant.email ?? "—"}</dd></div>
                    <div><dt>Address</dt><dd>{applicantAddress(applicant) || "—"}</dd></div>
                  </dl>
                ) : (
                  <p className="muted-note">Your role does not include applicant details.</p>
                )}
              </section>

              <section aria-labelledby={`${baseId}-application`} className="drawer-section">
                <h3 id={`${baseId}-application`}>Application</h3>
                <dl className="drawer-dl">
                  <div><dt>Reference</dt><dd><span className="apps-ref">{detail.application.application_ref ?? "—"}</span></dd></div>
                  <div><dt>Submitted</dt><dd>{formatDateTime(detail.application.received_at)}</dd></div>
                </dl>
              </section>

              <section aria-labelledby={`${baseId}-payment`} className="drawer-section">
                <h3 id={`${baseId}-payment`}>Proof of payment</h3>
                {!payment ? (
                  <p className="muted-note">Your role cannot view payment details.</p>
                ) : (
                  <>
                    {payment.proof ? (
                      <ProofPreview
                        evidenceId={payment.proof.evidence_id}
                        contentType={payment.proof.content_type}
                        onShown={setProofShown}
                      />
                    ) : (
                      <p className="form-message">No proof of payment has been uploaded.</p>
                    )}
                    <dl className="drawer-dl">
                      <div><dt>Amount</dt><dd>{formatMoney(payment.amount, payment.currency)}</dd></div>
                      <div><dt>Payment date</dt><dd>{formatCalendarDate(payment.paid_on)}</dd></div>
                      <div><dt>Reference number</dt><dd className="drawer-wrap">{payment.reference ?? "—"}</dd></div>
                      <div><dt>Route</dt><dd>{payment.route ? ROUTE_LABELS[payment.route] ?? humanize(payment.route) : "—"}</dd></div>
                    </dl>
                  </>
                )}
              </section>

            </>
          )}
        </div>

        <footer className="drawer-footer">
          <div aria-live="polite" role="status">
            {notice && <p className="form-message">{notice}</p>}
          </div>
          {error && <p className="form-message error" role="alert">{error}</p>}

          {detail && awaiting && step === "idle" && (
            <>
              {!canApprove && !canReject && (
                <p className="muted-note">Your role can view this application but not decide it.</p>
              )}
              {(canApprove || canReject) && (
                <div className="drawer-actions">
                  {canApprove && (
                    <button
                      ref={approveButtonRef}
                      type="button"
                      className="button-primary"
                      onClick={() => beginStep("approve")}
                      disabled={!proofShown}
                      aria-describedby={!proofShown ? `${baseId}-approve-hint` : undefined}
                    >
                      Approve
                    </button>
                  )}
                  {canReject && (
                    <button ref={rejectButtonRef} type="button" className="button-reject" onClick={() => beginStep("reject")}>
                      Reject
                    </button>
                  )}
                </div>
              )}
              {canApprove && !proofShown && (
                <p id={`${baseId}-approve-hint`} className="field-hint">Look at the proof of payment before approving.</p>
              )}
              {!canApprove && canReject && !payment?.proof && (
                <p className="field-hint">Approval needs an uploaded proof of payment.</p>
              )}
            </>
          )}

          {step === "approve" && (
            <div ref={confirmGroupRef} tabIndex={-1} role="group" aria-labelledby={`${baseId}-approve-title`} className="drawer-confirm">
              <p id={`${baseId}-approve-title`}><strong>Approve this application?</strong></p>
              <p className="muted-note">
                You looked at the proof of payment. Approving also verifies that payment and gives the member their SafeCard.
              </p>
              <div className="drawer-actions">
                <button type="button" className="button-primary" onClick={() => void submit("approve-with-payment")} disabled={busy}>
                  {busy ? "Approving…" : "Confirm approve"}
                </button>
                <button type="button" className="button-quiet" onClick={() => backToActions()} disabled={busy}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {step === "reject" && (
            <form
              className="drawer-confirm"
              onSubmit={(event) => {
                event.preventDefault();
                if (reasonValid) void submit("reject");
              }}
            >
              <div className="field-block">
                <label htmlFor={`${baseId}-reason`}>Reason for rejection</label>
                <textarea
                  id={`${baseId}-reason`}
                  value={reason}
                  required
                  minLength={REASON_MIN}
                  maxLength={REASON_MAX}
                  rows={4}
                  autoFocus
                  disabled={busy}
                  onChange={(event) => setReason(event.target.value)}
                  aria-describedby={`${baseId}-reason-hint`}
                />
                <p id={`${baseId}-reason-hint`} className="field-hint reason-hint">
                  <span>The applicant reads this exactly as written. At least {REASON_MIN} characters.</span>
                  <span className={reasonLength > 0 && reasonLength < REASON_MIN ? "counter-short" : undefined} data-testid="reason-counter">
                    {reasonLength} / {REASON_MAX}
                  </span>
                </p>
              </div>
              <div className="drawer-actions">
                <button type="submit" className="button-reject-solid" disabled={!reasonValid || busy}>
                  {busy ? "Rejecting…" : "Confirm reject"}
                </button>
                <button type="button" className="button-quiet" onClick={() => backToActions(true)} disabled={busy}>
                  Cancel
                </button>
              </div>
            </form>
          )}

          {(done || decided || !awaiting) && step === "idle" && (
            <div className="drawer-actions">
              <button type="button" className="button-quiet" onClick={requestClose}>
                Close
              </button>
            </div>
          )}
        </footer>
      </div>
    </dialog>
  );
}

/**
 * The uploaded proof of payment. It loads through the audited, short-lived
 * signed-URL route, so each view is logged.
 */
function ProofPreview({
  evidenceId,
  contentType,
  onShown,
}: {
  evidenceId: string;
  contentType: string;
  onShown: (shown: boolean) => void;
}) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    void (async () => {
      await Promise.resolve();
      if (!active) return;
      setError("");
      setUrl("");
      onShown(false);
      try {
        const response = await fetch(`/api/payment/evidence/${evidenceId}`, { cache: "no-store" });
        const body = await response.json().catch(() => null);
        if (!response.ok) throw new Error(body?.error ?? "The proof of payment could not be opened.");
        if (active) setUrl(body.signedUrl);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "The proof of payment could not be opened.");
      }
    })();
    return () => {
      active = false;
    };
  }, [evidenceId, attempt, onShown]);

  return (
    <div className="proof-preview" aria-live="polite">
      {error && (
        <p className="form-message error" role="alert">
          {error}{" "}
          <button type="button" className="link-button" onClick={() => setAttempt((value) => value + 1)}>
            Try again
          </button>
        </p>
      )}
      {!url && !error && <p className="muted-note">Loading the proof of payment…</p>}
      {url &&
        (contentType === "application/pdf" ? (
          <iframe
            src={url}
            title="Uploaded proof of payment (PDF)"
            className="proof-frame"
            sandbox=""
            referrerPolicy="no-referrer"
            onLoad={() => onShown(true)}
          />
        ) : (
          <Image
            src={url}
            alt="Uploaded proof of payment"
            width={960}
            height={960}
            unoptimized
            className="proof-image"
            onLoad={() => onShown(true)}
            onError={() => {
              setError("The proof of payment image could not be displayed.");
              onShown(false);
            }}
          />
        ))}
      {url && (
        <a className="link-button" href={url} target="_blank" rel="noopener noreferrer">
          Open full size
        </a>
      )}
    </div>
  );
}
