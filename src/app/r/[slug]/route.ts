import { NextRequest, NextResponse } from "next/server";

export function GET(request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  return context.params.then(({ slug }) => NextResponse.redirect(new URL(`/apply?ref=${encodeURIComponent(slug)}`, request.url)));
}
