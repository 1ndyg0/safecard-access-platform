import { afterEach, describe, expect, it } from "vitest";
import { createMemberToken, verifyMemberToken } from "./member-token";

const original = process.env.MEMBER_SESSION_SECRET;
afterEach(() => { process.env.MEMBER_SESSION_SECRET = original; });

describe("member session", () => {
  it("accepts a signed unexpired session", () => {
    process.env.MEMBER_SESSION_SECRET = "test-secret-that-is-longer-than-thirty-two-characters";
    const token = createMemberToken("case-1", 1_000);
    expect(verifyMemberToken(token, 2_000)?.caseId).toBe("case-1");
  });

  it("rejects tampering and expiry", () => {
    process.env.MEMBER_SESSION_SECRET = "test-secret-that-is-longer-than-thirty-two-characters";
    const token = createMemberToken("case-1", 1_000);
    expect(verifyMemberToken(token + "x", 2_000)).toBeNull();
    expect(verifyMemberToken(token, 31 * 60 * 1_000)).toBeNull();
  });
});
