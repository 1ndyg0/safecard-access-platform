import "server-only";

import { cookies } from "next/headers";
import { verifyMemberToken, MEMBER_SESSION_SECONDS } from "./member-token";
import { AuthError } from "./session";

export { createMemberToken, verifyMemberToken } from "./member-token";

export const MEMBER_COOKIE = "sc_member_session";
export async function requireMemberSession() {
  const store = await cookies();
  const session = verifyMemberToken(store.get(MEMBER_COOKIE)?.value);
  if (!session) throw new AuthError("Member authentication required");
  return session;
}

export function memberCookieIsSecure(
  appUrl = process.env.NEXT_PUBLIC_APP_URL,
  nodeEnv = process.env.NODE_ENV,
): boolean {
  try {
    const parsed = new URL(appUrl ?? "");
    if (parsed.protocol === "https:") return true;
    if (
      parsed.protocol === "http:" &&
      ["127.0.0.1", "localhost", "[::1]"].includes(parsed.hostname)
    ) return false;
  } catch {
    // Production falls back to a secure cookie when configuration is absent or invalid.
  }
  return nodeEnv === "production";
}

export const memberCookieOptions = {
  httpOnly: true,
  secure: memberCookieIsSecure(),
  sameSite: "lax" as const,
  path: "/",
  maxAge: MEMBER_SESSION_SECONDS,
};
