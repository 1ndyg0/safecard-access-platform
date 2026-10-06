import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { applicantCategory } from './applicant-capacity';
import { requireAdultSelfApplication } from './require-applicant-capacity';

describe('applicant capacity groundwork', () => {
  const today = new Date('2026-10-06T00:00:00+08:00');
  it.each([
    ['2023-10-06', 'child'], ['2008-10-07', 'child'],
    ['2008-10-06', 'adult'], ['1941-10-06', 'adult'],
    ['1940-10-06', 'invalid'], ['2024-10-06', 'invalid'],
    ['2027-01-01', 'invalid'], ['2000-02-30', 'invalid'],
  ])('classifies %s on the Manila calendar', (dob, expected) => {
    expect(applicantCategory(dob, today)).toBe(expected);
  });
  it('rejects a child profile and missing birth date from adult self-application', () => {
    expect(() => requireAdultSelfApplication('2020-01-01')).toThrow('guardian');
    expect(() => requireAdultSelfApplication(undefined)).toThrow('guardian');
    expect(() => requireAdultSelfApplication('2000-01-01')).not.toThrow();
  });
});
