"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Link from "next/link";

function DecisionGate() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refCode = searchParams.get("ref");

  const handleDecision = (decision: "accept" | "ask" | "decline") => {
    if (decision === "accept") {
      const params = refCode ? `?ref=${refCode}` : "";
      router.push(`/apply/form${params}`);
    } else if (decision === "ask") {
      window.location.href = "tel:143";
    } else {
      router.push("/");
    }
  };

  const options = [
    {
      key: "accept" as const,
      emoji: "✓",
      title: "Mag-apply",
      desc: "Gusto ko nang mag-enroll sa SafeCard",
      color: "var(--green)",
      bg: "var(--green-dim)",
    },
    {
      key: "ask" as const,
      emoji: "?",
      title: "Magtanong",
      desc: "May tanong pa ako — tumawag sa 143",
      color: "var(--amber)",
      bg: "var(--amber-dim)",
    },
    {
      key: "decline" as const,
      emoji: "✕",
      title: "Hindi ngayon",
      desc: "Hindi na ako mag-a-apply ngayon",
      color: "var(--text3)",
      bg: "transparent",
    },
  ];

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
        <Link href="/" style={{ fontFamily: "var(--font-jakarta)", fontSize: "0.78rem", color: "var(--text3)", textDecoration: "none" }}>
          ← Bumalik
        </Link>
        <span style={{ fontFamily: "var(--font-jakarta)", fontWeight: 700, fontSize: "0.88rem", color: "var(--text)" }}>
          Iyong Desisyon
        </span>
      </nav>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "40px 24px" }}>
        <h1 style={{ fontFamily: "var(--font-jakarta)", fontWeight: 800, fontSize: "1.5rem", letterSpacing: "-0.02em", marginBottom: 8, color: "var(--text)" }}>
          Ano ang iyong desisyon?
        </h1>
        <p style={{ color: "var(--text2)", fontSize: "0.86rem", lineHeight: 1.7, marginBottom: 32 }}>
          <strong style={{ color: "var(--text)" }}>Ang iyong sagot ay pribado.</strong> Hindi malalaman ng iyong employer o school ang iyong desisyon. Hindi makakaapekto ang sagot mo sa iyong trabaho o pag-aaral.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {options.map((opt) => (
            <button
              key={opt.key}
              onClick={() => handleDecision(opt.key)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 16,
                padding: "20px",
                background: opt.bg,
                border: `1.5px solid ${opt.bg === "transparent" ? "var(--border)" : opt.color}`,
                borderRadius: 12,
                cursor: "pointer",
                textAlign: "left",
                transition: "opacity 0.12s",
                width: "100%",
              }}
            >
              <span
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "50%",
                  background: opt.color,
                  display: "grid",
                  placeItems: "center",
                  fontSize: "1rem",
                  fontWeight: 900,
                  color: "#fff",
                  flexShrink: 0,
                  fontFamily: "var(--font-jakarta)",
                }}
              >
                {opt.emoji}
              </span>
              <div>
                <div style={{ fontFamily: "var(--font-jakarta)", fontWeight: 700, fontSize: "0.9rem", color: "var(--text)", marginBottom: 2 }}>
                  {opt.title}
                </div>
                <div style={{ fontSize: "0.76rem", color: "var(--text2)" }}>{opt.desc}</div>
              </div>
            </button>
          ))}
        </div>

        <p style={{ marginTop: 24, fontSize: "0.72rem", color: "var(--text3)", textAlign: "center", lineHeight: 1.6 }}>
          Kahit anong desisyon ang piliin mo, walang personal na impormasyon ang maitatago o ibabahagi. Ang iyong privacy ay protektado ng RA 10173 (Data Privacy Act).
        </p>
      </div>
    </main>
  );
}

export default function ApplyPage() {
  return (
    <Suspense>
      <DecisionGate />
    </Suspense>
  );
}
