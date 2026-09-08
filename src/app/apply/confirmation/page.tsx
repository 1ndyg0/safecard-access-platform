"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export default function ConfirmationPage() {
  const [refNumber, setRefNumber] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const ref = sessionStorage.getItem("sc_refnumber") || "SC-2026-XXXXXXXX";
    setRefNumber(ref);
    sessionStorage.removeItem("sc_refnumber");
  }, []);

  const handleCopy = () => {
    navigator.clipboard.writeText(refNumber).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleSMS = () => {
    const msg = `Naisumite ko na ang aking SafeCard application! Reference: ${refNumber}. Sa emergency, tawag sa PRC Hotline 143.`;
    window.location.href = `sms:?body=${encodeURIComponent(msg)}`;
  };

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
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 28, height: 28, background: "var(--red)", borderRadius: 7, display: "grid", placeItems: "center" }}>
            <span style={{ color: "#fff", fontWeight: 900, lineHeight: 1 }}>+</span>
          </div>
          <span style={{ fontFamily: "var(--font-jakarta)", fontWeight: 800, fontSize: "0.88rem", color: "var(--text)" }}>SafeCard</span>
        </div>
      </nav>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "48px 24px" }}>
        {/* Success */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              background: "var(--green-dim)",
              border: "2px solid var(--green)",
              display: "grid",
              placeItems: "center",
              margin: "0 auto 20px",
              fontSize: "2rem",
            }}
          >
            ✓
          </div>
          <h1
            style={{
              fontFamily: "var(--font-jakarta)",
              fontWeight: 800,
              fontSize: "1.6rem",
              letterSpacing: "-0.02em",
              color: "var(--text)",
              marginBottom: 8,
            }}
          >
            Naisumite na! 🎉
          </h1>
          <p style={{ color: "var(--text2)", fontSize: "0.86rem", lineHeight: 1.7 }}>
            Ang iyong application ay natanggap na ng Philippine Red Cross.
          </p>
        </div>

        {/* Reference Number */}
        <div className="sc-surface" style={{ padding: "24px", textAlign: "center", marginBottom: 20 }}>
          <p style={{ fontFamily: "var(--font-jakarta)", fontWeight: 600, fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--text3)", marginBottom: 8 }}>
            Reference Number
          </p>
          <div className="sc-ref" style={{ fontSize: "1.2rem", marginBottom: 12 }}>
            {refNumber}
          </div>
          <p style={{ fontSize: "0.72rem", color: "var(--text3)", marginBottom: 16, lineHeight: 1.6 }}>
            I-screenshot o kopyahin ang reference number na ito. Kailangan mo ito para i-check ang status ng iyong application.
          </p>
          <div style={{ display: "flex", gap: 10 }}>
            <button onClick={handleCopy} className="sc-btn-outline" style={{ flex: 1, justifyContent: "center" }}>
              {copied ? "✓ Nakopya!" : "📋 Kopyahin"}
            </button>
            <button onClick={handleSMS} className="sc-btn-outline" style={{ flex: 1, justifyContent: "center" }}>
              📱 I-share via SMS
            </button>
          </div>
        </div>

        {/* What's next */}
        <div className="sc-surface" style={{ padding: "20px", marginBottom: 16 }}>
          <p style={{ fontFamily: "var(--font-jakarta)", fontWeight: 700, fontSize: "0.82rem", color: "var(--text)", marginBottom: 12 }}>
            Ano ang mangyayari?
          </p>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { step: 1, text: "Ibe-verify ng aming team ang inyong bayad (1–2 araw)" },
              { step: 2, text: "Ipapadala ang iyong application sa Philippine Red Cross" },
              { step: 3, text: "Makakatanggap ka ng SMS kapag nakumpirma ang iyong membership" },
            ].map(({ step, text }) => (
              <div key={step} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: "50%",
                    background: "var(--red)",
                    color: "#fff",
                    display: "grid",
                    placeItems: "center",
                    fontFamily: "var(--font-jakarta)",
                    fontWeight: 700,
                    fontSize: "0.62rem",
                    flexShrink: 0,
                    marginTop: 1,
                  }}
                >
                  {step}
                </span>
                <p style={{ fontSize: "0.8rem", color: "var(--text2)", lineHeight: 1.6, margin: 0 }}>{text}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Warning */}
        <div
          style={{
            padding: "12px 14px",
            background: "var(--amber-dim)",
            borderRadius: 8,
            fontSize: "0.76rem",
            color: "var(--amber)",
            fontFamily: "var(--font-jakarta)",
            fontWeight: 600,
            marginBottom: 16,
            lineHeight: 1.6,
          }}
        >
          ⚠️ Ang &quot;Submitted&quot; ay hindi pa ibig sabihin ng &quot;Aktibong Miyembro&quot;. Abangan ang SMS mula sa PRC para sa kumpirmasyon.
        </div>

        {/* Emergency */}
        <div
          style={{
            padding: "14px",
            background: "var(--red-dim)",
            borderRadius: 8,
            textAlign: "center",
            marginBottom: 24,
          }}
        >
          <p style={{ fontFamily: "var(--font-jakarta)", fontWeight: 700, fontSize: "0.82rem", color: "var(--red)", marginBottom: 4 }}>
            Sa emergency habang hinihintay ang kumpirmasyon:
          </p>
          <a
            href="tel:143"
            style={{
              fontFamily: "var(--font-ibm-mono)",
              fontWeight: 700,
              fontSize: "1.6rem",
              color: "var(--red)",
              textDecoration: "none",
              display: "block",
            }}
          >
            📞 143
          </a>
          <p style={{ fontSize: "0.7rem", color: "var(--text3)", marginTop: 4 }}>PRC Hotline — available 24/7</p>
        </div>

        <Link href="/member" className="sc-btn-primary" style={{ width: "100%", justifyContent: "center", display: "flex" }}>
          Tingnan ang aking SafeCard →
        </Link>
      </div>
    </main>
  );
}
