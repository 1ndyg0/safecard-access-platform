"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface StatusStep {
  key: string;
  label: string;
  labelFil: string;
  completedAt: string | null;
  description: string;
  actionRequired?: string;
}

export default function MemberStatusPage() {
  const router = useRouter();
  const [steps, setSteps] = useState<StatusStep[]>([]);
  const [refNumber, setRefNumber] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = sessionStorage.getItem("sc_member_token");
    const ref = sessionStorage.getItem("sc_member_ref") || "";
    if (!token) { router.push("/member"); return; }
    setRefNumber(ref);

    fetch("/api/member/status", {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (r) => {
        if (r.status === 401) { router.push("/member"); return; }
        const json = await r.json();
        if (!r.ok) throw new Error(json.error);
        setSteps(json.steps || []);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [router]);

  if (loading) {
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
        <Link href="/member/card" style={{ fontFamily: "var(--font-jakarta)", fontSize: "0.78rem", color: "var(--text3)", textDecoration: "none" }}>
          ← Bumalik sa SafeCard
        </Link>
      </nav>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "28px 24px 60px" }}>
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontFamily: "var(--font-jakarta)", fontWeight: 700, fontSize: "0.62rem", textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--red)", marginBottom: 6 }}>
            Application Status
          </p>
          <h1 style={{ fontFamily: "var(--font-jakarta)", fontWeight: 800, fontSize: "1.3rem", letterSpacing: "-0.02em", color: "var(--text)", marginBottom: 4 }}>
            Katayuan ng Application
          </h1>
          {refNumber && (
            <p style={{ fontFamily: "var(--font-ibm-mono)", fontSize: "0.8rem", color: "var(--text3)" }}>{refNumber}</p>
          )}
        </div>

        {error && (
          <div style={{ padding: "12px 14px", background: "var(--red-dim)", borderRadius: 8, fontSize: "0.78rem", color: "var(--red)", marginBottom: 16 }}>
            {error}
          </div>
        )}

        {/* Status pipeline */}
        <div style={{ position: "relative" }}>
          {/* Vertical line */}
          <div
            style={{
              position: "absolute",
              left: 11,
              top: 12,
              bottom: 12,
              width: 2,
              background: "var(--border)",
              zIndex: 0,
            }}
          />

          {steps.map((step, i) => {
            const isDone = !!step.completedAt;
            const isCurrent = !isDone && (i === 0 || !!steps[i - 1]?.completedAt);

            return (
              <div key={step.key} style={{ display: "flex", gap: 16, marginBottom: 24, position: "relative", zIndex: 1 }}>
                {/* Circle */}
                <div
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: "50%",
                    background: isDone ? "var(--green)" : isCurrent ? "var(--blue)" : "var(--surface)",
                    border: `2px solid ${isDone ? "var(--green)" : isCurrent ? "var(--blue)" : "var(--border)"}`,
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                    fontSize: "0.68rem",
                    color: isDone ? "#fff" : isCurrent ? "#fff" : "var(--text3)",
                    fontFamily: "var(--font-jakarta)",
                    fontWeight: 700,
                  }}
                >
                  {isDone ? "✓" : isCurrent ? "●" : "○"}
                </div>

                <div style={{ flex: 1, paddingTop: 2 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8, marginBottom: 4 }}>
                    <div>
                      <div style={{ fontFamily: "var(--font-jakarta)", fontWeight: 700, fontSize: "0.86rem", color: isDone ? "var(--text)" : isCurrent ? "var(--blue)" : "var(--text3)" }}>
                        {step.labelFil}
                      </div>
                      <div style={{ fontSize: "0.68rem", color: "var(--text3)" }}>{step.label}</div>
                    </div>
                    {step.completedAt && (
                      <span style={{ fontSize: "0.68rem", color: "var(--text3)", flexShrink: 0, fontFamily: "var(--font-ibm-mono)" }}>
                        {new Date(step.completedAt).toLocaleDateString("en-PH", { month: "short", day: "numeric" })}
                      </span>
                    )}
                  </div>
                  <p style={{ fontSize: "0.76rem", color: "var(--text2)", lineHeight: 1.6, margin: 0 }}>{step.description}</p>
                  {step.actionRequired && (
                    <div style={{ marginTop: 8, padding: "8px 10px", background: "var(--amber-dim)", borderRadius: 6, fontSize: "0.72rem", color: "var(--amber)", fontFamily: "var(--font-jakarta)", fontWeight: 600 }}>
                      ⚠️ {step.actionRequired}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Fallback if no steps */}
        {steps.length === 0 && !error && (
          <div className="sc-surface" style={{ padding: 24, textAlign: "center" }}>
            <p style={{ color: "var(--text3)", fontSize: "0.84rem" }}>
              Ang status ay makikita pagkatapos mag-submit ng application.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
