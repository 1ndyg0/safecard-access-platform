"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface FormData {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  sex: string;
  mobile_number: string;
  address_line1: string;
  city: string;
  province: string;
  zip_code: string;
  refCode?: string;
}

interface PaymentData {
  method: "gcash" | "bank_transfer";
  referenceNumber: string;
  amount: number;
  paidAt: string;
  bankName?: string;
}

function ReviewPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [formData, setFormData] = useState<FormData | null>(null);
  const [paymentData, setPaymentData] = useState<PaymentData | null>(null);
  const [consents, setConsents] = useState({ voluntary: false, benefits: false, dataSharing: false });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const fd = JSON.parse(sessionStorage.getItem("sc_form") || "{}");
      const pd = JSON.parse(sessionStorage.getItem("sc_payment") || "{}");
      if (!fd.first_name) { router.push("/apply/form"); return; }
      if (!pd.referenceNumber) { router.push("/apply/payment"); return; }
      setFormData(fd);
      setPaymentData(pd);
    } catch {
      router.push("/apply/form");
    }
  }, [router]);

  const allConsented = consents.voluntary && consents.benefits && consents.dataSharing;

  const handleSubmit = async () => {
    if (!allConsented || !formData || !paymentData) return;
    setSubmitting(true);
    setError("");

    try {
      const campaignId = process.env.NEXT_PUBLIC_CAMPAIGN_ID;

      // Step 1: Create a recipient case
      const caseRes = await fetch("/api/intake/case", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: campaignId || "00000000-0000-0000-0000-000000000000",
          decision: "accept",
          data_mode: process.env.LAUNCH_GATES_COMPLETE === "true" ? "live" : "synthetic",
        }),
      });

      const caseJson = await caseRes.json();
      if (!caseRes.ok) {
        throw new Error(caseJson.error || "Hindi makapag-submit. Subukan muli.");
      }

      const caseId = caseJson.caseId;

      if (caseId) {
        // Step 2: Submit profile
        await fetch("/api/intake/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            case_id: caseId,
            profile: {
              first_name: formData.first_name,
              last_name: formData.last_name,
              date_of_birth: formData.date_of_birth,
              sex: formData.sex,
              mobile_number: formData.mobile_number,
              address_line1: formData.address_line1,
              city: formData.city,
              province: formData.province,
              zip_code: formData.zip_code,
            },
            data_mode: process.env.LAUNCH_GATES_COMPLETE === "true" ? "live" : "synthetic",
          }),
        });

        // Step 3: Record payment
        await fetch("/api/payment/mark-paid", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            case_id: caseId,
            payment_reference: paymentData.referenceNumber,
            payment_route: paymentData.method,
            data_mode: process.env.LAUNCH_GATES_COMPLETE === "true" ? "live" : "synthetic",
          }),
        });
      }

      // Generate a local reference number for the confirmation screen
      const refNumber = `SC-${new Date().getFullYear()}-${Math.random().toString(36).toUpperCase().substring(2, 10).replace(/[0OIL1]/g, 'X')}`;
      sessionStorage.setItem("sc_refnumber", refNumber);
      sessionStorage.setItem("sc_case_id", caseId || "");

      // Clear sensitive data
      sessionStorage.removeItem("sc_form");
      sessionStorage.removeItem("sc_payment");

      router.push("/apply/confirmation");
    } catch (err) {
      setError(err instanceof Error ? err.message : "May nangyaring error. Subukan muli.");
      setSubmitting(false);
    }
  };

  if (!formData || !paymentData) {
    return (
      <main style={{ minHeight: "100dvh", background: "var(--bg)", display: "grid", placeItems: "center" }}>
        <p style={{ color: "var(--text3)" }}>Naglo-load...</p>
      </main>
    );
  }

  return (
    <main style={{ minHeight: "100dvh", background: "var(--bg)" }}>
      <nav
        style={{
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          height: "56px",
          gap: 16,
        }}
      >
        <Link href="/apply/payment" style={{ fontFamily: "var(--font-jakarta)", fontSize: "0.78rem", color: "var(--text3)", textDecoration: "none" }}>
          ← Bumalik
        </Link>
        <span style={{ fontFamily: "var(--font-jakarta)", fontWeight: 700, fontSize: "0.88rem", color: "var(--text)" }}>
          I-review at I-submit
        </span>
      </nav>

      <div className="sc-progress">
        <div className="sc-progress-fill" style={{ width: "100%" }} />
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "28px 24px 120px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: "var(--red)",
                border: "1.5px solid var(--red)",
                display: "grid",
                placeItems: "center",
                fontFamily: "var(--font-jakarta)",
                fontWeight: 700,
                fontSize: "0.66rem",
                color: "#fff",
              }}
            >
              {s < 3 ? "✓" : "3"}
            </div>
          ))}
          <span style={{ fontSize: "0.72rem", color: "var(--text3)", marginLeft: 4 }}>Hakbang 3 ng 3</span>
        </div>

        {/* Personal Info Summary */}
        <div className="sc-surface" style={{ padding: "20px", marginBottom: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
            <span style={{ fontFamily: "var(--font-jakarta)", fontWeight: 700, fontSize: "0.82rem", color: "var(--text)" }}>
              Impormasyong Personal
            </span>
            <Link href="/apply/form" style={{ fontSize: "0.72rem", color: "var(--red)", textDecoration: "none", fontFamily: "var(--font-jakarta)", fontWeight: 600 }}>
              I-edit
            </Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: "0.8rem" }}>
            {[
              ["Pangalan", `${formData.first_name} ${formData.last_name}`],
              ["Kasarian", formData.sex === "male" ? "Lalaki" : "Babae"],
              ["Petsa ng Kapanganakan", formData.date_of_birth],
              ["Mobile", formData.mobile_number],
            ].map(([label, val]) => (
              <div key={label}>
                <div style={{ color: "var(--text3)", fontSize: "0.68rem", marginBottom: 2 }}>{label}</div>
                <div style={{ color: "var(--text)", fontWeight: 500 }}>{val}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 8, paddingTop: 8, borderTop: "1px solid var(--border)", fontSize: "0.78rem", color: "var(--text2)" }}>
            {formData.address_line1}, {formData.city}, {formData.province} {formData.zip_code}
          </div>
        </div>

        {/* Payment Summary */}
        <div className="sc-surface" style={{ padding: "20px", marginBottom: 20, borderLeft: "3px solid var(--green)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontFamily: "var(--font-jakarta)", fontWeight: 700, fontSize: "0.82rem", color: "var(--text)" }}>
              ✓ Bayad
            </span>
            <Link href="/apply/payment" style={{ fontSize: "0.72rem", color: "var(--red)", textDecoration: "none", fontFamily: "var(--font-jakarta)", fontWeight: 600 }}>
              I-edit
            </Link>
          </div>
          <div style={{ fontSize: "0.8rem" }}>
            <div style={{ display: "flex", gap: 8, color: "var(--text2)", marginBottom: 4 }}>
              <span>Paraan:</span>
              <span style={{ fontWeight: 600, color: "var(--text)" }}>
                {paymentData.method === "gcash" ? "GCash" : `Bank Transfer (${paymentData.bankName})`}
              </span>
            </div>
            <div style={{ display: "flex", gap: 8, color: "var(--text2)", marginBottom: 4 }}>
              <span>Reference:</span>
              <span style={{ fontFamily: "var(--font-ibm-mono)", color: "var(--text)" }}>{paymentData.referenceNumber}</span>
            </div>
            <div style={{ display: "flex", gap: 8, color: "var(--text2)" }}>
              <span>Halaga:</span>
              <span style={{ fontWeight: 700, color: "var(--green)" }}>₱{paymentData.amount.toLocaleString()}.00</span>
            </div>
          </div>
        </div>

        {/* Consents */}
        <div style={{ marginBottom: 20 }}>
          <p style={{ fontFamily: "var(--font-jakarta)", fontWeight: 700, fontSize: "0.82rem", color: "var(--text)", marginBottom: 12 }}>
            Mga Pahintulot (Consents)
          </p>
          {[
            { key: "voluntary" as const, label: "Kusang-loob ako sa paglahok sa SafeCard at hindi ito kinakailangan ng aking employer o paaralan." },
            { key: "benefits" as const, label: "Naiintindihan ko ang mga benepisyo at limitasyon ng SafeCard na aking nabasa." },
            { key: "dataSharing" as const, label: "Pumapayag ako na ibahagi ang aking personal na impormasyon sa Philippine Red Cross para sa aking membership, alinsunod sa RA 10173." },
          ].map((c) => (
            <label
              key={c.key}
              style={{
                display: "flex",
                gap: 12,
                padding: "14px",
                background: consents[c.key] ? "var(--green-dim)" : "var(--surface)",
                border: `1.5px solid ${consents[c.key] ? "var(--green)" : "var(--border)"}`,
                borderRadius: 10,
                cursor: "pointer",
                marginBottom: 10,
                alignItems: "flex-start",
              }}
            >
              <input
                type="checkbox"
                checked={consents[c.key]}
                onChange={(e) => setConsents((prev) => ({ ...prev, [c.key]: e.target.checked }))}
                style={{ marginTop: 2, accentColor: "var(--red)", flexShrink: 0, width: 16, height: 16 }}
              />
              <span style={{ fontSize: "0.78rem", color: "var(--text2)", lineHeight: 1.6 }}>{c.label}</span>
            </label>
          ))}
        </div>

        {error && (
          <div style={{ padding: "12px 14px", background: "var(--red-dim)", borderRadius: 8, fontSize: "0.78rem", color: "var(--red)", marginBottom: 16, fontFamily: "var(--font-jakarta)", fontWeight: 600 }}>
            ❌ {error}
          </div>
        )}

        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "var(--surface)", borderTop: "1px solid var(--border)", padding: "12px 24px" }}>
          <button
            className="sc-btn-primary"
            disabled={!allConsented || submitting}
            onClick={handleSubmit}
            style={{ width: "100%", justifyContent: "center" }}
          >
            {submitting ? "Nagsusumite..." : "I-submit ang Application →"}
          </button>
          {!allConsented && (
            <p style={{ textAlign: "center", fontSize: "0.7rem", color: "var(--text3)", marginTop: 6 }}>
              Lagyan ng tsek ang lahat ng pahintulot para makapag-submit
            </p>
          )}
        </div>
      </div>
    </main>
  );
}

export default function ReviewWrapper() {
  return (
    <Suspense>
      <ReviewPage />
    </Suspense>
  );
}
