"use client";

import { useLocale } from "@/components/LocaleProvider";
import { downloads } from "@/lib/education/content";
import { DOCUMENTS } from "@/lib/documents/registry";
import { DocumentCard } from "./DocumentCard";
import "./education.css";

/** Public documents only. The member guide is offered after sign-in. */
export function DownloadsSection() {
  const { locale } = useLocale();
  return (
    <div className="edu-band">
      <section className="edu-section" id="downloads" aria-labelledby="downloads-title">
        <div className="edu-heading">
          <p className="eyebrow">{downloads.eyebrow[locale]}</p>
          <h2 id="downloads-title">{downloads.title[locale]}</h2>
          <p className="edu-intro">{downloads.intro[locale]}</p>
        </div>
        <ul className="edu-docs-grid">
          {DOCUMENTS.filter((document) => document.audience === "public").map((document) => (
            <li key={document.slug} style={{ display: "contents" }}><DocumentCard document={document} locale={locale} /></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
