import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = process.cwd();
const MIGRATION = readFileSync(join(ROOT, 'supabase/migrations/00023_simplify_admin_review.sql'), 'utf8');
/** The migration without its explanatory comments, for pattern checks. */
const STATEMENTS = MIGRATION.split('\n').filter((line) => !line.trim().startsWith('--')).join('\n');

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) && !name.endsWith('.test.ts') ? [path] : [];
  });
}

describe('the administrator console is reduced to applications, approve and reject', () => {
  it.each([
    'src/app/admin/users',
    'src/app/admin/submissions',
    'src/app/api/admin/analytics/route.ts',
    'src/app/api/admin/users',
    'src/app/api/admin/roles',
    'src/app/api/admin/cases/[id]/audit',
    'src/app/api/admin/cases/[id]/correction',
    'src/app/api/admin/cases/[id]/request-payment-proof',
    'src/app/api/admin/cases/[id]/review',
    'src/components/admin/UserManagement.tsx',
    'src/components/admin/AnalyticsPanel.tsx',
    'src/components/admin/analytics-types.ts',
    'src/components/admin/AuditTimeline.tsx',
    'src/components/admin/CaseDetail.tsx',
    'src/components/admin/ReviewPanel.tsx',
    'src/components/admin/SubmissionsTable.tsx',
  ])('has no %s', (path) => {
    expect(existsSync(join(ROOT, path))).toBe(false);
  });

  it('keeps the screens and routes the console still uses', () => {
    for (const path of [
      'src/app/admin/page.tsx',
      'src/app/admin/applications/page.tsx',
      'src/app/admin/setup/page.tsx',
      'src/app/api/admin/overview/route.ts',
      'src/app/api/admin/cases/route.ts',
      'src/app/api/admin/cases/[id]/route.ts',
      'src/app/api/admin/cases/[id]/approve-with-payment/route.ts',
      'src/app/api/admin/cases/[id]/reject/route.ts',
      'src/components/admin/ReviewDrawer.tsx',
    ]) {
      expect(existsSync(join(ROOT, path)), path).toBe(true);
    }
  });

  it('no source file mentions a retired view, function or workflow state', () => {
    const forbidden = [
      /admin_case_queue_view/,
      /application_review_context/,
      /admin_dashboard_counts/,
      /admin_campaign_analytics/,
      /assign_staff_role_atomic/,
      /revoke_staff_role_atomic/,
      /provision_invited_staff_atomic/,
      /request_payment_evidence_reupload_atomic/,
      /mfa_enabled/,
    ];
    const offenders: string[] = [];
    for (const file of sourceFiles(join(ROOT, 'src'))) {
      const text = readFileSync(file, 'utf8');
      for (const pattern of forbidden) {
        if (pattern.test(text)) offenders.push(`${file}: ${pattern}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('the list and the detail read one view, so "complete" is defined once, in SQL', () => {
    const list = readFileSync(join(ROOT, 'src/app/api/admin/cases/route.ts'), 'utf8');
    const detail = readFileSync(join(ROOT, 'src/app/api/admin/cases/[id]/route.ts'), 'utf8');
    const reject = readFileSync(join(ROOT, 'src/app/api/admin/cases/[id]/reject/route.ts'), 'utf8');
    for (const source of [list, detail, reject]) {
      expect(source).toContain("'admin_applications_view'");
      expect(source).not.toMatch(/payment_state['"]?\s*,\s*\[/);
      expect(source).not.toContain('COMPLETE_PAYMENT_STATES');
    }
  });
});

describe('migration 00023', () => {
  it('defines complete as submitted details plus a payment past the applicant still paying', () => {
    expect(STATEMENTS).toContain("application_state in ('submitted', 'resubmitted')");
    expect(STATEMENTS).toContain("payment_state not in ('not_started', 'official_handoff_opened', 'payer_marked_paid')");
  });

  it('keeps the outcome columns in step with the append-only ledger', () => {
    expect(STATEMENTS).toContain('add column if not exists rejection_reason');
    expect(STATEMENTS).toContain('add column if not exists reviewed_by');
    expect(STATEMENTS).toContain('add column if not exists reviewed_at');
    expect(STATEMENTS).toContain('after insert on public.application_review_decisions');
  });

  it('never drops, disables or rewrites immutable evidence', () => {
    for (const table of [
      'audit_events',
      'application_submissions',
      'payment_evidence_versions',
      'membership_status_events',
      'application_review_decisions',
    ]) {
      expect(STATEMENTS).not.toMatch(new RegExp(`drop table[^;]*${table}`));
      expect(STATEMENTS).not.toMatch(new RegExp(`(update|delete from)\\s+public\\.${table}\\b`));
    }
    expect(STATEMENTS).not.toMatch(/disable trigger|drop trigger[^;]*immutable/);
    expect(STATEMENTS).not.toMatch(/\bcascade\b/);
  });

  it('is re-runnable', () => {
    for (const line of STATEMENTS.split(';')) {
      const statement = line.trim();
      if (/^(create (unique )?index)/.test(statement)) expect(statement).toContain('if not exists');
      if (/^drop (view|function)/.test(statement)) expect(statement).toContain('if exists');
    }
    expect(STATEMENTS).toContain('create or replace function public.admin_application_counts');
    expect(STATEMENTS).toContain('drop trigger if exists trg_sync_case_review_outcome');
  });

  it('keeps the new view and function away from browser roles', () => {
    expect(STATEMENTS).toContain('revoke all on public.admin_applications_view from public, anon, authenticated');
    expect(STATEMENTS).toContain('grant select on public.admin_applications_view to service_role');
    expect(STATEMENTS).toContain('revoke all on function public.admin_application_counts(uuid) from public, anon, authenticated');
  });

  it('does not forbid the member-correction fixtures: resubmission rows stay insertable', () => {
    // The member correction flow still serves cases already in correction_needed,
    // so the ledger keeps accepting that label. No console route produces it.
    expect(STATEMENTS).not.toContain('resubmission_requested');
    const reject = readFileSync(join(ROOT, 'src/app/api/admin/cases/[id]/reject/route.ts'), 'utf8');
    expect(reject).toContain("p_decision: 'rejected'");
  });
});
