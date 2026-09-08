import Link from "next/link";

export const metadata = { title: "Mga Benepisyo — SafeCard" };

const BENEFITS = [
  {
    emoji: "🚑",
    title: "Ambulance Benefit",
    titleFil: "Benepisyo sa Ambulansya",
    amount: "₱5,000",
    desc: "Saklaw ang paggamit ng ambulansya ng PRC para sa emergency transport.",
  },
  {
    emoji: "🩸",
    title: "Blood Benefit",
    titleFil: "Benepisyo sa Dugo",
    amount: "₱2,500 / unit",
    desc: "Tulong sa pagbabayad ng dugo mula sa PRC Blood Bank.",
  },
  {
    emoji: "🏥",
    title: "Hospitalization Benefit",
    titleFil: "Benepisyo sa Ospital",
    amount: "₱1,500 / araw",
    desc: "Araw-araw na benepisyo habang naka-ospital dahil sa aksidente o sakit.",
  },
  {
    emoji: "🦟",
    title: "Dengue Benefit",
    titleFil: "Benepisyo sa Dengue",
    amount: "₱5,000",
    desc: "Tulong para sa mga gastos sa paggamot ng dengue fever.",
  },
];

const EXCLUSIONS = [
  "Pre-existing na sakit bago mag-enroll",
  "Dental, vision, maternity na benepisyo",
  "Mga aksidente habang nasa trabaho (saklaw ng employers)",
  "Mga aksidente habang nasa ilegal na aktibidad",
  "Mga sakit na hindi nakalista sa saklaw",
];

export default function BenefitsPage() {
  return (
    <main style={{ minHeight: "100dvh", background: "var(--bg)" }}>
      {/* Header */}
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
        <Link
          href="/"
          style={{
            fontFamily: "var(--font-jakarta)",
            fontSize: "0.78rem",
            color: "var(--text3)",
            textDecoration: "none",
          }}
        >
          ← Bumalik
        </Link>
        <span
          style={{
            fontFamily: "var(--font-jakarta)",
            fontWeight: 700,
            fontSize: "0.88rem",
            color: "var(--text)",
          }}
        >
          Mga Benepisyo ng SafeCard
        </span>
      </nav>

      <div style={{ maxWidth: 640, margin: "0 auto", padding: "32px 24px 100px" }}>
        <h1
          style={{
            fontFamily: "var(--font-jakarta)",
            fontWeight: 800,
            fontSize: "1.6rem",
            letterSpacing: "-0.02em",
            marginBottom: 8,
            color: "var(--text)",
          }}
        >
          Ano ang saklaw ng SafeCard?
        </h1>
        <p style={{ color: "var(--text2)", fontSize: "0.9rem", lineHeight: 1.7, marginBottom: 28 }}>
          Mga benepisyong direkta mula sa Philippine Red Cross. Lahat ng detalye ay opisyal at binago ng PRC.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 32 }}>
          {BENEFITS.map((b) => (
            <div
              key={b.title}
              className="sc-surface"
              style={{ padding: "20px", display: "flex", gap: 16, alignItems: "flex-start" }}
            >
              <span style={{ fontSize: "1.8rem", flexShrink: 0 }}>{b.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, marginBottom: 6 }}>
                  <div>
                    <div
                      style={{
                        fontFamily: "var(--font-jakarta)",
                        fontWeight: 700,
                        fontSize: "0.88rem",
                        color: "var(--text)",
                      }}
                    >
                      {b.titleFil}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "var(--text3)" }}>{b.title}</div>
                  </div>
                  <div
                    style={{
                      fontFamily: "var(--font-ibm-mono)",
                      fontWeight: 500,
                      fontSize: "1rem",
                      color: "var(--red)",
                      flexShrink: 0,
                    }}
                  >
                    {b.amount}
                  </div>
                </div>
                <p style={{ fontSize: "0.8rem", color: "var(--text2)", lineHeight: 1.6, margin: 0 }}>{b.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Exclusions */}
        <div
          className="sc-surface"
          style={{ padding: "20px", borderLeft: "3px solid var(--amber)", marginBottom: 24 }}
        >
          <div
            style={{
              fontFamily: "var(--font-jakarta)",
              fontWeight: 700,
              fontSize: "0.82rem",
              color: "var(--amber)",
              marginBottom: 12,
            }}
          >
            ⚠️ Hindi kasama (Exclusions)
          </div>
          <ul style={{ padding: "0 0 0 16px", margin: 0, display: "flex", flexDirection: "column", gap: 6 }}>
            {EXCLUSIONS.map((e) => (
              <li key={e} style={{ fontSize: "0.8rem", color: "var(--text2)", lineHeight: 1.6 }}>
                {e}
              </li>
            ))}
          </ul>
        </div>

        {/* Claims */}
        <div className="sc-surface" style={{ padding: "20px", marginBottom: 32 }}>
          <div
            style={{
              fontFamily: "var(--font-jakarta)",
              fontWeight: 700,
              fontSize: "0.82rem",
              color: "var(--text)",
              marginBottom: 12,
            }}
          >
            📋 Paano mag-claim?
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[
              "Tumawag sa PRC Hotline 143 sa loob ng 30 araw mula sa aksidente",
              "I-submit ang mga dokumento sa loob ng 60 araw",
              "Ang PRC ang mag-apruba at magbabayad ng benepisyo",
            ].map((step, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                <span
                  style={{
                    fontFamily: "var(--font-jakarta)",
                    fontWeight: 700,
                    fontSize: "0.72rem",
                    color: "#fff",
                    background: "var(--red)",
                    borderRadius: "50%",
                    width: 20,
                    height: 20,
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  {i + 1}
                </span>
                <p style={{ fontSize: "0.8rem", color: "var(--text2)", lineHeight: 1.6, margin: 0 }}>{step}</p>
              </div>
            ))}
          </div>
          <div
            style={{
              marginTop: 16,
              padding: "10px 12px",
              background: "var(--red-dim)",
              borderRadius: 8,
              fontSize: "0.76rem",
              color: "var(--red)",
              fontWeight: 600,
              fontFamily: "var(--font-jakarta)",
            }}
          >
            📞 PRC Hotline: <strong>143</strong> (available 24/7)
          </div>
        </div>

        <Link href="/apply" className="sc-btn-primary" style={{ width: "100%", justifyContent: "center" }}>
          Mag-apply ngayon →
        </Link>
      </div>
    </main>
  );
}
