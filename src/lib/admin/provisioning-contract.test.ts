import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const callback = readFileSync(join(process.cwd(), 'src/app/auth/callback/route.ts'), 'utf8');
const setup = readFileSync(join(process.cwd(), 'src/components/admin/AdminPasswordSetup.tsx'), 'utf8');

describe('first-administrator password setup contract', () => {
  it('routes a bootstrapped administrator through the authenticated password setup screen', () => {
    expect(callback).toContain("requestedNext === '/admin/setup'");
    expect(setup).toContain('supabase.auth.updateUser({ password })');
    expect(setup).toContain('minLength={12}');
  });

  it('does not embed a service key in the setup screen', () => {
    expect(setup).not.toContain('SUPABASE_SERVICE_ROLE_KEY');
  });
});
