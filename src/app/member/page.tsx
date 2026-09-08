"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function MemberLoginPage() {
  const router = useRouter();
  const [refNumber, setRefNumber] = useState("");
  const [mobile, setMobile] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!refNumber.trim()) { setError("Kailangan ang reference number"); return; }
    if (!mobile.trim()) { setError("Kailangan ang mobile number"); return; }
    if (!/^(09|\+639)\d{9}$/.test(mobile)) { setError("Format ng mobile: 09XXXXXXXXX"); return; }

    setLoading(true);
    try {
      const res = await fetch("/api/member/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ referenceNumber: refNumber.trim().toUpperCase(), mobileNumber: mobile.trim() }),
      });
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Hindi namin nahanap ang iyong account.");
        return;
      }

      // Store session token
      sessionStorage.setItem("sc_member_token", json.token);
      sessionStorage.setItem("sc_member_name", json.memberName || "");
      sessionStorage.setItem("sc_member_ref", refNumber.trim().toUpperCase());

      router.push("/member/card");
    } catch {
      setError("May nangyaring error. Subukan muli.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main
      style={{
        minHeight: "100dvh",
        background: "var(--navy)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div style={{ width: "100%", maxWidth: 400 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <div
            style={{
              width: 56,
              height: 56,
              background: "var(--red)",
              borderRadius: 14,
              display: "grid",
              placeItems: "center",
              margin: "0 auto 16px",
            }}
          >
            <span style={{ fontSize: "1.8rem", color: "#fff", fontWeight: 900, lineHeight: 1 }}>+</span>
          </div>
          <h1
            style={{
              fontFamily: "var(--font-jakarta)",
              fontWeight: 800,
              fontSize: "1.4rem",
              color: "#fff",
              marginBottom: 6,
            }}
          >
            SafeCard Member Login
          </h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "0.8rem" }}>
            Tingnan ang iyong electronic SafeCard
          </p>
        </div>

        {/* Form */}
        <div
          style={{
            background: "var(--surface)",
            borderRadius: 16,
            padding: "28px",
            boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
          }}
        >
          <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <label className="sc-label">Reference Number / SC-YYYY-XXXXXXXX</label>
              <input
                className="sc-input"
                value={refNumber}
                onChange={(e) => setRefNumber(e.target.value.toUpperCase())}
                placeholder="SC-2026-XXXXXXXX"
                style={{ fontFamily: "var(--font-ibm-mono)", letterSpacing: "0.04em" }}
                autoComplete="off"
                autoCapitalize="characters"
              />
              <p style={{ fontSize: "0.68rem", color: "var(--text3)", marginTop: 4 }}>
                Makikita sa SMS na natanggap mo pagkatapos mag-apply
              </p>
            </div>

            <div>
              <label className="sc-label">Registered Mobile Number</label>
              <input
                type="tel"
                className="sc-input"
                value={mobile}
                onChange={(e) => setMobile(e.target.value)}
                placeholder="09XXXXXXXXX"
                autoComplete="off"
              />
            </div>

            {error && (
              <div
                style={{
                  padding: "10px 12px",
                  background: "var(--red-dim)",
                  borderRadius: 6,
                  fontSize: "0.78rem",
                  color: "var(--red)",
                  fontFamily: "var(--font-jakarta)",
                  fontWeight: 600,
                }}
              >
                ❌ {error}
              </div>
            )}

            <button
              type="submit"
              className="sc-btn-primary"
              disabled={loading}
              style={{ justifyContent: "center" }}
            >
              {loading ? "Naglo-load..." : "Tingnan ang aking SafeCard →"}
            </button>
          </form>
        </div>

        <div style={{ textAlign: "center", marginTop: 24 }}>
          <Link href="/" style={{ fontSize: "0.76rem", color: "rgba(255,255,255,0.4)", textDecoration: "none" }}>
            ← Bumalik sa homepage
          </Link>
        </div>
        <p style={{ textAlign: "center", marginTop: 16, fontSize: "0.7rem", color: "rgba(255,255,255,0.25)", lineHeight: 1.6 }}>
          Ang iyong reference number ay ipinadala sa SMS pagkatapos mag-submit ng application. Format: SC-2026-XXXXXXXX
        </p>
      </div>
    </main>
  );
}
