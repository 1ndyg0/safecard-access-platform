"use client";

import { useLocale } from "@/components/LocaleProvider";
import { type CoverageItem, coverage } from "@/lib/education/content";
import "./education.css";

function Group({ tone, title, items, locale }: { tone: "yes" | "no"; title: string; items: readonly CoverageItem[]; locale: "fil" | "en" }) {
  return (
    <section className={`edu-group ${tone}`} aria-label={title}>
      <h3>{title}</h3>
      <ul className="edu-rows">
        {items.map((item) => (
          <li key={item.title.en}><strong>{item.title[locale]}</strong><span>{item.text[locale]}</span></li>
        ))}
      </ul>
    </section>
  );
}

/** "Is it covered?": two equal lists, then the three points in time at which claims open. */
export function CoverageSection() {
  const { locale } = useLocale();
  const c = coverage;
  return (
    <div className="edu-band">
      <section className="edu-section" id="covered" aria-labelledby="covered-title">
        <div className="edu-heading">
          <p className="eyebrow">{c.eyebrow[locale]}</p>
          <h2 id="covered-title">{c.title[locale]}</h2>
          <p className="edu-intro">{c.intro[locale]}</p>
        </div>
        <div className="edu-cover">
          <Group tone="yes" title={c.covered.title[locale]} items={c.covered.items} locale={locale} />
          <Group tone="no" title={c.notCovered.title[locale]} items={c.notCovered.items} locale={locale} />
        </div>
        <p className="edu-note">{c.note[locale]}</p>

        <h3 className="edu-wait-title">{c.wait.title[locale]}</h3>
        <p className="edu-wait-intro">{c.wait.intro[locale]}</p>
        <ul className="edu-wait">
          {c.wait.cards.map((card) => (
            <li key={card.id} className={card.id === "day-1" ? "start" : undefined}>
              <strong>{card.figure[locale]}</strong>
              <p>{card.text[locale]}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
