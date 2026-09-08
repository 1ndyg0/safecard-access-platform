import Link from "next/link";

const BENEFITS = [
  { emoji: "🚑", label: "Ambulance", labelFil: "Ambulansya", amount: "₱5,000" },
  { emoji: "🩸", label: "Blood", labelFil: "Dugo", amount: "₱2,500/unit" },
  { emoji: "🏥", label: "Hospital", labelFil: "Ospital", amount: "₱1,500/araw" },
  { emoji: "🦟", label: "Dengue", labelFil: "Dengue", amount: "₱5,000" },
];

export default function LandingPage({
  searchParams,
}: {
  searchParams?: Promise<{ ref?: string; sponsor?: string }>;
}) {
  return (
    <main style={{ minHeight: "100dvh", background: "var(--bg)" }}>
      {/* Nav */}
      <nav
        style={{
          background: "var(--surface)",
          borderBottom: "1px solid var(--border)",
          padding: "0 24px",
          display: "flex",
          alignItems: "center",
          height: "56px",
          position: "sticky",
          top: 0,
          zIndex: 40,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1 }}>
          <div
            style={{
              width: 32,
              height: 32,
              background: "var(--red)",
              borderRadius: 8,
              display: "grid",
              placeItems: "center",
              flexShrink: 0,
            }}
          >
            <span style={{ color: "#fff", fontSize: "1rem", fontWeight: 900, lineHeight: 1 }}>+</span>
          </div>
          <span
            style={{
              fontFamily: "var(--font-jakarta)",
              fontWeight: 800,
              fontSize: "0.9rem",
              color: "var(--text)",
            }}
          >
            SafeCard
          </span>
        </div>
        <Link
          href="/member"
          style={{
            fontFamily: "var(--font-jakarta)",
            fontWeight: 600,
            fontSize: "0.78rem",
            color: "var(--text2)",
            textDecoration: "none",
          }}
        >
          Mag-login →
        </Link>
      </nav>

      {/* Hero */}
      <section
        style={{
          background: "var(--navy)",
          padding: "56px 24px 48px",
          textAlign: "center",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: "radial-gradient(ellipse at 50% 0%, rgba(200,16,46,0.15) 0%, transparent 70%)",
            pointerEvents: "none",
          }}
        />
        <div style={{ maxWidth: 480, margin: "0 auto", position: "relative" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              background: "rgba(200,16,46,0.15)",
              border: "1px solid rgba(200,16,46,0.3)",
              borderRadius: 20,
              padding: "4px 12px",
              marginBottom: 20,
            }}
          >
            <span style={{ fontSize: "0.62rem", fontWeight: 700, color: "#ff6b7a", textTransform: "uppercase", letterSpacing: "0.08em", fontFamily: "var(--font-jakarta)" }}>
              Opisyal na programa ng PRC
            </span>
          </div>
          <h1
            style={{
              fontFamily: "var(--font-jakarta)",
              fontWeight: 800,
              fontSize: "clamp(1.8rem, 5vw, 2.8rem)",
              color: "#fff",
              lineHeight: 1.15,
              letterSpacing: "-0.03em",
              marginBottom: 16,
            }}
          >
            Protektado ka sa <span style={{ color: "#ff6b7a" }}>SafeCard</span>
          </h1>
          <p
            style={{
              color: "rgba(255,255,255,0.65)",
              fontSize: "1rem",
              lineHeight: 1.7,
              marginBottom: 32,
            }}
          >
            Proteksyon na naiintindihan mo, sa isang tap. Opisyal na membership ng Philippine Red Cross — ₱1,200 lang sa isang taon.
          </p>
          <Link href="/apply" className="sc-btn-primary" style={{ fontSize: "1rem", padding: "16px 32px" }}>
            Mag-apply dito →
          </Link>
          <p style={{ color: "rgba(255,255,255,0.4)", fontSize: "0.72rem", marginTop: 12 }}>
            Para sa edad 3–85 · Kusang-loob · Hindi makakaapekto sa trabaho
          </p>
        </div>
      </section>

      {/* Benefits */}
      <section style={{ maxWidth: 640, margin: "0 auto", padding: "40px 24px" }}>
        <p
          style={{
            fontFamily: "var(--font-jakarta)",
            fontWeight: 700,
            fontSize: "0.62rem",
            textTransform: "uppercase",
            letterSpacing: "0.1em",
            color: "var(--red)",
            textAlign: "center",
            marginBottom: 12,
          }}
        >
          Mga Benepisyo
        </p>
        <h2
          style={{
            fontFamily: "var(--font-jakarta)",
            fontWeight: 800,
            fontSize: "1.4rem",
            textAlign: "center",
            letterSpacing: "-0.02em",
            marginBottom: 24,
            color: "var(--text)",
          }}
        >
          Ano ang kasama sa SafeCard?
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 12,
          }}
        >
          {BENEFITS.map((b) => (
            <div
              key={b.label}
              className="sc-surface"
              style={{ padding: "20px 16px", textAlign: "center" }}
            >
              <span style={{ fontSize: "1.8rem", display: "block", marginBottom: 8 }}>{b.emoji}</span>
              <div
                style={{
                  fontFamily: "var(--font-jakarta)",
                  fontWeight: 700,
                  fontSize: "0.82rem",
                  color: "var(--text)",
                  marginBottom: 4,
                }}
              >
                {b.labelFil}
              </div>
              <div
                style={{
                  fontFamily: "var(--font-ibm-mono)",
                  fontWeight: 500,
                  fontSize: "1rem",
                  color: "var(--red)",
                }}
              >
                {b.amount}
              </div>
            </div>
          ))}
        </div>
        <Link
          href="/benefits"
          style={{
            display: "block",
            textAlign: "center",
            marginTop: 16,
            fontFamily: "var(--font-jakarta)",
            fontWeight: 600,
            fontSize: "0.8rem",
            color: "var(--text3)",
            textDecoration: "none",
          }}
        >
          Tingnan ang lahat ng detalye →
        </Link>
      </section>

      {/* Pricing */}
      <section
        style={{
          maxWidth: 640,
          margin: "0 auto",
          padding: "0 24px 40px",
        }}
      >
        <div
          className="sc-surface"
          style={{
            padding: "24px",
            borderLeft: "3px solid var(--red)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div
                style={{
                  fontFamily: "var(--font-jakarta)",
                  fontWeight: 700,
                  fontSize: "0.84rem",
                  color: "var(--text)",
                  marginBottom: 4,
                }}
              >
                SafeCard Enhanced Platinum
              </div>
              <div style={{ fontSize: "0.76rem", color: "var(--text3)" }}>
                Philippine Red Cross · Para sa edad 3–85
              </div>
            </div>
            <div
              style={{
                fontFamily: "var(--font-jakarta)",
                fontWeight: 800,
                fontSize: "1.4rem",
                color: "var(--red)",
              }}
            >
              ₱1,200
              <span style={{ fontSize: "0.7rem", fontWeight: 600, color: "var(--text3)" }}>/taon</span>
            </div>
          </div>
        </div>
      </section>

      {/* Trust */}
      <section
        style={{
          background: "var(--surface2)",
          padding: "32px 24px",
          textAlign: "center",
          borderTop: "1px solid var(--border)",
        }}
      >
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          <p style={{ fontSize: "0.78rem", color: "var(--text3)", lineHeight: 1.7 }}>
            🛡️ Opisyal na programa ng <strong style={{ color: "var(--text)" }}>Philippine Red Cross</strong> ·
            Lahat ng bayad ay direkta sa PRC · Ang paglahok ay kusang-loob at hindi makakaapekto sa iyong trabaho
          </p>
        </div>
      </section>

      {/* Sticky CTA on mobile */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          background: "var(--surface)",
          borderTop: "1px solid var(--border)",
          padding: "12px 24px",
          display: "flex",
          gap: 12,
          zIndex: 50,
        }}
      >
        <Link href="/apply" className="sc-btn-primary" style={{ flex: 1 }}>
          Mag-apply →
        </Link>
        <Link href="/member" className="sc-btn-outline" style={{ flex: "none" }}>
          Login
        </Link>
      </div>
      {/* Spacer for sticky CTA */}
      <div style={{ height: 80 }} />
    </main>
  );
}
