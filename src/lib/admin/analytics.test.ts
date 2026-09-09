import { describe, expect, it } from 'vitest';
import { buildAdminAnalytics } from './analytics';

const base = {
  application_state: 'submitted', application_review_state: 'pending', payment_state: 'not_started',
  prc_handoff_state: 'not_ready', membership_state: 'not_active', created_at: '2026-09-09T00:00:00.000Z', updated_at: '2026-09-09T00:00:00.000Z',
};

describe('privacy-safe admin analytics', () => {
  it('suppresses cohorts and subgroups below five', () => {
    const result = buildAdminAnalytics(Array.from({ length: 4 }, () => ({ ...base })), new Date('2026-09-09T12:00:00Z'));
    expect(result.summary.awaitingReview).toBeNull();
    expect(result.rates.submittedPerStarted).toBeNull();
  });

  it('returns rates for sufficiently large cohorts while suppressing small numerators', () => {
    const cases = Array.from({ length: 10 }, (_, index) => ({
      ...base,
      application_review_state: index < 4 ? 'approved' : 'pending',
      payment_state: index < 5 ? 'verified_by_official_source' : 'not_started',
    }));
    const result = buildAdminAnalytics(cases, new Date('2026-09-09T12:00:00Z'));
    expect(result.rates.submittedPerStarted).toBe(1);
    expect(result.rates.approvedPerSubmitted).toBeNull();
    expect(result.rates.paymentVerifiedPerSubmitted).toBe(0.5);
  });
});
