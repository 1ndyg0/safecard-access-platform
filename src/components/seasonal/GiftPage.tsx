"use client";

import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import { useLocale } from "@/components/LocaleProvider";
import { PublicFooter } from "@/components/PublicFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { seasonalCopy as c } from "@/lib/seasonal/copy";
import { SeasonSnow } from "./Season";
import { ClockIcon } from "./GiftIcon";
import "./christmas.css";

/** /gift: what gifting is, how it works, and the questions people ask first. */
export function GiftPage() {
  const { locale } = useLocale();
  return (
    <div className="site-frame">
      <SiteHeader />
      <SeasonSnow />
      <main id="main-content">
        <div className="xmas-only">
          <div className="xmas-page">
            <section className="xmas-hero" aria-labelledby="gift-title">
              <p className="xmas-badge">{c.badge[locale]}</p>
              <h1 id="gift-title">{c.pageTitle[locale]}</h1>
              <p className="lede">{c.pageLede[locale]}</p>
              <div className="xmas-actions">
                <Link className="button-primary" href="/gift/card">{c.makerTitle[locale]}<ArrowRightIcon size={18} /></Link>
              </div>
            </section>

            <h2 className="xmas-section-title">{c.stepsTitle[locale]}</h2>
            <ol className="xmas-steps">
              {c.steps.map((step) => (
                <li key={step.title.en}><h3>{step.title[locale]}</h3><p>{step.text[locale]}</p></li>
              ))}
            </ol>

            <aside className="xmas-notice" aria-labelledby="xmas-apply-by">
              <ClockIcon />
              <div><h2 id="xmas-apply-by">{c.applyByTitle[locale]}</h2><p>{c.applyByBody[locale]}</p></div>
            </aside>

            <h2 className="xmas-section-title">{c.faqTitle[locale]}</h2>
            <div className="xmas-faq">
              {c.faq.map((item, index) => (
                <details key={item.q.en} open={index === 0}>
                  <summary>{item.q[locale]}</summary>
                  <p>{item.a[locale]}</p>
                </details>
              ))}
            </div>

            <section className="xmas-final" aria-labelledby="xmas-final-title">
              <h2 id="xmas-final-title">{c.finalTitle[locale]}</h2>
              <p>{c.finalBody[locale]}</p>
              <div className="xmas-actions">
                <Link className="button-primary" href="/gift/card">{c.makerTitle[locale]}<ArrowRightIcon size={18} /></Link>
              </div>
            </section>
          </div>
        </div>
      </main>
      <PublicFooter />
    </div>
  );
}
