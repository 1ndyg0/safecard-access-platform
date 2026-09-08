"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface CardData {
  referenceNumber: string;
  memberName: string;
  status: "active" | "pending" | "expired";
  validUntil: string | null;
  planName: string;
  benefits: {
    ambulance: number;
    blood: number;
    hospitalization: number;
    dengue: number;
  };
  qrPayload: string;
}

function QRCodeDisplay({ url }: { url: string }) {
  // Simple QR code display using an external API
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(url)}&size=80x80&margin=0`;
  return (
    <div
      style={{
        width: 88,
        height: 88,
        background: "#fff",
        borderRadius: 8,
        padding: 4,
        display: "grid",
        placeItems: "center",
      }}
    >
      <img src={qrUrl} alt="Verification QR" width={80} height={80} />
    </div>
  );
}

export default function MemberCardPage() {
  const router = useRouter();
  const [card, setCard] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);

  useEffect(() => {
    const token = sessionStorage.getItem("sc_member_token");
    if (!token) { router.push("/member"); return; }

    fetch("/api/member/card", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        if (r.status === 401) { router.push("/member"); return; }
        const json = await r.json();
        if (!r.ok) throw new Error(json.error);
        setCard(json);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [router]);

  const handleCopy = () => {
    if (!card) return;
    navigator.clipboard.writeText(card.referenceNumber).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  if (loading) {
    return (
      <main style={{ minHeight: "100dvh", background: "var(--navy)", display: "grid", placeItems: "center" }}>
        <p style={{ color: "rgba(255,255,255,0.5)" }}>Naglo-load ng iyong SafeCard...</p>
      </main>
    );
  }

  if (error || !card) {
    return (
      <main style={{ minHeight: "100dvh", background: "var(--navy)", display: "grid", placeItems: "center" }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <p style={{ color: "rgba(255,255,255,0.5)", marginBottom: 16 }}>{error || "Hindi mahanap ang card."}</p>
          <Link href="/member" className="sc-btn-primary">Bumalik sa Login</Link>
        </div>
      </main>
    );
  }

  const statusLabel = card.status === "active" ? "● Active" : card.status === "pending" ? "● Pending" : "● Expired";
  const statusColor = card.status === "active" ? "#22c55e" : card.status === "pending" ? "#f59e0b" : "#9ca3af";

  return (
    <main style={{ minHeight: "100dvh", background: "var(--navy)", padding: "0 0 40px" }}>
      {/* Nav */}
      <nav style={{ padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, background: "var(--red)", borderRadius: 7, display: "grid", placeItems: "center" }}>
            <span style={{ color: "#fff", fontWeight: 900, lineHeight: 1 }}>+</span>
          </div>
          <span style={{ fontFamily: "var(--font-jakarta)", fontWeight: 800, fontSize: "0.88rem", color: "#fff" }}>SafeCard</span>
        </div>
        <button
          onClick={() => { sessionStorage.removeItem("sc_member_token"); router.push("/member"); }}
          style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: "0.76rem", cursor: "pointer", fontFamily: "var(--font-jakarta)" }}
        >
          Mag-logout
        </button>
      </nav>

      <div style={{ maxWidth: 400, margin: "0 auto", padding: "0 24px" }}>
        {/* Pending banner */}
        {card.status === "pending" && (
          <div
            style={{
              padding: "10px 14px",
              background: "rgba(217,119,6,0.2)",
              border: "1px solid rgba(217,119,6,0.4)",
              borderRadius: 8,
              fontSize: "0.74rem",
              color: "#fbbf24",
              marginBottom: 16,
              lineHeight: 1.6,
            }}
          >
            ⏳ Ang iyong membership ay pinoproseso pa ng Philippine Red Cross. Maabisuhan ka via SMS kapag nakumpirma na.
          </div>
        )}

        {/* ID Card */}
        <div className="sc-id-card" style={{ marginBottom: 20 }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 28, height: 28, background: "var(--red)", borderRadius: 6, display: "grid", placeItems: "center" }}>
                <span style={{ color: "#fff", fontWeight: 900, lineHeight: 1 }}>+</span>
              </div>
              <div>
                <div style={{ fontFamily: "var(--font-jakarta)", fontWeight: 700, fontSize: "0.72rem", color: "#fff", lineHeight: 1 }}>Philippine Red Cross</div>
                <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.5)" }}>SafeCard</div>
              </div>
            </div>
            <span
              style={{
                fontSize: "0.66rem",
                fontWeight: 700,
                fontFamily: "var(--font-jakarta)",
                color: statusColor,
                background: `${statusColor}22`,
                border: `1px solid ${statusColor}55`,
                padding: "3px 8px",
                borderRadius: 20,
              }}
            >
              {statusLabel}
            </span>
          </div>

          {/* Name */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>Miyembro / Member</div>
            <div style={{ fontFamily: "var(--font-jakarta)", fontWeight: 700, fontSize: "1.1rem", color: "#fff" }}>
              {card.memberName}
            </div>
            <div style={{ fontSize: "0.64rem", color: "rgba(255,255,255,0.5)", marginTop: 2 }}>{card.planName}</div>
          </div>

          {/* Grid: details + QR */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <div style={{ fontSize: "0.58rem", color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>Member ID</div>
                <div style={{ fontFamily: "var(--font-ibm-mono)", fontSize: "0.76rem", color: "#fff", letterSpacing: "0.04em" }}>
                  {card.referenceNumber}
                </div>
              </div>
              {card.validUntil && (
                <div>
                  <div style={{ fontSize: "0.58rem", color: "rgba(255,255,255,0.4)", marginBottom: 2 }}>Valid Until</div>
                  <div style={{ fontFamily: "var(--font-jakarta)", fontSize: "0.8rem", color: "#fff", fontWeight: 600 }}>
                    {new Date(card.validUntil).toLocaleDateString("en-PH", { month: "short", year: "numeric" })}
                  </div>
                </div>
              )}
            </div>
            <QRCodeDisplay url={card.qrPayload} />
          </div>

          {/* Footer */}
          <div
            style={{
              marginTop: 16,
              paddingTop: 12,
              borderTop: "1px solid rgba(255,255,255,0.1)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ fontSize: "0.6rem", color: "rgba(255,255,255,0.3)" }}>SafeCard by Philippine Red Cross</span>
            <a
              href="tel:143"
              style={{
                fontFamily: "var(--font-jakarta)",
                fontWeight: 700,
                fontSize: "0.7rem",
                color: "#ff6b7a",
                textDecoration: "none",
              }}
            >
              Emergency: 143
            </a>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
          <a href="tel:143" className="sc-btn-primary" style={{ flex: 1, justifyContent: "center" }}>
            📞 Tawag sa 143
          </a>
          <button onClick={handleCopy} className="sc-btn-outline" style={{ flex: 1, justifyContent: "center" }}>
            {copied ? "✓ Nakopya!" : "📋 I-copy Ref"}
          </button>
        </div>

        <Link
          href="/member/status"
          style={{
            display: "block",
            textAlign: "center",
            padding: "12px",
            background: "rgba(255,255,255,0.05)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            fontFamily: "var(--font-jakarta)",
            fontWeight: 600,
            fontSize: "0.8rem",
            color: "rgba(255,255,255,0.6)",
            textDecoration: "none",
            marginBottom: 16,
          }}
        >
          📊 Tingnan ang Application Status →
        </Link>

        {/* Emergency panel */}
        <div
          style={{
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 12,
          }}
        >
          <button
            onClick={() => setEmergencyOpen((o) => !o)}
            style={{
              width: "100%",
              padding: "14px 16px",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              background: "none",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-jakarta)",
              fontWeight: 600,
              fontSize: "0.8rem",
              color: "rgba(255,255,255,0.7)",
            }}
          >
            🚨 Emergency & Benefits Info
            <span>{emergencyOpen ? "▲" : "▼"}</span>
          </button>
          {emergencyOpen && (
            <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { emoji: "📞", text: "Hotline: 143 (available 24/7)" },
                { emoji: "💬", text: "SMS/Viber: 0917 855 6025" },
                { emoji: "🚑", text: "Ambulance — ₱5,000" },
                { emoji: "🩸", text: "Blood — ₱2,500/unit" },
                { emoji: "🏥", text: "Ospital — ₱1,500/araw" },
                { emoji: "🦟", text: "Dengue — ₱5,000" },
              ].map((item) => (
                <div key={item.text} style={{ display: "flex", gap: 8, fontSize: "0.78rem", color: "rgba(255,255,255,0.55)" }}>
                  <span>{item.emoji}</span>
                  <span>{item.text}</span>
                </div>
              ))}
              <p style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.3)", marginTop: 4, lineHeight: 1.5 }}>
                Mag-ulat sa loob ng 30 araw mula sa aksidente. I-submit ang mga dokumento sa loob ng 60 araw.
              </p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
