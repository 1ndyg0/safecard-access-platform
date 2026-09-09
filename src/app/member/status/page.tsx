"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";

type StatusData = {
  reference: string;
  states: {
    application_state: string;
    payment_state: string;
    prc_handoff_state: string;
    membership_state: string;
    updated_at: string;
  };
  nextAction: string;
};

const steps = [
  { key: "application_state", label: "Application" },
  { key: "payment_state", label: "Payment" },
  { key: "prc_handoff_state", label: "PRC handoff" },
  { key: "membership_state", label: "Membership" },
] as const;

export default function MemberStatusPage() {
  const router = useRouter();
  const [status, setStatus] = useState<StatusData>();
  const [error, setError] = useState("");
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentRef, setPaymentRef] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentMsg, setPaymentMsg] = useState("");

  const loadStatus = useCallback(() => {
    fetch("/api/member/status", { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json();
        if (response.status === 401) {
          router.replace("/member");
          return;
        }
        if (!response.ok) throw new Error(data.error);
        setStatus(data);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load."));
  }, [router]);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  async function handleMarkPaid(e: FormEvent) {
    e.preventDefault();
    if (!paymentRef.trim()) return;
    setSubmittingPayment(true);
    setPaymentMsg("");
    try {
      const response = await fetch("/api/payment/mark-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reference_number: paymentRef.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to update payment status");
      setPaymentMsg("Payment reference submitted! Pending staff reconciliation.");
      setPaymentRef("");
      setShowPaymentForm(false);
      loadStatus();
    } catch (err) {
      setPaymentMsg(err instanceof Error ? err.message : "Submission error");
    } finally {
      setSubmittingPayment(false);
    }
  }

  const isPaymentPending =
    status?.states?.payment_state === "not_started" ||
    status?.states?.payment_state === "official_handoff_opened";

  return (
    <main className="portal-page">
      <div className="portal-shell">
        <header className="portal-header">
          <Link href="/">
            <BrandMark />
          </Link>
          <Link href="/member/card" className="button-quiet">
            Electronic card
          </Link>
        </header>

        <section className="portal-card">
          <p className="eyebrow">Status tracker</p>
          <h1>{status?.reference ?? "Application status"}</h1>

          {error ? (
            <p className="form-message error">{error}</p>
          ) : !status ? (
            <p>Loading protected status…</p>
          ) : (
            <>
              <div className="status-timeline">
                {steps.map((step, index) => (
                  <article key={step.key}>
                    <span>{index + 1}</span>
                    <div>
                      <strong>{step.label}</strong>
                      <p>{status.states[step.key].replaceAll("_", " ")}</p>
                    </div>
                  </article>
                ))}
              </div>

              <div className="notice-panel">
                <strong>What happens next</strong>
                <span>{status.nextAction}</span>
              </div>

              {isPaymentPending && (
                <div style={{ marginTop: "1.5rem", padding: "1rem", borderRadius: "0.5rem", border: "1px solid var(--border)", background: "var(--card)" }}>
                  <p className="eyebrow">Action Required: Complete Payment</p>
                  <p style={{ fontSize: "0.875rem", margin: "0.5rem 0" }}>
                    If you have already sent your fee via GCash or Bank Deposit, please enter your transaction reference number below to notify staff for verification.
                  </p>
                  {!showPaymentForm ? (
                    <button type="button" className="button-primary" onClick={() => setShowPaymentForm(true)}>
                      Submit Payment Reference Number →
                    </button>
                  ) : (
                    <form onSubmit={handleMarkPaid} style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "0.75rem" }}>
                      <input
                        type="text"
                        value={paymentRef}
                        onChange={(e) => setPaymentRef(e.target.value)}
                        placeholder="e.g. 100293847561 (GCash Ref #)"
                        required
                        style={{ padding: "0.5rem", borderRadius: "0.25rem", border: "1px solid var(--border)", background: "var(--card)" }}
                      />
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button type="submit" className="button-primary" disabled={submittingPayment}>
                          {submittingPayment ? "Submitting..." : "Submit Reference"}
                        </button>
                        <button type="button" className="button-quiet" onClick={() => setShowPaymentForm(false)}>
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                  {paymentMsg && <p style={{ fontSize: "0.875rem", color: "var(--accent)", marginTop: "0.5rem" }}>{paymentMsg}</p>}
                </div>
              )}

              <p className="portal-footnote">
                Last updated {new Date(status.states.updated_at).toLocaleString()}. For official questions, call{" "}
                <a href="tel:143">Hotline 143</a>.
              </p>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
