import { describe, expect, it } from 'vitest';
import {
  correctionBlockMessage,
  fieldLabel,
  memberCopy,
  reviewStateLabel,
  t,
} from './copy';
import { CORRECTABLE_FIELDS } from './correction-fields';

/**
 * A half-translated product is worse than an untranslated one: the
 * applicant reads Filipino until something goes wrong, then hits English
 * at exactly the moment they need to understand it. These tests treat a
 * missing Filipino string as a failure, not a nicety.
 */
describe('member copy is complete in both languages', () => {
  it('has a Filipino and an English string for every key', () => {
    for (const [key, value] of Object.entries(memberCopy)) {
      expect(value.fil, `${key} is missing Filipino`).toBeTruthy();
      expect(value.en, `${key} is missing English`).toBeTruthy();
    }
  });

  it('translates the states people hit when something goes wrong', () => {
    // Loading, error, retry and empty are the ones usually left behind.
    for (const key of ['loading', 'loadError', 'retry', 'empty'] as const) {
      expect(t(key, 'fil')).not.toBe(t(key, 'en'));
    }
  });

  it('labels every correctable field in both languages', () => {
    for (const field of CORRECTABLE_FIELDS) {
      expect(fieldLabel(field, 'fil')).not.toBe(field);
      expect(fieldLabel(field, 'en')).not.toBe(field);
    }
  });

  it('names each review outcome in the reader language', () => {
    expect(reviewStateLabel('approved', 'fil')).toBe('Naaprubahan ang aplikasyon');
    expect(reviewStateLabel('approved', 'en')).toBe('Application approved');
    expect(reviewStateLabel('rejected', 'fil')).toBe('Hindi naaprubahan');
    // An unknown state reads as pending rather than as a raw enum value.
    expect(reviewStateLabel('something_new', 'en')).toBe('Awaiting review');
  });

  it('explains every reason a correction can be blocked', () => {
    for (const reason of [
      'not_requested',
      'consent_withdrawn',
      'consent_expired',
      'consent_renewal_required',
      'already_resubmitted',
    ]) {
      expect(correctionBlockMessage(reason, 'fil').length).toBeGreaterThan(10);
      expect(correctionBlockMessage(reason, 'en').length).toBeGreaterThan(10);
    }
  });

  it('tells an approved applicant they are not yet a member', () => {
    // The single most dangerous misreading this screen can produce.
    expect(t('approvedNotMembership', 'en')).toMatch(/not membership yet/i);
    expect(t('approvedNotMembership', 'fil')).toMatch(/hindi pa ito membership/i);
  });

  it('states that the workflow steps are separate', () => {
    expect(t('separateStates', 'en')).toMatch(/only prc/i);
    expect(t('separateStates', 'fil')).toMatch(/PRC lamang/i);
  });

  it('offers Hotline 143 in both languages', () => {
    expect(t('callHotline', 'fil')).toContain('143');
    expect(t('callHotline', 'en')).toContain('143');
  });
});
