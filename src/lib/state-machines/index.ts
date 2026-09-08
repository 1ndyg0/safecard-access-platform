/**
 * SafeCard state machines
 *
 * Each process has its own state machine with explicit valid transitions.
 * This prevents the common mistake of showing "active" just because
 * an application was submitted or a payer says they paid.
 *
 * State machines:
 * 1. Consent: not_started → reviewing → agreed → withdrawn | expired_due_to_content_change
 * 2. Application: draft → ready_for_review → submitted → correction_needed → resubmitted → withdrawn
 * 3. Payment: not_started → official_handoff_opened → payer_marked_paid → verification_pending → verified | failed | refunded
 * 4. PRC Handoff: not_ready → ready_for_export → exported → acknowledged → accepted | rejected | correction_requested
 * 5. Membership: not_active → pending_prc_confirmation → active_confirmed → declined | expired | renewed
 * 6. Support: open → waiting_on_* → resolved | closed_no_response
 */

import type {
  ConsentState,
  ApplicationState,
  PaymentState,
  PrcHandoffState,
  MembershipState,
  SupportState,
} from '@/types/database';

// ============================================================
// Transition map type
// ============================================================

type TransitionMap<T extends string> = Record<T, T[]>;

// ============================================================
// Consent state machine
// ============================================================

const CONSENT_TRANSITIONS: TransitionMap<ConsentState> = {
  not_started: ['reviewing', 'agreed'],
  reviewing: ['agreed', 'not_started'],
  agreed: ['withdrawn', 'expired_due_to_content_change'],
  withdrawn: [], // Terminal state
  expired_due_to_content_change: ['reviewing'], // Can re-review updated content
};

// ============================================================
// Application state machine
// ============================================================

const APPLICATION_TRANSITIONS: TransitionMap<ApplicationState> = {
  draft: ['ready_for_review', 'withdrawn'],
  ready_for_review: ['submitted', 'draft', 'withdrawn'],
  submitted: ['correction_needed', 'withdrawn'],
  correction_needed: ['resubmitted', 'withdrawn'],
  resubmitted: ['correction_needed', 'withdrawn'],
  withdrawn: [], // Terminal state
};

// ============================================================
// Payment state machine
// ============================================================

const PAYMENT_TRANSITIONS: TransitionMap<PaymentState> = {
  not_started: ['official_handoff_opened'],
  official_handoff_opened: ['payer_marked_paid', 'failed_or_cancelled'],
  payer_marked_paid: ['verification_pending', 'failed_or_cancelled'],
  verification_pending: ['verified_by_official_source', 'failed_or_cancelled'],
  verified_by_official_source: ['refunded_or_reversed'],
  failed_or_cancelled: ['official_handoff_opened'], // Can retry
  refunded_or_reversed: [], // Terminal state
};

// ============================================================
// PRC handoff state machine
// ============================================================

const PRC_HANDOFF_TRANSITIONS: TransitionMap<PrcHandoffState> = {
  not_ready: ['ready_for_export'],
  ready_for_export: ['exported'],
  exported: ['acknowledged', 'correction_requested', 'accepted', 'rejected'],
  acknowledged: ['accepted', 'rejected', 'correction_requested'],
  correction_requested: ['ready_for_export'], // Re-export after correction
  accepted: [], // Terminal state
  rejected: [], // Terminal state
};

// ============================================================
// Membership state machine
// PRC confirmation is the ONLY source of active membership
// ============================================================

const MEMBERSHIP_TRANSITIONS: TransitionMap<MembershipState> = {
  not_active: ['pending_prc_confirmation'],
  pending_prc_confirmation: ['active_confirmed', 'declined'],
  active_confirmed: ['expired', 'renewed'],
  declined: [], // Terminal state
  expired: ['renewed'],
  renewed: ['expired'],
};

// ============================================================
// Support state machine
// ============================================================

const SUPPORT_TRANSITIONS: TransitionMap<SupportState> = {
  open: ['waiting_on_recipient', 'waiting_on_school', 'waiting_on_prc', 'resolved', 'closed_no_response'],
  waiting_on_recipient: ['open', 'resolved', 'closed_no_response'],
  waiting_on_school: ['open', 'resolved', 'closed_no_response'],
  waiting_on_prc: ['open', 'resolved', 'closed_no_response'],
  resolved: [], // Terminal state
  closed_no_response: [], // Terminal state
};

// ============================================================
// Transition validation
// ============================================================

export class InvalidTransitionError extends Error {
  constructor(
    public readonly machine: string,
    public readonly from: string,
    public readonly to: string,
  ) {
    super(`Invalid ${machine} transition: ${from} → ${to}`);
    this.name = 'InvalidTransitionError';
  }
}

function validateTransition<T extends string>(
  machineName: string,
  transitions: TransitionMap<T>,
  from: T,
  to: T,
): void {
  const allowed = transitions[from];
  if (!allowed || !allowed.includes(to)) {
    throw new InvalidTransitionError(machineName, from, to);
  }
}

// ============================================================
// Public API
// ============================================================

export function validateConsentTransition(from: ConsentState, to: ConsentState): void {
  validateTransition('consent', CONSENT_TRANSITIONS, from, to);
}

export function validateApplicationTransition(from: ApplicationState, to: ApplicationState): void {
  validateTransition('application', APPLICATION_TRANSITIONS, from, to);
}

export function validatePaymentTransition(from: PaymentState, to: PaymentState): void {
  validateTransition('payment', PAYMENT_TRANSITIONS, from, to);
}

export function validatePrcHandoffTransition(from: PrcHandoffState, to: PrcHandoffState): void {
  validateTransition('prc_handoff', PRC_HANDOFF_TRANSITIONS, from, to);
}

export function validateMembershipTransition(from: MembershipState, to: MembershipState): void {
  validateTransition('membership', MEMBERSHIP_TRANSITIONS, from, to);
}

export function validateSupportTransition(from: SupportState, to: SupportState): void {
  validateTransition('support', SUPPORT_TRANSITIONS, from, to);
}

// ============================================================
// Query helpers
// ============================================================

export function getAllowedTransitions<T extends string>(
  transitions: TransitionMap<T>,
  from: T,
): T[] {
  return transitions[from] || [];
}

export function getConsentTransitions(from: ConsentState): ConsentState[] {
  return getAllowedTransitions(CONSENT_TRANSITIONS, from);
}

export function getApplicationTransitions(from: ApplicationState): ApplicationState[] {
  return getAllowedTransitions(APPLICATION_TRANSITIONS, from);
}

export function getPaymentTransitions(from: PaymentState): PaymentState[] {
  return getAllowedTransitions(PAYMENT_TRANSITIONS, from);
}

export function getPrcHandoffTransitions(from: PrcHandoffState): PrcHandoffState[] {
  return getAllowedTransitions(PRC_HANDOFF_TRANSITIONS, from);
}

export function getMembershipTransitions(from: MembershipState): MembershipState[] {
  return getAllowedTransitions(MEMBERSHIP_TRANSITIONS, from);
}

export function getSupportTransitions(from: SupportState): SupportState[] {
  return getAllowedTransitions(SUPPORT_TRANSITIONS, from);
}

export function isTerminalState<T extends string>(
  transitions: TransitionMap<T>,
  state: T,
): boolean {
  const allowed = transitions[state];
  return !allowed || allowed.length === 0;
}
