"use client";

import { PhoneIcon } from "@/components/icons";
import { useLocale } from "@/components/LocaleProvider";
import { accident } from "@/lib/education/content";
import "./education.css";

/** "After an accident": call 143 first, then two deadlines, then what to bring. */
export function AccidentSection() {
  const { locale } = useLocale();
  const c = accident;
  return (
    <section className="edu-section" id="accident" aria-labelledby="accident-title">
      <div className="edu-heading">
        <p className="eyebrow">{c.eyebrow[locale]}</p>
        <h2 id="accident-title">{c.title[locale]}</h2>
      </div>

      <div className="edu-call">
        <div>
          <h3>{c.call.title[locale]}</h3>
          <p>{c.call.text[locale]}</p>
        </div>
        <a href="tel:143"><PhoneIcon size={22} />{c.call.action[locale]}</a>
      </div>

      <ol className="edu-steps">
        {c.steps.map((step) => (
          <li key={step.id}>
            <span className={`edu-when ${step.deadline ? "deadline" : ""}`}>{step.when[locale]}</span>
            <h3>{step.title[locale]}</h3>
            <p>{step.text[locale]}</p>
          </li>
        ))}
      </ol>

      <h3 className="edu-docs-title">{c.documents.title[locale]}</h3>
      <p className="edu-docs-intro">{c.documents.intro[locale]}</p>
      <div className="edu-docs">
        <section aria-label={c.documents.hospital.title[locale]}>
          <h4>{c.documents.hospital.title[locale]}</h4>
          <ul className="edu-checks">{c.documents.hospital.items.map((item) => <li key={item.en}>{item[locale]}</li>)}</ul>
        </section>
        <section aria-label={c.documents.death.title[locale]}>
          <h4>{c.documents.death.title[locale]}</h4>
          <ul className="edu-checks">{c.documents.death.items.map((item) => <li key={item.en}>{item[locale]}</li>)}</ul>
        </section>
      </div>
    </section>
  );
}
