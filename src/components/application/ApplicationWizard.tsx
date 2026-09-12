"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { useLocale } from "@/components/LocaleProvider";
import { ManualPaymentPanel } from "@/components/application/ManualPaymentPanel";

type Step = "learn" | "check" | "decide" | "consent" | "profile" | "review" | "payment" | "complete" | "declined";
type PilotConfig = {
  mode: "synthetic" | "live" | "unavailable";
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
  const [localStateReady, setLocalStateReady] = useState(false);

  useEffect(() => {
    fetch("/api/pilot/config", { cache: "no-store" }).then(async (response) => {
      const next = await response.json() as PilotConfig;
      if (!response.ok) throw new Error(next.configurationError || "Pilot configuration is unavailable.");
      setConfig(next); setProfile(next.mode === "live" ? emptyProfile : syntheticProfile);
    }).catch((caught) => setConfig({ mode: "unavailable", campaign: null, payment: { available: false, reason: "Unavailable" }, externalNotifications: { available: false, reason: "Parked" }, configurationError: caught instanceof Error ? caught.message : "Pilot configuration is unavailable." }));
  }, []);

  useEffect(() => {
    if (config?.mode !== "live" || caseId) return;
    const storedCaseId = window.sessionStorage.getItem("safecard-case-id");
    if (!storedCaseId) return;
    void (async () => {
      try {
        const statusResponse = await fetch(`/api/intake/status?case_id=${encodeURIComponent(storedCaseId)}`, { cache: "no-store" });
        const statusBody = await statusResponse.json();
        if (!statusResponse.ok) throw new Error(statusBody.error || "Unable to restore the application.");
        setCaseId(storedCaseId);
        setConsentRecordId(statusBody.consentRecordId ?? undefined);
        if (["submitted", "resubmitted"].includes(statusBody.states.application)) {
          setReference(statusBody.applicationRef ?? "");
          setStep("payment");
          return;
        }
        if (statusBody.states.consent === "agreed") {
          const profileResponse = await fetch(`/api/intake/profile?case_id=${encodeURIComponent(storedCaseId)}`, { cache: "no-store" });
          if (profileResponse.ok) {
            const profileBody = await profileResponse.json();
            setProfile((current) => ({ ...current, ...profileBody.profile }));
          }
          setStep("profile");
          return;
        }
        setStep("consent");
      } catch (caught) {
        window.sessionStorage.removeItem("safecard-case-id");
        setError(caught instanceof Error ? caught.message : "Unable to restore the application.");
      }
    })();
  }, [caseId, config]);

  useEffect(() => {
    if (!localStateReady || caseId || !["learn", "check", "decide"].includes(step)) return;
    window.sessionStorage.setItem("safecard-wizard-state", JSON.stringify({ step, answers }));
  }, [answers, caseId, localStateReady, step]);

  useEffect(() => {
    if (caseId) return;
    const restore = () => {
      try {
        const saved = JSON.parse(window.sessionStorage.getItem("safecard-wizard-state") ?? "null") as { step?: Step; answers?: typeof answers } | null;
        if (saved?.step && ["learn", "check", "decide"].includes(saved.step)) setStep(saved.step);
        if (saved?.answers) setAnswers(saved.answers);
      } catch {
        window.sessionStorage.removeItem("safecard-wizard-state");
      } finally {
        setLocalStateReady(true);
      }
    };
    // Restore after the first client paint. This avoids a hydration mismatch
    // while keeping state writes outside the synchronous effect body.
    const frame = window.requestAnimationFrame(restore);
    return () => window.cancelAnimationFrame(frame);
    // Restore once for this tab. PII is never stored here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const isFil = locale === "fil";
  const ui = isFil ? {
    bannerLive: "Live pilot na kontrolado", bannerLiveBody: "Aktibo ang mga approved data control.", bannerSynthetic: "Synthetic na walkthrough", bannerSyntheticBody: "Huwag maglagay ng totoong personal na impormasyon. Walang mae-enroll o sisingilin dito.",
    learnEyebrow: "01 · Impormasyon", learnTitle: "Alamin ang mahalaga bago magpasya.", learnBody: "Ang working baseline ay ₱1,200 bawat taon para sa edad 3–85. Ang eksaktong benepisyo, exclusions, eligibility, activation, at claims ay PRC lamang ang nagkukumpirma.",
    paymentBoundary: "Bayad ≠ pahintulot", paymentBoundaryBody: "Hindi maaaring magpasya ang sponsor o payer para sa recipient.", submissionBoundary: "Submission ≠ activation", submissionBoundaryBody: "PRC lamang ang makakapagkumpirma ng membership.", claimsBoundary: "PRC ang nagdedesisyon sa claims", claimsBoundaryBody: "Hindi nagdedesisyon ang project team kung covered o approved ang claim.", fullGuide: "Buong gabay",
    checkEyebrow: "02 · Pag-check", checkTitle: "Apat na bagay na dapat malinaw.", feeQuestion: "Magkano ang working annual fee?", feeCorrect: "₱1,200 / year", feeWrong: "₱100 total", activationQuestion: "Sino ang nagkukumpirma ng activation?", activationCorrect: "Philippine Red Cross", activationWrong: "Ang sponsor", choiceQuestion: "Sino ang nagpapasyang sumali?", choiceCorrect: "Ang recipient", choiceWrong: "Ang payer", hotlineQuestion: "Emergency hotline sa working guide", continue: "Magpatuloy →", reviewGuide: "Balikan ang gabay",
    decideEyebrow: "03 · Pribadong desisyon", decideTitle: "Ang iyong sagot ay sa iyo lamang.", decideBody: "Hindi makakatanggap ng notification ang sponsor kung ikaw ay magtatanong o tatanggi.", accept: "Accept / Mag-apply", acceptBody: "Magpatuloy sa privacy at consent step.", ask: "Ask / Magtanong", askBody: "Buksan ang Hotline 143 nang hindi nagsisimula ng application.", decline: "Not now / Hindi ngayon", declineBody: "Umalis nang pribado nang walang ibibigay na personal na impormasyon.", busy: "Gumagawa ng pribadong session…",
    consentEyebrow: "04 · Privacy at pahintulot", consentTitle: "Pahintulot bago ang personal na datos.", minimum: "Minimum na kailangang kolektahin", minimumBody: "Sa live pilot, PRC-approved application fields lamang ang maaaring kolektahin. Hindi makikita ng sponsors ang identity, address, mobile number, application answers, payment evidence, o claims activity ng recipient. Mananatiling transient ang data hanggang sa secure na PRC handoff.", privacyLink: "Basahin ang privacy at rights notice", voluntary: "Kusang-loob ang pagsali at maaari akong umatras.", privacyConsent: "Naiintindihan ko kung bakit kinokolekta at ibinabahagi sa PRC ang approved fields.", boundaryConsent: "Naiintindihan ko na ang bayad at submission ay hindi nag-a-activate ng membership.", continuePrivately: "Magpatuloy nang pribado →", back: "Bumalik",
    profileEyebrow: "05 · Approved fields", profileLiveTitle: "Detalye ng iyong application", profileSyntheticTitle: "Synthetic form demonstration", profileLiveBody: "Mase-save lamang ang draft sa protected pilot backend pagkatapos ng consent.", profileSyntheticBody: "Naka-lock ang fields sa reserved synthetic values. Hindi puwedeng gumamit ng totoong impormasyon hanggang makumpleto ang launch gates.", firstName: "First name", lastName: "Last name", dob: "Date of birth", sex: "Sex", female: "Female", male: "Male", mobile: "Mobile number", email: "Email (optional)", address: "Address", city: "City", province: "Province", zip: "ZIP code", review: "Suriin →", clearDevice: "I-clear ang shared device",
    reviewEyebrow: "06 · Review", reviewTitle: "Suriin bago isumite.", name: "Pangalan", dateOfBirth: "Petsa ng kapanganakan", addressLabel: "Address", nextPayment: "Susunod: manual payment pagkatapos ng submission", nextPaymentBody: "Isumite muna ang application. Kung may approved payment routes ang controlled pilot, saka ka pipili ng GCash o bank transfer at mag-u-upload ng proof. Hiwalay ang payment sa consent, submission, approval, PRC handoff, at membership activation.", submit: "Isumite ang application →", submitting: "Isinusumite…", edit: "I-edit",
    completeLiveEyebrow: "Application submitted", completeSyntheticEyebrow: "Synthetic walkthrough complete", completeLiveTitle: "Natanggap ang submission—hindi pa active.", completeSyntheticTitle: "Walang totoong application na ginawa.", completeLiveBody: "Itago ang reference na ito. Hiwalay pa rin ang payment review, PRC handoff, at membership activation.", completeSyntheticBody: "Demonstration lamang ang reference na ito at hindi ito puwedeng gamitin bilang membership credential.", applicationRef: "Application reference", demoRef: "Demo reference", checkStatus: "Tingnan ang status", returnHome: "Bumalik sa home", print: "I-print ang summary", declinedEyebrow: "Pribadong choice na na-record locally", declinedTitle: "Walang application na sinimulan.", declinedBody: "Walang personal na impormasyong hiningi, at hindi sasabihan ang sponsor na tumanggi ka.", reviewAgain: "Suriin ulit",
  } : {
    bannerLive: "Controlled live pilot", bannerLiveBody: "Approved data controls are active.", bannerSynthetic: "Synthetic walkthrough", bannerSyntheticBody: "Do not enter real personal information. Nothing here enrolls or charges anyone.",
    learnEyebrow: "01 · Education", learnTitle: "Know what matters before deciding.", learnBody: "The working baseline is ₱1,200 per year for ages 3–85. Only PRC confirms exact benefits, exclusions, eligibility, activation, and claims.",
    paymentBoundary: "Payment ≠ consent", paymentBoundaryBody: "A sponsor or payer cannot decide for the recipient.", submissionBoundary: "Submission ≠ activation", submissionBoundaryBody: "Only a PRC confirmation activates membership.", claimsBoundary: "Claims stay with PRC", claimsBoundaryBody: "The project team never decides coverage or outcomes.", fullGuide: "Full guide",
    checkEyebrow: "02 · Comprehension", checkTitle: "Four things that must be clear.", feeQuestion: "Working annual fee", feeCorrect: "₱1,200 / year", feeWrong: "₱100 total", activationQuestion: "Who confirms activation?", activationCorrect: "Philippine Red Cross", activationWrong: "The sponsor", choiceQuestion: "Who decides to participate?", choiceCorrect: "The recipient", choiceWrong: "The payer", hotlineQuestion: "Emergency hotline in the working guide", continue: "Continue →", reviewGuide: "Review guide",
    decideEyebrow: "03 · Private decision", decideTitle: "Your answer belongs to you.", decideBody: "The sponsor receives no notification about an “ask” or “decline” choice.", accept: "Accept / Mag-apply", acceptBody: "Continue to the privacy and consent step.", ask: "Ask / Magtanong", askBody: "Open Hotline 143 without starting an application.", decline: "Not now / Hindi ngayon", declineBody: "Leave privately without providing personal information.", busy: "Creating a private session…",
    consentEyebrow: "04 · Privacy and consent", consentTitle: "Consent before personal data.", minimum: "Minimum necessary collection", minimumBody: "The live pilot may collect only PRC-approved application fields. Sponsors cannot see recipient identity, address, mobile number, application answers, payment evidence, or claims activity. Data remains transient until secure PRC handoff.", privacyLink: "Read the privacy and rights notice", voluntary: "I am choosing voluntarily and may withdraw.", privacyConsent: "I understand why the approved fields are collected and shared with PRC.", boundaryConsent: "I understand payment and submission do not activate membership.", continuePrivately: "Continue privately →", back: "Back",
    profileEyebrow: "05 · Approved fields", profileLiveTitle: "Your application details", profileSyntheticTitle: "Synthetic form demonstration", profileLiveBody: "Your draft is saved only to the protected pilot backend after consent.", profileSyntheticBody: "Fields are locked to reserved synthetic values. Real information is blocked until every launch gate passes.", firstName: "First name", lastName: "Last name", dob: "Date of birth", sex: "Sex", female: "Female", male: "Male", mobile: "Mobile number", email: "Email (optional)", address: "Address", city: "City", province: "Province", zip: "ZIP code", review: "Review →", clearDevice: "Clear shared device",
    reviewEyebrow: "06 · Review", reviewTitle: "Review before submitting.", name: "Name", dateOfBirth: "Date of birth", addressLabel: "Address", nextPayment: "Next: manual payment after submission", nextPaymentBody: "Submit the application first. If the controlled pilot has approved payment routes, you will then choose GCash or bank transfer and upload proof. Payment remains separate from consent, submission, approval, PRC handoff, and membership activation.", submit: "Submit application →", submitting: "Submitting…", edit: "Edit",
    completeLiveEyebrow: "Application submitted", completeSyntheticEyebrow: "Synthetic walkthrough complete", completeLiveTitle: "Submission received—not yet active.", completeSyntheticTitle: "No real application was created.", completeLiveBody: "Keep this reference. Payment review, PRC handoff, and membership activation remain separate stages.", completeSyntheticBody: "This reference is demonstrative and cannot be used as a membership credential.", applicationRef: "Application reference", demoRef: "Demo reference", checkStatus: "Check status", returnHome: "Return home", print: "Print summary", declinedEyebrow: "Private choice recorded locally", declinedTitle: "No application was started.", declinedBody: "No personal information was requested, and the sponsor is not told that you declined.", reviewAgain: "Review again",
  };

  async function api(path: string, body: unknown) {
    const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || (isFil ? "Hindi makumpleto ang request." : "The request could not be completed."));
    return data;
  }

  async function decide(decision: "accept" | "ask" | "decline") {
    setError("");
    if (config?.mode === "unavailable") { setError(config.configurationError || (isFil ? "Hindi available ang pilot." : "The pilot is unavailable.")); return; }
    if (decision === "ask") { setError(isFil ? "Tumawag sa Philippine Red Cross Hotline 143 bago magpasya." : "Call Philippine Red Cross Hotline 143 to ask before deciding."); return; }
    if (decision === "decline") { setStep("declined"); return; }
    if (!isLive) { setStep("consent"); return; }
    if (!config?.campaign) { setError(isFil ? "Hindi pa naka-configure ang live pilot." : "The live pilot is not configured."); return; }
    setBusy(true);
    try {
      const result = await api("/api/intake/case", { campaign_id: config.campaign.id, referral_link_id: referralLinkId, decision: "accept" });
      setCaseId(result.caseId);
      window.sessionStorage.setItem("safecard-case-id", result.caseId);
      await api("/api/intake/comprehension", { case_id: result.caseId, answers: { coverage_understanding: true, payment_not_activation: true, can_withdraw_consent: true, claims_contact_correct: true } });
      setStep("consent");
    } catch (caught) { setError(caught instanceof Error ? caught.message : (isFil ? "Hindi masimulan ang application." : "Unable to start the application.")); }
    finally { setBusy(false); }
  }

  async function recordConsent() {
    if (!allAgreed) return;
    if (!isLive) { setStep("profile"); return; }
    const content = config?.content ?? [];
    const contentLocale = locale === "fil" ? "tl" : "en";
    const consent = content.find((item) => item.locale === contentLocale && item.content_type === "consent_text");
    const privacy = content.find((item) => item.locale === contentLocale && item.content_type === "privacy_notice");
    if (!caseId || !consent || !privacy) { setError(isFil ? "Hindi available ang approved consent content." : "Approved consent content is unavailable."); return; }
    setBusy(true);
    try {
      const result = await api("/api/consent/grant", { case_id: caseId, consent_type: "membership_application", consent_content_version_id: consent.id, privacy_notice_version_id: privacy.id, locale: contentLocale, idempotency_key: key("consent") });
      setConsentRecordId(result.consentRecordId); setStep("profile");
    } catch (caught) { setError(caught instanceof Error ? caught.message : (isFil ? "Hindi ma-record ang consent." : "Consent could not be recorded.")); }
    finally { setBusy(false); }
  }

  function profileValid() {
    return profile.first_name.trim() && profile.last_name.trim() && /^(09|\+639)\d{9}$/.test(profile.mobile_number) && /^\d{4}$/.test(profile.zip_code) && profile.address_line1.trim() && profile.city.trim() && profile.province.trim();
  }

  async function submit() {
    if (!profileValid()) { setError(isFil ? "Kumpletuhin ang lahat ng required fields gamit ang tamang format." : "Please complete every required field using the requested format."); return; }
    if (!isLive) {
      setReference(`DEMO-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 8).toUpperCase()}`);
      setProfile(syntheticProfile); setStep("complete"); return;
    }
    if (!caseId || !consentRecordId || !config?.content) { setError(isFil ? "Hindi kumpleto ang secure session mo. Magsimula ulit." : "Your secure session is incomplete. Start again."); return; }
    setBusy(true); setError("");
    try {
      await api("/api/intake/profile", { case_id: caseId, profile_data: profile, data_mode: "live" });
      const contentLocale = locale === "fil" ? "tl" : "en";
      const seen = config.content.filter((item) => item.locale === contentLocale).map((item) => item.id);
      const privacy = config.content.find((item) => item.locale === contentLocale && item.content_type === "privacy_notice");
      if (!privacy) throw new Error(isFil ? "Wala ang approved privacy notice." : "Approved privacy notice is missing.");
      const result = await api("/api/intake/submit", { case_id: caseId, consent_record_id: consentRecordId, content_versions_seen: seen, privacy_notice_version_id: privacy.id, profile_data: profile, submitted_by: "recipient", idempotency_key: key("submit"), data_mode: "live" });
      setReference(result.applicationRef); setStep("payment");
    } catch (caught) { setError(caught instanceof Error ? caught.message : (isFil ? "Hindi naisumite ang application." : "Submission failed.")); }
    finally { setBusy(false); }
  }

  async function clearSharedDevice() {
    if (isLive) await fetch("/api/intake/clear-session", { method: "POST" }).catch(() => undefined);
    window.sessionStorage.removeItem("safecard-case-id"); window.sessionStorage.removeItem("safecard-wizard-state"); setProfile(isLive ? emptyProfile : syntheticProfile); router.push("/");
  }

  const labels = isFil ? ["Matuto", "Suriin", "Magpasya", "Pahintulot", "Form", "Suriin", "Bayad"] : ["Learn", "Check", "Decide", "Consent", "Form", "Review", "Payment"];
  const progress = ["learn", "check", "decide", "consent", "profile", "review", "payment"].indexOf(step);

  return <main className="wizard-page">
    <header className="wizard-nav"><Link href="/"><BrandMark /></Link><button className="locale-toggle" onClick={() => setLocale(locale === "fil" ? "en" : "fil")}>{locale === "fil" ? "English" : "Filipino"}</button></header>
    <div className="wizard-banner"><strong>{config?.mode === "unavailable" ? (isFil ? "Hindi available ang pilot" : "Pilot unavailable") : isLive ? ui.bannerLive : ui.bannerSynthetic}</strong><span>{config?.mode === "unavailable" ? config.configurationError : isLive ? ui.bannerLiveBody : ui.bannerSyntheticBody}</span></div>
    {step !== "complete" && step !== "declined" && <ol className="wizard-progress" aria-label="Application progress">{labels.map((label, index) => <li key={`${index}-${label}`} className={index === progress ? "current" : index < progress ? "done" : ""}><span>{index < progress ? "✓" : index + 1}</span>{label}</li>)}</ol>}
    <section className="wizard-card">
      {config?.mode === "unavailable" && <div className="parked-panel" role="alert"><strong>{isFil ? "Hindi maaaring magsimula ng application." : "Applications cannot start."}</strong><p>{config.configurationError}</p></div>}
      {step === "learn" && <><p className="eyebrow">{ui.learnEyebrow}</p><h1>{ui.learnTitle}</h1><p className="wizard-lede">{ui.learnBody}</p><div className="boundary-grid"><article><strong>{ui.paymentBoundary}</strong><p>{ui.paymentBoundaryBody}</p></article><article><strong>{ui.submissionBoundary}</strong><p>{ui.submissionBoundaryBody}</p></article><article><strong>{ui.claimsBoundary}</strong><p>{ui.claimsBoundaryBody}</p></article></div><div className="wizard-actions"><button className="button-primary" onClick={() => setStep("check")}>{isFil ? "Suriin ang pagkaunawa" : "Check my understanding"} →</button><Link className="button-quiet" href="/benefits">{ui.fullGuide}</Link></div></>}
      {step === "check" && <><p className="eyebrow">{ui.checkEyebrow}</p><h1>{ui.checkTitle}</h1><Quiz label={ui.feeQuestion} name="cost" value={answers.cost} onChange={(value) => setAnswers({ ...answers, cost: value })} options={[["1200", ui.feeCorrect], ["100", ui.feeWrong]]} /><Quiz label={ui.activationQuestion} name="activation" value={answers.activation} onChange={(value) => setAnswers({ ...answers, activation: value })} options={[["prc", ui.activationCorrect], ["sponsor", ui.activationWrong]]} /><Quiz label={ui.choiceQuestion} name="choice" value={answers.choice} onChange={(value) => setAnswers({ ...answers, choice: value })} options={[["recipient", ui.choiceCorrect], ["payer", ui.choiceWrong]]} /><Quiz label={ui.hotlineQuestion} name="emergency" value={answers.emergency} onChange={(value) => setAnswers({ ...answers, emergency: value })} options={[["143", "Hotline 143"], ["sponsor", ui.activationWrong]]} />{error && <p className="form-message error">{error}</p>}<div className="wizard-actions"><button className="button-primary" onClick={() => quizPassed ? setStep("decide") : setError(isFil ? "Balikan ang guide at sagutin nang tama ang apat." : "Review the guide and answer all four correctly.")}>{ui.continue}</button><button className="button-quiet" onClick={() => setStep("learn")}>{ui.reviewGuide}</button></div></>}
      {step === "decide" && <><p className="eyebrow">{ui.decideEyebrow}</p><h1>{ui.decideTitle}</h1><p className="wizard-lede">{ui.decideBody}</p><div className="decision-list"><button onClick={() => decide("accept")}><span>✓</span><div><strong>{ui.accept}</strong><p>{ui.acceptBody}</p></div></button><button onClick={() => decide("ask")}><span>?</span><div><strong>{ui.ask}</strong><p>{ui.askBody}</p></div></button><button onClick={() => decide("decline")}><span>×</span><div><strong>{ui.decline}</strong><p>{ui.declineBody}</p></div></button></div>{error && <p className="form-message error">{error}</p>}{busy && <p className="form-message">{ui.busy}</p>}</>}
      {step === "consent" && <><p className="eyebrow">{ui.consentEyebrow}</p><h1>{ui.consentTitle}</h1><div className="privacy-panel"><strong>{ui.minimum}</strong><p>{ui.minimumBody}</p><Link href="/privacy">{ui.privacyLink}</Link></div>{[["voluntary", ui.voluntary], ["privacy", ui.privacyConsent], ["boundaries", ui.boundaryConsent]].map(([item, label]) => <label key={item} className="consent-row"><input type="checkbox" checked={agreed[item as keyof typeof agreed]} onChange={(event) => setAgreed({ ...agreed, [item]: event.target.checked })} /><span>{label}</span></label>)}{error && <p className="form-message error">{error}</p>}<div className="wizard-actions"><button className="button-primary" disabled={!allAgreed || busy} onClick={recordConsent}>{ui.continuePrivately}</button><button className="button-quiet" onClick={() => setStep("decide")}>{ui.back}</button></div></>}
      {step === "profile" && <><p className="eyebrow">{ui.profileEyebrow}</p><h1>{isLive ? ui.profileLiveTitle : ui.profileSyntheticTitle}</h1><p className="wizard-lede">{isLive ? ui.profileLiveBody : ui.profileSyntheticBody}</p><div className="form-grid"><Field label={ui.firstName} value={profile.first_name} disabled={!isLive} onChange={(value) => setProfile({ ...profile, first_name: value })} /><Field label={ui.lastName} value={profile.last_name} disabled={!isLive} onChange={(value) => setProfile({ ...profile, last_name: value })} /><Field label={ui.dob} type="date" value={profile.date_of_birth} disabled={!isLive} onChange={(value) => setProfile({ ...profile, date_of_birth: value })} /><label className="field-block"><span>{ui.sex}</span><select value={profile.sex} disabled={!isLive} onChange={(event) => setProfile({ ...profile, sex: event.target.value as "male" | "female" })}><option value="female">{ui.female}</option><option value="male">{ui.male}</option></select></label><Field label={ui.mobile} value={profile.mobile_number} disabled={!isLive} onChange={(value) => setProfile({ ...profile, mobile_number: value })} /><Field label={ui.email} value={profile.email || ""} disabled={!isLive} onChange={(value) => setProfile({ ...profile, email: value })} /><div className="full"><Field label={ui.address} value={profile.address_line1} disabled={!isLive} onChange={(value) => setProfile({ ...profile, address_line1: value })} /></div><Field label={ui.city} value={profile.city} disabled={!isLive} onChange={(value) => setProfile({ ...profile, city: value })} /><Field label={ui.province} value={profile.province} disabled={!isLive} onChange={(value) => setProfile({ ...profile, province: value })} /><Field label={ui.zip} value={profile.zip_code} disabled={!isLive} onChange={(value) => setProfile({ ...profile, zip_code: value })} /></div>{error && <p className="form-message error">{error}</p>}<div className="wizard-actions"><button className="button-primary" onClick={() => profileValid() ? setStep("review") : setError(isFil ? "Kumpletuhin ang lahat ng required fields." : "Complete every required field.")}>{ui.review}</button><button className="button-quiet" onClick={clearSharedDevice}>{ui.clearDevice}</button></div></>}
      {step === "review" && <><p className="eyebrow">{ui.reviewEyebrow}</p><h1>{ui.reviewTitle}</h1><dl className="review-list"><div><dt>{ui.name}</dt><dd>{profile.first_name} {profile.last_name}</dd></div><div><dt>{ui.dateOfBirth}</dt><dd>{profile.date_of_birth}</dd></div><div><dt>{ui.mobile}</dt><dd>{profile.mobile_number}</dd></div><div><dt>{ui.addressLabel}</dt><dd>{profile.address_line1}, {profile.city}, {profile.province} {profile.zip_code}</dd></div></dl><div className="notice-panel"><strong>{ui.nextPayment}</strong><span>{ui.nextPaymentBody}</span></div>{error && <p className="form-message error">{error}</p>}<div className="wizard-actions"><button className="button-primary" disabled={busy} onClick={submit}>{busy ? ui.submitting : isLive ? ui.submit : (isFil ? "Kumpletuhin ang demo →" : "Complete demo →")}</button><button className="button-quiet" onClick={() => setStep("profile")}>{ui.edit}</button></div></>}
      {step === "payment" && (caseId && config?.campaign ? <ManualPaymentPanel caseId={caseId} campaignId={config.campaign.id} live={isLive} onComplete={() => { setProfile(emptyProfile); window.sessionStorage.removeItem("safecard-case-id"); setStep("complete"); }} /> : <p className="form-message error">Your secure payment session is incomplete. Start again.</p>)}
      {step === "complete" && <div className="completion-panel"><span className="completion-mark">✓</span><p className="eyebrow">{isLive ? ui.completeLiveEyebrow : ui.completeSyntheticEyebrow}</p><h1>{isLive ? ui.completeLiveTitle : ui.completeSyntheticTitle}</h1><p>{isLive ? ui.completeLiveBody : ui.completeSyntheticBody}</p><div className="reference-box"><span>{isLive ? ui.applicationRef : ui.demoRef}</span><strong>{reference}</strong></div><div className="wizard-actions"><Link className="button-primary" href={isLive ? "/member" : "/"}>{isLive ? ui.checkStatus : ui.returnHome}</Link><button className="button-quiet" onClick={() => window.print()}>{ui.print}</button></div></div>}
      {step === "declined" && <div className="completion-panel"><span className="completion-mark quiet">×</span><p className="eyebrow">{ui.declinedEyebrow}</p><h1>{ui.declinedTitle}</h1><p>{ui.declinedBody}</p><div className="wizard-actions"><Link className="button-primary" href="/">{ui.returnHome}</Link><button className="button-quiet" onClick={() => setStep("learn")}>{ui.reviewAgain}</button></div></div>}
    </section>
  </main>;
}

function Quiz({ label, name, value, onChange, options }: { label: string; name: string; value: string; onChange: (value: string) => void; options: string[][] }) {
  return <fieldset className="quiz-block"><legend>{label}</legend>{options.map(([optionValue, text]) => <label key={optionValue}><input type="radio" name={name} checked={value === optionValue} onChange={() => onChange(optionValue)} /><span>{text}</span></label>)}</fieldset>;
}

function Field({ label, value, onChange, disabled, type = "text" }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean; type?: string }) {
  return <label className="field-block"><span>{label}</span><input type={type} value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} /></label>;
}
