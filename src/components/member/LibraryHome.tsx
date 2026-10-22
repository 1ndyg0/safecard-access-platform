"use client";

import { useLocale } from "@/components/LocaleProvider";
import { DocumentCard } from "@/components/education/DocumentCard";
import { library } from "@/lib/education/content";
import { findDocument } from "@/lib/documents/registry";
import "@/components/education/education.css";

export function LibraryHome() {
  const { locale } = useLocale();
  const guide = findDocument("member-guide")!;
  const faqs = findDocument("faqs")!;
  return (
    <section className="library-card" aria-labelledby="library-title">
      <p className="eyebrow">{library.eyebrow[locale]}</p>
      <h1 id="library-title">{library.title[locale]}</h1>
      <p className="lede">{library.intro[locale]}</p>
      {locale === "fil" && <p className="library-notice">{library.languageNotice.fil}</p>}
      <ul className="library-docs">
        <li style={{ display: "contents" }}>
          <DocumentCard document={guide} locale={locale} headingLevel={2} className="library-doc" readHref="/member/library/guide" readLabel={library.read[locale]} />
        </li>
        <li style={{ display: "contents" }}>
          <DocumentCard document={faqs} locale={locale} headingLevel={2} className="library-doc" readHref="/member/library/faq" readLabel={library.readFaq[locale]} />
        </li>
      </ul>
    </section>
  );
}
