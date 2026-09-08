"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface FormData {
  first_name: string;
  last_name: string;
  date_of_birth: string;
  sex: "male" | "female" | "";
  mobile_number: string;
  address_line1: string;
  city: string;
  province: string;
  zip_code: string;
}

const EMPTY: FormData = {
  first_name: "",
  last_name: "",
  date_of_birth: "",
  sex: "",
  mobile_number: "",
  address_line1: "",
  city: "",
  province: "",
  zip_code: "",
};

function PersonalInfoForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const refCode = searchParams.get("ref");

  const [form, setForm] = useState<FormData>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [submitting, setSubmitting] = useState(false);

  const set = (field: keyof FormData, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const validate = (): boolean => {
    const e: Partial<Record<keyof FormData, string>> = {};
    if (!form.first_name.trim()) e.first_name = "Kailangan ang pangalan";
    if (!form.last_name.trim()) e.last_name = "Kailangan ang apelyido";
    if (!form.date_of_birth) {
      e.date_of_birth = "Kailangan ang petsa ng kapanganakan";
    } else {
      const age = (Date.now() - new Date(form.date_of_birth).getTime()) / (365.25 * 86400000);
      if (age < 3 || age > 85) e.date_of_birth = "Edad ay dapat 3 hanggang 85 taon";
    }
    if (!form.sex) e.sex = "Pumili ng kasarian";
    if (!form.mobile_number) {
      e.mobile_number = "Kailangan ang mobile number";
    } else if (!/^(09|\+639)\d{9}$/.test(form.mobile_number)) {
      e.mobile_number = "Format: 09XXXXXXXXX";
    }
    if (!form.address_line1.trim()) e.address_line1 = "Kailangan ang address";
    if (!form.city.trim()) e.city = "Kailangan ang lungsod";
    if (!form.province.trim()) e.province = "Kailangan ang probinsya";
    if (!form.zip_code || !/^\d{4}$/.test(form.zip_code)) e.zip_code = "4-digit ZIP code";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSubmitting(true);
    try {
      // Store form data in sessionStorage for the payment step
      const data = { ...form, refCode };
      sessionStorage.setItem("sc_form", JSON.stringify(data));
      const params = refCode ? `?ref=${refCode}` : "";
      router.push(`/apply/payment${params}`);
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

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
        <Link href="/apply" style={{ fontFamily: "var(--font-jakarta)", fontSize: "0.78rem", color: "var(--text3)", textDecoration: "none" }}>
          ← Bumalik
        </Link>
        <span style={{ fontFamily: "var(--font-jakarta)", fontWeight: 700, fontSize: "0.88rem", color: "var(--text)" }}>
          Impormasyong Personal
        </span>
      </nav>

      {/* Progress */}
      <div className="sc-progress">
        <div className="sc-progress-fill" style={{ width: "33%" }} />
      </div>

      <div style={{ maxWidth: 480, margin: "0 auto", padding: "28px 24px 100px" }}>
        {/* Step indicator */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 20 }}>
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: s === 1 ? "var(--red)" : "var(--surface2)",
                border: `1.5px solid ${s === 1 ? "var(--red)" : "var(--border)"}`,
                display: "grid",
                placeItems: "center",
                fontFamily: "var(--font-jakarta)",
                fontWeight: 700,
                fontSize: "0.66rem",
                color: s === 1 ? "#fff" : "var(--text3)",
              }}
            >
              {s}
            </div>
          ))}
          <span style={{ fontSize: "0.72rem", color: "var(--text3)", marginLeft: 4 }}>Hakbang 1 ng 3</span>
        </div>

        <h1 style={{ fontFamily: "var(--font-jakarta)", fontWeight: 800, fontSize: "1.3rem", letterSpacing: "-0.02em", marginBottom: 4, color: "var(--text)" }}>
          Impormasyong Personal
        </h1>
        <p style={{ fontSize: "0.8rem", color: "var(--text2)", marginBottom: 24 }}>Personal Information</p>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="sc-label">Pangalan / First Name *</label>
              <input
                className={`sc-input${errors.first_name ? " error" : ""}`}
                value={form.first_name}
                onChange={(e) => set("first_name", e.target.value)}
                placeholder="Juan"
              />
              {errors.first_name && <p className="sc-error">{errors.first_name}</p>}
            </div>
            <div>
              <label className="sc-label">Apelyido / Last Name *</label>
              <input
                className={`sc-input${errors.last_name ? " error" : ""}`}
                value={form.last_name}
                onChange={(e) => set("last_name", e.target.value)}
                placeholder="Dela Cruz"
              />
              {errors.last_name && <p className="sc-error">{errors.last_name}</p>}
            </div>
          </div>

          <div>
            <label className="sc-label">Petsa ng Kapanganakan / Date of Birth *</label>
            <input
              type="date"
              className={`sc-input${errors.date_of_birth ? " error" : ""}`}
              value={form.date_of_birth}
              onChange={(e) => set("date_of_birth", e.target.value)}
            />
            {errors.date_of_birth && <p className="sc-error">{errors.date_of_birth}</p>}
            <p style={{ fontSize: "0.7rem", color: "var(--text3)", marginTop: 4 }}>Para sa edad 3–85 taon</p>
          </div>

          <div>
            <label className="sc-label">Kasarian / Sex *</label>
            <select
              className={`sc-input${errors.sex ? " error" : ""}`}
              value={form.sex}
              onChange={(e) => set("sex", e.target.value)}
              style={{ appearance: "none", backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8'%3E%3Cpath d='M0 0l6 8 6-8z' fill='%238892A8'/%3E%3C/svg%3E\")", backgroundRepeat: "no-repeat", backgroundPosition: "right 14px center" }}
            >
              <option value="">Pumili ng kasarian</option>
              <option value="male">Lalaki / Male</option>
              <option value="female">Babae / Female</option>
            </select>
            {errors.sex && <p className="sc-error">{errors.sex}</p>}
          </div>

          <div>
            <label className="sc-label">Mobile Number *</label>
            <input
              type="tel"
              className={`sc-input${errors.mobile_number ? " error" : ""}`}
              value={form.mobile_number}
              onChange={(e) => set("mobile_number", e.target.value)}
              placeholder="09XXXXXXXXX"
              maxLength={13}
            />
            {errors.mobile_number && <p className="sc-error">{errors.mobile_number}</p>}
          </div>

          <div>
            <label className="sc-label">Address / Tirahan *</label>
            <input
              className={`sc-input${errors.address_line1 ? " error" : ""}`}
              value={form.address_line1}
              onChange={(e) => set("address_line1", e.target.value)}
              placeholder="House No., Street, Barangay"
            />
            {errors.address_line1 && <p className="sc-error">{errors.address_line1}</p>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label className="sc-label">Lungsod / City *</label>
              <input
                className={`sc-input${errors.city ? " error" : ""}`}
                value={form.city}
                onChange={(e) => set("city", e.target.value)}
                placeholder="Maynila"
              />
              {errors.city && <p className="sc-error">{errors.city}</p>}
            </div>
            <div>
              <label className="sc-label">Probinsya *</label>
              <input
                className={`sc-input${errors.province ? " error" : ""}`}
                value={form.province}
                onChange={(e) => set("province", e.target.value)}
                placeholder="Metro Manila"
              />
              {errors.province && <p className="sc-error">{errors.province}</p>}
            </div>
          </div>

          <div>
            <label className="sc-label">ZIP Code *</label>
            <input
              className={`sc-input${errors.zip_code ? " error" : ""}`}
              value={form.zip_code}
              onChange={(e) => set("zip_code", e.target.value)}
              placeholder="1000"
              maxLength={4}
              inputMode="numeric"
            />
            {errors.zip_code && <p className="sc-error">{errors.zip_code}</p>}
          </div>

          {/* Privacy notice */}
          <div
            style={{
              padding: "12px 14px",
              background: "var(--surface2)",
              borderRadius: 8,
              fontSize: "0.72rem",
              color: "var(--text3)",
              lineHeight: 1.6,
            }}
          >
            🔒 Ang iyong personal na impormasyon ay ibibigay lamang sa Philippine Red Cross para sa iyong membership application. Protektado ito ng RA 10173 (Data Privacy Act of 2012).
          </div>

          <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "var(--surface)", borderTop: "1px solid var(--border)", padding: "12px 24px" }}>
            <button
              type="submit"
              className="sc-btn-primary"
              disabled={submitting}
              style={{ width: "100%", justifyContent: "center" }}
            >
              {submitting ? "Naglo-load..." : "Susunod: Bayad →"}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

export default function FormPage() {
  return (
    <Suspense>
      <PersonalInfoForm />
    </Suspense>
  );
}
