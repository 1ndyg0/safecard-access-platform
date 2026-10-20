import { describe, expect, it } from 'vitest';
import { interpretSearch, parseQueueQuery, resolveDateRange } from './queue';

const CAMPAIGN = '11111111-1111-4111-8111-111111111111';

function query(params: Record<string, string>) {
  return parseQueueQuery(new URLSearchParams({ campaign_id: CAMPAIGN, ...params }));
}

describe('applications query', () => {
  it('defaults to newest first, first page, every status', () => {
    const parsed = query({});
    expect(parsed.sort).toBe('newest');
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(25);
    expect(parsed.status).toBeUndefined();
  });

  it('accepts the three statuses and treats "all" as no filter', () => {
    expect(query({ status: 'awaiting_review' }).status).toBe('awaiting_review');
    expect(query({ status: 'approved' }).status).toBe('approved');
    expect(query({ status: 'rejected' }).status).toBe('rejected');
    expect(query({ status: 'all' }).status).toBeUndefined();
  });

  it('rejects states from the retired workflow filters', () => {
    expect(() => query({ status: 'verification_pending' })).toThrow();
    expect(() => query({ status: 'correction_needed' })).toThrow();
  });

  it('rejects a bad campaign id, limit or sort', () => {
    expect(() => parseQueueQuery(new URLSearchParams({ campaign_id: 'nope' }))).toThrow();
    expect(() => query({ limit: '500' })).toThrow();
    expect(() => query({ sort: 'longest_waiting' })).toThrow();
  });

  it('turns a date range into inclusive UTC bounds', () => {
    const range = resolveDateRange(query({ from: '2026-09-01', to: '2026-09-30' }));
    expect(range.fromIso).toBe('2026-09-01T00:00:00.000Z');
    expect(range.toIso).toBe('2026-09-30T23:59:59.999Z');
    expect(resolveDateRange(query({}))).toEqual({ fromIso: undefined, toIso: undefined });
  });
});

describe('interpretSearch', () => {
  it('recognises a full application reference, case-insensitively', () => {
    expect(interpretSearch('sc-2026-ab12cd34')).toEqual({
      kind: 'reference',
      reference: 'SC-2026-AB12CD34',
    });
  });

  it('recognises a mobile number however it is typed', () => {
    expect(interpretSearch('0917 123 4567')).toEqual({
      kind: 'mobile',
      patterns: ['09171234567', '+639171234567'],
    });
    expect(interpretSearch('+63 917 123 4567')).toEqual({
      kind: 'mobile',
      patterns: ['+639171234567', '09171234567'],
    });
    // A fragment is matched as typed.
    expect(interpretSearch('4567')).toEqual({ kind: 'mobile', patterns: ['4567'] });
  });

  it('treats anything else as name tokens and strips filter metacharacters', () => {
    expect(interpretSearch('Ana Reyes')).toEqual({ kind: 'name', tokens: ['Ana', 'Reyes'] });
    expect(interpretSearch("O'Brien")).toEqual({ kind: 'name', tokens: ["O'Brien"] });
    const hostile = interpretSearch('a%,b_(c).or(x)');
    expect(hostile?.kind).toBe('name');
    if (hostile?.kind === 'name') {
      for (const token of hostile.tokens) expect(token).not.toMatch(/[%_,()*\\]/);
    }
  });

  it('returns null for empty or too-short input', () => {
    expect(interpretSearch('')).toBeNull();
    expect(interpretSearch(' a ')).toBeNull();
    expect(interpretSearch('%%')).toBeNull();
  });
});
