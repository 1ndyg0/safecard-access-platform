import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  formatCount,
  formatHours,
  formatRate,
  unavailableLabel,
} from '../../components/admin/analytics-types';

/**
 * Suppression itself is enforced in SQL, so these tests cover the two
 * things that can still go wrong in the application:
 *
 *   1. A suppressed measure must never be rendered as a number. If a
 *      formatter falls back to 0 on a suppressed value, the whole
 *      threshold is decorative.
 *   2. The threshold and the complementary rule must stay in the
 *      migration. Lowering 5 to 1, or dropping the complement check,
 *      would silently re-expose small cohorts.
 *
 * The 4-versus-5 boundary is exercised against a real database in
 * e2e/analytics-suppression.spec.ts.
 */

const MIGRATION = readFileSync(
  join(process.cwd(), 'supabase/migrations/00010_admin_operations_views.sql'),
  'utf8',
);

describe('suppressed measures never render a number', () => {
  it('shows a reason instead of a rate', () => {
    const suppressed = {
      available: false as const,
      suppressed: true,
      reason: 'cohort_below_threshold' as const,
    };
    const rendered = formatRate(suppressed, 5);
    expect(rendered).toBe('Hidden — fewer than 5 cases');
    expect(rendered).not.toMatch(/\d+\.\d%/);
  });

  it('shows a reason instead of a count', () => {
    const rendered = formatCount(
      { available: false, suppressed: true, reason: 'cohort_below_threshold' },
      5,
    );
    expect(rendered).toBe('Hidden — fewer than 5 cases');
    expect(Number.isNaN(Number(rendered))).toBe(true);
  });

  it('distinguishes "no data yet" from "hidden"', () => {
    expect(formatCount({ available: false, suppressed: false, reason: 'no_data' }, 5)).toBe(
      'No data yet',
    );
  });

  it('says a measure is untracked rather than reporting zero', () => {
    expect(
      formatRate({ available: false, suppressed: false, reason: 'no_upload_telemetry' }, 5),
    ).toBe('Not tracked yet — no upload telemetry');
    expect(
      formatRate(
        { available: false, suppressed: false, reason: 'no_application_review_state' },
        5,
      ),
    ).toBe('Not tracked yet — awaiting application review states');
  });

  it('renders real values when the cohort is large enough', () => {
    expect(formatRate({ available: true, suppressed: false, rate: 0.625, cohort_size: 40 }, 5)).toBe(
      '62.5%',
    );
    expect(formatCount({ available: true, suppressed: false, count: 12 }, 5)).toBe('12');
    expect(
      formatHours({ available: true, suppressed: false, hours: 18.25, cohort_size: 9 }, 5),
    ).toBe('18.3 h');
  });

  it('discloses a genuine zero, which is not a small cohort', () => {
    expect(formatCount({ available: true, suppressed: false, count: 0 }, 5)).toBe('0');
  });

  it('reports the threshold it was given rather than a hard-coded 5', () => {
    expect(unavailableLabel('cohort_below_threshold', 10)).toBe('Hidden — fewer than 10 cases');
  });
});

describe('the migration keeps its privacy guarantees', () => {
  it('sets the suppression threshold to 5', () => {
    expect(MIGRATION).toMatch(/admin_suppression_threshold\(\)[\s\S]*?select 5;/);
  });

  it('suppresses the complement, not only the small cell', () => {
    // Without this, a suppressed cohort is recoverable by subtracting
    // the disclosed one from the denominator.
    expect(MIGRATION).toContain('(p_denominator - p_numerator) < public.admin_suppression_threshold()');
  });

  it('suppresses on the numerator as well as the denominator', () => {
    expect(MIGRATION).toContain('p_numerator < public.admin_suppression_threshold()');
  });

  it('does not expose identifiers through an aggregate', () => {
    const analytics = MIGRATION.slice(MIGRATION.indexOf('admin_campaign_analytics'));
    for (const column of [
      'first_name',
      'last_name',
      'mobile_number',
      'email',
      'application_ref',
      'date_of_birth',
    ]) {
      expect(analytics).not.toContain(column);
    }
  });

  it('does not grant aggregate functions to browser-facing roles', () => {
    expect(MIGRATION).toContain(
      'revoke all on function public.admin_dashboard_counts(uuid) from public, anon, authenticated',
    );
    expect(MIGRATION).toContain(
      'revoke all on function public.admin_campaign_analytics(uuid) from public, anon, authenticated',
    );
  });

  it('adds no table, column or enum owned by the database module', () => {
    expect(MIGRATION).not.toMatch(/\balter table\b/i);
    expect(MIGRATION).not.toMatch(/\bdrop table\b/i);
    expect(MIGRATION).not.toMatch(/\bcreate table\b/i);
    expect(MIGRATION).not.toMatch(/\bcreate type\b/i);
    expect(MIGRATION).not.toMatch(/\balter type\b/i);
  });
});
