"use client";

import Image from "next/image";
import Link from "next/link";
import { DownloadIcon, ExternalLinkIcon } from "@/components/icons";
import { downloads } from "@/lib/education/content";
import { documentHref, formatBytes, type ProgramDocument } from "@/lib/documents/registry";
import "./education.css";

type Props = {
  document: ProgramDocument;
  locale: "fil" | "en";
  /** Landing page: download and open. Library: read online, download and open. */
  readHref?: string;
  readLabel?: string;
  headingLevel?: 2 | 3;
  className?: string;
};

/** "PDF · 19 slides · English · 1.3 MB": what the file is, before anyone taps. */
export function documentMeta(document: ProgramDocument, locale: "fil" | "en"): string {
  const unit = document.unit === "slides" ? downloads.slides[locale] : downloads.pages[locale];
  return `PDF · ${document.pageCount} ${unit} · ${downloads.englishOnly[locale]} · ${formatBytes(document.bytes)}`;
}

export function DocumentCard({ document, locale, readHref, readLabel, headingLevel = 3, className = "" }: Props) {
  const item = downloads.items[document.slug];
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const openLabel = locale === "fil" ? "Buksan sa browser" : "Open in browser";
  const title = document.title[locale];
  return (
    <article className={className || "edu-doc"}>
      <Link className="edu-doc-thumb" style={readHref ? { aspectRatio: `${item.thumbnail.width} / ${item.thumbnail.height}` } : undefined} href={readHref ?? documentHref(document.slug, { view: true })} {...(readHref ? {} : { target: "_blank", rel: "noopener" })} aria-hidden="true" tabIndex={-1}>
        <Image src={item.thumbnail.src} width={item.thumbnail.width} height={item.thumbnail.height} alt="" unoptimized />
      </Link>
      <div>
        <Heading>{title}</Heading>
        <p>{item.description[locale]}</p>
        <p className="edu-doc-meta">{documentMeta(document, locale)}</p>
        <div className="edu-doc-actions">
          {readHref && <Link className="button-primary" href={readHref}>{readLabel}</Link>}
          <a className={readHref ? "button-quiet" : "button-primary"} href={documentHref(document.slug)} download={document.downloadName}>
            <DownloadIcon size={18} /><span>{downloads.download[locale]}<span className="sr-only">: {title}</span></span>
          </a>
          <a className="button-quiet" href={documentHref(document.slug, { view: true })} target="_blank" rel="noopener">
            <ExternalLinkIcon size={18} /><span>{openLabel}<span className="sr-only">: {title}</span></span>
          </a>
        </div>
      </div>
    </article>
  );
}
