"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { advanceInvitation, getInvitation } from "@/lib/data";
import type { Sponsorship } from "@/lib/types";

type Step = "learn" | "quiz" | "consent" | "apply" | "done";

const copy = {
  en: {
    voluntary: "This invitation is voluntary. You may pause or decline without consequence.",
    title: "Understand first. Decide for yourself.",
    intro: "A student sponsor has offered to fund a Safe Card membership. Read the working program summary before choosing what to do.",
  },
  fil: {
    voluntary: "Kusang-loob ang imbitasyong ito. Maaari kang huminto o tumanggi nang walang kapalit.",
    title: "Unawain muna. Ikaw ang magpasya.",
    intro: "May estudyanteng nag-alok na sagutin ang Safe Card membership. Basahin muna ang buod bago magpasya.",
  }
};

export default function RecipientFlow({ code }: { code: string }) {
  const [invitation, setInvitation] = useState<Sponsorship | null | undefined>(undefined);
  const [step, setStep] = useState<Step>("learn");
  const [lang, setLang] = useState<"en" | "fil">("en");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [consent, setConsent] = useState(false);
  const [alias, setAlias] = useState("DEMO PERSON");
  const [age, setAge] = useState("44");
  const [error, setError] = useState("");

  useEffect(() => { getInvitation(code).then(setInvitation).catch(() => setInvitation(null)); }, [code]);
  const t = copy[lang];
  const score = [answers.cost === "1200", answers.choice === "recipient", answers.emergency === "143"].filter(Boolean).length;

  const finishQuiz = async () => {
    if (score < 3) { setError("Review your answers. All three are needed before continuing."); return; }
    setError(""); await advanceInvitation(code, "informed"); setStep("consent");
  };

  const submitDemo = async (event: FormEvent) => {
    event.preventDefault();
    const numericAge = Number(age);
    if (!alias.trim() || numericAge < 3 || numericAge > 85) { setError("Use a synthetic alias and an eligible demo age from 3 to 85."); return; }
    setError(""); await advanceInvitation(code, "submitted"); setStep("done");
  };

  if (invitation === undefined) return <div className="recipient-loading">Opening invitation…</div>;
  if (!invitation) return <div className="recipient-error"><div className="brand dark"><span className="brand-mark" />SafeCard</div><h1>Invitation not found.</h1><p>The link may be invalid or unavailable in this demo browser.</p><Link className="button" href="/">Return to overview</Link></div>;

  return <main className="recipient-page">
    <header className="recipient-top"><Link className="brand dark" href="/"><span className="brand-mark" />SafeCard</Link><button className="lang" onClick={() => setLang(lang === "en" ? "fil" : "en")}>{lang === "en" ? "Filipino" : "English"}</button></header>
    <div className="recipient-shell">
      <div className="recipient-progress" aria-label="Progress"><span className={step === "learn" ? "current" : "done"}>1 Learn</span><span className={step === "quiz" ? "current" : ["consent","apply","done"].includes(step) ? "done" : ""}>2 Check</span><span className={step === "consent" ? "current" : ["apply","done"].includes(step) ? "done" : ""}>3 Decide</span><span className={step === "apply" ? "current" : step === "done" ? "done" : ""}>4 Demo intake</span></div>
      <div className="voluntary"><span aria-hidden="true">✓</span>{t.voluntary}</div>

      {step === "learn" && <section>
        <p className="eyebrow">Invitation · {invitation.sponsorAlias}</p><h1>{t.title}</h1><p className="recipient-lede">{t.intro}</p>
        <div className="benefit-grid">
          <article><span>Working annual cost</span><strong>₱1,200</strong><p>One year; payment must use an approved official PRC route.</p></article>
          <article><span>Working eligibility</span><strong>Ages 3–85</strong><p>Final eligibility and activation are decided by PRC.</p></article>
          <article><span>Accident assistance</span><strong>Up to ₱300,000</strong><p>For accidental death, disablement, or dismemberment, subject to official terms.</p></article>
          <article><span>Medical reimbursement</span><strong>Up to ₱10,000</strong><p>For qualifying accidents, subject to official terms and exclusions.</p></article>
        </div>
        <details className="limits"><summary>Important limits and claims guidance</summary><p>Benefits are not guaranteed for every incident. Exclusions, required documents, deadlines, and final decisions belong to PRC. The working project materials say Hotline 143 is the first route for accident-related ambulance or blood emergencies, but all contacts require confirmation before a live pilot.</p></details>
        <div className="source-note"><b>Content status: for validation</b><span>Working baseline reviewed 4 Sep 2026. Not yet approved as live PRC content.</span></div>
        <div className="flow-actions"><button className="button" onClick={() => setStep("quiz")}>Check my understanding</button><Link className="button secondary" href="/">Not now</Link></div>
      </section>}

      {step === "quiz" && <section className="narrow">
        <p className="eyebrow">Quick check</p><h1>Three things to know</h1><p className="recipient-lede">Choose the best answer. You can review and try again.</p>
        <fieldset><legend>1. What is the working annual cost?</legend><label><input type="radio" name="cost" onChange={() => setAnswers({...answers, cost:"1200"})} /> ₱1,200 for one year</label><label><input type="radio" name="cost" onChange={() => setAnswers({...answers, cost:"100"})} /> ₱100 total</label></fieldset>
        <fieldset><legend>2. Who decides whether to participate?</legend><label><input type="radio" name="choice" onChange={() => setAnswers({...answers, choice:"sponsor"})} /> The sponsor</label><label><input type="radio" name="choice" onChange={() => setAnswers({...answers, choice:"recipient"})} /> The recipient</label></fieldset>
        <fieldset><legend>3. What is the working first contact for an accident-related ambulance or blood emergency?</legend><label><input type="radio" name="emergency" onChange={() => setAnswers({...answers, emergency:"143"})} /> PRC Hotline 143</label><label><input type="radio" name="emergency" onChange={() => setAnswers({...answers, emergency:"sponsor"})} /> The sponsor</label></fieldset>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="flow-actions"><button className="button" onClick={finishQuiz}>Continue</button><button className="button secondary" onClick={() => setStep("learn")}>Review</button></div>
      </section>}

      {step === "consent" && <section className="narrow">
        <p className="eyebrow">Your decision</p><h1>Your choice comes before any form.</h1><p className="recipient-lede">This prototype does not send information to PRC. In a live pilot, a PRC-approved notice would explain every field, purpose, recipient, retention period, and correction or withdrawal route.</p>
        <div className="privacy-card"><h2>What the sponsor can see</h2><p>Only a high-level status such as invited, learning complete, submitted, or completed.</p><h2>What they cannot see</h2><p>Your identity documents, health information, claim activity, or answers in the application.</p></div>
        <label className="check"><input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} /><span>I understand this is a synthetic prototype and choose to continue to the demo intake.</span></label>
        <div className="flow-actions"><button className="button" disabled={!consent} onClick={async () => { await advanceInvitation(code, "consented"); setStep("apply"); }}>Continue privately</button><Link className="button secondary" href="/">Decline</Link></div>
      </section>}

      {step === "apply" && <section className="narrow">
        <p className="eyebrow">Synthetic demo only</p><h1>Try the intake safely.</h1><p className="recipient-lede">Do not use a real name or personal information. Production fields remain blocked until privacy and PRC approvals exist.</p>
        <form className="intake" onSubmit={submitDemo}>
          <label className="field"><span>Demo alias</span><input value={alias} onChange={(e) => setAlias(e.target.value)} maxLength={40} autoComplete="off" /><small>Example: DEMO PERSON</small></label>
          <label className="field"><span>Demo age</span><input value={age} onChange={(e) => setAge(e.target.value)} inputMode="numeric" type="number" min="3" max="85" /><small>Working eligibility is ages 3–85.</small></label>
          <label className="field"><span>Preferred language</span><select defaultValue={lang}><option value="en">English</option><option value="fil">Filipino</option></select></label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="button wide">Submit demo application</button>
        </form>
      </section>}

      {step === "done" && <section className="narrow completion">
        <span className="success-mark" aria-hidden="true">✓</span><p className="eyebrow">Demo submitted</p><h1>You are still in control.</h1><p className="recipient-lede">This created only a prototype status. It is not an official registration, payment, membership ID, or activation.</p>
        <div className="reference"><span>Prototype reference</span><strong>SC-{invitation.inviteCode.slice(0, 8)}</strong></div>
        <div className="flow-actions"><Link className="button" href="/">View sponsor status</Link><button className="button secondary" onClick={() => window.print()}>Print summary</button></div>
      </section>}
    </div>
  </main>;
}
