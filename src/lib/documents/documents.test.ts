import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const requireMemberSession = vi.fn();
vi.mock("@/lib/auth/member-session", () => ({ requireMemberSession: () => requireMemberSession() }));

import { GET } from "@/app/api/documents/[slug]/route";
import { DocumentIntegrityError } from "./files";
import * as files from "./files";
import { DOCUMENTS, documentHref, findDocument, formatBytes } from "./registry";

const directory = path.join(process.cwd(), "content", "documents");

function call(slug: string, query = "") {
  return GET(new Request(`http://localhost/api/documents/${slug}${query}`), { params: Promise.resolve({ slug }) });
}

describe("document registry", () => {
  it("pins each file by size and SHA-256", () => {
    for (const document of DOCUMENTS) {
      const bytes = readFileSync(path.join(directory, document.file));
      expect(bytes.byteLength, `${document.slug} size`).toBe(document.bytes);
      expect(createHash("sha256").update(bytes).digest("hex"), `${document.slug} sha256`).toBe(document.sha256);
      expect(bytes.subarray(0, 5).toString("latin1"), `${document.slug} is a PDF`).toBe("%PDF-");
    }
  });

  it("keeps every document under the 4.5 MB limit of a function response", () => {
    for (const document of DOCUMENTS) expect(document.bytes, document.slug).toBeLessThan(4_500_000);
  });

  it("has unique slugs and file names", () => {
    expect(new Set(DOCUMENTS.map((document) => document.slug)).size).toBe(DOCUMENTS.length);
    expect(new Set(DOCUMENTS.map((document) => document.file)).size).toBe(DOCUMENTS.length);
    expect(new Set(DOCUMENTS.map((document) => document.downloadName)).size).toBe(DOCUMENTS.length);
  });

  it("makes only the member guide members-only", () => {
    expect(DOCUMENTS.filter((document) => document.audience === "member").map((document) => document.slug)).toEqual(["member-guide"]);
  });

  it("builds links and sizes", () => {
    expect(documentHref("faqs")).toBe("/api/documents/faqs");
    expect(documentHref("member-guide", { view: true, page: 8 })).toBe("/api/documents/member-guide?view=1#page=8");
    expect(formatBytes(1_326_043)).toBe("1.3 MB");
    expect(formatBytes(2_702_673)).toBe("2.7 MB");
    expect(formatBytes(800)).toBe("1 KB");
    expect(findDocument("nope")).toBeUndefined();
  });
});

describe("GET /api/documents/[slug]", () => {
  beforeEach(() => {
    requireMemberSession.mockReset();
  });

  it("downloads a public document without a session", async () => {
    const response = await call("faqs");
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/pdf");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="Safe-Card-FAQs.pdf"');
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    const body = Buffer.from(await response.arrayBuffer());
    expect(body.byteLength).toBe(Number(response.headers.get("content-length")));
    expect(createHash("sha256").update(body).digest("hex")).toBe(findDocument("faqs")!.sha256);
    expect(requireMemberSession).not.toHaveBeenCalled();
  });

  it("opens in the browser viewer when asked", async () => {
    const response = await call("program-overview", "?view=1");
    expect(response.headers.get("content-disposition")).toBe('inline; filename="Safe-Card-Program-Overview.pdf"');
  });

  it("refuses the member guide without a member session", async () => {
    requireMemberSession.mockRejectedValue(new Error("Member authentication required"));
    const response = await call("member-guide");
    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("content-disposition")).toBeNull();
    expect(await response.json()).toEqual({ error: "Member authentication required." });
  });

  it("serves the member guide privately to a signed-in member", async () => {
    requireMemberSession.mockResolvedValue({ caseId: "case-1", exp: 9_999_999_999 });
    const response = await call("member-guide");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("content-disposition")).toBe('attachment; filename="PRC-Safe-Card-Member-Guide-2026.pdf"');
    expect(Number(response.headers.get("content-length"))).toBe(findDocument("member-guide")!.bytes);
  });

  it("answers 404 for an unknown document and never checks a session for it", async () => {
    const response = await call("../../etc/passwd");
    expect(response.status).toBe(404);
    expect((await call("nothing")).status).toBe(404);
    expect(requireMemberSession).not.toHaveBeenCalled();
  });

  it("answers 503, not a corrupt file, when a document no longer matches its pin", async () => {
    const spy = vi.spyOn(files, "readDocument").mockRejectedValue(new DocumentIntegrityError("faqs"));
    const response = await call("faqs");
    expect(response.status).toBe(503);
    expect(response.headers.get("content-type")).toContain("application/json");
    spy.mockRestore();
  });
});
