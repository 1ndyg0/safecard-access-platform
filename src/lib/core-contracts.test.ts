import { describe, expect, it } from 'vitest';
import { canonicalJson } from './canonical-json';
import { generateApplicationReference } from './reference';
import {
  InvalidTransitionError,
  validateApplicationTransition,
  validateConsentTransition,
  validateMembershipTransition,
  validatePaymentTransition,
  validatePrcHandoffTransition,
} from './state-machines';

describe('state-machine safety contracts', () => {
  it('keeps submission, payment, PRC acceptance, and activation separate', () => {
    validateApplicationTransition('ready_for_review', 'submitted');
    validatePaymentTransition('verification_pending', 'verified_by_official_source');
    validatePrcHandoffTransition('exported', 'accepted');
    validateMembershipTransition('pending_prc_confirmation', 'active_confirmed');
  });

  it('does not let payment activate membership or skip official verification', () => {
    expect(() => validatePaymentTransition('payer_marked_paid', 'verified_by_official_source'))
      .toThrow(InvalidTransitionError);
    expect(() => validateMembershipTransition('not_active', 'active_confirmed'))
      .toThrow(InvalidTransitionError);
  });

  it('does not allow withdrawn consent to be revived', () => {
    expect(() => validateConsentTransition('withdrawn', 'agreed'))
      .toThrow(InvalidTransitionError);
  });
});

describe('stable identifiers and hashes', () => {
  it('canonicalizes equivalent objects identically', () => {
    expect(canonicalJson({ b: 2, a: { d: 4, c: 3 } }))
      .toBe(canonicalJson({ a: { c: 3, d: 4 }, b: 2 }));
  });

  it('creates non-sequential, correctly formatted application references', () => {
    const references = new Set(Array.from({ length: 500 }, generateApplicationReference));
    expect(references.size).toBe(500);
    for (const reference of references) {
      expect(reference).toMatch(/^SC-\d{4}-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{8}$/);
    }
  });
});
