"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { copy, CURRENT_WORKING_ELIGIBILITY, CURRENT_WORKING_FEE } from "@/lib/public-content";
import { useLocale } from "@/components/LocaleProvider";
import { BenefitStoryboard } from "@/components/BenefitStoryboard";

type ReferralState = { valid: boolean; sponsorDisplayName?: string; reason?: string } | null;

export function LandingExperience() {
  const { locale, setLocale } = useLocale();
  const t = copy[locale];
  const params = useSearchParams();
  const referral = params.get("ref");
  const [referralState, setReferralState] = useState<ReferralState>(null);

  useEffect(() => {
    if (!referral) return;
    const controller = new AbortController();
    fetch(`/api/referrals/validate?slug=${encodeURIComponent(referral)}`, { signal: controller.signal })
      .then((response) => response.json())
      .then(setReferralState)
      .catch(() => setReferralState({ valid: false, reason: "unavailable" }));
    return () => controller.abort();
  }, [referral]);

  const applicationHref = referral && referralState?.valid ? `/apply?ref=${encodeURIComponent(referral)}` : "/apply";

  return (
    <main className="site-frame">
      <header className="public-nav">
        <Link href="/" className="brand-link"><BrandMark /></Link>
        <nav aria-label="Primary navigation">
          <a href="#benefits">{t.navBenefits}</a><a href="#process">{t.navProcess}</a>
          <Link href="/ambassador">{t.ambassadorLogin}</Link><Link href="/member">{t.memberLogin}</Link><Link href="/admin/login">{t.adminLogin}</Link>
        </nav>
        <button className="locale-toggle" type="button" onClick={() => setLocale(locale === "fil" ? "en" : "fil")} aria-label="Change language">
          <span className={locale === "fil" ? "active" : ""}>FIL</span><span>/</span><span className={locale === "en" ? "active" : ""}>EN</span>
        </button>
      </header>

      <section className="hero-grid">
        <div className="hero-copy reveal">
          <p className="pilot-badge"><span />{t.badge}</p>
          {referral && referralState?.valid && <p className="referral-note">{locale === "fil" ? "Pribadong imbitasyon mula kay" : "Private invitation from"} <strong>{referralState.sponsorDisplayName}</strong></p>}
          {referral && referralState?.valid === false && <p className="referral-warning">{locale === "fil" ? "Hindi na valid ang referral link. Maaari ka pa ring magpatuloy nang walang attribution." : "This referral is no longer valid. You may continue without attribution."}</p>}
          <h1>{t.heroTitle}</h1>
          <p className="hero-lede">{t.heroBody}</p>
          <div className="hero-actions"><Link className="button-primary" href={applicationHref}>{t.primaryCta}<span aria-hidden="true">→</span></Link><Link className="button-quiet" href="/benefits">{t.secondaryCta}</Link></div>
          <p className="voluntary-line"><span aria-hidden="true">✓</span>{t.voluntary}</p>
        </div>

        <div className="hero-card-stack reveal delay-1" aria-label="SafeCard working program summary">
          <article className="programme-card">
            <div className="card-kicker"><span>01</span>Working baseline</div><strong>{CURRENT_WORKING_FEE}</strong><p>{CURRENT_WORKING_ELIGIBILITY}</p><div className="card-rule" />
            <small>{locale === "fil" ? "Kinakailangan pa ang pinal na pag-apruba ng PRC bago gamitin sa live pilot." : "Final PRC approval is required before live pilot use."}</small>
          </article>
          <article className="control-card"><span className="control-index">02</span><div><strong>{locale === "fil" ? "Ikaw ang may kontrol" : "You stay in control"}</strong><p>{locale === "fil" ? "Walang personal na datos bago ang iyong pasya at pahintulot." : "No personal data before your decision and consent."}</p></div></article>
        </div>
      </section>

      <section className="benefit-section" id="benefits">
        <div className="section-heading"><p>{t.benefitsEyebrow}</p><h2>{t.benefitsTitle}</h2><span>{locale === "fil" ? "Ang working information ay hindi kapalit ng opisyal na terms." : "Working information never replaces official terms."}</span></div>
        <BenefitStoryboard locale={locale} compact />
      </section>

      <section className="process-section" id="process">
        <div className="section-heading inverse"><p>{locale === "fil" ? "Mula imbitasyon hanggang PRC" : "From invitation to PRC"}</p><h2>{t.processTitle}</h2></div>
        <ol className="process-grid">{[
          ["Learn", "Matuto", "Review the working benefits, limits, and source status."],
          ["Decide", "Magpasya", "Accept, ask a question, or privately decline."],
          ["Apply", "Mag-apply", "Provide approved information only after consent."],
          ["Confirm", "Kumpirmahin", "Track submission, payment review, and PRC confirmation separately."],
        ].map(([en, fil, detail], index) => <li key={en}><div className="process-step-heading"><span>{index + 1}</span><h3>{locale === "fil" ? fil : en}</h3></div><p>{detail}</p></li>)}</ol>
      </section>

      <footer className="public-footer"><BrandMark /><p>{t.footerNote}</p><a href="tel:143">Emergency: 143</a></footer>
    </main>
  );
}
