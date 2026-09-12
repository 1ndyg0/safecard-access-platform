import { afterEach, describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { memberCookieIsSecure } from './member-session';
import { createMemberToken, verifyMemberToken } from './member-token';

const original = process.env.MEMBER_SESSION_SECRET;
afterEach(() => { process.env.MEMBER_SESSION_SECRET = original; });

describe('member session', () => {
  it('accepts a signed unexpired session', () => {
    process.env.MEMBER_SESSION_SECRET = 'test-secret-that-is-longer-than-thirty-two-characters';
    const token = createMemberToken('case-1', 1_000);
    expect(verifyMemberToken(token, 2_000)?.caseId).toBe('case-1');
  });

  it('rejects tampering and expiry', () => {
    process.env.MEMBER_SESSION_SECRET = 'test-secret-that-is-longer-than-thirty-two-characters';
    const token = createMemberToken('case-1', 1_000);
    expect(verifyMemberToken(token + 'x', 2_000)).toBeNull();
    expect(verifyMemberToken(token, 31 * 60 * 1_000)).toBeNull();
  });
});

describe('member session cookie transport', () => {
  it('uses Secure on hosted HTTPS deployments', () => {
    expect(memberCookieIsSecure('https://preview.safecard.example', 'production')).toBe(true);
  });
  it('allows the disposable loopback HTTP production server', () => {
    expect(memberCookieIsSecure('http://127.0.0.1:3100', 'production')).toBe(false);
    expect(memberCookieIsSecure('http://localhost:3100', 'production')).toBe(false);
  });
  it('fails secure for an invalid production URL', () => {
    expect(memberCookieIsSecure('not a URL', 'production')).toBe(true);
    expect(memberCookieIsSecure('http://external.example', 'production')).toBe(true);
  });
});
