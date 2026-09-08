"use client";

import Link from "next/link";
import { BenefitStoryboard } from "@/components/BenefitStoryboard";
import { useLocale } from "@/components/LocaleProvider";

export function BenefitsExperience() {
  const { locale } = useLocale();
  return <>
    <div className="notice-panel amber"><strong>{locale === "fil" ? "Mahalagang hangganan" : "Important boundary"}</strong><span>{locale === "fil" ? "Ang bayad ay hindi consent, submission, approval, o membership activation. PRC lamang ang nagkukumpirma." : "Payment is not consent, submission, approval, or membership activation. Only PRC confirms membership."}</span></div>
    <BenefitStoryboard locale={locale} />
    <section className="content-section"><p className="eyebrow">{locale === "fil" ? "Working assumptions ng pilot" : "Working pilot assumptions"}</p><h2>{locale === "fil" ? "Kailangan pa ng pinal na validation." : "Fee and eligibility still require formal validation."}</h2><dl className="review-list"><div><dt>{locale === "fil" ? "Taunang working fee" : "Working annual fee"}</dt><dd>₱1,200</dd></div><div><dt>{locale === "fil" ? "Edad sa working guide" : "Working age range"}</dt><dd>{locale === "fil" ? "3–85 taong gulang" : "3–85 years old"}</dd></div><div><dt>{locale === "fil" ? "Emergency at official questions" : "Emergency and official questions"}</dt><dd>PRC Hotline 143</dd></div></dl><p>{locale === "fil" ? "Synthetic information lamang ito para sa controlled testing. Mananatiling naka-off ang live mode hanggang nasa registry ang approved content." : "These assumptions support controlled design and testing only. Live mode stays disabled until approved content is published in the registry."}</p></section>
    <div className="wizard-actions"><Link href="/apply" className="button-primary">{locale === "fil" ? "Suriin ang pagkaunawa" : "Check my understanding"} →</Link><Link href="/privacy" className="button-quiet">{locale === "fil" ? "Paunawa sa privacy" : "Privacy notice"}</Link></div>
  </>;
}
