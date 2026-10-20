import { describe, expect, it } from 'vitest';
import {
  APPLICATION_STATES,
  CONSENT_STATES,
  MEMBERSHIP_STATES,
  PAYMENT_STATES,
  PRC_HANDOFF_STATES,
  parseQueueQuery,
  resolveDateRange,
  reviewBucketStates,
  serializeQueueQuery,
} from './queue';

const CAMPAIGN = '11111111-1111-4111-8111-111111111111';

function query(params: Record<string, string>) {
  return parseQueueQuery(new URLSearchParams({ campaign_id: CAMPAIGN, ...params }));
}

describe('queue filters', () => {
  it('keeps every state filter on its own column', () => {
    const parsed = query({
      consent_state: 'agreed',
      application_state: 'submitted',
      payment_state: 'verification_pending',
      prc_handoff_state: 'ready_for_export',
      membership_state: 'not_active',
    });

    expect(parsed.consent_state).toBe('agreed');
    expect(parsed.application_state).toBe('submitted');
    expect(parsed.payment_state).toBe('verification_pending');
    expect(parsed.prc_handoff_state).toBe('ready_for_export');
    expect(parsed.membership_state).toBe('not_active');
  });

  it('rejects a value from another state machine', () => {
    // 'active_confirmed' is a membership label. Accepting it on the
    // consent filter is what produced invalid-enum errors before.
    expect(() => query({ consent_state: 'active_confirmed' })).toThrow();
    expect(() => query({ payment_state: 'submitted' })).toThrow();
    expect(() => query({ application_state: 'verified_by_official_source' })).toThrow();
  });

  it('keeps the five enums disjoint enough that a shared value cannot exist', () => {
    // Any label shared across two enums would let a cross-column filter
    // look correct in testing and fail in production on other values.
    const membershipOnly = MEMBERSHIP_STATES.filter(
      (state) =>
        !(CONSENT_STATES as readonly string[]).includes(state) &&
        !(APPLICATION_STATES as readonly string[]).includes(state) &&
        !(PAYMENT_STATES as readonly string[]).includes(state) &&
        !(PRC_HANDOFF_STATES as readonly string[]).includes(state),
    );
    expect(membershipOnly).toContain('active_confirmed');
  });

  it('accepts only a full application reference', () => {
    expect(query({ application_ref: 'SC-2026-AB12CD34' }).application_ref).toBe(
      'SC-2026-AB12CD34',
    );
    expect(query({ application_ref: 'sc-2026-ab12cd34' }).application_ref).toBe(
      'SC-2026-AB12CD34',
    );
    // A prefix would let someone walk the register.
    expect(() => query({ application_ref: 'SC-2026' })).toThrow();
    expect(() => query({ application_ref: 'SC-2026-AB12' })).toThrow();
  });

  it('treats an empty parameter as absent rather than invalid', () => {
    const parsed = query({ payment_state: '', application_state: 'draft' });
    expect(parsed.payment_state).toBeUndefined();
    expect(parsed.application_state).toBe('draft');
  });

  it('defaults to newest first, page one', () => {
    const parsed = query({});
    expect(parsed.sort).toBe('newest');
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(25);
  });

  it('caps the page size', () => {
    expect(() => query({ limit: '500' })).toThrow();
  });

  it('requires a meaningful search term and trims it', () => {
    expect(query({ search: '  Reyes  ' }).search).toBe('Reyes');
    expect(() => query({ search: 'ab' })).toThrow();
  });

  it('maps review buckets onto application states', () => {
    expect(reviewBucketStates('awaiting')).toEqual([
      'ready_for_review',
      'submitted',
      'resubmitted',
    ]);
    expect(reviewBucketStates('correction_requested')).toEqual(['correction_needed']);
  });
});

describe('date range boundaries', () => {
  it('covers the whole of the "to" day', () => {
    const range = resolveDateRange(query({ from: '2026-03-01', to: '2026-03-31' }));
    expect(range.fromIso).toBe('2026-03-01T00:00:00.000Z');
    // A case created at 18:00 on the 31st must still be inside the range.
    expect(range.toIso).toBe('2026-03-31T23:59:59.999Z');
  });

  it('allows an open-ended range', () => {
    expect(resolveDateRange(query({ from: '2026-03-01' })).toIso).toBeUndefined();
    expect(resolveDateRange(query({ to: '2026-03-01' })).fromIso).toBeUndefined();
  });

  it('rejects a malformed date', () => {
    expect(() => query({ from: '01-03-2026' })).toThrow();
    expect(() => query({ from: '2026-13-01' })).toThrow();
  });
});

describe('URL persistence', () => {
  it('round-trips filters through a query string', () => {
    const original = query({
      payment_state: 'verification_pending',
      search: 'SC-2026-AB12CD34',
      sort: 'longest_waiting',
      page: '3',
    });
    const serialized = serializeQueueQuery(original);
    const reparsed = parseQueueQuery(new URLSearchParams(serialized));

    expect(reparsed.payment_state).toBe('verification_pending');
    expect(reparsed.search).toBe('SC-2026-AB12CD34');
    expect(reparsed.sort).toBe('longest_waiting');
    expect(reparsed.page).toBe(3);
  });

  it('omits defaults so a shared link stays readable', () => {
    const serialized = serializeQueueQuery(query({ application_state: 'draft' }));
    expect(serialized).not.toContain('sort=newest');
    expect(serialized).not.toContain('page=1');
    expect(serialized).toContain('application_state=draft');
  });
});
