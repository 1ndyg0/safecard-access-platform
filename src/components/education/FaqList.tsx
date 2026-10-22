"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRightIcon, SearchIcon } from "@/components/icons";
import { useLocale } from "@/components/LocaleProvider";
import { faq, type FaqItem } from "@/lib/education/content";
import "./education.css";

/** Lower-case and strip accents so "ano" finds "Ano" and "ñ" does not get in the way. */
function fold(text: string): string {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

function haystack(item: FaqItem, locale: "fil" | "en"): string {
  return fold([item.question[locale], ...item.answer.map((paragraph) => paragraph[locale]), item.keywords?.[locale] ?? ""].join(" "));
}

/**
 * The questions, as a search box and a list of native <details> elements.
 * Used by the landing page and by the member library, so both always show
 * the same answers. Questions that a whole section explains link to it.
 */
export function FaqList({ variant }: { variant: "landing" | "member" }) {
  const { locale } = useLocale();
  const [query, setQuery] = useState("");
  const terms = fold(query).split(/\s+/).filter(Boolean);

  const index = useMemo(() => faq.items.map((item) => ({ id: item.id, text: haystack(item, locale) })), [locale]);
  const visible = new Set(index.filter((entry) => terms.every((term) => entry.text.includes(term))).map((entry) => entry.id));
  const shown = terms.length === 0 ? faq.items.length : visible.size;

  return (
    <div className="edu-faq">
      <div className="edu-search">
        <SearchIcon size={20} />
        <label className="sr-only" htmlFor={`faq-search-${variant}`}>{faq.searchLabel[locale]}</label>
        <input
          id={`faq-search-${variant}`}
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          value={query}
          placeholder={faq.searchPlaceholder[locale]}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <p className="edu-count" role="status" aria-live="polite">
        {terms.length > 0 && shown > 0 ? (shown === 1 ? faq.resultsOne[locale] : `${shown} ${faq.resultsMany[locale]}`) : ""}
      </p>

      {faq.items.map((item) => {
        const detailsProps = { name: `faq-${variant}` } as Record<string, string>;
        return (
          <details key={item.id} hidden={terms.length > 0 && !visible.has(item.id)} {...detailsProps}>
            <summary>{item.question[locale]}</summary>
            <div className="answer">
              {item.answer.map((paragraph) => <p key={paragraph.en}>{paragraph[locale]}</p>)}
              {item.more && (variant === "landing"
                ? <a className="edu-text-link" href={item.more.landing}>{item.more.label[locale]}<ArrowRightIcon size={16} /></a>
                : <Link className="edu-text-link" href={item.more.member}>{item.more.label[locale]}<ArrowRightIcon size={16} /></Link>)}
            </div>
          </details>
        );
      })}

      <p className="edu-empty" hidden={terms.length === 0 || shown > 0}>{faq.noMatch[locale]}</p>
    </div>
  );
}
