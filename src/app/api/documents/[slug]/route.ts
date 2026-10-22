import { NextResponse } from "next/server";
import { requireMemberSession } from "@/lib/auth/member-session";
import { readDocument } from "@/lib/documents/files";
import { findDocument } from "@/lib/documents/registry";

/**
 * Official Safe Card PDFs.
 *
 *   GET /api/documents/{slug}          downloads the file
 *   GET /api/documents/{slug}?view=1   opens it in the browser's own viewer
 *
 * Public documents are open. Member documents require the member session
 * cookie; without it the answer is 401 and nothing about the file is
 * revealed. The PDF is only ever a top-level response, never embedded in a
 * page, so the site's frame and object restrictions stay as they are.
 */
export async function GET(request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const document = findDocument(slug);
  if (!document) return NextResponse.json({ error: "Document not found." }, { status: 404 });

  if (document.audience === "member") {
    try {
      await requireMemberSession();
    } catch {
      return NextResponse.json({ error: "Member authentication required." }, { status: 401, headers: { "Cache-Control": "private, no-store" } });
    }
  }

  let bytes: Buffer;
  try {
    bytes = await readDocument(document);
  } catch {
    return NextResponse.json({ error: "This document is temporarily unavailable." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }

  const inline = new URL(request.url).searchParams.get("view") === "1";
  return new NextResponse(new Uint8Array(bytes), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${document.downloadName}"`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": document.audience === "member" ? "private, no-store" : "public, max-age=3600",
    },
  });
}
