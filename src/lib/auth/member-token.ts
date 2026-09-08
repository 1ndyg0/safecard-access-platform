import { createHmac, timingSafeEqual } from "node:crypto";

export const MEMBER_SESSION_SECONDS = 30 * 60;
export type MemberSession = { caseId: string; exp: number };

function secret() {
  const value = process.env.MEMBER_SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("MEMBER_SESSION_SECRET must be at least 32 characters");
  return value;
}

function signature(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function createMemberToken(caseId: string, now = Date.now()) {
  const payload = Buffer.from(JSON.stringify({ caseId, exp: Math.floor(now / 1000) + MEMBER_SESSION_SECONDS })).toString("base64url");
  return `${payload}.${signature(payload)}`;
}

export function verifyMemberToken(token: string | undefined, now = Date.now()): MemberSession | null {
  if (!token) return null;
  const [payload, supplied] = token.split(".");
  if (!payload || !supplied) return null;
  const expected = signature(payload);
  const suppliedBuffer = Buffer.from(supplied);
  const expectedBuffer = Buffer.from(expected);
  if (suppliedBuffer.length !== expectedBuffer.length || !timingSafeEqual(suppliedBuffer, expectedBuffer)) return null;
  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as MemberSession;
    if (!session.caseId || !session.exp || session.exp <= Math.floor(now / 1000)) return null;
    return session;
  } catch {
    return null;
  }
}
