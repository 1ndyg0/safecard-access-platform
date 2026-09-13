import { describe, expect, it } from 'vitest';
import { contentSecurityPolicy } from './content-security-policy';

describe('configured API and private image sources', () => {
  it('permits browser Auth and signed images from the disposable local stack', () => {
    const policy = contentSecurityPolicy('http://127.0.0.1:54321');
    expect(policy).toContain("connect-src 'self' http://127.0.0.1:54321");
    expect(policy).toContain("img-src 'self' data: blob: http://127.0.0.1:54321");
  });
  it('limits hosted access to the configured origin', () => {
    const policy = contentSecurityPolicy('https://project.supabase.co/');
    expect(policy).toContain("connect-src 'self' https://project.supabase.co");
    expect(policy).not.toContain('*');
  });
  for (const value of [undefined, 'javascript:alert(1)', 'http://external.example.test', 'https://user:password@project.supabase.co']) {
    it(`fails closed for ${value ?? 'missing configuration'}`, () => {
      expect(contentSecurityPolicy(value)).toMatch(/connect-src 'self'$/);
    });
  }
});
