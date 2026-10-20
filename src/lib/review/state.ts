/**
 * Application review.
 *
 * The administrator makes one of two decisions on an application that is
 * awaiting review: approve (which also verifies the payment proof, in its own
 * route) or reject (with a reason the applicant reads). A decision answers one
 * question — does this application meet the criteria — and answers nothing
 * about membership. Rejection is final here; reopening is not offered in the
 * console.
 *
 * `resubmission_requested` stays in the list because the database enum keeps
 * the label and the member correction flow still serves cases that already
 * carry it; the console no longer produces it.
 */

export const REVIEW_STATES = [
  'pending',
  'approved',
  'resubmission_requested',
  'rejected',
] as const;

export type ReviewState = (typeof REVIEW_STATES)[number];

/** Only an application that has not been decided can be approved or rejected. */
export function awaitsDecision(state: ReviewState): boolean {
  return state === 'pending';
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

/** A review decision never changes payment or membership. */
export const STATES_A_REVIEW_MUST_NOT_CHANGE = [
  'payment_state',
  'membership_state',
] as const;
