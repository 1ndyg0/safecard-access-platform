import "server-only";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { ProgramDocument } from "./registry";

/** Directory holding the official PDFs. It sits outside `public/` so nothing is served without a route. */
export const DOCUMENTS_DIRECTORY = path.join(process.cwd(), "content", "documents");

export class DocumentIntegrityError extends Error {
  constructor(slug: string) {
    super(`Document ${slug} does not match the pinned registry entry.`);
    this.name = "DocumentIntegrityError";
  }
}

const verified = new Map<string, Buffer>();

/**
 * Read a document and confirm it is exactly the registered file.
 * The check runs once per server instance and the verified bytes are kept,
 * so repeat downloads cost a memory copy, not a re-hash.
 */
export async function readDocument(document: ProgramDocument): Promise<Buffer> {
  const cached = verified.get(document.slug);
  if (cached) return cached;
  const bytes = await readFile(path.join(DOCUMENTS_DIRECTORY, document.file));
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (bytes.byteLength !== document.bytes || digest !== document.sha256) {
    throw new DocumentIntegrityError(document.slug);
  }
  verified.set(document.slug, bytes);
  return bytes;
}
