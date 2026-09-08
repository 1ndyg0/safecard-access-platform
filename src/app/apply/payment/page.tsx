"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface BankAccount {
  bank: string;
  type: string;
  currency: string;
  accountNumber: string;
  swiftCode: string;
  branch: string;
}

interface PaymentConfig {
  amount: number;
  accountName: string;
  channels: {
    gcash: { qrImageUrl: string; accountNumber: string };
    bankTransfer: { accounts: BankAccount[] };
  };
}

function PaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refCode = searchParams.get("ref");

  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<"gcash" | "bank_transfer" | null>(null);
  const [selectedBank, setSelectedBank] = useState<string>("");
  const [paid, setPaid] = useState(false);
  const [paymentRef, setPaymentRef] = useState("");
  const [refError, setRefError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetch("/api/payment-config")
      .then((r) => r.json())
      .then(setConfig)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleContinue = () => {
    if (!paymentRef.trim()) {
      setRefError("Kailangan ang reference number");
      return;
    }

    const formData = JSON.parse(sessionStorage.getItem("sc_form") || "{}");
    sessionStorage.setItem(
      "sc_payment",
      JSON.stringify({
        method: channel,
        referenceNumber: paymentRef.trim(),
        amount: config?.amount || 1200,
        paidAt: new Date().toISOString(),
        bankName: channel === "bank_transfer" ? selectedBank : undefined,
      })
    );

    const params = refCode ? `?ref=${refCode}` : "";
    router.push(`/apply/review${params}`);
  };

  if (loading) {
    return (
      <main style={{ minHeight: "100dvh", background: "var(--bg)", display: "grid", placeItems: "center" }}>
        <p style={{ color: "var(--text3)", fontSize: "0.88rem" }}>Naglo-load...</p>
      </main>
    );
  }

  const banks = config?.channels.bankTransfer.accounts || [];
  const bankDetails = banks.find((b) => b.bank === selectedBank);

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
        <Link href="/apply/form" style={{ fontFamily: "var(--font-jakarta)", fontSize: "0.78rem", color: "var(--text3)", textDecoration: "none" }}>
          ← Bumalik
        </Link>
        <span style={{ fontFamily: "var(--font-jakarta)", fontWeight: 700, fontSize: "0.88rem", color: "var(--text)" }}>
          Bayad
        </span>
      </nav>

      <div className="sc-progress">
        <div className="sc-progress-fill" style={{ width: "66%" }} />
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "28px 24px 100px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: s <= 2 ? "var(--red)" : "var(--surface2)",
                border: `1.5px solid ${s <= 2 ? "var(--red)" : "var(--border)"}`,
                display: "grid",
                placeItems: "center",
                fontFamily: "var(--font-jakarta)",
                fontWeight: 700,
                fontSize: "0.66rem",
                color: s <= 2 ? "#fff" : "var(--text3)",
              }}
            >
              {s < 2 ? "✓" : s}
            </div>
          ))}
          <span style={{ fontSize: "0.72rem", color: "var(--text3)", marginLeft: 4 }}>Hakbang 2 ng 3</span>
        </div>

        <h1 style={{ fontFamily: "var(--font-jakarta)", fontWeight: 800, fontSize: "1.3rem", letterSpacing: "-0.02em", marginBottom: 4, color: "var(--text)" }}>
          Bayad / Payment
        </h1>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
          <p style={{ fontSize: "0.8rem", color: "var(--text2)" }}>₱1,200 · Philippine Red Cross</p>
        </div>

        {/* Trust notice */}
        <div
          style={{
            padding: "10px 14px",
            background: "var(--green-dim)",
            borderRadius: 8,
            fontSize: "0.74rem",
            color: "var(--green)",
            fontWeight: 600,
            fontFamily: "var(--font-jakarta)",
            marginBottom: 20,
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          🔒 Ang bayad mo ay direkta sa PRC — hindi dadaan sa SafeCard platform
        </div>

        {/* Channel selector */}
        {!channel && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontFamily: "var(--font-jakarta)", fontWeight: 600, fontSize: "0.8rem", color: "var(--text2)" }}>
              Piliin ang paraan ng bayad:
            </p>
            <button
              onClick={() => setChannel("gcash")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "20px",
                background: "var(--surface)",
                border: "1.5px solid var(--border)",
                borderRadius: 12,
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
              }}
            >
              <span style={{ fontSize: "1.8rem" }}>📱</span>
              <div>
                <div style={{ fontFamily: "var(--font-jakarta)", fontWeight: 700, fontSize: "0.9rem", color: "var(--text)", marginBottom: 2 }}>
                  GCash
                </div>
                <div style={{ fontSize: "0.76rem", color: "var(--text2)" }}>I-scan ang QR Code o i-send sa GCash number</div>
              </div>
            </button>
            <button
              onClick={() => setChannel("bank_transfer")}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "20px",
                background: "var(--surface)",
                border: "1.5px solid var(--border)",
                borderRadius: 12,
                cursor: "pointer",
                textAlign: "left",
                width: "100%",
              }}
            >
              <span style={{ fontSize: "1.8rem" }}>🏦</span>
              <div>
                <div style={{ fontFamily: "var(--font-jakarta)", fontWeight: 700, fontSize: "0.9rem", color: "var(--text)", marginBottom: 2 }}>
                  Bank Transfer
                </div>
                <div style={{ fontSize: "0.76rem", color: "var(--text2)" }}>Direktang deposit sa PRC bank account (BPI, BDO, Security Bank, Metro Bank)</div>
              </div>
            </button>
          </div>
        )}

        {/* GCash flow */}
        {channel === "gcash" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <button onClick={() => setChannel(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: "0.8rem", fontFamily: "var(--font-jakarta)", padding: 0 }}>
                ← Palitan ang paraan
              </button>
            </div>
            <div className="sc-surface" style={{ padding: "24px", textAlign: "center", marginBottom: 16 }}>
              <p style={{ fontFamily: "var(--font-jakarta)", fontWeight: 700, fontSize: "0.82rem", color: "var(--text)", marginBottom: 12 }}>
                I-scan ang QR Code gamit ang GCash app
              </p>
              {config?.channels.gcash.qrImageUrl ? (
                <img
                  src={config.channels.gcash.qrImageUrl}
                  alt="GCash QR Code ng PRC"
                  style={{ maxWidth: 200, borderRadius: 8, margin: "0 auto", display: "block" }}
                />
              ) : (
                <div style={{ width: 180, height: 180, background: "var(--surface2)", borderRadius: 8, margin: "0 auto 12px", display: "grid", placeItems: "center", border: "1px solid var(--border)" }}>
                  <span style={{ fontSize: "0.72rem", color: "var(--text3)" }}>QR Code</span>
                </div>
              )}
              {config?.channels.gcash.accountNumber && (
                <div style={{ marginTop: 12 }}>
                  <p style={{ fontSize: "0.72rem", color: "var(--text3)", marginBottom: 4 }}>O i-send sa GCash number:</p>
                  <p style={{ fontFamily: "var(--font-ibm-mono)", fontWeight: 500, fontSize: "1rem", color: "var(--text)" }}>
                    {config.channels.gcash.accountNumber}
                  </p>
                </div>
              )}
              <p style={{ marginTop: 12, fontSize: "0.76rem", color: "var(--text2)" }}>
                Payee: <strong>Philippine Red Cross</strong> · Halaga: <strong>₱1,200.00</strong>
              </p>
            </div>
          </div>
        )}

        {/* Bank Transfer flow */}
        {channel === "bank_transfer" && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <button onClick={() => setChannel(null)} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text3)", fontSize: "0.8rem", fontFamily: "var(--font-jakarta)", padding: 0 }}>
                ← Palitan ang paraan
              </button>
            </div>
            <div className="sc-surface" style={{ padding: "20px", marginBottom: 16 }}>
              <p style={{ fontFamily: "var(--font-jakarta)", fontWeight: 700, fontSize: "0.82rem", color: "var(--text)", marginBottom: 12 }}>
                Pumili ng banko:
              </p>
              <select
                className="sc-input"
                value={selectedBank}
                onChange={(e) => setSelectedBank(e.target.value)}
                style={{ marginBottom: 16 }}
              >
                <option value="">Piliin ang banko</option>
                {banks.map((b) => (
                  <option key={b.bank} value={b.bank}>{b.bank}</option>
                ))}
              </select>
              {bankDetails && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
                    <span style={{ color: "var(--text3)" }}>Account Name</span>
                    <span style={{ color: "var(--text)", fontWeight: 600, fontFamily: "var(--font-jakarta)" }}>Philippine Red Cross</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
                    <span style={{ color: "var(--text3)" }}>Account No.</span>
                    <span style={{ color: "var(--text)", fontFamily: "var(--font-ibm-mono)", fontSize: "0.86rem" }}>{bankDetails.accountNumber}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem", borderBottom: "1px solid var(--border)", paddingBottom: 8 }}>
                    <span style={{ color: "var(--text3)" }}>Swift Code</span>
                    <span style={{ color: "var(--text)", fontFamily: "var(--font-ibm-mono)", fontSize: "0.86rem" }}>{bankDetails.swiftCode}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.78rem" }}>
                    <span style={{ color: "var(--text3)" }}>Branch</span>
                    <span style={{ color: "var(--text)", textAlign: "right", maxWidth: "60%" }}>{bankDetails.branch}</span>
                  </div>
                  <div style={{ marginTop: 8, padding: "8px 12px", background: "var(--amber-dim)", borderRadius: 6, fontSize: "0.72rem", color: "var(--amber)", fontFamily: "var(--font-jakarta)", fontWeight: 600 }}>
                    💡 Halaga: ₱1,200.00 · Ilagay ang iyong mobile number sa remarks/description
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* After payment — reference input */}
        {channel && (
          <div>
            {!paid ? (
              <button
                onClick={() => setPaid(true)}
                className="sc-btn-primary"
                style={{ width: "100%", justifyContent: "center", marginBottom: 16, background: "var(--green)" }}
              >
                ✓ Na-bayaran na ako
              </button>
            ) : (
              <div className="sc-surface" style={{ padding: "20px", marginBottom: 16 }}>
                <label className="sc-label">
                  {channel === "gcash" ? "GCash Reference Number (13 digits)" : "Transaction Reference Number"}
                </label>
                <input
                  className={`sc-input${refError ? " error" : ""}`}
                  value={paymentRef}
                  onChange={(e) => { setPaymentRef(e.target.value); setRefError(""); }}
                  placeholder={channel === "gcash" ? "123456789012" : "REF-XXXXXXXXXXXX"}
                  style={{ fontFamily: "var(--font-ibm-mono)" }}
                />
                {refError && <p className="sc-error">{refError}</p>}
                {channel === "bank_transfer" && !selectedBank && (
                  <p className="sc-error">Pumili muna ng banko sa itaas</p>
                )}
              </div>
            )}
          </div>
        )}

        <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "var(--surface)", borderTop: "1px solid var(--border)", padding: "12px 24px" }}>
          <button
            className="sc-btn-primary"
            disabled={!paid || !paymentRef.trim() || (channel === "bank_transfer" && !selectedBank) || submitting}
            onClick={handleContinue}
            style={{ width: "100%", justifyContent: "center" }}
          >
            {submitting ? "Naglo-load..." : "Susunod: I-review →"}
          </button>
        </div>
      </div>
    </main>
  );
}

export default function PaymentPageWrapper() {
  return (
    <Suspense>
      <PaymentPage />
    </Suspense>
  );
}
