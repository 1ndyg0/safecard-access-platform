"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon, CheckIcon } from "@/components/icons";
import { AccidentSection } from "@/components/education/AccidentSection";
import { CoverageSection } from "@/components/education/CoverageSection";
import { DownloadsSection } from "@/components/education/DownloadsSection";
import { FaqSection } from "@/components/education/FaqSection";
import { SectionIndex } from "@/components/education/SectionIndex";
import { WhatYouGet } from "@/components/education/WhatYouGet";
import { HelpBlock } from "@/components/HelpBlock";
import { GiftBand } from "@/components/seasonal/GiftBand"; // SEASONAL:christmas-2026
import { SeasonSnow } from "@/components/seasonal/Season"; // SEASONAL:christmas-2026
import { useLocale } from "@/components/LocaleProvider";
import { ProcessTimeline } from "@/components/ProcessTimeline";
import { PublicFooter } from "@/components/PublicFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { heroFacts, joinNote } from "@/lib/education/content";
import { copy } from "@/lib/public-content";
import "@/components/education/education.css";

export function LandingExperience() {
  const { locale } = useLocale();
  const t = copy[locale];

  return (
    <div className="site-frame">
      <SiteHeader />
      <SeasonSnow /> {/* SEASONAL:christmas-2026 */}
      <main id="main-content">
        <section className="hero-grid" aria-labelledby="hero-title">
          <div className="hero-copy reveal">
            <p className="hero-eyebrow"><span aria-hidden="true" />{t.eyebrow}</p>
            <h1 id="hero-title" className="hero-title">{t.heroTitle}</h1>
            <p className="hero-lede">{t.heroBody}</p>
            <p className="hero-qualifier">{t.heroQualifier}</p>
            <div className="hero-actions">
              <Link className="button-primary" href="/apply">{t.primaryCta}<ArrowRightIcon size={18} /></Link>
              <a className="button-quiet" href="#covered">{t.secondaryCta}</a>
            </div>
            <ul className="hero-facts">{heroFacts.map((fact) => <li key={fact.en}>{fact[locale]}</li>)}</ul>
            <p className="voluntary-line"><CheckIcon size={16} />{t.voluntary}</p>
          </div>

          <div className="hero-visual reveal delay-1" role="img" aria-label={t.heroVisual}>
            <Image className="card-front" src="/images/education/card-front.webp" width={425} height={266} alt="" priority unoptimized />
            <Image className="card-back" src="/images/education/card-back.webp" width={425} height={266} alt="" priority unoptimized />
          </div>
        </section>

        <GiftBand /> {/* SEASONAL:christmas-2026 */}

        <SectionIndex />
        <WhatYouGet />
        <CoverageSection />
        <AccidentSection />

        <section className="process-section" id="process" aria-labelledby="process-title">
          <div className="process-inner">
            <div className="section-heading inverse">
              <p>{t.processEyebrow}</p>
              <h2 id="process-title">{t.processTitle}</h2>
            </div>
            <ProcessTimeline />
            <p className="process-note">{joinNote[locale]}</p>
          </div>
        </section>

        <FaqSection />
        <DownloadsSection />

        <div className="help-section"><HelpBlock /></div>
      </main>
      <PublicFooter />
    </div>
  );
}
