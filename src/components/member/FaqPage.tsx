"use client";

import { DownloadIcon } from "@/components/icons";
import { useLocale } from "@/components/LocaleProvider";
import { FaqList } from "@/components/education/FaqList";
import { faq, library } from "@/lib/education/content";
import { documentHref } from "@/lib/documents/registry";
import "@/components/education/education.css";

export function FaqPage() {
  const { locale } = useLocale();
  return (
    <section className="library-card" aria-labelledby="faq-page-title">
      <p className="eyebrow">{library.eyebrow[locale]}</p>
      <h1 id="faq-page-title">{library.faqTitle[locale]}</h1>
      <p className="lede">{library.faqIntro[locale]}</p>
      <div style={{ marginTop: 24 }}><FaqList variant="member" /></div>
      <div className="edu-faq-download">
        <a className="edu-text-link" href={documentHref("faqs")} download="Safe-Card-FAQs.pdf"><DownloadIcon size={18} />{faq.download[locale]}</a>
      </div>
    </section>
  );
}
