/**
 * Official Safe Card documents offered for reading and download.
 *
 * Each entry pins one exact file: its size, page count and SHA-256. A unit
 * test re-hashes the files in `content/documents`, so a document cannot be
 * replaced, truncated or re-exported without this registry (and a reviewer)
 * noticing. Update the entry in the same commit as the file.
 *
 * Audience:
 *   - "public": the prospect-facing documents (landing page).
 *   - "member": available only after a member signs in.
 *
 * This module holds metadata only, so client components can import it. The
 * file system is touched in `files.ts`, which is server-only.
 */

export type DocumentAudience = "public" | "member";
export type DocumentSlug = "program-overview" | "faqs" | "member-guide";

export interface ProgramDocument {
  slug: DocumentSlug;
  audience: DocumentAudience;
  /** File inside `content/documents`. */
  file: string;
  /** File name offered to the browser when downloading. */
  downloadName: string;
  title: { en: string; fil: string };
  /** What `pageCount` counts, for the size line shown before the tap. */
  unit: "slides" | "pages";
  pageCount: number;
  bytes: number;
  sha256: string;
  /** The documents are published in English only. */
  language: "en";
}

export const DOCUMENTS: readonly ProgramDocument[] = [
  {
    slug: "program-overview",
    audience: "public",
    file: "safe-card-program-overview.pdf",
    downloadName: "Safe-Card-Program-Overview.pdf",
    title: { en: "Program overview", fil: "Program overview" },
    unit: "slides",
    pageCount: 19,
    bytes: 1326043,
    sha256: "19747002a55d112d2e1cdff56ec143ba6716fc102ef6b24160048889f729dd26",
    language: "en",
  },
  {
    slug: "faqs",
    audience: "public",
    file: "safe-card-faqs.pdf",
    downloadName: "Safe-Card-FAQs.pdf",
    title: { en: "Frequently asked questions", fil: "Mga madalas itanong" },
    unit: "pages",
    pageCount: 2,
    bytes: 2702673,
    sha256: "8030b0952ec77c4f6ab00ce5f34da4d6407f5b88d8cc479bb0c42e1a0b7e1967",
    language: "en",
  },
  {
    slug: "member-guide",
    audience: "member",
    file: "prc-safe-card-member-guide-2026.pdf",
    downloadName: "PRC-Safe-Card-Member-Guide-2026.pdf",
    title: { en: "Member Guide 2026", fil: "Member Guide 2026" },
    unit: "pages",
    pageCount: 59,
    bytes: 1389473,
    sha256: "3a7ba9a83c94d67a6263d402b748e2ce92967b261c386d9f8464cd8890f74180",
    language: "en",
  },
] as const;

export function findDocument(slug: string): ProgramDocument | undefined {
  return DOCUMENTS.find((document) => document.slug === slug);
}

export function documentHref(slug: DocumentSlug, options: { view?: boolean; page?: number } = {}): string {
  const base = `/api/documents/${slug}`;
  const query = options.view ? "?view=1" : "";
  const fragment = options.page ? `#page=${options.page}` : "";
  return `${base}${query}${fragment}`;
}

/** "1.3 MB" style size, in decimal megabytes as file managers show it. */
export function formatBytes(bytes: number): string {
  if (bytes >= 1_000_000) return `${(bytes / 1_000_000).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1_000))} KB`;
}
