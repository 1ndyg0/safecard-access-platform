import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  InvalidReviewTransitionError,
  REVIEW_STATES,
  STATES_A_REVIEW_MUST_NOT_CHANGE,
  allowedDecisions,
  assertTransition,
  canReopen,
  canTransition,
  isFinal,
  requiresReason,
  validateReason,
} from './state';

describe('review state machine', () => {
  it('lets a pending application go to any of the three decisions', () => {
    expect(allowedDecisions('pending')).toEqual([
      'approved',
      'resubmission_requested',
      'rejected',
    ]);
  });

  it('treats rejection as final', () => {
    expect(isFinal('rejected')).toBe(true);
    expect(allowedDecisions('rejected')).toEqual([]);
    expect(canTransition('rejected', 'pending')).toBe(false);
    expect(canTransition('rejected', 'approved')).toBe(false);
    expect(() => assertTransition('rejected', 'pending')).toThrow(InvalidReviewTransitionError);
  });

  it('offers reopening only from rejected, and only as a separate action', () => {
    expect(canReopen('rejected')).toBe(true);
    for (const state of REVIEW_STATES.filter((value) => value !== 'rejected')) {
      expect(canReopen(state)).toBe(false);
    }
  });

  it('returns a requested resubmission to pending once corrected', () => {
    expect(canTransition('resubmission_requested', 'pending')).toBe(true);
  });

  it('lets an approved application be pulled back before handoff', () => {
    expect(canTransition('approved', 'resubmission_requested')).toBe(true);
    expect(canTransition('approved', 'rejected')).toBe(true);
  });

  it('requires a reason for everything except approval', () => {
    expect(requiresReason('approved')).toBe(false);
    expect(requiresReason('resubmission_requested')).toBe(true);
    expect(requiresReason('rejected')).toBe(true);
  });

  it('rejects a reason too short to explain anything', () => {
    expect(validateReason('no')).toBeNull();
    expect(validateReason('   ')).toBeNull();
    expect(validateReason(undefined)).toBeNull();
    expect(validateReason('Your birth date does not match the document.')).toBe(
      'Your birth date does not match the document.',
    );
  });

  it('rejects a reason long enough to be a case file', () => {
    expect(validateReason('x'.repeat(501))).toBeNull();
    expect(validateReason('x'.repeat(500))).toBe('x'.repeat(500));
  });

  it('names the states a review must never move', () => {
    expect(STATES_A_REVIEW_MUST_NOT_CHANGE).toEqual([
      'payment_state',
      'membership_state',
    ]);
  });
});

/**
 * The separation rules are the product. Asserting them against the
 * route source catches the case where someone adds a convenient
 * "also mark it verified" line during a later change.
 */
describe('a review decision touches nothing else', () => {
  const REVIEW_ROUTE = readFileSync(
    join(process.cwd(), 'src/app/api/admin/cases/[id]/review/route.ts'),
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
  const ATOMIC_HANDOFF_MIGRATION = readFileSync(
    join(process.cwd(), 'supabase/migrations/00015_atomic_prc_handoff.sql'),
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

  it('keeps handoff coordination inside the locked database transaction', () => {
    expect(REVIEW_ROUTE).not.toMatch(/prc_handoff_state:\s*['"]/);
    expect(REVIEW_ROUTE).not.toContain('ready_for_export');
    expect(ATOMIC_REVIEW_MIGRATION).toContain(
      "and payment_state = 'verified_by_official_source'",
    );
    expect(ATOMIC_REVIEW_MIGRATION).toContain(
      "then 'ready_for_export'::public.prc_handoff_state",
    );
    expect(ATOMIC_REVIEW_MIGRATION).not.toContain(
      "then 'exported'::public.prc_handoff_state",
    );
  });

  it('never writes membership, payment or handoff from a correction', () => {
    expect(CORRECTION_ROUTE).not.toMatch(/membership_state:\s*['"]/);
    expect(CORRECTION_ROUTE).not.toMatch(/payment_state:\s*['"]/);
    expect(CORRECTION_ROUTE).not.toMatch(/prc_handoff_state:\s*['"]/);
  });

  it('requires an explicit confirmation on every staff decision', () => {
    expect(REVIEW_ROUTE).toContain('confirm: z.literal(true)');
  });

  it('requires the state the reviewer saw, so a stale screen is refused', () => {
    expect(REVIEW_ROUTE).toContain('expected_review_state');
    expect(REVIEW_ROUTE).toContain('p_expected_state: body.expected_review_state');
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

  it('makes a PRC-requested correction eligible for a new reviewed export cycle', () => {
    expect(ATOMIC_HANDOFF_MIGRATION).toContain(
      "when p_prc_status = 'correction_requested' then 'not_active'::public.membership_state",
    );
    expect(ATOMIC_CORRECTION_MIGRATION).toContain("application_state = 'resubmitted'");
    expect(ATOMIC_REVIEW_MIGRATION).toContain(
      "prc_handoff_state in ('not_ready', 'correction_requested')",
    );
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
