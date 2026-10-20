import { describe, expect, it } from 'vitest';
import { formatFullName, isAdministratorApproved, maskMobile } from './approved';

describe('isAdministratorApproved', () => {
  it('needs both approval and verified payment', () => {
    expect(isAdministratorApproved({ application_review_state: 'approved', payment_state: 'verified_by_official_source' })).toBe(true);
    expect(isAdministratorApproved({ application_review_state: 'approved', payment_state: 'verification_pending' })).toBe(false);
    expect(isAdministratorApproved({ application_review_state: 'pending', payment_state: 'verified_by_official_source' })).toBe(false);
  });

  it('never applies to a declined membership', () => {
    expect(isAdministratorApproved({ application_review_state: 'approved', payment_state: 'verified_by_official_source', membership_state: 'declined' })).toBe(false);
  });
});

describe('maskMobile', () => {
  it('keeps the first and last four digits', () => {
    expect(maskMobile('09254636315')).toBe('0925•••6315');
    expect(maskMobile('+639254636315')).toBe('+639•••••6315');
  });

  it('handles empty and short values', () => {
    expect(maskMobile('')).toBe('');
    expect(maskMobile(null)).toBe('');
    expect(maskMobile('123')).toBe('•••');
  });
});

describe('formatFullName', () => {
  it('joins first and last name with a single space', () => {
    expect(formatFullName('Ana', 'Reyes')).toBe('Ana Reyes');
  });

  it('trims a trailing space on the first name instead of doubling it', () => {
    expect(formatFullName('Ana ', 'Reyes')).toBe('Ana Reyes');
    expect(formatFullName('  Ana  Maria ', ' Reyes ')).toBe('Ana Maria Reyes');
  });

  it('skips missing parts', () => {
    expect(formatFullName('Ana', null)).toBe('Ana');
    expect(formatFullName(undefined, undefined)).toBe('');
  });
});
