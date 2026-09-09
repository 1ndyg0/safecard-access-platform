"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";

type Profile = {
  first_name: string; middle_name?: string; last_name: string; date_of_birth: string;
  sex: "male" | "female"; civil_status?: string; address_line1: string; address_line2?: string;
  city: string; province: string; zip_code: string; mobile_number: string; email?: string;
};

type CorrectionData = { reference: string; reason: string | null; profile: Profile };

function idempotencyKey() {
  return `member-correction-${crypto.randomUUID()}`;
}

export function ApplicationCorrectionForm() {
  const router = useRouter();
  const [data, setData] = useState<CorrectionData>();
  const [profile, setProfile] = useState<Profile>();
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/member/application-correction", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const body = await response.json();
        if (response.status === 401) { router.replace("/member"); return; }
        if (!response.ok) throw new Error(body.error ?? "Unable to load the requested correction.");
        setData(body); setProfile(body.profile);
      })
      .catch((caught) => { if (caught instanceof Error && caught.name !== "AbortError") setError(caught.message); });
    return () => controller.abort();
  }, [router]);

  function update(field: keyof Profile, value: string) {
    if (!profile) return;
    setProfile({ ...profile, [field]: value });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!profile) return;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/member/application-correction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ profile_data: profile, idempotency_key: idempotencyKey() }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "The correction could not be submitted.");
      router.replace("/member/status?resubmitted=1");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The correction could not be submitted.");
    } finally { setBusy(false); }
  }

  return <main className="portal-page"><div className="portal-shell">
    <header className="portal-header"><Link href="/"><BrandMark /></Link><Link href="/member/status" className="button-quiet">Back to status</Link></header>
    <section className="portal-card">
      <p className="eyebrow">Protected application correction</p>
      <h1>Correct and resubmit your application</h1>
      {!data && !error && <p>Loading the current approved fields…</p>}
      {error && <p className="form-message error" role="alert">{error}</p>}
      {data && profile && <>
        <div className="notice-panel amber"><strong>Staff note for {data.reference}</strong><span>{data.reason ?? "Please review the requested fields."}</span></div>
        <p>Review every field. Submitting creates a new immutable version for staff review; it does not change payment, PRC handoff, or membership status.</p>
        <form onSubmit={(event) => void submit(event)}>
          <div className="form-grid">
            <Field label="First name" value={profile.first_name} onChange={(value) => update("first_name", value)} />
            <Field label="Middle name (optional)" value={profile.middle_name ?? ""} required={false} onChange={(value) => update("middle_name", value)} />
            <Field label="Last name" value={profile.last_name} onChange={(value) => update("last_name", value)} />
            <Field label="Date of birth" type="date" value={profile.date_of_birth} onChange={(value) => update("date_of_birth", value)} />
            <label className="field-block"><span>Sex</span><select value={profile.sex} onChange={(event) => update("sex", event.target.value)}><option value="female">Female</option><option value="male">Male</option></select></label>
            <Field label="Civil status (optional)" value={profile.civil_status ?? ""} required={false} onChange={(value) => update("civil_status", value)} />
            <Field label="Mobile number" value={profile.mobile_number} inputMode="tel" onChange={(value) => update("mobile_number", value)} />
            <Field label="Email (optional)" type="email" value={profile.email ?? ""} required={false} onChange={(value) => update("email", value)} />
            <div className="full"><Field label="Address line 1" value={profile.address_line1} onChange={(value) => update("address_line1", value)} /></div>
            <div className="full"><Field label="Address line 2 (optional)" value={profile.address_line2 ?? ""} required={false} onChange={(value) => update("address_line2", value)} /></div>
            <Field label="City" value={profile.city} onChange={(value) => update("city", value)} />
            <Field label="Province" value={profile.province} onChange={(value) => update("province", value)} />
            <Field label="ZIP code" value={profile.zip_code} inputMode="numeric" onChange={(value) => update("zip_code", value)} />
          </div>
          <div className="wizard-actions"><button className="button-primary" disabled={busy}>{busy ? "Submitting securely…" : "Submit corrections for review →"}</button><Link className="button-quiet" href="/member/status">Cancel</Link></div>
        </form>
      </>}
    </section>
  </div></main>;
}

function Field({ label, value, onChange, type = "text", required = true, inputMode }: {
  label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean;
  inputMode?: "text" | "tel" | "numeric";
}) {
  return <label className="field-block"><span>{label}</span><input type={type} value={value} required={required} inputMode={inputMode} onChange={(event) => onChange(event.target.value)} /></label>;
}
