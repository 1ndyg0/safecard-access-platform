"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { useLocale } from "@/components/LocaleProvider";
import { ManualPaymentPanel } from "@/components/application/ManualPaymentPanel";

type Step = "learn" | "check" | "decide" | "consent" | "profile" | "review" | "payment" | "complete" | "declined";
type PilotConfig = {
  mode: "synthetic" | "live";
  campaign: { id: string; membership_fee: number } | null;
  content?: Array<{ id: string; content_type: string; locale: "tl" | "en"; title: string; body: string }>;
  payment: { available: boolean; reason: string | null };
  externalNotifications: { available: boolean; reason: string };
  configurationError?: string;
};
type Profile = {
  first_name: string; last_name: string; date_of_birth: string; sex: "male" | "female";
  mobile_number: string; address_line1: string; city: string; province: string; zip_code: string; email?: string;
};

const syntheticProfile: Profile = {
  first_name: "DEMO", last_name: "PERSON", date_of_birth: "2000-01-01", sex: "female",
  mobile_number: "09000000000", address_line1: "TEST ADDRESS", city: "TEST CITY", province: "TEST PROVINCE", zip_code: "0000", email: "demo@example.invalid",
};
const emptyProfile: Profile = { first_name: "", last_name: "", date_of_birth: "", sex: "female", mobile_number: "", address_line1: "", city: "", province: "", zip_code: "", email: "" };

function key(prefix: string) { return `${prefix}-${crypto.randomUUID()}`; }

export function ApplicationWizard() {
  const { locale, setLocale } = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const referralSlug = params.get("ref");
  const [step, setStep] = useState<Step>("learn");
  const [config, setConfig] = useState<PilotConfig | null>(null);
  const [referralLinkId, setReferralLinkId] = useState<string>();
  const [caseId, setCaseId] = useState<string>();
  const [consentRecordId, setConsentRecordId] = useState<string>();
  const [answers, setAnswers] = useState({ cost: "", activation: "", choice: "", emergency: "" });
  const [agreed, setAgreed] = useState({ voluntary: false, privacy: false, boundaries: false });
  const [profile, setProfile] = useState<Profile>(syntheticProfile);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/pilot/config", { cache: "no-store" }).then((r) => r.json()).then((next: PilotConfig) => {
      setConfig(next); setProfile(next.mode === "live" ? emptyProfile : syntheticProfile);
    }).catch(() => setConfig({ mode: "synthetic", campaign: null, payment: { available: false, reason: "Unavailable" }, externalNotifications: { available: false, reason: "Parked" } }));
  }, []);

  useEffect(() => {
    if (!referralSlug) return;
    fetch(`/api/referrals/validate?slug=${encodeURIComponent(referralSlug)}`).then((r) => r.json()).then((data) => {
      if (data.valid) setReferralLinkId(data.referralLinkId);
    }).catch(() => undefined);
  }, [referralSlug]);

  const quizPassed = useMemo(() => answers.cost === "1200" && answers.activation === "prc" && answers.choice === "recipient" && answers.emergency === "143", [answers]);
  const allAgreed = agreed.voluntary && agreed.privacy && agreed.boundaries;
  const isLive = config?.mode === "live";

  async function api(path: string, body: unknown) {
    const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "The request could not be completed.");
    return data;
  }

  async function decide(decision: "accept" | "ask" | "decline") {
    setError("");
    if (decision === "ask") { setError("Call Philippine Red Cross Hotline 143 to ask before deciding."); return; }
    if (decision === "decline") { setStep("declined"); return; }
    if (!isLive) { setStep("consent"); return; }
    if (!config?.campaign) { setError("The live pilot is not configured."); return; }
    setBusy(true);
    try {
      const result = await api("/api/intake/case", { campaign_id: config.campaign.id, referral_link_id: referralLinkId, decision: "accept" });
      setCaseId(result.caseId);
      window.sessionStorage.setItem("safecard-case-id", result.caseId);
      await api("/api/intake/comprehension", { case_id: result.caseId, answers: { coverage_understanding: true, payment_not_activation: true, can_withdraw_consent: true, claims_contact_correct: true } });
      setStep("consent");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Unable to start the application."); }
    finally { setBusy(false); }
  }

  async function recordConsent() {
    if (!allAgreed) return;
    if (!isLive) { setStep("profile"); return; }
    const content = config?.content ?? [];
    const contentLocale = locale === "fil" ? "tl" : "en";
    const consent = content.find((item) => item.locale === contentLocale && item.content_type === "consent_text");
    const privacy = content.find((item) => item.locale === contentLocale && item.content_type === "privacy_notice");
    if (!caseId || !consent || !privacy) { setError("Approved consent content is unavailable."); return; }
    setBusy(true);
    try {
      const result = await api("/api/consent/grant", { case_id: caseId, consent_type: "membership_application", consent_content_version_id: consent.id, privacy_notice_version_id: privacy.id, locale: contentLocale, idempotency_key: key("consent") });
      setConsentRecordId(result.consentRecordId); setStep("profile");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Consent could not be recorded."); }
    finally { setBusy(false); }
  }

  function profileValid() {
    return profile.first_name.trim() && profile.last_name.trim() && /^(09|\+639)\d{9}$/.test(profile.mobile_number) && /^\d{4}$/.test(profile.zip_code) && profile.address_line1.trim() && profile.city.trim() && profile.province.trim();
  }

  async function submit() {
    if (!profileValid()) { setError("Please complete every required field using the requested format."); return; }
    if (!isLive) {
      setReference(`DEMO-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`);
      setProfile(syntheticProfile); setStep("complete"); return;
    }
    if (!caseId || !consentRecordId || !config?.content) { setError("Your secure session is incomplete. Start again."); return; }
    setBusy(true); setError("");
    try {
      await api("/api/intake/profile", { case_id: caseId, profile_data: profile, data_mode: "live" });
      const contentLocale = locale === "fil" ? "tl" : "en";
      const seen = config.content.filter((item) => item.locale === contentLocale).map((item) => item.id);
      const privacy = config.content.find((item) => item.locale === contentLocale && item.content_type === "privacy_notice");
      if (!privacy) throw new Error("Approved privacy notice is missing.");
      const result = await api("/api/intake/submit", { case_id: caseId, consent_record_id: consentRecordId, content_versions_seen: seen, privacy_notice_version_id: privacy.id, profile_data: profile, submitted_by: "recipient", idempotency_key: key("submit"), data_mode: "live" });
      setReference(result.applicationRef); setStep("payment");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Submission failed."); }
    finally { setBusy(false); }
  }

  async function clearSharedDevice() {
    if (isLive) await fetch("/api/intake/clear-session", { method: "POST" }).catch(() => undefined);
    window.sessionStorage.clear(); setProfile(isLive ? emptyProfile : syntheticProfile); router.push("/");
  }

  const labels = locale === "fil" ? ["Matuto", "Suriin", "Magpasya", "Pahintulot", "Form", "Review", "Bayad"] : ["Learn", "Check", "Decide", "Consent", "Form", "Review", "Payment"];
  const progress = ["learn", "check", "decide", "consent", "profile", "review", "payment"].indexOf(step);

  return <main className="wizard-page">
    <header className="wizard-nav"><Link href="/"><BrandMark /></Link><button className="locale-toggle" onClick={() => setLocale(locale === "fil" ? "en" : "fil")}>{locale === "fil" ? "English" : "Filipino"}</button></header>
    <div className="wizard-banner"><strong>{isLive ? "Controlled live pilot" : "Synthetic walkthrough"}</strong><span>{isLive ? "Approved data controls are active." : "Do not enter real personal information. Nothing here enrolls or charges anyone."}</span></div>
    {step !== "complete" && step !== "declined" && <ol className="wizard-progress" aria-label="Application progress">{labels.map((label, index) => <li key={label} className={index === progress ? "current" : index < progress ? "done" : ""}><span>{index < progress ? "✓" : index + 1}</span>{label}</li>)}</ol>}
    <section className="wizard-card">
      {step === "learn" && <><p className="eyebrow">01 · Education</p><h1>{locale === "fil" ? "Alamin ang mahalaga bago magpasya." : "Know what matters before deciding."}</h1><p className="wizard-lede">{locale === "fil" ? "Ang working baseline ay ₱1,200 bawat taon para sa edad 3–85. Ang eksaktong benepisyo, exclusion, eligibility, activation, at claims ay PRC lamang ang nagkukumpirma." : "The working baseline is ₱1,200 per year for ages 3–85. Only PRC confirms exact benefits, exclusions, eligibility, activation, and claims."}</p><div className="boundary-grid"><article><strong>Payment ≠ consent</strong><p>A sponsor or payer cannot decide for the recipient.</p></article><article><strong>Submission ≠ activation</strong><p>Only a PRC confirmation activates membership.</p></article><article><strong>Claims stay with PRC</strong><p>The project team never decides coverage or outcomes.</p></article></div><div className="wizard-actions"><button className="button-primary" onClick={() => setStep("check")}>{locale === "fil" ? "Suriin ang pagkaunawa" : "Check my understanding"} →</button><Link className="button-quiet" href="/benefits">Full guide</Link></div></>}
      {step === "check" && <><p className="eyebrow">02 · Comprehension</p><h1>{locale === "fil" ? "Apat na bagay na dapat malinaw." : "Four things that must be clear."}</h1><Quiz label="Working annual fee" name="cost" value={answers.cost} onChange={(value) => setAnswers({ ...answers, cost: value })} options={[["1200", "₱1,200 / year"], ["100", "₱100 total"]]} /><Quiz label="Who confirms activation?" name="activation" value={answers.activation} onChange={(value) => setAnswers({ ...answers, activation: value })} options={[["prc", "Philippine Red Cross"], ["sponsor", "The sponsor"]]} /><Quiz label="Who decides to participate?" name="choice" value={answers.choice} onChange={(value) => setAnswers({ ...answers, choice: value })} options={[["recipient", "The recipient"], ["payer", "The payer"]]} /><Quiz label="Emergency hotline in the working guide" name="emergency" value={answers.emergency} onChange={(value) => setAnswers({ ...answers, emergency: value })} options={[["143", "Hotline 143"], ["sponsor", "The sponsor"]]} />{error && <p className="form-message error">{error}</p>}<div className="wizard-actions"><button className="button-primary" onClick={() => quizPassed ? setStep("decide") : setError("Review the guide and answer all four correctly.")}>Continue →</button><button className="button-quiet" onClick={() => setStep("learn")}>Review guide</button></div></>}
      {step === "decide" && <><p className="eyebrow">03 · Private decision</p><h1>{locale === "fil" ? "Ang iyong sagot ay sa iyo lamang." : "Your answer belongs to you."}</h1><p className="wizard-lede">The sponsor receives no notification about an “ask” or “decline” choice.</p><div className="decision-list"><button onClick={() => decide("accept")}><span>✓</span><div><strong>Accept / Mag-apply</strong><p>Continue to the privacy and consent step.</p></div></button><button onClick={() => decide("ask")}><span>?</span><div><strong>Ask / Magtanong</strong><p>Open Hotline 143 without starting an application.</p></div></button><button onClick={() => decide("decline")}><span>×</span><div><strong>Not now / Hindi ngayon</strong><p>Leave privately without providing personal information.</p></div></button></div>{error && <p className="form-message error">{error}</p>}{busy && <p className="form-message">Creating a private session…</p>}</>}
      {step === "consent" && <><p className="eyebrow">04 · Privacy and consent</p><h1>{locale === "fil" ? "Pahintulot bago ang personal na datos." : "Consent before personal data."}</h1><div className="privacy-panel"><strong>Minimum necessary collection</strong><p>The live pilot may collect only PRC-approved application fields. Sponsors cannot see recipient identity, address, mobile number, application answers, payment evidence, or claims activity. Data remains transient until secure PRC handoff.</p><Link href="/privacy">Read the privacy and rights notice</Link></div>{[["voluntary", "I am choosing voluntarily and may withdraw."], ["privacy", "I understand why the approved fields are collected and shared with PRC."], ["boundaries", "I understand payment and submission do not activate membership."]].map(([item, label]) => <label key={item} className="consent-row"><input type="checkbox" checked={agreed[item as keyof typeof agreed]} onChange={(event) => setAgreed({ ...agreed, [item]: event.target.checked })} /><span>{label}</span></label>)}{error && <p className="form-message error">{error}</p>}<div className="wizard-actions"><button className="button-primary" disabled={!allAgreed || busy} onClick={recordConsent}>Continue privately →</button><button className="button-quiet" onClick={() => setStep("decide")}>Back</button></div></>}
      {step === "profile" && <><p className="eyebrow">05 · Approved fields</p><h1>{isLive ? "Your application details" : "Synthetic form demonstration"}</h1><p className="wizard-lede">{isLive ? "Your draft is saved only to the protected pilot backend after consent." : "Fields are locked to reserved synthetic values. Real information is blocked until every launch gate passes."}</p><div className="form-grid"><Field label="First name" value={profile.first_name} disabled={!isLive} onChange={(value) => setProfile({ ...profile, first_name: value })} /><Field label="Last name" value={profile.last_name} disabled={!isLive} onChange={(value) => setProfile({ ...profile, last_name: value })} /><Field label="Date of birth" type="date" value={profile.date_of_birth} disabled={!isLive} onChange={(value) => setProfile({ ...profile, date_of_birth: value })} /><label className="field-block"><span>Sex</span><select value={profile.sex} disabled={!isLive} onChange={(event) => setProfile({ ...profile, sex: event.target.value as "male" | "female" })}><option value="female">Female</option><option value="male">Male</option></select></label><Field label="Mobile number" value={profile.mobile_number} disabled={!isLive} onChange={(value) => setProfile({ ...profile, mobile_number: value })} /><Field label="Email (optional)" value={profile.email || ""} disabled={!isLive} onChange={(value) => setProfile({ ...profile, email: value })} /><div className="full"><Field label="Address" value={profile.address_line1} disabled={!isLive} onChange={(value) => setProfile({ ...profile, address_line1: value })} /></div><Field label="City" value={profile.city} disabled={!isLive} onChange={(value) => setProfile({ ...profile, city: value })} /><Field label="Province" value={profile.province} disabled={!isLive} onChange={(value) => setProfile({ ...profile, province: value })} /><Field label="ZIP code" value={profile.zip_code} disabled={!isLive} onChange={(value) => setProfile({ ...profile, zip_code: value })} /></div>{error && <p className="form-message error">{error}</p>}<div className="wizard-actions"><button className="button-primary" onClick={() => profileValid() ? setStep("review") : setError("Complete every required field.")}>Review →</button><button className="button-quiet" onClick={clearSharedDevice}>Clear shared device</button></div></>}
      {step === "review" && <><p className="eyebrow">06 · Review</p><h1>{locale === "fil" ? "Suriin bago isumite." : "Review before submitting."}</h1><dl className="review-list"><div><dt>Name</dt><dd>{profile.first_name} {profile.last_name}</dd></div><div><dt>Date of birth</dt><dd>{profile.date_of_birth}</dd></div><div><dt>Mobile</dt><dd>{profile.mobile_number}</dd></div><div><dt>Address</dt><dd>{profile.address_line1}, {profile.city}, {profile.province} {profile.zip_code}</dd></div></dl><div className="notice-panel"><strong>Next: manual payment after submission</strong><span>Submit the application first. If the controlled pilot has approved payment routes, you will then choose GCash or bank transfer and upload proof. Payment remains separate from consent, submission, approval, PRC handoff, and membership activation.</span></div>{error && <p className="form-message error">{error}</p>}<div className="wizard-actions"><button className="button-primary" disabled={busy} onClick={submit}>{busy ? "Submitting…" : isLive ? "Submit application →" : "Complete demo →"}</button><button className="button-quiet" onClick={() => setStep("profile")}>Edit</button></div></>}
      {step === "payment" && (caseId && config?.campaign ? <ManualPaymentPanel caseId={caseId} campaignId={config.campaign.id} live={isLive} onComplete={() => { setProfile(emptyProfile); window.sessionStorage.removeItem("safecard-case-id"); setStep("complete"); }} /> : <p className="form-message error">Your secure payment session is incomplete. Start again.</p>)}
      {step === "complete" && <div className="completion-panel"><span className="completion-mark">✓</span><p className="eyebrow">{isLive ? "Application submitted" : "Synthetic walkthrough complete"}</p><h1>{isLive ? "Submission received—not yet active." : "No real application was created."}</h1><p>{isLive ? "Keep this reference. Payment review, PRC handoff, and membership activation remain separate stages." : "This reference is demonstrative and cannot be used as a membership credential."}</p><div className="reference-box"><span>{isLive ? "Application reference" : "Demo reference"}</span><strong>{reference}</strong></div><div className="wizard-actions"><Link className="button-primary" href={isLive ? "/member" : "/"}>{isLive ? "Check status" : "Return home"}</Link><button className="button-quiet" onClick={() => window.print()}>Print summary</button></div></div>}
      {step === "declined" && <div className="completion-panel"><span className="completion-mark quiet">×</span><p className="eyebrow">Private choice recorded locally</p><h1>No application was started.</h1><p>No personal information was requested, and the sponsor is not told that you declined.</p><div className="wizard-actions"><Link className="button-primary" href="/">Return home</Link><button className="button-quiet" onClick={() => setStep("learn")}>Review again</button></div></div>}
    </section>
  </main>;
}

function Quiz({ label, name, value, onChange, options }: { label: string; name: string; value: string; onChange: (value: string) => void; options: string[][] }) {
  return <fieldset className="quiz-block"><legend>{label}</legend>{options.map(([optionValue, text]) => <label key={optionValue}><input type="radio" name={name} checked={value === optionValue} onChange={() => onChange(optionValue)} /><span>{text}</span></label>)}</fieldset>;
}

function Field({ label, value, onChange, disabled, type = "text" }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean; type?: string }) {
  return <label className="field-block"><span>{label}</span><input type={type} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} /></label>;
}
