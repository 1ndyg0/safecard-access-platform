import { describe, expect, it } from 'vitest';
import { ageOn, isEligibleAge } from './age';

const today = new Date(2026, 8, 29);

describe('program age boundary', () => {
  it('uses completed calendar years at the 3 and 85 year boundaries', () => {
    expect(isEligibleAge('2023-09-29', today)).toBe(true);
    expect(isEligibleAge('2023-09-30', today)).toBe(false);
    expect(isEligibleAge('1940-09-30', today)).toBe(true);
    expect(isEligibleAge('1940-09-29', today)).toBe(false);
  });

  it('rejects impossible and future dates', () => {
    expect(ageOn('2026-02-30', today)).toBeNull();
    expect(ageOn('2027-01-01', today)).toBeNull();
  });
});
