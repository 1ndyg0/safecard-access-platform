"use client";

import { DownloadIcon } from "@/components/icons";
import { useLocale } from "@/components/LocaleProvider";
import { faq } from "@/lib/education/content";
import { documentHref } from "@/lib/documents/registry";
import { FaqList } from "./FaqList";
import "./education.css";

export function FaqSection() {
  const { locale } = useLocale();
  return (
    <section className="edu-section" id="faq" aria-labelledby="faq-title">
      <div className="edu-heading">
        <p className="eyebrow">{faq.eyebrow[locale]}</p>
        <h2 id="faq-title">{faq.title[locale]}</h2>
      </div>
      <FaqList variant="landing" />
      <div className="edu-faq-download">
        <a className="edu-text-link" href={documentHref("faqs")} download="Safe-Card-FAQs.pdf"><DownloadIcon size={18} />{faq.download[locale]}</a>
      </div>
    </section>
  );
}
