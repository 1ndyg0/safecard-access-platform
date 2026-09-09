import { describe, expect, it } from 'vitest';
import {
  InvalidTransitionError,
  validateApplicationTransition,
  validateMembershipTransition,
  validatePaymentTransition,
} from './index';

describe('independent lifecycle state machines', () => {
  it('does not treat a payment declaration as payment verification', () => {
    expect(() => validatePaymentTransition('payer_marked_paid', 'verification_pending')).not.toThrow();
    expect(() => validatePaymentTransition('payer_marked_paid', 'verified_by_official_source')).toThrow(InvalidTransitionError);
  });

  it('does not activate membership from an application or payment state', () => {
    expect(() => validateMembershipTransition('not_active', 'active_confirmed')).toThrow(InvalidTransitionError);
    expect(() => validateMembershipTransition('not_active', 'pending_prc_confirmation')).not.toThrow();
  });

  it('requires a returned application to be resubmitted before another review', () => {
    expect(() => validateApplicationTransition('submitted', 'correction_needed')).not.toThrow();
    expect(() => validateApplicationTransition('correction_needed', 'submitted')).toThrow(InvalidTransitionError);
    expect(() => validateApplicationTransition('correction_needed', 'resubmitted')).not.toThrow();
  });
});
