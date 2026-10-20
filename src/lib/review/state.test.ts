import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  REASON_MAX,
  REASON_MIN,
  REVIEW_STATES,
  STATES_A_REVIEW_MUST_NOT_CHANGE,
  awaitsDecision,
} from './state';

describe('review state', () => {
  it('only an undecided application awaits a decision', () => {
    expect(awaitsDecision('pending')).toBe(true);
    for (const state of ['approved', 'rejected', 'resubmission_requested'] as const) {
      expect(awaitsDecision(state)).toBe(false);
    }
  });

  it('keeps every enum label the database still holds', () => {
    expect([...REVIEW_STATES]).toEqual(['pending', 'approved', 'resubmission_requested', 'rejected']);
  });

  it('asks for a reason of 10 to 500 characters', () => {
    expect(REASON_MIN).toBe(10);
    expect(REASON_MAX).toBe(500);
  });

  it('names the states a decision must not change', () => {
    expect([...STATES_A_REVIEW_MUST_NOT_CHANGE]).toEqual(['payment_state', 'membership_state']);
  });
});

/**
 * The separation rules are the product. Asserting them against the
 * route source catches the case where someone adds a convenient
 * "also mark it verified" line during a later change.
 */
describe('a review decision touches nothing else', () => {
  const REVIEW_ROUTE = readFileSync(
    join(process.cwd(), 'src/app/api/admin/cases/[id]/reject/route.ts'),
    'utf8',
  );
  const CORRECTION_ROUTE = readFileSync(
    join(process.cwd(), 'src/app/api/member/correction/route.ts'),
    'utf8',
  );
  const ATOMIC_REVIEW_MIGRATION = readFileSync(
    join(process.cwd(), 'supabase/migrations/00014_atomic_review_and_payment.sql'),
    'utf8',
  );
  const ATOMIC_CORRECTION_MIGRATION = readFileSync(
    join(process.cwd(), 'supabase/migrations/00016_atomic_member_correction.sql'),
    'utf8',
  );
  const REMOVAL_MIGRATION = readFileSync(
    join(process.cwd(), 'supabase/migrations/00022_remove_ambassador_prc_finance.sql'),
    'utf8',
  );

  it('never writes membership state from a review decision', () => {
    expect(REVIEW_ROUTE).not.toMatch(/membership_state:\s*['"]/);
    expect(REVIEW_ROUTE).not.toContain('active_confirmed');
  });

  it('never writes payment state from a review decision', () => {
    expect(REVIEW_ROUTE).not.toMatch(/payment_state:\s*['"]/);
    expect(REVIEW_ROUTE).not.toContain('verified_by_official_source');
  });

  it('reads the applicant-facing reason from the request, never from the case', () => {
    expect(REVIEW_ROUTE).toContain('reason: z.string().trim().min(REASON_MIN).max(REASON_MAX)');
    expect(REVIEW_ROUTE).toContain('p_reason: body.reason');
  });

  it('no longer has any PRC handoff coordination in the review transaction', () => {
    expect(REVIEW_ROUTE).not.toMatch(/prc_handoff_state/);
    expect(REVIEW_ROUTE).not.toContain('ready_for_export');
    const start = REMOVAL_MIGRATION.indexOf('create or replace function public.record_application_review_atomic');
    const end = REMOVAL_MIGRATION.indexOf('\n$$;\n', start);
    const fn = REMOVAL_MIGRATION.slice(start, end);
    expect(fn).not.toContain('prc_handoff_state');
    expect(fn).toContain('insert into public.application_review_decisions');
    expect(fn).toMatch(/where id = p_case_id\s+for update;/);
  });

  it('never writes membership or payment from a correction', () => {
    expect(CORRECTION_ROUTE).not.toMatch(/membership_state:\s*['"]/);
    expect(CORRECTION_ROUTE).not.toMatch(/payment_state:\s*['"]/);
  });

  it('requires an explicit confirmation on the staff decision', () => {
    expect(REVIEW_ROUTE).toContain('confirm: z.literal(true)');
  });

  it('requires the state the reviewer saw, so a stale screen is refused', () => {
    // Rejecting acts only on an application still awaiting review, in the
    // route and again in the database function.
    expect(REVIEW_ROUTE).toContain("application.status !== 'awaiting_review'");
    expect(REVIEW_ROUTE).toContain("p_expected_state: 'pending'");
    expect(ATOMIC_REVIEW_MIGRATION).toContain('if v_prior <> p_expected_state then');
  });

  it('locks and applies the review transactionally, so a race cannot clobber', () => {
    expect(REVIEW_ROUTE).toContain("'record_application_review_atomic'");
    expect(ATOMIC_REVIEW_MIGRATION).toMatch(/where id = p_case_id\s+for update;/);
    expect(ATOMIC_REVIEW_MIGRATION).toContain('insert into public.application_review_decisions');
    expect(ATOMIC_REVIEW_MIGRATION).toContain('insert into public.audit_events');
  });

  it('submits profile, version, state and audit in one correction transaction', () => {
    expect(CORRECTION_ROUTE).toContain("'submit_member_correction_atomic'");
    expect(ATOMIC_CORRECTION_MIGRATION).toMatch(/where id = p_case_id\s+for update;/);
    expect(ATOMIC_CORRECTION_MIGRATION).toContain('update public.recipient_profiles');
    expect(ATOMIC_CORRECTION_MIGRATION).toContain('insert into public.application_submissions');
    expect(ATOMIC_CORRECTION_MIGRATION).toContain('insert into public.audit_events');
    expect(ATOMIC_CORRECTION_MIGRATION).toContain('to service_role');
    expect(ATOMIC_CORRECTION_MIGRATION).toContain('from public, anon, authenticated');
  });

  it('returns an applicant to review after a correction', () => {
    expect(ATOMIC_CORRECTION_MIGRATION).toContain("application_state = 'resubmitted'");
    expect(REMOVAL_MIGRATION).toContain("application_review_state = 'pending'");
  });

  it('takes the member case id only from the session', () => {
    expect(CORRECTION_ROUTE).toContain('requireMemberSession()');
    // No case id parameter anywhere: nothing to tamper with.
    expect(CORRECTION_ROUTE).not.toMatch(/searchParams\.get\(['"]case/);
    expect(CORRECTION_ROUTE).not.toMatch(/body\.case_id/);
  });

  it('derives the data mode on the server, not from the request', () => {
    expect(CORRECTION_ROUTE).toContain('resolveDataMode()');
    expect(CORRECTION_ROUTE).not.toMatch(/data_mode:\s*dataModeSchema/);
  });
});

describe('the review migration stays additive', () => {
  const MIGRATION = readFileSync(
    join(process.cwd(), 'supabase/migrations/00012_application_review.sql'),
    'utf8',
  );

  it('adds a column rather than altering an existing one', () => {
    expect(MIGRATION).toContain('add column application_review_state');
    expect(MIGRATION).not.toMatch(/alter\s+column/i);
    expect(MIGRATION).not.toMatch(/drop\s+(table|column|type)/i);
  });

  it('keeps the decision ledger append-only', () => {
    expect(MIGRATION).toContain('prevent_audit_mutation');
    expect(MIGRATION).toContain('before update or delete');
  });

  it('makes duplicate decisions impossible at the database level', () => {
    expect(MIGRATION).toMatch(/idempotency_key\s+text not null unique/);
  });

  it('requires a reason for every decision except approval', () => {
    expect(MIGRATION).toContain('reason_required_unless_approved');
  });

  it('permits reopening only from rejected', () => {
    expect(MIGRATION).toContain('reopen_only_from_rejected');
  });
});
