"use client";

import Link from "next/link";
import { ArrowRightIcon, CalendarCheckIcon, ChatIcon, InfoIcon, PhoneIcon } from "@/components/icons";
import { useLocale } from "@/components/LocaleProvider";
import { copy } from "@/lib/public-content";

/** The single help area that carries the hotline. Benefit sections point here instead of repeating a call button. */
export function HelpBlock({ showMoreLink = true, headingLevel = 2 }: { showMoreLink?: boolean; headingLevel?: 2 | 1 }) {
  const { locale } = useLocale();
  const t = copy[locale];
  const Heading = headingLevel === 1 ? "h1" : "h2";
  return (
    <section className="help-block" id="help" aria-labelledby="help-title">
      <div className="help-block-lead">
        <p className="eyebrow">{t.helpEyebrow}</p>
        <Heading id="help-title">{t.helpTitle}</Heading>
        <p>{t.helpLead}</p>
        <a className="button-primary help-call" href="tel:143"><PhoneIcon size={20} /><span>{t.helpCall}</span></a>
      </div>
      <div className="help-cards">
        <article>
          <span className="help-icon"><CalendarCheckIcon size={22} /></span>
          <h3>{t.helpWhenTitle}</h3>
          <ul>{t.helpWhen.map((item) => <li key={item}>{item}</li>)}</ul>
        </article>
        <article>
          <span className="help-icon"><ChatIcon size={22} /></span>
          <h3>{t.helpExpectTitle}</h3>
          <p>{t.helpExpect}</p>
        </article>
        <article>
          <span className="help-icon"><InfoIcon size={22} /></span>
          <h3>{t.helpSafecardTitle}</h3>
          <p>{t.helpSafecard}</p>
          {showMoreLink && <Link href="/help" className="text-link">{t.helpMore}<ArrowRightIcon size={16} /></Link>}
        </article>
      </div>
    </section>
  );
}
