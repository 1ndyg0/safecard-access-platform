import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * These assertions guard properties that live in SQL and in route
 * wiring rather than in a function that can be called from a test. They
 * are cheap, and each one corresponds to a way this module could quietly
 * stop being privacy-safe during a later change.
 */

const read = (path: string) => readFileSync(join(process.cwd(), path), 'utf8');

const MIGRATION = read('supabase/migrations/00013_storyboard_analytics.sql');
const COLLECT_ROUTE = read('src/app/api/analytics/storyboard/route.ts');
const REPORT_ROUTE = read('src/app/api/admin/analytics/storyboard/route.ts');
const CONTENT_ROUTE = read('src/app/api/content/storyboard/route.ts');
const GOVERNED = read('src/lib/storyboard/governed.ts');

describe('the event table cannot hold personal data', () => {
  it('defines no identifying column', () => {
    const table = MIGRATION.slice(
      MIGRATION.indexOf('create table public.storyboard_events'),
      MIGRATION.indexOf('create index idx_storyboard_events_occurred'),
    );
    for (const column of [
      'case_id',
      'application_ref',
      'mobile',
      'email',
      'first_name',
      'last_name',
      'ip_address',
      'user_agent',
      'referral',
    ]) {
      expect(table, `${column} must not exist`).not.toContain(column);
    }
  });

  it('constrains benefit id, event name and locale to closed sets', () => {
    expect(MIGRATION).toMatch(/benefit_id\s+text not null check/);
    expect(MIGRATION).toMatch(/event_name\s+text not null check/);
    expect(MIGRATION).toMatch(/locale\s+text not null check/);
  });

  it('bounds duration so a numeric column cannot carry a payload', () => {
    expect(MIGRATION).toContain('duration_ms <= 1800000');
  });
});

describe('raw events cannot be enumerated publicly', () => {
  it('revokes browser-facing roles and enables row level security', () => {
    expect(MIGRATION).toContain(
      'revoke all on public.storyboard_events from public, anon, authenticated',
    );
    expect(MIGRATION).toContain('alter table public.storyboard_events enable row level security');
    // RLS on with no policy: anon and authenticated read nothing.
    expect(MIGRATION).not.toMatch(/create policy[\s\S]*storyboard_events/i);
  });

  it('exposes only the aggregate function to staff', () => {
    expect(REPORT_ROUTE).toContain("rpc('storyboard_analytics'");
    expect(REPORT_ROUTE).not.toContain("from('storyboard_events')");
    expect(REPORT_ROUTE).toContain('requireStaffAuth');
    expect(REPORT_ROUTE).toContain('requireAnyStaffRole');
  });
});

describe('aggregates suppress small cohorts', () => {
  it('sets the threshold to five', () => {
    expect(MIGRATION).toMatch(/storyboard_suppression_threshold\(\)[\s\S]*?select 5;/);
  });

  it('suppresses the complement as well as the cell', () => {
    // Without this a small completion count is recoverable by
    // subtracting from the opened count.
    expect(MIGRATION).toContain('(opened_visits - completed_visits) >= v_threshold');
  });

  it('suppresses the denominator itself when visits are few', () => {
    expect(MIGRATION).toContain("case when v_visits >= v_threshold");
  });

  it('counts distinct visits, not raw events', () => {
    // Counting events would let one enthusiastic reader look like a trend.
    expect(MIGRATION).toContain('count(distinct visit_id)');
  });
});

describe('collection is rate limited and never blocks the page', () => {
  it('enforces a rate limit', () => {
    expect(COLLECT_ROUTE).toContain("enforceRateLimit(request, 'storyboard-analytics'");
    expect(COLLECT_ROUTE).toContain('429');
  });

  it('returns no body, so nothing is worth waiting for', () => {
    expect(COLLECT_ROUTE).toContain('status: 204');
  });

  it('rejects an invalid payload instead of coercing it', () => {
    expect(COLLECT_ROUTE).toContain('storyboardEventBatchSchema.safeParse');
    expect(COLLECT_ROUTE).toContain('status: 400');
  });
});

describe('governed content degrades safely', () => {
  it('loads only approved and published content', () => {
    expect(GOVERNED).toContain("eq('approval_status', 'approved')");
    expect(GOVERNED).toContain("eq('is_published', true)");
  });

  it('bounds the registry read', () => {
    expect(GOVERNED).toContain('REGISTRY_TIMEOUT_MS');
    expect(GOVERNED).toContain('withTimeout');
  });

  it('treats a malformed approved payload like an absent one', () => {
    expect(GOVERNED).toContain("unavailable('malformed')");
  });

  it('keeps fallback available for synthetic mode and fails closed in live mode', () => {
    expect(CONTENT_ROUTE).toContain('status: 200');
    expect(CONTENT_ROUTE).toContain('status: 503');
    expect(GOVERNED).toContain("mode === 'live'");
  });

  it('assembles the provenance envelope on the server', () => {
    // An editor must not be able to mark their own draft "approved".
    expect(GOVERNED).toContain("provenance: 'approved'");
  });
});
