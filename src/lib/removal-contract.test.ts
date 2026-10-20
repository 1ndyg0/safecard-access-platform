import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const MIGRATION = readFileSync(
  join(ROOT, 'supabase/migrations/00022_remove_ambassador_prc_finance.sql'),
  'utf8',
);
/** The migration without its explanatory comments, for pattern checks. */
const STATEMENTS = MIGRATION.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts') ? [path] : [];
  });
}

describe('ambassador, PRC export, finance role and MFA enrolment are removed', () => {
  it.each([
    'src/app/ambassador',
    'src/app/r',
    'src/app/api/referrals',
    'src/app/api/sponsors',
    'src/app/api/export',
    'src/app/admin/export',
    'src/app/admin/security',
    'src/app/api/admin/cases/[id]/payment',
    'src/app/api/payment/verify',
    'src/components/AmbassadorDashboard.tsx',
    'src/components/admin/ExportConsole.tsx',
    'src/components/admin/MfaPanel.tsx',
    'src/components/admin/PaymentActions.tsx',
    'src/lib/export',
    'src/lib/referrals',
    'src/lib/sponsors',
  ])('has no %s', (path) => {
    expect(existsSync(join(ROOT, path))).toBe(false);
  });

  it('keeps the approval route, the proof request route and the member card', () => {
    for (const path of [
      'src/app/api/admin/cases/[id]/approve-with-payment/route.ts',
      'src/app/api/admin/cases/[id]/request-payment-proof/route.ts',
      'src/app/api/payment/evidence/[id]/route.ts',
      'src/app/api/member/card/route.ts',
      'src/app/member/card/page.tsx',
      'src/lib/member/approved.ts',
    ]) {
      expect(existsSync(join(ROOT, path)), path).toBe(true);
    }
  });

  it('no source file queries a removed table or column', () => {
    const forbidden = [
      /\.from\(\s*['"](sponsors|referral_links|relationships|prc_export_batches|prc_export_items)['"]/,
      /prc_handoff_state/,
      /referral_link_id/,
      /payer_sponsor_id/,
      /['"]prc_liaison['"]/,
      /['"]finance_export['"]/,
      /auth\.mfa/,
    ];
    const offenders: string[] = [];
    for (const file of sourceFiles(join(ROOT, 'src'))) {
      if (file.endsWith('src/types/database.ts')) continue;
      const text = readFileSync(file, 'utf8');
      for (const pattern of forbidden) {
        if (pattern.test(text)) offenders.push(`${file}: ${pattern}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe('the removal migration', () => {
  it('drops every removed table, function and type', () => {
    for (const table of ['relationships', 'referral_links', 'sponsors', 'prc_export_items', 'prc_export_batches']) {
      expect(MIGRATION).toContain(`drop table if exists public.${table};`);
    }
    for (const fn of [
      'create_prc_export_batch_atomic',
      'acknowledge_prc_export_item_atomic',
      'increment_referral_visits',
      'increment_referral_starts',
      'is_case_sponsor',
    ]) {
      expect(MIGRATION).toContain(`drop function if exists public.${fn}(`);
    }
    expect(MIGRATION).toContain('drop type if exists public.relationship_type;');
    expect(MIGRATION).toContain('drop type if exists public.prc_handoff_state;');
  });

  it('never cascades, so an unexpected dependency fails instead of taking data with it', () => {
    expect(STATEMENTS.toLowerCase()).not.toMatch(/\bcascade\b/);
  });

  it('does not weaken or disable any immutability trigger or delete kept records', () => {
    const lower = STATEMENTS.toLowerCase();
    expect(lower).not.toMatch(/disable\s+trigger/);
    expect(lower).not.toMatch(/drop\s+trigger/);
    expect(lower).not.toMatch(/session_replication_role/);
    expect(lower).not.toMatch(/truncate/);
    for (const kept of [
      'recipient_cases', 'recipient_profiles', 'consent_records', 'application_submissions',
      'payment_intents', 'payment_evidence', 'payment_evidence_versions', 'audit_events',
      'application_review_decisions', 'membership_status_events',
    ]) {
      expect(lower, `must not delete from ${kept}`).not.toMatch(new RegExp(`delete\\s+from\\s+public\\.${kept}\\b`));
      expect(lower, `must not drop ${kept}`).not.toMatch(new RegExp(`drop\\s+table[^;]*public\\.${kept}\\b`));
    }
  });

  it('refuses to run over export history', () => {
    expect(MIGRATION).toContain('Refusing to drop prc_export_batches');
    expect(MIGRATION).toContain('Refusing to drop prc_export_items');
  });

  it('blocks the retired roles instead of pretending an enum label can be dropped', () => {
    expect(MIGRATION).toContain('role_assignments_retired_roles_chk');
    expect(MIGRATION).toContain("check (role not in ('prc_liaison', 'finance_export'))");
  });

  it('checks its own post-conditions inside the migration', () => {
    expect(MIGRATION).toContain('Kept relations are missing after the removal');
    expect(MIGRATION).toContain('An immutability trigger is missing after the removal');
  });
});
