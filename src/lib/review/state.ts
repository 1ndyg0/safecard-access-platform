/**
 * Application review state machine.
 *
 * Deliberately separate from every other state machine in the platform.
 * A review decision answers one question — does this application, as
 * submitted, meet the criteria — and answers nothing about money, about
 * the PRC handoff, or about membership.
 *
 * Rejection is final. A rejected application does not drift back into
 * review because someone clicked the wrong control; reopening it is a
 * distinct privileged action with its own audit trail (see `canReopen`).
 * That is the safer default: an applicant told they were rejected should
 * not silently become pending again, and a reviewer should have to mean
 * it.
 */

export const REVIEW_STATES = [
  'pending',
  'approved',
  'resubmission_requested',
  'rejected',
] as const;

export type ReviewState = (typeof REVIEW_STATES)[number];

export const REVIEW_DECISIONS = ['approved', 'resubmission_requested', 'rejected'] as const;
export type ReviewDecision = (typeof REVIEW_DECISIONS)[number];

/**
 * Transitions a normal staff decision may make.
 *
 * `approved` is not terminal: a later correction round can legitimately
 * send an approved application back if new information arrives before
 * the PRC handoff. `rejected` is terminal here by design.
 */
const REVIEW_TRANSITIONS: Record<ReviewState, ReadonlyArray<ReviewState>> = {
  pending: ['approved', 'resubmission_requested', 'rejected'],
  resubmission_requested: ['pending'],
  approved: ['resubmission_requested', 'rejected'],
  rejected: [],
};

export class InvalidReviewTransitionError extends Error {
  constructor(from: ReviewState, to: ReviewState) {
    super(`Cannot move an application review from "${from}" to "${to}".`);
    this.name = 'InvalidReviewTransitionError';
  }
}

export function canTransition(from: ReviewState, to: ReviewState): boolean {
  return REVIEW_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: ReviewState, to: ReviewState): void {
  if (!canTransition(from, to)) throw new InvalidReviewTransitionError(from, to);
}

export function allowedDecisions(from: ReviewState): ReadonlyArray<ReviewState> {
  return REVIEW_TRANSITIONS[from];
}

/** Rejection is final; only the privileged reopen action moves it. */
export function isFinal(state: ReviewState): boolean {
  return state === 'rejected';
}

/**
 * Reopening is not a transition in the table above. It is a separate,
 * audited action available only to the accountable role, and only from
 * a rejected state.
 */
export function canReopen(state: ReviewState): boolean {
  return state === 'rejected';
}

/** A reason is required for everything an applicant could be hurt by. */
export function requiresReason(decision: ReviewDecision): boolean {
  return decision !== 'approved';
}

/**
 * Applicant-safe reason check.
 *
 * The applicant reads this string exactly as written. A one-word reason
 * is not an explanation, and the field is capped so a reviewer cannot
 * paste a case file into a message that leaves the platform.
 */
export const REASON_MIN = 10;
export const REASON_MAX = 500;

export function validateReason(reason: string | undefined): string | null {
  if (!reason) return null;
  const trimmed = reason.trim();
  if (trimmed.length < REASON_MIN || trimmed.length > REASON_MAX) return null;
  return trimmed;
}

/**
 * A review decision never changes payment or membership. PRC handoff
 * readiness is the one derived coordination state: approval may make an
 * already-paid case ready, and withdrawing approval removes that readiness.
 */
export const STATES_A_REVIEW_MUST_NOT_CHANGE = [
  'payment_state',
  'membership_state',
] as const;
