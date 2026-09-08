import { NextResponse } from "next/server";
import { MEMBER_COOKIE, memberCookieOptions } from "@/lib/auth/member-session";

export async function POST() {
  const response = NextResponse.json({ loggedOut: true });
  response.cookies.set(MEMBER_COOKIE, "", { ...memberCookieOptions, maxAge: 0 });
  return response;
}
