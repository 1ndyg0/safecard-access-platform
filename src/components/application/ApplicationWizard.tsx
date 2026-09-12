"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { useLocale } from "@/components/LocaleProvider";
import { ManualPaymentPanel } from "@/components/application/ManualPaymentPanel";

type Step = "learn" | "check" | "decide" | "consent" | "profile" | "payment" | "review" | "complete" | "declined";
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
type PaymentSummary = { routeLabel: string; reference: string };

const syntheticProfile: Profile = {
  first_name: "DEMO", last_name: "PERSON", date_of_birth: "2000-01-01", sex: "female",
  mobile_number: "09000000000", address_line1: "TEST ADDRESS", city: "TEST CITY", province: "TEST PROVINCE", zip_code: "0000", email: "demo@example.invalid",
};
const emptyProfile: Profile = { first_name: "", last_name: "", date_of_birth: "", sex: "female", mobile_number: "", address_line1: "", city: "", province: "", zip_code: "", email: "" };

function key(prefix: string) { return `${prefix}-${crypto.randomUUID()}`; }

const PROGRESS_STEPS: Step[] = ["learn", "check", "decide", "consent", "profile", "payment", "review"];

const prevStep: Partial<Record<Step, Step>> = {
  check: "learn",
  decide: "check",
  consent: "decide",
  profile: "consent",
  payment: "profile",
  review: "payment",
};

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
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary | null>(null);
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

  const allAgreed = agreed.voluntary && agreed.privacy && agreed.boundaries;
  const isLive = config?.mode === "live";
  const isFil = locale === "fil";

  const ui = isFil ? {
    bannerLive: "Live pilot na kontrolado", bannerLiveBody: "Aktibo ang mga approved data control.", bannerSynthetic: "Synthetic na walkthrough", bannerSyntheticBody: "Huwag maglagay ng totoong personal na impormasyon. Walang mae-enroll o sisingilin dito.",
    learnEyebrow: "01 · Impormasyon", learnTitle: "Alamin ang mahalaga bago magpasya.", learnBody: "Ang working baseline ay ₱1,200 bawat taon para sa edad 3–85. Ang eksaktong benepisyo, exclusions, eligibility, activation, at claims ay PRC lamang ang nagkukumpirma.",
    paymentBoundary: "Bayad ≠ pahintulot", paymentBoundaryBody: "Hindi maaaring magpasya ang sponsor o payer para sa recipient.", submissionBoundary: "Submission ≠ activation", submissionBoundaryBody: "PRC lamang ang makakapagkumpirma ng membership.", claimsBoundary: "PRC ang nagdedesisyon sa claims", claimsBoundaryBody: "Hindi nagdedesisyon ang project team kung covered o approved ang claim.", fullGuide: "Buong gabay",
    checkEyebrow: "02 · Pag-check", checkTitle: "Apat na bagay na dapat malinaw.",
    feeQuestion: "Magkano ang working annual fee?", feeCorrect: "₱1,200 / year", feeWrong: "₱100 total",
    feeExplain: "Ang taunang bayad ng membership ay ₱1,200 bawat taon. Isang beses ito bayad bawat taon, hindi ₱100 lang sa kabuuan.",
    activationQuestion: "Sino ang nagkukumpirma ng activation?", activationCorrect: "Philippine Red Cross", activationWrong: "Ang sponsor",
    activationExplain: "Ang Philippine Red Cross (PRC) lamang ang makakapagkumpirma at makapag-activate ng iyong membership. Hindi ito magagawa ng iyong sponsor.",
    choiceQuestion: "Sino ang nagpapasyang sumali?", choiceCorrect: "Ang recipient", choiceWrong: "Ang payer",
    choiceExplain: "Ikaw bilang recipient ang dapat magpasyang sumali nang kusang-loob. Hindi pwedeng magpasya para sa iyo ang payer o sponsor.",
    hotlineQuestion: "Emergency hotline sa working guide", hotlineExplain: "Ang emergency hotline ng Philippine Red Cross ay 143. Maaari kang tumawag anumang oras para sa ambulansya o mga katanungan tungkol sa iyong membership.",
    quizCorrectLabel: "✓ Tama", quizWrongLabel: "✗ Mali — tamang sagot:",
    continue: "Magpatuloy →", reviewGuide: "Balikan ang gabay",
    decideEyebrow: "03 · Pribadong desisyon", decideTitle: "Ang iyong sagot ay sa iyo lamang.", decideBody: "Hindi makakatanggap ng notification ang sponsor kung ikaw ay magtatanong o tatanggi.", accept: "Accept / Mag-apply", acceptBody: "Magpatuloy sa privacy at consent step.", ask: "Ask / Magtanong", askBody: "Buksan ang Hotline 143 nang hindi nagsisimula ng application.", decline: "Not now / Hindi ngayon", declineBody: "Umalis nang pribado nang walang ibibigay na personal na impormasyon.", busy: "Gumagawa ng pribadong session…",
    consentEyebrow: "04 · Privacy at pahintulot", consentTitle: "Pahintulot bago ang personal na datos.", minimum: "Minimum na kailangang kolektahin", minimumBody: "Sa live pilot, PRC-approved application fields lamang ang maaaring kolektahin. Hindi makikita ng sponsors ang identity, address, mobile number, application answers, payment evidence, o claims activity ng recipient.", privacyLink: "Basahin ang privacy at rights notice", voluntary: "Kusang-loob ang pagsali at maaari akong umatras.", privacyConsent: "Naiintindihan ko kung bakit kinokolekta at ibinabahagi sa PRC ang approved fields.", boundaryConsent: "Naiintindihan ko na ang bayad at submission ay hindi nag-a-activate ng membership.", continuePrivately: "Magpatuloy nang pribado →",
    profileEyebrow: "05 · Approved fields", profileLiveTitle: "Detalye ng iyong application", profileSyntheticTitle: "Synthetic form demonstration", profileLiveBody: "Mase-save lamang ang draft sa protected pilot backend pagkatapos ng consent.", profileSyntheticBody: "Naka-lock ang fields sa reserved synthetic values. Hindi puwedeng gumamit ng totoong impormasyon hanggang makumpleto ang launch gates.", firstName: "First name", lastName: "Last name", dob: "Date of birth", sex: "Sex", female: "Female", male: "Male", mobile: "Mobile number", email: "Email (optional)", address: "Address", city: "City", province: "Province", zip: "ZIP code", reviewBtn: "Susunod: Bayad →", clearDevice: "I-clear ang shared device",
    paymentDemoEyebrow: "06 · Bayad (demo)", paymentDemoTitle: "Sa live na app, magbabayad ka dito.", paymentDemoBody: "Kapag live na ang pilot, pipili ka ng payment route (GCash o bank transfer), ilalagay ang iyong payment reference, at mag-uupload ng proof ng bayad. Para sa demo na ito, pindutin ang Magpatuloy.", paymentDemoContinue: "Magpatuloy →",
    reviewEyebrow: "07 · Review", reviewTitle: "Suriin bago isumite.", name: "Pangalan", dateOfBirth: "Petsa ng kapanganakan", addressLabel: "Address", mobileLabel: "Mobile",
    paymentSummaryTitle: "Bayad na naisumite", paymentSummaryRoute: "Route", paymentSummaryReference: "Reference", paymentSummaryStatus: "✓ Nai-upload ang proof — naghihintay ng staff verification",
    submit: "Isumite ang application →", submitting: "Isinusumite…", completeDemo: "Kumpletuhin ang demo →", edit: "I-edit",
    completeLiveEyebrow: "Application submitted", completeSyntheticEyebrow: "Synthetic walkthrough complete",
    completeLiveTitle: "Handa ka na!", completeSyntheticTitle: "Walang totoong application na ginawa.",
    completeLiveBody: "Natanggap ang iyong application at ang iyong proof ng bayad ay naghihintay ng staff review.", completeSyntheticBody: "Demonstration lamang ang reference na ito at hindi ito puwedeng gamitin bilang membership credential.",
    applicationRef: "Application reference", demoRef: "Demo reference",
    completeNextStepsTitle: "Susunod na mangyayari",
    completeStep1: "Susuriin ng staff ang iyong proof ng bayad",
    completeStep2: "Ipapasa ang application sa Philippine Red Cross (PRC)",
    completeStep3: "Kukumpirmahin ng PRC ang iyong membership",
    completeStep4: "Mag-log in gamit ang iyong application reference at mobile number para ma-check ang status",
    completeHotlineNote: "Para sa mga katanungan, tumawag sa Philippine Red Cross Hotline",
    checkStatus: "Tingnan ang status", returnHome: "Bumalik sa home", print: "I-print ang summary",
    declinedEyebrow: "Pribadong choice na na-record locally", declinedTitle: "Walang application na sinimulan.", declinedBody: "Walang personal na impormasyong hiningi, at hindi sasabihan ang sponsor na tumanggi ka.", reviewAgain: "Suriin ulit",
    backLabel: "← Bumalik", cancelLabel: "I-cancel", cancelConfirm: "Sigurado ka bang gusto mong mag-cancel? Mawawala ang iyong progreso.",
    labels: ["Matuto", "Suriin", "Magpasya", "Pahintulot", "Form", "Bayad", "Suriin"],
  } : {
    bannerLive: "Controlled live pilot", bannerLiveBody: "Approved data controls are active.", bannerSynthetic: "Synthetic walkthrough", bannerSyntheticBody: "Do not enter real personal information. Nothing here enrolls or charges anyone.",
    learnEyebrow: "01 · Education", learnTitle: "Know what matters before deciding.", learnBody: "The working baseline is ₱1,200 per year for ages 3–85. Only PRC confirms exact benefits, exclusions, eligibility, activation, and claims.",
    paymentBoundary: "Payment ≠ consent", paymentBoundaryBody: "A sponsor or payer cannot decide for the recipient.", submissionBoundary: "Submission ≠ activation", submissionBoundaryBody: "Only a PRC confirmation activates membership.", claimsBoundary: "Claims stay with PRC", claimsBoundaryBody: "The project team never decides coverage or outcomes.", fullGuide: "Full guide",
    checkEyebrow: "02 · Comprehension", checkTitle: "Four things that must be clear.",
    feeQuestion: "Working annual fee", feeCorrect: "₱1,200 / year", feeWrong: "₱100 total",
    feeExplain: "The annual membership fee is ₱1,200 per year. This is paid once a year, not ₱100 in total.",
    activationQuestion: "Who confirms activation?", activationCorrect: "Philippine Red Cross", activationWrong: "The sponsor",
    activationExplain: "Only the Philippine Red Cross (PRC) can officially confirm and activate your membership. Your sponsor cannot do this for you.",
    choiceQuestion: "Who decides to participate?", choiceCorrect: "The recipient", choiceWrong: "The payer",
    choiceExplain: "The person receiving the membership (you, the recipient) must freely decide to join. A payer or sponsor cannot make this choice on your behalf.",
    hotlineQuestion: "Emergency hotline in the working guide", hotlineExplain: "The Philippine Red Cross emergency hotline is 143. Call anytime for ambulance assistance or questions about your membership.",
    quizCorrectLabel: "✓ Correct", quizWrongLabel: "✗ Incorrect — correct answer:",
    continue: "Continue →", reviewGuide: "Review guide",
    decideEyebrow: "03 · Private decision", decideTitle: "Your answer belongs to you.", decideBody: "The sponsor receives no notification about an 'ask' or 'decline' choice.", accept: "Accept / Mag-apply", acceptBody: "Continue to the privacy and consent step.", ask: "Ask / Magtanong", askBody: "Open Hotline 143 without starting an application.", decline: "Not now / Hindi ngayon", declineBody: "Leave privately without providing personal information.", busy: "Creating a private session…",
    consentEyebrow: "04 · Privacy and consent", consentTitle: "Consent before personal data.", minimum: "Minimum necessary collection", minimumBody: "The live pilot may collect only PRC-approved application fields. Sponsors cannot see recipient identity, address, mobile number, application answers, payment evidence, or claims activity.", privacyLink: "Read the privacy and rights notice", voluntary: "I am choosing voluntarily and may withdraw.", privacyConsent: "I understand why the approved fields are collected and shared with PRC.", boundaryConsent: "I understand payment and submission do not activate membership.", continuePrivately: "Continue privately →",
    profileEyebrow: "05 · Approved fields", profileLiveTitle: "Your application details", profileSyntheticTitle: "Synthetic form demonstration", profileLiveBody: "Your draft is saved only to the protected pilot backend after consent.", profileSyntheticBody: "Fields are locked to reserved synthetic values. Real information is blocked until every launch gate passes.", firstName: "First name", lastName: "Last name", dob: "Date of birth", sex: "Sex", female: "Female", male: "Male", mobile: "Mobile number", email: "Email (optional)", address: "Address", city: "City", province: "Province", zip: "ZIP code", reviewBtn: "Next: Payment →", clearDevice: "Clear shared device",
    paymentDemoEyebrow: "06 · Payment (demo)", paymentDemoTitle: "In the live app, you would pay here.", paymentDemoBody: "When the pilot goes live, you will choose a payment route (GCash or bank transfer), enter your payment reference, and upload proof of payment. For this demo, tap Continue.", paymentDemoContinue: "Continue →",
    reviewEyebrow: "07 · Review", reviewTitle: "Review before submitting.", name: "Name", dateOfBirth: "Date of birth", addressLabel: "Address", mobileLabel: "Mobile",
    paymentSummaryTitle: "Payment submitted", paymentSummaryRoute: "Route", paymentSummaryReference: "Reference", paymentSummaryStatus: "✓ Proof uploaded — pending staff review",
    submit: "Submit application →", submitting: "Submitting…", completeDemo: "Complete demo →", edit: "Edit",
    completeLiveEyebrow: "Application submitted", completeSyntheticEyebrow: "Synthetic walkthrough complete",
    completeLiveTitle: "You're all set!", completeSyntheticTitle: "No real application was created.",
    completeLiveBody: "Your application has been received and your payment proof is pending staff review.", completeSyntheticBody: "This reference is demonstrative and cannot be used as a membership credential.",
    applicationRef: "Application reference", demoRef: "Demo reference",
    completeNextStepsTitle: "What happens next",
    completeStep1: "Staff reviews your payment proof",
    completeStep2: "Application is forwarded to Philippine Red Cross (PRC)",
    completeStep3: "PRC confirms your membership",
    completeStep4: "Log in with your application reference and mobile number to check your status",
    completeHotlineNote: "For questions, call Philippine Red Cross Hotline",
    checkStatus: "Check application status →", returnHome: "Return home", print: "Print summary",
    declinedEyebrow: "Private choice recorded locally", declinedTitle: "No application was started.", declinedBody: "No personal information was requested, and the sponsor is not told that you declined.", reviewAgain: "Review again",
    backLabel: "← Back", cancelLabel: "Cancel", cancelConfirm: "Are you sure you want to cancel? Your progress will be lost.",
    labels: ["Learn", "Check", "Decide", "Consent", "Form", "Payment", "Review"],
  };

  async function api(path: string, body: unknown) {
    const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || (isFil ? "Hindi makumpleto ang request." : "The request could not be completed."));
    return data;
  }

  function goBack() {
    const back = prevStep[step];
    if (back) { setError(""); setStep(back); }
  }

  function cancelWizard() {
    if (step !== "learn" && !window.confirm(ui.cancelConfirm)) return;
    router.push("/");
  }

  async function decide(decision: "accept" | "ask" | "decline") {
    setError("");
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
      setProfile(syntheticProfile);
      setStep("complete");
      return;
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
      setReference(result.applicationRef);
      setProfile(emptyProfile);
      window.sessionStorage.removeItem("safecard-case-id");
      setStep("complete");
    } catch (caught) { setError(caught instanceof Error ? caught.message : (isFil ? "Hindi naisumite ang application." : "Submission failed.")); }
    finally { setBusy(false); }
  }

  async function clearSharedDevice() {
    if (isLive) await fetch("/api/intake/clear-session", { method: "POST" }).catch(() => undefined);
    window.sessionStorage.clear(); setProfile(isLive ? emptyProfile : syntheticProfile); router.push("/");
  }

  const progress = PROGRESS_STEPS.indexOf(step);
  const showProgress = step !== "complete" && step !== "declined";

  return (
    <main className="wizard-page">
      <header className="wizard-nav">
        <Link href="/"><BrandMark /></Link>
        <button className="locale-toggle" onClick={() => setLocale(locale === "fil" ? "en" : "fil")}>{locale === "fil" ? "English" : "Filipino"}</button>
      </header>

      <div className="wizard-banner">
        <strong>{isLive ? ui.bannerLive : ui.bannerSynthetic}</strong>
        <span>{isLive ? ui.bannerLiveBody : ui.bannerSyntheticBody}</span>
      </div>

      {showProgress && (
        <ol className="wizard-progress" aria-label="Application progress">
          {ui.labels.map((label, index) => (
            <li key={`${index}-${label}`} className={index === progress ? "current" : index < progress ? "done" : ""}>
              <span>{index < progress ? "✓" : index + 1}</span>{label}
            </li>
          ))}
        </ol>
      )}

      <section className="wizard-card">

        {/* ── STEP 1: LEARN ── */}
        {step === "learn" && (
          <>
            <p className="eyebrow">{ui.learnEyebrow}</p>
            <h1>{ui.learnTitle}</h1>
            <p className="wizard-lede">{ui.learnBody}</p>
            <div className="boundary-grid">
              <article><strong>{ui.paymentBoundary}</strong><p>{ui.paymentBoundaryBody}</p></article>
              <article><strong>{ui.submissionBoundary}</strong><p>{ui.submissionBoundaryBody}</p></article>
              <article><strong>{ui.claimsBoundary}</strong><p>{ui.claimsBoundaryBody}</p></article>
            </div>
            <div className="wizard-actions">
              <button className="button-primary" onClick={() => setStep("check")}>{isFil ? "Suriin ang pagkaunawa" : "Check my understanding"} →</button>
              <Link className="button-quiet" href="/benefits">{ui.fullGuide}</Link>
              <button className="button-quiet wizard-cancel" onClick={cancelWizard}>{ui.cancelLabel}</button>
            </div>
          </>
        )}

        {/* ── STEP 2: CHECK ── */}
        {step === "check" && (
          <>
            <p className="eyebrow">{ui.checkEyebrow}</p>
            <h1>{ui.checkTitle}</h1>
            <Quiz
              label={ui.feeQuestion} name="cost" value={answers.cost}
              onChange={(v) => setAnswers({ ...answers, cost: v })}
              options={[["1200", ui.feeCorrect], ["100", ui.feeWrong]]}
              correctValue="1200" explanation={ui.feeExplain} correctLabel={ui.quizCorrectLabel} wrongLabel={ui.quizWrongLabel}
            />
            <Quiz
              label={ui.activationQuestion} name="activation" value={answers.activation}
              onChange={(v) => setAnswers({ ...answers, activation: v })}
              options={[["prc", ui.activationCorrect], ["sponsor", ui.activationWrong]]}
              correctValue="prc" explanation={ui.activationExplain} correctLabel={ui.quizCorrectLabel} wrongLabel={ui.quizWrongLabel}
            />
            <Quiz
              label={ui.choiceQuestion} name="choice" value={answers.choice}
              onChange={(v) => setAnswers({ ...answers, choice: v })}
              options={[["recipient", ui.choiceCorrect], ["payer", ui.choiceWrong]]}
              correctValue="recipient" explanation={ui.choiceExplain} correctLabel={ui.quizCorrectLabel} wrongLabel={ui.quizWrongLabel}
            />
            <Quiz
              label={ui.hotlineQuestion} name="emergency" value={answers.emergency}
              onChange={(v) => setAnswers({ ...answers, emergency: v })}
              options={[["143", "Hotline 143"], ["sponsor", ui.activationWrong]]}
              correctValue="143" explanation={ui.hotlineExplain} correctLabel={ui.quizCorrectLabel} wrongLabel={ui.quizWrongLabel}
            />
            <div className="wizard-actions">
              <button className="button-primary" onClick={() => { setError(""); setStep("decide"); }}>{ui.continue}</button>
              <button className="button-quiet" onClick={goBack}>{ui.backLabel}</button>
              <button className="button-quiet wizard-cancel" onClick={cancelWizard}>{ui.cancelLabel}</button>
            </div>
          </>
        )}

        {/* ── STEP 3: DECIDE ── */}
        {step === "decide" && (
          <>
            <p className="eyebrow">{ui.decideEyebrow}</p>
            <h1>{ui.decideTitle}</h1>
            <p className="wizard-lede">{ui.decideBody}</p>
            <div className="decision-list">
              <button onClick={() => decide("accept")}><span>✓</span><div><strong>{ui.accept}</strong><p>{ui.acceptBody}</p></div></button>
              <button onClick={() => decide("ask")}><span>?</span><div><strong>{ui.ask}</strong><p>{ui.askBody}</p></div></button>
              <button onClick={() => decide("decline")}><span>×</span><div><strong>{ui.decline}</strong><p>{ui.declineBody}</p></div></button>
            </div>
            {error && <p className="form-message error">{error}</p>}
            {busy && <p className="form-message">{ui.busy}</p>}
            <div className="wizard-actions">
              <button className="button-quiet" onClick={goBack}>{ui.backLabel}</button>
              <button className="button-quiet wizard-cancel" onClick={cancelWizard}>{ui.cancelLabel}</button>
            </div>
          </>
        )}

        {/* ── STEP 4: CONSENT ── */}
        {step === "consent" && (
          <>
            <p className="eyebrow">{ui.consentEyebrow}</p>
            <h1>{ui.consentTitle}</h1>
            <div className="privacy-panel">
              <strong>{ui.minimum}</strong>
              <p>{ui.minimumBody}</p>
              <Link href="/privacy">{ui.privacyLink}</Link>
            </div>
            {(["voluntary", "privacy", "boundaries"] as const).map((item, i) => (
              <label key={item} className="consent-row">
                <input type="checkbox" checked={agreed[item]} onChange={(e) => setAgreed({ ...agreed, [item]: e.target.checked })} />
                <span>{[ui.voluntary, ui.privacyConsent, ui.boundaryConsent][i]}</span>
              </label>
            ))}
            {error && <p className="form-message error">{error}</p>}
            <div className="wizard-actions">
              <button className="button-primary" disabled={!allAgreed || busy} onClick={recordConsent}>{ui.continuePrivately}</button>
              <button className="button-quiet" onClick={goBack}>{ui.backLabel}</button>
              <button className="button-quiet wizard-cancel" onClick={cancelWizard}>{ui.cancelLabel}</button>
            </div>
          </>
        )}

        {/* ── STEP 5: PROFILE ── */}
        {step === "profile" && (
          <>
            <p className="eyebrow">{ui.profileEyebrow}</p>
            <h1>{ui.profileLiveTitle}</h1>
            <p className="wizard-lede">{ui.profileLiveBody}</p>
            <div className="form-grid">
              <Field label={ui.firstName} value={profile.first_name} onChange={(v) => setProfile({ ...profile, first_name: v })} />
              <Field label={ui.lastName} value={profile.last_name} onChange={(v) => setProfile({ ...profile, last_name: v })} />
              <Field label={ui.dob} type="date" value={profile.date_of_birth} onChange={(v) => setProfile({ ...profile, date_of_birth: v })} />
              <label className="field-block">
                <span>{ui.sex}</span>
                <select value={profile.sex} onChange={(e) => setProfile({ ...profile, sex: e.target.value as "male" | "female" })}>
                  <option value="female">{ui.female}</option>
                  <option value="male">{ui.male}</option>
                </select>
              </label>
              <Field label={ui.mobile} value={profile.mobile_number} onChange={(v) => setProfile({ ...profile, mobile_number: v })} />
              <Field label={ui.email} value={profile.email || ""} onChange={(v) => setProfile({ ...profile, email: v })} />
              <div className="full"><Field label={ui.address} value={profile.address_line1} onChange={(v) => setProfile({ ...profile, address_line1: v })} /></div>
              <Field label={ui.city} value={profile.city} onChange={(v) => setProfile({ ...profile, city: v })} />
              <Field label={ui.province} value={profile.province} onChange={(v) => setProfile({ ...profile, province: v })} />
              <Field label={ui.zip} value={profile.zip_code} onChange={(v) => setProfile({ ...profile, zip_code: v })} />
            </div>
            {error && <p className="form-message error">{error}</p>}
            <div className="wizard-actions">
              <button className="button-primary" disabled={!profileValid()} onClick={() => profileValid() ? setStep("payment") : setError(isFil ? "Kumpletuhin ang lahat ng required fields." : "Complete every required field.")}>{ui.reviewBtn}</button>
              <button className="button-quiet" onClick={goBack}>{ui.backLabel}</button>
              <button className="button-quiet wizard-cancel" onClick={clearSharedDevice}>{ui.clearDevice}</button>
            </div>
          </>
        )}

        {/* ── STEP 6: PAYMENT ── */}
        {step === "payment" && (
          isLive && !caseId
            ? <p className="form-message error">{isFil ? "Hindi kumpleto ang secure session mo. Magsimula ulit." : "Your secure payment session is incomplete. Start again."}</p>
            : <ManualPaymentPanel
                caseId={caseId ?? "SYNTHETIC-CASE"}
                campaignId={config?.campaign?.id ?? "00000000-0000-0000-0000-000000000010"}
                live={isLive}
                onBack={goBack}
                onComplete={(summary) => { setPaymentSummary(summary); setStep("review"); }}
              />
        )}

        {/* ── STEP 7: REVIEW ── */}
        {step === "review" && (
          <>
            <p className="eyebrow">{ui.reviewEyebrow}</p>
            <h1>{ui.reviewTitle}</h1>
            <dl className="review-list">
              <div><dt>{ui.name}</dt><dd>{profile.first_name} {profile.last_name}</dd></div>
              <div><dt>{ui.dateOfBirth}</dt><dd>{profile.date_of_birth}</dd></div>
              <div><dt>{ui.mobileLabel}</dt><dd>{profile.mobile_number}</dd></div>
              <div><dt>{ui.addressLabel}</dt><dd>{profile.address_line1}, {profile.city}, {profile.province} {profile.zip_code}</dd></div>
            </dl>
            {paymentSummary && (
              <div className="payment-summary-panel">
                <strong>{ui.paymentSummaryTitle}</strong>
                <div className="payment-summary-rows">
                  <div className="payment-summary-row"><span>{ui.paymentSummaryRoute}</span><span>{paymentSummary.routeLabel}</span></div>
                  <div className="payment-summary-row"><span>{ui.paymentSummaryReference}</span><span>{paymentSummary.reference}</span></div>
                  <div className="payment-summary-row proof-status"><span>{ui.paymentSummaryStatus}</span></div>
                </div>
              </div>
            )}
            {error && <p className="form-message error">{error}</p>}
            <div className="wizard-actions">
              <button className="button-primary" disabled={busy} onClick={submit}>{busy ? ui.submitting : isLive ? ui.submit : ui.completeDemo}</button>
              <button className="button-quiet" onClick={goBack}>{ui.backLabel}</button>
              <button className="button-quiet wizard-cancel" onClick={cancelWizard}>{ui.cancelLabel}</button>
            </div>
          </>
        )}

        {/* ── COMPLETE ── */}
        {step === "complete" && (
          <div className="completion-panel">
            <span className="completion-mark">✓</span>
            <p className="eyebrow" style={{ marginTop: "18px" }}>{isLive ? ui.completeLiveEyebrow : ui.completeSyntheticEyebrow}</p>
            <h1>{isLive ? ui.completeLiveTitle : ui.completeSyntheticTitle}</h1>
            <p className="wizard-lede">{isLive ? ui.completeLiveBody : ui.completeSyntheticBody}</p>
            <div className="reference-box">
              <span>{isLive ? ui.applicationRef : ui.demoRef}</span>
              <strong>{reference}</strong>
            </div>
            <div className="next-steps-panel">
                <strong>{ui.completeNextStepsTitle}</strong>
                <ol className="next-steps-list">
                  <li>{ui.completeStep1}</li>
                  <li>{ui.completeStep2}</li>
                  <li>{ui.completeStep3}</li>
                  <li>{ui.completeStep4}</li>
                </ol>
                <p className="hotline-note">{ui.completeHotlineNote} <strong>143</strong>. {isFil ? "Hindi nagdedesisyon ang SafeCard ng claims o membership activation." : "SafeCard never decides claims or membership activation."}</p>
              </div>
            <div className="wizard-actions" style={{ justifyContent: "center", marginTop: "28px" }}>
              <Link className="button-primary" href={isLive ? "/member" : "/"}>{isLive ? ui.checkStatus : ui.returnHome}</Link>
              <button className="button-quiet" onClick={() => window.print()}>{ui.print}</button>
            </div>
          </div>
        )}

        {/* ── DECLINED ── */}
        {step === "declined" && (
          <div className="completion-panel">
            <span className="completion-mark quiet">×</span>
            <p className="eyebrow" style={{ marginTop: "18px" }}>{ui.declinedEyebrow}</p>
            <h1>{ui.declinedTitle}</h1>
            <p>{ui.declinedBody}</p>
            <div className="wizard-actions" style={{ justifyContent: "center" }}>
              <Link className="button-primary" href="/">{ui.returnHome}</Link>
              <button className="button-quiet" onClick={() => setStep("learn")}>{ui.reviewAgain}</button>
            </div>
          </div>
        )}

      </section>
    </main>
  );
}

// ── Quiz component with feedback ──
type QuizProps = {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  options: string[][];
  correctValue: string;
  explanation: string;
  correctLabel: string;
  wrongLabel: string;
};

function Quiz({ label, name, value, onChange, options, correctValue, explanation, correctLabel, wrongLabel }: QuizProps) {
  const isAnswered = value !== "";
  const isCorrect = isAnswered && value === correctValue;
  const isWrong = isAnswered && value !== correctValue;

  // Shuffle options once on mount so the correct answer is not always first.
  const [displayOptions] = useState<string[][]>(() => {
    const shuffled = [...options];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  });

  return (
    <fieldset className="quiz-block">
      <legend className="quiz-question">{label}</legend>
      <div className="quiz-options">
        {displayOptions.map(([optionValue, text]) => {
          const isSelected = value === optionValue;
          const isThisCorrect = optionValue === correctValue;
          return (
            <label
              key={optionValue}
              className={`quiz-option${isSelected ? (isThisCorrect ? " quiz-option-correct" : " quiz-option-wrong") : ""}`}
            >
              <input
                type="radio"
                name={name}
                checked={isSelected}
                onChange={() => onChange(optionValue)}
              />
              <span className="quiz-option-text">{text}</span>
              {isSelected && isThisCorrect && <span className="quiz-mark quiz-mark-correct">✓</span>}
              {isSelected && !isThisCorrect && <span className="quiz-mark quiz-mark-wrong">✗</span>}
            </label>
          );
        })}
      </div>
      {isCorrect && (
        <div className="quiz-feedback quiz-feedback-correct">
          {correctLabel}
        </div>
      )}
      {isWrong && (
        <div className="quiz-feedback quiz-feedback-wrong">
          <strong>{wrongLabel} {options.find(([v]) => v === correctValue)?.[1]}</strong>
          <p>{explanation}</p>
        </div>
      )}
    </fieldset>
  );
}

// ── Field component ──
function Field({ label, value, onChange, disabled, type = "text" }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean; type?: string }) {
  return (
    <label className="field-block">
      <span>{label}</span>
      <input type={type} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
