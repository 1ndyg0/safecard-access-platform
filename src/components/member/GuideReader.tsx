"use client";

import { useEffect, useState } from "react";
import { DownloadIcon, ExternalLinkIcon } from "@/components/icons";
import { useLocale } from "@/components/LocaleProvider";
import { library } from "@/lib/education/content";
import { documentHref, findDocument, formatBytes } from "@/lib/documents/registry";
import { GUIDE_INTRO, GUIDE_TITLE, guideSections, type GuideBlock, type GuideSection } from "@/lib/education/guide";
import "@/components/education/education.css";

function Block({ block }: { block: GuideBlock }) {
  switch (block.type) {
    case "p":
      return <p>{block.text}</p>;
    case "h3":
      return <h3>{block.text}</h3>;
    case "ul":
      return <ul>{block.items.map((item) => <li key={item}>{item}</li>)}</ul>;
    case "callout":
      return <p className={`reader-callout ${block.tone === "warn" ? "warn" : ""}`} role="note">{block.text}</p>;
    case "table":
      return (
        <div className="reader-table-wrap" role="region" tabIndex={0} aria-label={block.head.join(", ")}>
          <table className="reader-table">
            <thead><tr>{block.head.map((cell) => <th key={cell} scope="col">{cell}</th>)}</tr></thead>
            <tbody>
              {block.rows.map((row) => (
                <tr key={row[0]}>
                  {row.map((cell, index) => (index === 0 && block.firstColumnHeader
                    ? <th key={index} scope="row">{cell}</th>
                    : <td key={index}>{cell}</td>))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    case "steps":
      return (
        <ol className="reader-steps">
          {block.items.map((item) => <li key={item.title}><strong>{item.title}</strong><span>{item.text}</span></li>)}
        </ol>
      );
    case "claimDocs":
      return (
        <div className="reader-claimdocs">
          {block.rows.map((row) => (
            <section key={row.claim} aria-label={row.claim}>
              <h3>{row.claim}</h3>
              <ul>{row.items.map((item) => <li key={item}>{item}</li>)}</ul>
              <p className="chapter">{row.chapter}</p>
            </section>
          ))}
        </div>
      );
    case "pdfLink":
      return (
        <p>
          <a className="button-quiet" href={documentHref("member-guide", { view: true, page: block.page })} target="_blank" rel="noopener">
            <ExternalLinkIcon size={18} /><span>{block.label}</span>
          </a>
        </p>
      );
  }
}

function SectionView({ section }: { section: GuideSection }) {
  return (
    <section className="reader-section" id={section.id} aria-labelledby={`${section.id}-title`}>
      <header>
        {section.number && <span className="num" aria-hidden="true">{section.number}</span>}
        <h2 id={`${section.id}-title`}>{section.number && <span className="sr-only">{section.number}. </span>}{section.title}</h2>
      </header>
      {section.blocks.map((block, index) => <Block key={index} block={block} />)}
      <a className="reader-source" href={documentHref("member-guide", { view: true, page: section.page })} target="_blank" rel="noopener">
        <ExternalLinkIcon size={14} />Original: Member Guide 2026, page {section.page}
      </a>
    </section>
  );
}

/**
 * The Member Guide as a page: a section list beside the text on large
 * screens, a jump menu on phones, the original page for every section, and
 * the PDF to download, open or print.
 */
export function GuideReader() {
  const { locale } = useLocale();
  const guide = findDocument("member-guide")!;
  const [active, setActive] = useState<string>(guideSections[0].id);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => { for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id); },
      { rootMargin: "-15% 0px -75% 0px" },
    );
    for (const section of guideSections) {
      const element = document.getElementById(section.id);
      if (element) observer.observe(element);
    }
    return () => observer.disconnect();
  }, []);

  /** A link such as /member/library/guide#claims should land on its section after the page renders. */
  useEffect(() => {
    const id = window.location.hash.slice(1);
    if (id && document.getElementById(id)) document.getElementById(id)!.scrollIntoView();
  }, []);

  function jump(id: string) {
    setActive(id);
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", `#${id}`);
  }

  const label = (section: GuideSection) => `${section.number ? `${section.number} ` : ""}${section.title}`;

  return (
    <section className="library-card" aria-labelledby="guide-title">
      <p className="eyebrow">{library.eyebrow[locale]}</p>
      <h1 id="guide-title">{GUIDE_TITLE}</h1>
      <p className="lede" lang="en">{GUIDE_INTRO}</p>
      {locale === "fil" && <p className="library-notice">{library.languageNotice.fil}</p>}
      <div className="reader-actions">
        <a className="button-primary" href={documentHref("member-guide")} download={guide.downloadName}>
          <DownloadIcon size={18} /><span>{locale === "fil" ? "I-download ang PDF" : "Download the PDF"} · {formatBytes(guide.bytes)}</span>
        </a>
        <a className="button-quiet" href={documentHref("member-guide", { view: true })} target="_blank" rel="noopener">
          <ExternalLinkIcon size={18} /><span>{locale === "fil" ? "Buksan ang orihinal" : "Open the original"}</span>
        </a>
      </div>

      <div className="reader" lang="en">
        <nav className="reader-toc" aria-label="Guide sections">
          <h2>In this guide</h2>
          <ol>
            {guideSections.map((section) => (
              <li key={section.id}>
                <a href={`#${section.id}`} aria-current={active === section.id ? "true" : undefined} onClick={() => setActive(section.id)}>
                  <span className="num" aria-hidden="true">{section.number}</span><span>{section.title}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="reader-body">
          <div className="reader-toc-mobile">
            <label htmlFor="guide-jump">Jump to a section</label>
            <select id="guide-jump" value={active} onChange={(event) => jump(event.target.value)}>
              {guideSections.map((section) => <option key={section.id} value={section.id}>{label(section)}</option>)}
            </select>
          </div>
          {guideSections.map((section) => <SectionView key={section.id} section={section} />)}
        </div>
      </div>
    </section>
  );
}
