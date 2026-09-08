import "server-only";

import { cookies } from "next/headers";
import { verifyMemberToken, MEMBER_SESSION_SECONDS } from "./member-token";

export { createMemberToken, verifyMemberToken } from "./member-token";

export const MEMBER_COOKIE = "sc_member_session";
export async function requireMemberSession() {
  const store = await cookies();
  const session = verifyMemberToken(store.get(MEMBER_COOKIE)?.value);
  if (!session) throw new Error("Member authentication required");
  return session;
}

export const memberCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: MEMBER_SESSION_SECONDS,
};
