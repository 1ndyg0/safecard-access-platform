import { beforeEach, describe, expect, it, vi } from 'vitest';

const fixture = vi.hoisted(() => ({
  assignments: [] as { id: string; role: string; campaign_id: string | null; organization_id: string | null }[],
}));
vi.mock('@/lib/audit', () => ({ writeAuditEvent: vi.fn() }));
vi.mock('@/lib/auth/session', () => ({ getSessionClient: vi.fn() }));
vi.mock('@/lib/db/client', () => ({
  getSupabaseAdminClient: () => ({
    from: (table: string) => {
      const query = {
        select: () => query, eq: () => query, in: () => query, is: () => query, or: () => query,
        single: async () => ({ data: { organization_id: 'org-shared' }, error: null }),
        limit: async () => ({ data: fixture.assignments, error: null }),
        then: (resolve: (value: unknown) => unknown) => Promise.resolve({
          data: table === 'role_assignments' ? fixture.assignments : null, error: null,
        }).then(resolve),
      };
      return query;
    },
  }),
}));
import { requireAnyRole, requireRole } from './permissions';

describe('legacy permission entrypoints preserve campaign boundaries', () => {
  beforeEach(() => {
    fixture.assignments = [{ id: 'assignment', role: 'finance_export', campaign_id: 'campaign-a', organization_id: 'org-shared' }];
  });

  for (const check of [
    (campaign: string) => requireRole('staff', 'finance_export', campaign),
    (campaign: string) => requireAnyRole('staff', ['finance_export'], campaign),
  ]) {
    it('denies a sibling campaign when organization metadata is attached to a campaign role', async () => {
      expect((await check('campaign-b')).allowed).toBe(false);
    });
    it('allows the explicitly assigned campaign', async () => {
      expect((await check('campaign-a')).allowed).toBe(true);
    });
    it('allows a genuine organization-wide assignment in its organization', async () => {
      fixture.assignments[0].campaign_id = null;
      expect((await check('campaign-b')).allowed).toBe(true);
    });
  }

  it('does not treat a campaign role as an organization administrator', async () => {
    expect((await requireAnyRole('staff', ['finance_export'], undefined, 'org-shared')).allowed).toBe(false);
  });
});
