import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const callback = readFileSync(join(process.cwd(), 'src/app/auth/callback/route.ts'), 'utf8');
const invitation = readFileSync(join(process.cwd(), 'src/app/api/admin/users/route.ts'), 'utf8');
const setup = readFileSync(join(process.cwd(), 'src/components/admin/AdminPasswordSetup.tsx'), 'utf8');

describe('staff invitation bootstrap contract', () => {
  it('routes invited staff through the authenticated password setup screen', () => {
    expect(invitation).toContain('/auth/callback?next=/admin/setup');
    expect(callback).toContain("requestedNext === '/admin/setup'");
    expect(setup).toContain('supabase.auth.updateUser({ password })');
    expect(setup).toContain('minLength={12}');
  });

  it('does not embed or generate a password server-side', () => {
    expect(invitation).not.toMatch(/password\s*:/);
    expect(setup).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });
});
