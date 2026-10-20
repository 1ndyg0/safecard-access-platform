"use client";

import Link from "next/link";
import { ArrowRightIcon, CheckIcon, LockIcon } from "@/components/icons";
import { BenefitStoryboard } from "@/components/BenefitStoryboard";
import { HelpBlock } from "@/components/HelpBlock";
import { useLocale } from "@/components/LocaleProvider";
import { ProcessTimeline } from "@/components/ProcessTimeline";
import { PublicFooter } from "@/components/PublicFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { copy, MEMBERSHIP_AGES, MEMBERSHIP_FEE } from "@/lib/public-content";
import type { BenefitCard } from "@/lib/storyboard/schema";

export function LandingExperience({ cards, provenance }: { cards: BenefitCard[] | null; provenance: "approved" | "provisional" }) {
  const { locale } = useLocale();
  const t = copy[locale];
  const isFil = locale === "fil";

  return (
    <div className="site-frame">
      <SiteHeader />
      <main id="main-content">
        <section className="hero-grid">
          <div className="hero-copy reveal">
            <p className="hero-eyebrow"><span aria-hidden="true" />{t.eyebrow}</p>
            <h1>{t.heroTitle}</h1>
            <p className="hero-lede">{t.heroBody}</p>
            <div className="hero-actions">
              <Link className="button-primary" href="/apply">{t.primaryCta}<ArrowRightIcon size={18} /></Link>
              <Link className="button-quiet" href="/benefits">{t.secondaryCta}</Link>
            </div>
            <p className="voluntary-line"><CheckIcon size={16} />{t.voluntary}</p>
          </div>

          <div className="hero-card-stack reveal delay-1">
            <article className="programme-card" aria-label={`${t.cardKicker}: ${MEMBERSHIP_FEE[locale]}`}>
              <p className="card-kicker">{t.cardKicker}</p>
              <p className="card-price"><strong>₱1,200</strong><span>{isFil ? "bawat taon" : "per year"}</span></p>
              <p className="card-ages">{MEMBERSHIP_AGES[locale]}</p>
              <div className="card-rule" />
              <p className="card-note">{t.cardNote}</p>
            </article>
            <article className="control-card">
              <span className="control-icon"><LockIcon size={20} /></span>
              <div><strong>{t.controlTitle}</strong><p>{t.controlBody}</p></div>
            </article>
          </div>
        </section>

        <section className="benefit-section" id="benefits" aria-labelledby="benefits-title">
          <div className="section-heading">
            <p>{t.benefitsEyebrow}</p>
            <h2 id="benefits-title">{t.benefitsTitle}</h2>
            <span>{t.benefitsNote}</span>
          </div>
          {cards ? (
            <BenefitStoryboard cards={cards} locale={locale} provenance={provenance} compact />
          ) : (
            <div className="parked-panel" role="alert">
              <strong>{isFil ? "Pansamantalang hindi available ang benefit guide." : "The benefit guide is temporarily unavailable."}</strong>
              <p>{isFil ? "Hindi magbubukas ang application hangga't hindi naibabalik ang nilalaman." : "Applications will remain unavailable until the content is restored."}</p>
            </div>
          )}
        </section>

        <section className="process-section" id="process" aria-labelledby="process-title">
          <div className="process-inner">
            <div className="section-heading inverse">
              <p>{t.processEyebrow}</p>
              <h2 id="process-title">{t.processTitle}</h2>
            </div>
            <ProcessTimeline />
          </div>
        </section>

        <div className="help-section"><HelpBlock /></div>
      </main>
      <PublicFooter />
    </div>
  );
}
