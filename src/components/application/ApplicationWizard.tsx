"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { BrandMark } from "@/components/BrandMark";
import { ArrowRightIcon, CheckIcon, PhoneIcon } from "@/components/icons";
import { LocaleToggle } from "@/components/LocaleToggle";
import { useLocale } from "@/components/LocaleProvider";
import { SeasonGarland, SeasonScene } from "@/components/seasonal/Season"; // SEASONAL:christmas-2026
import { Field, ManualPaymentPanel } from "@/components/application/ManualPaymentPanel";

type Step = "learn" | "check" | "decide" | "consent" | "profile" | "pay" | "complete" | "declined";
type ApplyConfig = {
  mode: "synthetic" | "live" | "unavailable";
  campaign: { id: string; membership_fee: number } | null;
  content?: Array<{ id: string; content_type: string; locale: "tl" | "en"; title: string; body: string }>;
  payment: { available: boolean; reason: string | null };
  externalNotifications: { available: boolean; reason: string };
  configurationError?: string;
};
type Profile = {
  first_name: string; last_name: string; date_of_birth: string; sex: "male" | "female" | "";
  mobile_number: string; address_line1: string; city: string; province: string; zip_code: string; email?: string;
};
type PaymentSummary = { routeLabel: string; reference: string };

const emptyProfile: Profile = { first_name: "", last_name: "", date_of_birth: "", sex: "", mobile_number: "", address_line1: "", city: "", province: "", zip_code: "", email: "" };

function key(prefix: string) { return `${prefix}-${crypto.randomUUID()}`; }

const PROGRESS_STEPS: Step[] = ["learn", "check", "decide", "consent", "profile", "pay"];

const prevStep: Partial<Record<Step, Step>> = {
  check: "learn",
  decide: "check",
  consent: "decide",
  profile: "consent",
  pay: "profile",
  declined: "decide",
};

const MIN_AGE = 3;
const MAX_AGE = 85;

function ageOn(dateOfBirth: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const today = new Date();
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age -= 1;
  return age;
}

// ── Understanding check: five scenario questions, one at a time ──
type QuizQuestion = { id: string; question: string; options: Array<{ value: string; label: string }>; correct: string; explanation: string };

function buildQuiz(isFil: boolean): QuizQuestion[] {
  return isFil ? [
    { id: "fee", question: "Magkano ang membership fee ng SafeCard?", correct: "yearly", options: [{ value: "yearly", label: "₱1,200 bawat taon" }, { value: "once", label: "₱100 isang beses lang" }, { value: "monthly", label: "₱1,200 bawat buwan" }],
      explanation: "Ang membership fee ay ₱1,200 bawat taon, para sa edad 3 hanggang 85." },
    { id: "payment", question: "Nakabayad ka na ng fee. Ano ang ibig sabihin nito?", correct: "reviewed", options: [{ value: "reviewed", label: "Susuriin muna ang application at proof ng bayad ko" }, { value: "member", label: "Miyembro na ako agad" }, { value: "claim", label: "Puwede na akong mag-file ng claim" }],
      explanation: "Ang bayad ay hindi pa pahintulot, approval, o membership activation. Susuriin muna ng staff ang application at proof ng bayad mo." },
    { id: "claims", question: "Sino ang nagpapasya kung aaprubahan ang claim o benepisyo?", correct: "prc", options: [{ value: "prc", label: "Ang Philippine Red Cross" }, { value: "safecard", label: "Ang SafeCard" }, { value: "payer", label: "Ang nagbayad" }],
      explanation: "Ang PRC lamang ang nagpapasya sa eligibility at claims. Hindi nagdedesisyon ng claims ang SafeCard." },
    { id: "voluntary", question: "Paano kung magbago ang isip mo bago matapos ang application?", correct: "cancel", options: [{ value: "cancel", label: "Puwede akong mag-cancel anumang oras at itatapon ang application ko" }, { value: "finish", label: "Kailangan kong tapusin kapag nasimulan na" }, { value: "call", label: "Kailangan kong tumawag para mag-cancel" }],
      explanation: "Kusang-loob ang paglahok. Mag-cancel anumang oras bago mag-submit at walang ipapadala sa aming team." },
    { id: "emergency", question: "Sa emergency, ano ang unang dapat gawin?", correct: "call", options: [{ value: "call", label: "Tumawag sa PRC Hotline 143" }, { value: "apply", label: "Mag-submit ng application" }, { value: "email", label: "Mag-email sa SafeCard" }],
      explanation: "Sa emergency, tumawag agad sa Hotline 143. Hindi pang-emergency ang application." },
  ] : [
    { id: "fee", question: "How much is the SafeCard membership fee?", correct: "yearly", options: [{ value: "yearly", label: "₱1,200 per year" }, { value: "once", label: "₱100, one time" }, { value: "monthly", label: "₱1,200 every month" }],
      explanation: "The membership fee is ₱1,200 per year, for ages 3 to 85." },
    { id: "payment", question: "You have paid the fee. What does that mean?", correct: "reviewed", options: [{ value: "reviewed", label: "My application and payment proof are reviewed first" }, { value: "member", label: "I am a member right away" }, { value: "claim", label: "I can file a claim right away" }],
      explanation: "Payment is not consent, approval, or membership activation. Staff review your application and payment proof first." },
    { id: "claims", question: "Who decides whether a claim or benefit request is approved?", correct: "prc", options: [{ value: "prc", label: "The Philippine Red Cross" }, { value: "safecard", label: "SafeCard" }, { value: "payer", label: "The person who paid" }],
      explanation: "Only PRC decides eligibility and claims. SafeCard never decides claims." },
    { id: "voluntary", question: "What if you change your mind before you finish?", correct: "cancel", options: [{ value: "cancel", label: "I can cancel at any time and my application is discarded" }, { value: "finish", label: "I must finish once I have started" }, { value: "call", label: "I have to call to cancel" }],
      explanation: "Taking part is voluntary. Cancel any time before you submit and nothing is sent to our team." },
    { id: "emergency", question: "In an emergency, what should you do first?", correct: "call", options: [{ value: "call", label: "Call the PRC Hotline 143" }, { value: "apply", label: "Submit an application" }, { value: "email", label: "Email SafeCard" }],
      explanation: "In an emergency, call Hotline 143 right away. The application is not for emergencies." },
  ];
}

export function ApplicationWizard() {
  const { locale } = useLocale();
  const router = useRouter();
  const [step, setStep] = useState<Step>("learn");
  const [config, setConfig] = useState<ApplyConfig | null>(null);
  const [caseId, setCaseId] = useState<string>();
  const [consentRecordId, setConsentRecordId] = useState<string>();
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizPicks, setQuizPicks] = useState<Record<string, string>>({});
  // Answer order is shuffled once per visit so the right answer is not always first.
  const [quizOrder] = useState<number[][]>(() => Array.from({ length: 5 }, () => {
    const order = [0, 1, 2];
    for (let i = order.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  }));
  const [agreed, setAgreed] = useState({ voluntary: false, privacy: false, boundaries: false });
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [showProfileErrors, setShowProfileErrors] = useState(false);
  const [applicationSubmitted, setApplicationSubmitted] = useState(false);
  const [paymentSummary, setPaymentSummary] = useState<PaymentSummary | null>(null);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [asking, setAsking] = useState(false);
  const [confirmingCancel, setConfirmingCancel] = useState(false);
  const [localStateReady, setLocalStateReady] = useState(false);
  const headingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/pilot/config", { cache: "no-store" }).then(async (response) => {
      const next = await response.json() as ApplyConfig;
      if (!response.ok) throw new Error(next.configurationError || "Applications are unavailable.");
      setConfig(next); setProfile(emptyProfile);
    }).catch((caught) => setConfig({ mode: "unavailable", campaign: null, payment: { available: false, reason: "Unavailable" }, externalNotifications: { available: false, reason: "Parked" }, configurationError: caught instanceof Error ? caught.message : "Applications are unavailable." }));
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
        if (["withdrawn"].includes(statusBody.states.application)) { window.sessionStorage.removeItem("safecard-case-id"); return; }
        setCaseId(storedCaseId);
        setConsentRecordId(statusBody.consentRecordId ?? undefined);
        // A submitted application whose proof of payment is still missing resumes at the final step.
        if (["submitted", "resubmitted"].includes(statusBody.states.application)) {
          setReference(statusBody.applicationRef ?? "");
          setApplicationSubmitted(true);
          setStep("pay");
          return;
        }
        setStep(statusBody.states.consent === "agreed" ? "profile" : "consent");
      } catch (caught) {
        window.sessionStorage.removeItem("safecard-case-id");
        setError(caught instanceof Error ? caught.message : "Unable to restore the application.");
      }
    })();
  }, [caseId, config]);

  useEffect(() => {
    if (!localStateReady || caseId || !["learn", "check", "decide"].includes(step)) return;
    window.sessionStorage.setItem("safecard-wizard-state", JSON.stringify({ step, quizIndex, quizPicks }));
  }, [quizIndex, quizPicks, caseId, localStateReady, step]);

  useEffect(() => {
    if (caseId) return;
    const restore = () => {
      try {
        const saved = JSON.parse(window.sessionStorage.getItem("safecard-wizard-state") ?? "null") as { step?: Step; quizIndex?: number; quizPicks?: Record<string, string> } | null;
        if (saved?.step && ["learn", "check", "decide"].includes(saved.step)) setStep(saved.step);
        if (typeof saved?.quizIndex === "number") setQuizIndex(saved.quizIndex);
        if (saved?.quizPicks) setQuizPicks(saved.quizPicks);
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

  // Move keyboard and screen-reader focus to the new step's heading.
  useEffect(() => {
    // A message from one step must not follow the applicant into the next.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setError("");
    if (!localStateReady) return;
    headingRef.current?.querySelector<HTMLElement>("h1")?.focus({ preventScroll: false });
  }, [step, localStateReady]);

  const allAgreed = agreed.voluntary && agreed.privacy && agreed.boundaries;
  const isLive = config?.mode === "live";
  const isFil = locale === "fil";
  const quiz = buildQuiz(isFil);

  const ui = isFil ? {
    syntheticBanner: "Synthetic na walkthrough", syntheticBannerBody: "Huwag maglagay ng totoong personal na impormasyon. Walang mae-enroll o sisingilin dito.",
    unavailable: "Hindi available ang application", back: "Bumalik", cancel: "I-cancel ang application", required: "Kailangan", legendRequired: "Ang may * ay kailangan.",
    learnEyebrow: "Hakbang 1 · Impormasyon", learnTitle: "Alamin ang mahalaga bago magpasya.", learnBody: "Ang taunang membership fee ay ₱1,200 para sa edad 3 hanggang 85. Ang PRC lamang ang nagkukumpirma ng eksaktong benepisyo, exclusions, eligibility, at claims.",
    boundary1: "Ang bayad ay hindi approval", boundary1Body: "Hindi inaaprubahan ng pagbabayad ang application mo. Susuriin ito ng staff.",
    boundary2: "Ikaw ang may kontrol", boundary2Body: "Kusang-loob ito. Maaari kang mag-cancel anumang oras bago mag-submit.",
    boundary3: "Ang PRC ang nagpapasya sa claims", boundary3Body: "Hindi nagdedesisyon ang SafeCard kung covered o approved ang claim.",
    readyTitle: "Ihanda ang mga ito", ready: ["Ang iyong mobile number at address", "Gagamitin mong GCash o bank account", "Larawan o screenshot ng receipt ng bayad"],
    check: "Suriin ang pagkaunawa", skip: "Dumiretso sa application", fullGuide: "Basahin ang buong gabay",
    checkEyebrow: "Hakbang 2 · Pag-check", checkTitle: "Tiyakin nating malinaw ang lahat.", checkIntro: "Limang maikling tanong. Pumili ng sagot at agad mong makikita kung tama.",
    question: "Tanong", of: "sa", next: "Susunod na tanong", finish: "Tapusin ang pag-check", tryAgain: "Subukan ulit", correct: "Tama!", incorrect: "Hindi pa tama.",
    quizDoneTitle: "Handa ka nang magpasya.", quizDoneBody: "Naunawaan mo ang mga pangunahing bagay. Wala pang personal na datos na kinokolekta.", reviewQuiz: "Ulitin ang pag-check", continue: "Magpatuloy sa desisyon",
    decideEyebrow: "Hakbang 3 · Pribadong desisyon", decideTitle: "Ano ang gusto mong gawin?", decideBody: "Wala kang kailangang ibigay ngayon. Ang iyong sagot ay sa iyo lamang.",
    accept: "Mag-apply", acceptBody: "Magpatuloy sa privacy at pahintulot.", ask: "May tanong ako", askBody: "Tumawag muna sa PRC Hotline 143. Hindi ito magsisimula ng application.", decline: "Hindi muna ngayon", declineBody: "Umalis nang hindi nagbibigay ng anumang impormasyon.",
    askTitle: "Tumawag sa PRC Hotline 143", askText: "Sasagutin ng Philippine Red Cross ang mga tanong tungkol sa benepisyo, eligibility, at claims. Hindi nagsisimula ng application ang pagtawag.", call: "Tumawag sa 143", busy: "Inihahanda ang iyong application…",
    consentEyebrow: "Hakbang 4 · Privacy at pahintulot", consentTitle: "Pahintulot bago ang personal na datos.", minimum: "Minimum na kinokolekta", minimumBody: "Ang kinokolekta lamang ay ang mga field na kailangan sa application. Ang mga staff na nagsusuri lamang ng application mo ang makakakita nito.", privacyLink: "Basahin ang paunawa sa privacy",
    consentLead: "Lagyan ng check ang tatlo para magpatuloy.", voluntary: "Kusang-loob ang pagsali at maaari akong umatras.", privacyConsent: "Naiintindihan ko kung bakit kinokolekta ang mga detalye ko at kung sino ang makakakita nito.", boundaryConsent: "Naiintindihan ko na ang bayad at submission ay hindi pa approval o membership activation.", continuePrivately: "Magpatuloy",
    profileEyebrow: "Hakbang 5 · Iyong mga detalye", profileTitle: "Detalye ng iyong application", profileBody: "Ilagay ang mga detalye gaya ng nasa opisyal mong ID. Mase-save lamang ang mga ito kapag isinumite mo ang buong application sa huling hakbang.",
    firstName: "First name", lastName: "Last name", dob: "Date of birth", sex: "Sex", selectSex: "Pumili", female: "Female", male: "Male", mobile: "Mobile number", mobileHint: "Halimbawa: 09171234567", email: "Email", address: "Address", addressHint: "Bahay/unit, kalye, barangay", city: "City o munisipalidad", province: "Province", zip: "ZIP code", zipHint: "4 na numero", reviewBtn: "Susunod: Bayad at isumite",
    errFirst: "Ilagay ang first name.", errLast: "Ilagay ang last name.", errDob: "Piliin ang petsa ng kapanganakan.", errAge: "Ang membership ay para sa edad 3 hanggang 85.", errSex: "Piliin ang sex.", errMobile: "Gamitin ang 09XXXXXXXXX o +639XXXXXXXXX.", errAddress: "Ilagay ang address.", errCity: "Ilagay ang city.", errProvince: "Ilagay ang province.", errZip: "Ilagay ang 4-digit na ZIP code.", fixErrors: "Pakiayos ang mga field na may error.",
    payEyebrow: "Hakbang 6 · Bayad at pagsusumite", payTitle: "Suriin, bayaran, at isumite.", payBody: "Suriin ang iyong mga detalye, bayaran ang fee, i-upload ang proof, at isumite. Walang ipapadala sa aming team hangga't hindi mo ito natatapos.",
    yourDetails: "Ang iyong mga detalye", edit: "I-edit", name: "Pangalan", dateOfBirth: "Petsa ng kapanganakan", addressLabel: "Address", mobileLabel: "Mobile", emailLabel: "Email",
    submitError: "Hindi naisumite ang application.", notReady: "Hindi pa handa ang application. Subukan muli o tumawag sa Hotline 143.", missingContent: "Hindi available ang approved na nilalaman.",
    completeEyebrow: "Naisumite ang application", completeTitle: "Natanggap namin ang application mo.", completeBody: "Nakumpleto mo ang application at ang proof ng bayad. Susuriin ito ng staff.",
    applicationRef: "Application reference", paymentSummaryTitle: "Bayad na naisumite", paymentSummaryRoute: "Paraan", paymentSummaryReference: "Reference",
    nextTitle: "Ano ang susunod", next1: "Susuriin ng staff ang iyong application at proof ng bayad.", next2: "Kapag naaprubahan, makikita mo ang iyong SafeCard sa member login.", next3: "Mag-sign in gamit ang mobile number na ginamit mo para i-check ang status.", hotlineNote: "May tanong? Tumawag sa Philippine Red Cross Hotline", noDecide: "Hindi nagdedesisyon ang SafeCard ng claims.",
    checkStatus: "Tingnan ang status", home: "Bumalik sa home", print: "I-print ang summary", clearDevice: "I-clear ang device na ito",
    declinedEyebrow: "Walang nai-save", declinedTitle: "Walang application na sinimulan.", declinedBody: "Walang personal na impormasyong hiningi o na-save. Maaari kang bumalik kahit kailan.", reviewAgain: "Balikan ang gabay",
    cancelTitle: "I-cancel ang application?", cancelBody: "Itatapon ang iyong application at walang ipapadala sa aming team. Maaari kang magsimula ulit anumang oras.", cancelConfirm: "Oo, i-cancel", cancelKeep: "Ituloy ang application", cancelling: "Kinakansela…",
    labels: ["Matuto", "Suriin", "Magpasya", "Pahintulot", "Detalye", "Bayad"], progress: "Progreso ng application",
  } : {
    syntheticBanner: "Synthetic walkthrough", syntheticBannerBody: "Do not enter real personal information. Nothing here enrolls or charges anyone.",
    unavailable: "Applications are unavailable", back: "Back", cancel: "Cancel application", required: "Required", legendRequired: "Fields marked * are required.",
    learnEyebrow: "Step 1 · Information", learnTitle: "Know what matters before deciding.", learnBody: "The annual membership fee is ₱1,200 for ages 3 to 85. Only PRC confirms exact benefits, exclusions, eligibility, and claims.",
    boundary1: "Payment is not approval", boundary1Body: "Paying does not approve your application. Staff review it first.",
    boundary2: "You stay in control", boundary2Body: "It is voluntary. You can cancel any time before you submit.",
    boundary3: "Claims stay with PRC", boundary3Body: "SafeCard never decides whether a claim is covered or approved.",
    readyTitle: "Have these ready", ready: ["Your mobile number and address", "The GCash or bank account you will pay from", "A photo or screenshot of your payment receipt"],
    check: "Check my understanding", skip: "Go straight to the application", fullGuide: "Read the full guide",
    checkEyebrow: "Step 2 · Understanding check", checkTitle: "Let's make sure everything is clear.", checkIntro: "Five short questions. Pick an answer and you will see right away whether it is right.",
    question: "Question", of: "of", next: "Next question", finish: "Finish the check", tryAgain: "Try again", correct: "Correct!", incorrect: "Not quite.",
    quizDoneTitle: "You are ready to decide.", quizDoneBody: "You understood the key points. No personal data has been collected.", reviewQuiz: "Retake the check", continue: "Continue to your decision",
    decideEyebrow: "Step 3 · Private decision", decideTitle: "What would you like to do?", decideBody: "You do not have to share anything yet. Your answer belongs to you.",
    accept: "Apply", acceptBody: "Continue to privacy and consent.", ask: "I have a question", askBody: "Call PRC Hotline 143 first. This does not start an application.", decline: "Not now", declineBody: "Leave without sharing any information.",
    askTitle: "Call PRC Hotline 143", askText: "The Philippine Red Cross answers questions about benefits, eligibility, and claims. Calling does not start an application.", call: "Call 143", busy: "Preparing your application…",
    consentEyebrow: "Step 4 · Privacy and consent", consentTitle: "Consent before personal data.", minimum: "Minimum necessary data", minimumBody: "Only the fields needed for the application are collected. Only staff who review your application can see them.", privacyLink: "Read the privacy notice",
    consentLead: "Tick all three to continue.", voluntary: "I am choosing voluntarily and may withdraw.", privacyConsent: "I understand why my details are collected and who can see them.", boundaryConsent: "I understand payment and submission are not approval or membership activation.", continuePrivately: "Continue",
    profileEyebrow: "Step 5 · Your details", profileTitle: "Your application details", profileBody: "Enter your details as they appear on your official ID. They are saved only when you submit the whole application in the last step.",
    firstName: "First name", lastName: "Last name", dob: "Date of birth", sex: "Sex", selectSex: "Select", female: "Female", male: "Male", mobile: "Mobile number", mobileHint: "For example: 09171234567", email: "Email", address: "Address", addressHint: "House or unit, street, barangay", city: "City or municipality", province: "Province", zip: "ZIP code", zipHint: "4 digits", reviewBtn: "Next: Pay and submit",
    errFirst: "Enter your first name.", errLast: "Enter your last name.", errDob: "Choose your date of birth.", errAge: "Membership is for ages 3 to 85.", errSex: "Select your sex.", errMobile: "Use 09XXXXXXXXX or +639XXXXXXXXX.", errAddress: "Enter your address.", errCity: "Enter your city.", errProvince: "Enter your province.", errZip: "Enter a 4-digit ZIP code.", fixErrors: "Please fix the fields marked with an error.",
    payEyebrow: "Step 6 · Pay and submit", payTitle: "Review, pay, and submit.", payBody: "Check your details, pay the fee, upload your proof, and submit. Nothing is sent to our team until you finish this step.",
    yourDetails: "Your details", edit: "Edit", name: "Name", dateOfBirth: "Date of birth", addressLabel: "Address", mobileLabel: "Mobile", emailLabel: "Email",
    submitError: "The application could not be submitted.", notReady: "Applications are not ready yet. Please try again or call Hotline 143.", missingContent: "Approved content is unavailable.",
    completeEyebrow: "Application submitted", completeTitle: "We have received your application.", completeBody: "You completed your application and proof of payment. Staff will now review it.",
    applicationRef: "Application reference", paymentSummaryTitle: "Payment submitted", paymentSummaryRoute: "Method", paymentSummaryReference: "Reference",
    nextTitle: "What happens next", next1: "Staff review your application and payment proof.", next2: "Once approved, your SafeCard appears when you sign in as a member.", next3: "Sign in with the mobile number you used to check your status.", hotlineNote: "Questions? Call the Philippine Red Cross Hotline", noDecide: "SafeCard never decides claims.",
    checkStatus: "Check my status", home: "Back to home", print: "Print summary", clearDevice: "Clear this device",
    declinedEyebrow: "Nothing was saved", declinedTitle: "No application was started.", declinedBody: "No personal information was requested or saved. You can come back any time.", reviewAgain: "Review the guide",
    cancelTitle: "Cancel your application?", cancelBody: "Your application will be discarded and nothing is sent to our team. You can start again at any time.", cancelConfirm: "Yes, cancel", cancelKeep: "Keep applying", cancelling: "Cancelling…",
    labels: ["Learn", "Check", "Decide", "Consent", "Details", "Pay"], progress: "Application progress",
  };

  async function api(path: string, body: unknown) {
    const response = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await response.json();
    if (!response.ok) {
      // Surface which field failed instead of a bare "Validation failed".
      const fieldMessages = data.details && typeof data.details === "object" ? Object.values(data.details as Record<string, string[]>).flat().filter(Boolean) : [];
      throw new Error(fieldMessages.length ? fieldMessages.join(" · ") : data.error || (isFil ? "Hindi makumpleto ang request." : "The request could not be completed."));
    }
    return data;
  }

  function goBack() {
    const back = prevStep[step];
    if (back) { setError(""); setAsking(false); setStep(back); }
  }

  function resetLocalState() {
    window.sessionStorage.removeItem("safecard-case-id");
    window.sessionStorage.removeItem("safecard-wizard-state");
    setProfile(emptyProfile);
  }

  async function discardApplication() {
    setBusy(true);
    try {
      if (isLive && caseId) {
        // Closes the case server-side. Failure must not trap the applicant in the flow.
        await fetch("/api/intake/cancel", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ case_id: caseId }) }).catch(() => undefined);
        await fetch("/api/intake/clear-session", { method: "POST" }).catch(() => undefined);
      }
    } finally {
      resetLocalState();
      router.push("/");
    }
  }

  function requestCancel() {
    // Until the details step nothing worth keeping has been entered, so there is nothing to confirm or discard.
    if (!caseId && !["profile", "pay"].includes(step)) { resetLocalState(); router.push("/"); return; }
    setConfirmingCancel(true);
  }

  async function clearSharedDevice() {
    if (isLive) await fetch("/api/intake/clear-session", { method: "POST" }).catch(() => undefined);
    resetLocalState();
    router.push("/");
  }

  async function decide(decision: "accept" | "ask" | "decline") {
    setError("");
    if (config?.mode === "unavailable") { setError(config.configurationError || ui.notReady); return; }
    if (decision === "ask") { setAsking(true); return; }
    setAsking(false);
    if (decision === "decline") { resetLocalState(); setStep("declined"); return; }
    // Nothing is saved yet. The case, consent and details are all created together at the final submit.
    if (isLive && !config?.campaign) { setError(ui.notReady); return; }
    setStep("consent");
  }

  function recordConsent() {
    if (!allAgreed) return;
    if (isLive) {
      // Fail early if the approved consent text is missing; the consent record itself is written at the final submit.
      const contentLocale = locale === "fil" ? "tl" : "en";
      const content = config?.content ?? [];
      const hasConsent = content.some((item) => item.locale === contentLocale && item.content_type === "consent_text");
      const hasPrivacy = content.some((item) => item.locale === contentLocale && item.content_type === "privacy_notice");
      if (!hasConsent || !hasPrivacy) { setError(ui.missingContent); return; }
    }
    setError("");
    setStep("profile");
  }

  function profileErrors(): Record<string, string> {
    const errors: Record<string, string> = {};
    if (!profile.first_name.trim()) errors.first_name = ui.errFirst;
    if (!profile.last_name.trim()) errors.last_name = ui.errLast;
    const age = ageOn(profile.date_of_birth);
    if (!profile.date_of_birth || age === null) errors.date_of_birth = ui.errDob;
    else if (age < MIN_AGE || age > MAX_AGE) errors.date_of_birth = ui.errAge;
    if (!profile.sex) errors.sex = ui.errSex;
    if (!/^(09|\+639)\d{9}$/.test(profile.mobile_number.replace(/[\s-]/g, ""))) errors.mobile_number = ui.errMobile;
    if (!profile.address_line1.trim()) errors.address_line1 = ui.errAddress;
    if (!profile.city.trim()) errors.city = ui.errCity;
    if (!profile.province.trim()) errors.province = ui.errProvince;
    if (!/^\d{4}$/.test(profile.zip_code)) errors.zip_code = ui.errZip;
    return errors;
  }

  const errors = profileErrors();
  const fieldError = (name: string) => (showProfileErrors || touched[name] ? errors[name] : undefined);
  const touch = (name: string) => () => setTouched((current) => ({ ...current, [name]: true }));

  function continueFromProfile() {
    const firstError = Object.keys(errors)[0];
    if (firstError) {
      setShowProfileErrors(true);
      setError(ui.fixErrors);
      document.getElementById(`profile-${firstError}`)?.focus();
      return;
    }
    setError("");
    setProfile((current) => ({ ...current, mobile_number: current.mobile_number.replace(/[\s-]/g, "") }));
    setStep("pay");
  }

  /**
   * Creates the application. This is the only moment anything is written: the case, the consent record, the
   * details and the submission are all created here, as the first part of the final submit. Staff therefore only
   * ever receive complete applications, and abandoning the flow earlier leaves nothing behind.
   * Each part is skipped once done, so a retry after a network failure resumes instead of duplicating.
   */
  async function createAndSubmitApplication(): Promise<{ caseId: string }> {
    if (!isLive || !config?.campaign || !config.content) throw new Error(ui.notReady);
    const contentLocale = locale === "fil" ? "tl" : "en";
    const content = config.content;
    const consent = content.find((item) => item.locale === contentLocale && item.content_type === "consent_text");
    const privacy = content.find((item) => item.locale === contentLocale && item.content_type === "privacy_notice");
    if (!consent || !privacy) throw new Error(ui.missingContent);

    let activeCaseId = caseId;
    if (!activeCaseId) {
      const created = await api("/api/intake/case", { campaign_id: config.campaign.id, decision: "accept" });
      activeCaseId = created.caseId as string;
      setCaseId(activeCaseId);
      window.sessionStorage.setItem("safecard-case-id", activeCaseId);
      await api("/api/intake/comprehension", { case_id: activeCaseId, answers: { coverage_understanding: true, payment_not_activation: true, can_withdraw_consent: true, claims_contact_correct: true } });
    }

    let activeConsentId = consentRecordId;
    if (!activeConsentId) {
      const granted = await api("/api/consent/grant", { case_id: activeCaseId, consent_type: "membership_application", consent_content_version_id: consent.id, privacy_notice_version_id: privacy.id, locale: contentLocale, idempotency_key: key("consent") });
      activeConsentId = granted.consentRecordId as string;
      setConsentRecordId(activeConsentId);
    }

    if (!applicationSubmitted) {
      const seen = content.filter((item) => item.locale === contentLocale).map((item) => item.id);
      await api("/api/intake/profile", { case_id: activeCaseId, profile_data: profile, data_mode: "live" });
      const result = await api("/api/intake/submit", { case_id: activeCaseId, consent_record_id: activeConsentId, content_versions_seen: seen, privacy_notice_version_id: privacy.id, profile_data: profile, submitted_by: "recipient", idempotency_key: key("submit"), data_mode: "live" });
      setReference(result.applicationRef);
      setApplicationSubmitted(true);
    }
    return { caseId: activeCaseId };
  }

  const progress = PROGRESS_STEPS.indexOf(step);
  const showProgress = progress >= 0;
  const canCancel = showProgress;
  const quizDone = quizIndex >= quiz.length;
  const currentQuestion = quiz[Math.min(quizIndex, quiz.length - 1)];
  const picked = quizPicks[currentQuestion.id];
  const pickedCorrect = picked === currentQuestion.correct;

  return (
    <div className="wizard-page">
      <header className="wizard-nav">
        <Link href="/" className="brand-link" aria-label="SafeCard"><BrandMark /></Link>
        <LocaleToggle />
      </header>
      {step !== "pay" && <SeasonGarland light />} {/* SEASONAL:christmas-2026 — the payment step stays undecorated */}

      <main id="main-content" className="wizard-main">
        {step !== "complete" && (
          <div className="wizard-toolbar">
            {step === "learn"
              ? <BackLink fallbackHref="/" />
              : step === "pay" && applicationSubmitted
                // Details are already submitted; going "back" would only resubmit them.
                ? <BackLink fallbackHref="/" label={ui.home} />
                : <BackLink onBack={goBack} label={ui.back} />}
            {canCancel && <button type="button" className="cancel-link" onClick={requestCancel}>{ui.cancel}</button>}
          </div>
        )}

        {config?.mode === "synthetic" && (
          <div className="wizard-banner"><strong>{ui.syntheticBanner}</strong><span>{ui.syntheticBannerBody}</span></div>
        )}

        {showProgress && (
          <ol className="wizard-progress" aria-label={ui.progress}>
            {ui.labels.map((label, index) => (
              <li key={label} className={index === progress ? "current" : index < progress ? "done" : ""} aria-current={index === progress ? "step" : undefined}>
                <span aria-hidden="true">{index < progress ? <CheckIcon size={14} /> : index + 1}</span>{label}
              </li>
            ))}
          </ol>
        )}


        <section className="wizard-card" ref={headingRef}>
          {config?.mode === "unavailable" && <div className="parked-panel" role="alert"><strong>{ui.unavailable}</strong><p>{config.configurationError}</p></div>}

          {/* ── STEP 1: LEARN ── */}
          {step === "learn" && (
            <>
              <p className="eyebrow">{ui.learnEyebrow}</p>
              <h1 tabIndex={-1}>{ui.learnTitle}</h1>
              <p className="wizard-lede">{ui.learnBody}</p>
              <div className="boundary-grid">
                <article><strong>{ui.boundary1}</strong><p>{ui.boundary1Body}</p></article>
                <article><strong>{ui.boundary2}</strong><p>{ui.boundary2Body}</p></article>
                <article><strong>{ui.boundary3}</strong><p>{ui.boundary3Body}</p></article>
              </div>
              <div className="ready-list">
                <h2>{ui.readyTitle}</h2>
                <ul>{ui.ready.map((item) => <li key={item}><CheckIcon size={16} />{item}</li>)}</ul>
              </div>
              <div className="wizard-actions">
                <button className="button-primary" onClick={() => setStep("check")}>{ui.check}<ArrowRightIcon size={18} /></button>
                <button className="button-quiet" onClick={() => { setQuizIndex(quiz.length); setStep("decide"); }}>{ui.skip}</button>
                <Link className="text-link" href="/benefits">{ui.fullGuide}</Link>
              </div>
            </>
          )}

          {/* ── STEP 2: CHECK ── */}
          {step === "check" && (
            <>
              <p className="eyebrow">{ui.checkEyebrow}</p>
              <h1 tabIndex={-1}>{ui.checkTitle}</h1>
              {!quizDone ? (
                <>
                  <p className="wizard-lede">{ui.checkIntro}</p>
                  <div className="quiz-progress" role="progressbar" aria-valuemin={1} aria-valuemax={quiz.length} aria-valuenow={quizIndex + 1} aria-label={`${ui.question} ${quizIndex + 1} ${ui.of} ${quiz.length}`}>
                    <span style={{ width: `${((quizIndex + (pickedCorrect ? 1 : 0)) / quiz.length) * 100}%` }} />
                  </div>
                  <fieldset className="quiz-block" key={currentQuestion.id}>
                    <legend className="quiz-question"><span className="quiz-count">{ui.question} {quizIndex + 1} {ui.of} {quiz.length}</span>{currentQuestion.question}</legend>
                    <div className="quiz-options">
                      {quizOrder[Math.min(quizIndex, quiz.length - 1)].map((position) => currentQuestion.options[position]).map((option) => {
                        const selected = picked === option.value;
                        const isRight = option.value === currentQuestion.correct;
                        return (
                          <label key={option.value} className={`quiz-option${selected ? (isRight ? " quiz-option-correct" : " quiz-option-wrong") : ""}`}>
                            <input type="radio" name={`quiz-${currentQuestion.id}`} checked={selected} disabled={pickedCorrect} onChange={() => setQuizPicks({ ...quizPicks, [currentQuestion.id]: option.value })} />
                            <span className="quiz-option-text">{option.label}</span>
                            {selected && <span className={`quiz-mark ${isRight ? "quiz-mark-correct" : "quiz-mark-wrong"}`} aria-hidden="true">{isRight ? "✓" : "✗"}</span>}
                          </label>
                        );
                      })}
                    </div>
                    <div aria-live="polite">
                      {picked && (
                        <div className={`quiz-feedback ${pickedCorrect ? "quiz-feedback-correct" : "quiz-feedback-wrong"}`}>
                          <strong>{pickedCorrect ? ui.correct : ui.incorrect}</strong>
                          <p>{currentQuestion.explanation}</p>
                        </div>
                      )}
                    </div>
                  </fieldset>
                  <div className="wizard-actions">
                    {pickedCorrect
                      ? <button className="button-primary" onClick={() => setQuizIndex(quizIndex + 1)}>{quizIndex === quiz.length - 1 ? ui.finish : ui.next}<ArrowRightIcon size={18} /></button>
                      : picked
                        ? <button className="button-primary" onClick={() => setQuizPicks((current) => { const next = { ...current }; delete next[currentQuestion.id]; return next; })}>{ui.tryAgain}</button>
                        : <button className="button-primary" disabled>{ui.next}</button>}
                  </div>
                </>
              ) : (
                <div className="quiz-done">
                  <span className="completion-mark"><CheckIcon size={28} /></span>
                  <h2>{ui.quizDoneTitle}</h2>
                  <p className="wizard-lede">{ui.quizDoneBody}</p>
                  <div className="wizard-actions">
                    <button className="button-primary" onClick={() => setStep("decide")}>{ui.continue}<ArrowRightIcon size={18} /></button>
                    <button className="button-quiet" onClick={() => { setQuizPicks({}); setQuizIndex(0); }}>{ui.reviewQuiz}</button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── STEP 3: DECIDE ── */}
          {step === "decide" && (
            <>
              <p className="eyebrow">{ui.decideEyebrow}</p>
              <h1 tabIndex={-1}>{ui.decideTitle}</h1>
              <p className="wizard-lede">{ui.decideBody}</p>
              <div className="decision-list">
                <button onClick={() => decide("accept")} disabled={busy}><span aria-hidden="true">✓</span><div><strong>{ui.accept}</strong><p>{ui.acceptBody}</p></div></button>
                <button onClick={() => decide("ask")} disabled={busy} aria-expanded={asking}><span aria-hidden="true">?</span><div><strong>{ui.ask}</strong><p>{ui.askBody}</p></div></button>
                <button onClick={() => decide("decline")} disabled={busy}><span aria-hidden="true">×</span><div><strong>{ui.decline}</strong><p>{ui.declineBody}</p></div></button>
              </div>
              {asking && (
                <div className="ask-panel" role="region" aria-label={ui.askTitle}>
                  <div><strong>{ui.askTitle}</strong><p>{ui.askText}</p></div>
                  <a className="button-primary" href="tel:143"><PhoneIcon size={18} />{ui.call}</a>
                </div>
              )}
              {error && <p className="form-message error" role="alert">{error}</p>}
              {busy && <p className="form-message" role="status">{ui.busy}</p>}
            </>
          )}

          {/* ── STEP 4: CONSENT ── */}
          {step === "consent" && (
            <>
              <p className="eyebrow">{ui.consentEyebrow}</p>
              <h1 tabIndex={-1}>{ui.consentTitle}</h1>
              <div className="privacy-panel">
                <strong>{ui.minimum}</strong>
                <p>{ui.minimumBody}</p>
                <Link href="/privacy">{ui.privacyLink}</Link>
              </div>
              <p className="consent-lead">{ui.consentLead}</p>
              {(["voluntary", "privacy", "boundaries"] as const).map((item, i) => (
                <label key={item} className="consent-row">
                  <input type="checkbox" checked={agreed[item]} onChange={(e) => setAgreed({ ...agreed, [item]: e.target.checked })} />
                  <span>{[ui.voluntary, ui.privacyConsent, ui.boundaryConsent][i]}</span>
                </label>
              ))}
              {error && <p className="form-message error" role="alert">{error}</p>}
              <div className="wizard-actions">
                <button className="button-primary" disabled={!allAgreed || busy} onClick={recordConsent}>{ui.continuePrivately}<ArrowRightIcon size={18} /></button>
              </div>
            </>
          )}

          {/* ── STEP 5: DETAILS ── */}
          {step === "profile" && (
            <>
              <p className="eyebrow">{ui.profileEyebrow}</p>
              <h1 tabIndex={-1}>{ui.profileTitle}</h1>
              <p className="wizard-lede">{ui.profileBody}</p>
              <p className="required-legend">{ui.legendRequired}</p>
              <div className="form-grid">
                <Field id="profile-first_name" label={ui.firstName} required requiredText={ui.required} autoComplete="given-name" value={profile.first_name} error={fieldError("first_name")} onBlur={touch("first_name")} onChange={(v) => setProfile({ ...profile, first_name: v })} />
                <Field id="profile-last_name" label={ui.lastName} required requiredText={ui.required} autoComplete="family-name" value={profile.last_name} error={fieldError("last_name")} onBlur={touch("last_name")} onChange={(v) => setProfile({ ...profile, last_name: v })} />
                <Field id="profile-date_of_birth" label={ui.dob} required requiredText={ui.required} type="date" autoComplete="bday" max={new Date().toISOString().slice(0, 10)} value={profile.date_of_birth} error={fieldError("date_of_birth")} onBlur={touch("date_of_birth")} onChange={(v) => setProfile({ ...profile, date_of_birth: v })} />
                <div className={`field-block ${fieldError("sex") ? "has-error" : ""}`}>
                  <label htmlFor="profile-sex">{ui.sex}<span className="req" aria-hidden="true"> *</span><span className="sr-only"> ({ui.required})</span></label>
                  <select id="profile-sex" required aria-required="true" aria-invalid={fieldError("sex") ? true : undefined} aria-describedby={fieldError("sex") ? "profile-sex-error" : undefined} value={profile.sex} onBlur={touch("sex")} onChange={(e) => setProfile({ ...profile, sex: e.target.value as Profile["sex"] })}>
                    <option value="">{ui.selectSex}</option>
                    <option value="female">{ui.female}</option>
                    <option value="male">{ui.male}</option>
                  </select>
                  {fieldError("sex") && <p className="field-error" id="profile-sex-error" role="alert">{fieldError("sex")}</p>}
                </div>
                <Field id="profile-mobile_number" label={ui.mobile} required requiredText={ui.required} type="tel" inputMode="tel" autoComplete="tel" hint={ui.mobileHint} value={profile.mobile_number} error={fieldError("mobile_number")} onBlur={touch("mobile_number")} onChange={(v) => setProfile({ ...profile, mobile_number: v })} />
                <Field id="profile-email" label={ui.email} optionalText={isFil ? "Opsyonal" : "Optional"} type="email" inputMode="email" autoComplete="email" value={profile.email || ""} onChange={(v) => setProfile({ ...profile, email: v })} />
                <div className="full"><Field id="profile-address_line1" label={ui.address} required requiredText={ui.required} autoComplete="address-line1" hint={ui.addressHint} value={profile.address_line1} error={fieldError("address_line1")} onBlur={touch("address_line1")} onChange={(v) => setProfile({ ...profile, address_line1: v })} /></div>
                <Field id="profile-city" label={ui.city} required requiredText={ui.required} autoComplete="address-level2" value={profile.city} error={fieldError("city")} onBlur={touch("city")} onChange={(v) => setProfile({ ...profile, city: v })} />
                <Field id="profile-province" label={ui.province} required requiredText={ui.required} autoComplete="address-level1" value={profile.province} error={fieldError("province")} onBlur={touch("province")} onChange={(v) => setProfile({ ...profile, province: v })} />
                <Field id="profile-zip_code" label={ui.zip} required requiredText={ui.required} inputMode="numeric" autoComplete="postal-code" maxLength={4} hint={ui.zipHint} value={profile.zip_code} error={fieldError("zip_code")} onBlur={touch("zip_code")} onChange={(v) => setProfile({ ...profile, zip_code: v.replace(/\D/g, "") })} />
              </div>
              {error && <p className="form-message error" role="alert">{error}</p>}
              <div className="wizard-actions">
                <button className="button-primary" onClick={continueFromProfile}>{ui.reviewBtn}<ArrowRightIcon size={18} /></button>
              </div>
            </>
          )}

          {/* ── STEP 6: REVIEW, PAY AND SUBMIT ── */}
          {step === "pay" && (
            <>
                  <p className="eyebrow">{ui.payEyebrow}</p>
                  <h1 tabIndex={-1}>{ui.payTitle}</h1>
                  <p className="wizard-lede">{ui.payBody}</p>
                  {!applicationSubmitted && (
                    <section className="details-summary" aria-labelledby="details-summary-title">
                      <header><h2 id="details-summary-title">{ui.yourDetails}</h2><button type="button" className="link-button" onClick={() => setStep("profile")}>{ui.edit}</button></header>
                      <dl className="review-list">
                        <div><dt>{ui.name}</dt><dd>{profile.first_name} {profile.last_name}</dd></div>
                        <div><dt>{ui.dateOfBirth}</dt><dd>{profile.date_of_birth}</dd></div>
                        <div><dt>{ui.mobileLabel}</dt><dd>{profile.mobile_number}</dd></div>
                        {profile.email && <div><dt>{ui.emailLabel}</dt><dd>{profile.email}</dd></div>}
                        <div><dt>{ui.addressLabel}</dt><dd>{profile.address_line1}, {profile.city}, {profile.province} {profile.zip_code}</dd></div>
                      </dl>
                    </section>
                  )}
                  <ManualPaymentPanel
                    caseId={caseId}
                    campaignId={config?.campaign?.id ?? "00000000-0000-0000-0000-000000000010"}
                    live={isLive}
                    beforeSubmit={isLive ? createAndSubmitApplication : undefined}
                    onComplete={(summary) => {
                      setPaymentSummary(summary);
                      setProfile(emptyProfile);
                      window.sessionStorage.removeItem("safecard-case-id");
                      setStep("complete");
                    }}
                  />
            </>
          )}

          {/* ── COMPLETE ── */}
          {step === "complete" && (
            <div className="completion-panel">
              <span className="completion-mark"><CheckIcon size={30} /></span>
              <p className="eyebrow" style={{ marginTop: "18px" }}>{ui.completeEyebrow}</p>
              <h1 tabIndex={-1}>{ui.completeTitle}</h1>
              <p className="wizard-lede">{ui.completeBody}</p>
              <div className="reference-box">
                <span>{ui.applicationRef}</span>
                <strong>{reference}</strong>
              </div>
              {paymentSummary && (
                <div className="payment-summary-panel">
                  <strong>{ui.paymentSummaryTitle}</strong>
                  <div className="payment-summary-rows">
                    <div className="payment-summary-row"><span>{ui.paymentSummaryRoute}</span><span>{paymentSummary.routeLabel}</span></div>
                    {paymentSummary.reference && <div className="payment-summary-row"><span>{ui.paymentSummaryReference}</span><span>{paymentSummary.reference}</span></div>}
                  </div>
                </div>
              )}
              <div className="next-steps-panel">
                <strong>{ui.nextTitle}</strong>
                <ol className="next-steps-list"><li>{ui.next1}</li><li>{ui.next2}</li><li>{ui.next3}</li></ol>
                <p className="hotline-note">{ui.hotlineNote} <strong>143</strong>. {ui.noDecide}</p>
              </div>
              <div className="wizard-actions" style={{ justifyContent: "center", marginTop: "28px" }}>
                <Link className="button-primary" href="/member">{ui.checkStatus}<ArrowRightIcon size={18} /></Link>
                <button className="button-quiet" onClick={() => window.print()}>{ui.print}</button>
                <button className="button-quiet" onClick={clearSharedDevice}>{ui.clearDevice}</button>
              </div>
            </div>
          )}

          {/* ── DECLINED ── */}
          {step === "declined" && (
            <div className="completion-panel">
              <span className="completion-mark quiet" aria-hidden="true">×</span>
              <p className="eyebrow" style={{ marginTop: "18px" }}>{ui.declinedEyebrow}</p>
              <h1 tabIndex={-1}>{ui.declinedTitle}</h1>
              <p>{ui.declinedBody}</p>
              <div className="wizard-actions" style={{ justifyContent: "center" }}>
                <Link className="button-primary" href="/">{ui.home}</Link>
                <button className="button-quiet" onClick={() => setStep("learn")}>{ui.reviewAgain}</button>
              </div>
            </div>
          )}
        </section>
      </main>
      {step !== "pay" && <SeasonScene variant="mini" />} {/* SEASONAL:christmas-2026 — the payment step stays undecorated */}

      {confirmingCancel && (
        <CancelDialog title={ui.cancelTitle} body={ui.cancelBody} confirmLabel={busy ? ui.cancelling : ui.cancelConfirm} keepLabel={ui.cancelKeep} busy={busy} onConfirm={discardApplication} onKeep={() => setConfirmingCancel(false)} />
      )}
    </div>
  );
}

function CancelDialog({ title, body, confirmLabel, keepLabel, busy, onConfirm, onKeep }: { title: string; body: string; confirmLabel: string; keepLabel: string; busy: boolean; onConfirm: () => void; onKeep: () => void }) {
  const keepRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    keepRef.current?.focus();
    function onKey(event: KeyboardEvent) { if (event.key === "Escape" && !busy) onKeep(); }
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("keydown", onKey); previous?.focus(); };
  }, [busy, onKeep]);
  return (
    <div className="dialog-backdrop" onClick={() => { if (!busy) onKeep(); }}>
      <div className="dialog-panel" role="alertdialog" aria-modal="true" aria-labelledby="cancel-title" aria-describedby="cancel-body" onClick={(event) => event.stopPropagation()}>
        <h2 id="cancel-title">{title}</h2>
        <p id="cancel-body">{body}</p>
        <div className="wizard-actions">
          <button ref={keepRef} type="button" className="button-primary" onClick={onKeep} disabled={busy}>{keepLabel}</button>
          <button type="button" className="button-quiet" onClick={onConfirm} disabled={busy}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
}
