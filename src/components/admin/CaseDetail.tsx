"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";

type Detail = {
  case: Record<string, string>;
  profile: Record<string, string> | null;
  payments: Array<Record<string, string>>;
};

export function CaseDetail({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = useState<Detail>();
  const [error, setError] = useState("");
  const [actionMessage, setActionMessage] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [officialRef, setOfficialRef] = useState("");
  const [verifSource, setVerifSource] = useState<"manual_prc_reconciliation" | "prc_confirmation">("manual_prc_reconciliation");

  const loadDetail = useCallback(() => {
    fetch(`/api/admin/cases/${id}`, { cache: "no-store" })
      .then(async (response) => {
        const body = await response.json();
        if (response.status === 401) {
          router.replace("/admin/login");
          return;
        }
        if (!response.ok) throw new Error(body.error ?? "Failed to fetch case detail");
        setData(body);
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load."));
  }, [id, router]);

  useEffect(() => {
    loadDetail();
  }, [loadDetail]);

  async function handleVerifyPayment(event: FormEvent) {
    event.preventDefault();
    if (!data?.payments?.length) return;
    const paymentIntentId = data.payments[0].id;
    setActionMessage("");
    setVerifying(true);
    try {
      const response = await fetch("/api/payment/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_intent_id: paymentIntentId,
          verification_source: verifSource,
          evidence: officialRef ? { official_reference: officialRef } : undefined,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Payment verification failed");
      setActionMessage("Payment verified successfully!");
      loadDetail();
    } catch (err) {
      setActionMessage(err instanceof Error ? err.message : "Verification error");
    } finally {
      setVerifying(false);
    }
  }

  const profile = data?.profile;
  const isPaymentVerified = data?.case?.payment_state === "verified_by_official_source";

  return (
    <AdminShell>
      <header className="admin-heading">
        <div>
          <p className="eyebrow">Authorized case detail</p>
          <h1>{data?.case.application_ref ?? "Submission"}</h1>
        </div>
        <Link href="/admin/submissions" className="button-quiet">
          Back to queue
        </Link>
      </header>

      {error && <p className="form-message error">{error}</p>}
      {actionMessage && <p className="form-message info">{actionMessage}</p>}

      {data && (
        <>
          <div className="state-grid">
            {["consent_state", "application_state", "payment_state", "prc_handoff_state", "membership_state"].map((key) => (
              <article key={key}>
                <span>{key.replaceAll("_", " ")}</span>
                <strong>{data.case[key]?.replaceAll("_", " ")}</strong>
              </article>
            ))}
          </div>

          <section className="admin-panel stack">
            <p className="eyebrow">Minimum necessary profile</p>
            {profile ? (
              <dl className="review-list">
                <div>
                  <dt>Name</dt>
                  <dd>{[profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(" ")}</dd>
                </div>
                <div>
                  <dt>Date of birth</dt>
                  <dd>{profile.date_of_birth}</dd>
                </div>
                <div>
                  <dt>Mobile</dt>
                  <dd>{profile.mobile_number}</dd>
                </div>
                <div>
                  <dt>Address</dt>
                  <dd>
                    {[profile.address_line1, profile.address_line2, profile.city, profile.province, profile.zip_code]
                      .filter(Boolean)
                      .join(", ")}
                  </dd>
                </div>
              </dl>
            ) : (
              <p>No profile has been submitted.</p>
            )}
          </section>

          <section className="admin-panel stack">
            <p className="eyebrow">Payment evidence & Reconciliation</p>
            {data.payments.length ? (
              data.payments.map((payment) => (
                <article key={payment.id} className="payment-row" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong>{payment.payment_state?.replaceAll("_", " ")}</strong>
                    <span>{payment.payment_route} · {payment.expected_amount} PHP</span>
                  </div>
                  {payment.reference_number && (
                    <p style={{ fontSize: "0.875rem", margin: 0 }}>
                      Payer Ref Number: <code>{payment.reference_number}</code>
                    </p>
                  )}
                </article>
              ))
            ) : (
              <p>No payment intent recorded.</p>
            )}

            {data.payments.length > 0 && !isPaymentVerified && (
              <form onSubmit={handleVerifyPayment} style={{ marginTop: "1rem", display: "flex", flexDirection: "column", gap: "0.75rem", borderTop: "1px solid var(--border)", paddingTop: "1rem" }}>
                <p className="eyebrow">Verify Payment against Bank/GCash Statement</p>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <span>Official Bank Statement / Settlement Ref # (Optional):</span>
                  <input
                    type="text"
                    value={officialRef}
                    onChange={(e) => setOfficialRef(e.target.value)}
                    placeholder="e.g. BPI-STATEMENT-2026-09"
                    style={{ padding: "0.5rem", borderRadius: "0.25rem", border: "1px solid var(--border)", background: "var(--card)" }}
                  />
                </label>
                <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                  <span>Verification Source:</span>
                  <select
                    value={verifSource}
                    onChange={(e) => setVerifSource(e.target.value as "manual_prc_reconciliation" | "prc_confirmation")}
                    style={{ padding: "0.5rem", borderRadius: "0.25rem", border: "1px solid var(--border)", background: "var(--card)" }}
                  >
                    <option value="manual_prc_reconciliation">Manual Bank/GCash Reconciliation</option>
                    <option value="prc_confirmation">Direct PRC Confirmation</option>
                  </select>
                </label>
                <button type="submit" className="button-primary" disabled={verifying} style={{ alignSelf: "flex-start" }}>
                  {verifying ? "Verifying..." : "Confirm & Mark Payment Verified"}
                </button>
              </form>
            )}
          </section>
        </>
      )}
    </AdminShell>
  );
}
