/**
 * Applications list query.
 *
 * The console shows complete applications only (details submitted and proof of
 * payment uploaded). That rule lives in the database view
 * `admin_applications_view`; nothing here re-implements it. The administrator
 * filters on one three-value status, a single search box and an optional date
 * range.
 */

import { z } from 'zod';

export const APPLICATION_STATUSES = ['awaiting_review', 'approved', 'rejected'] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  awaiting_review: 'Awaiting review',
  approved: 'Approved',
  rejected: 'Rejected',
};

export const SORT_OPTIONS = ['newest', 'oldest'] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const queueQuerySchema = z.object({
  campaign_id: z.string().uuid(),
  search: z.string().trim().min(2).max(120).optional(),
  /** Absent means every status. */
  status: z.enum(APPLICATION_STATUSES).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  sort: z.enum(SORT_OPTIONS).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type QueueQuery = z.infer<typeof queueQuerySchema>;

export function parseQueueQuery(params: URLSearchParams): QueueQuery {
  const raw: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    if (value !== '' && value !== 'all') raw[key] = value;
  }
  return queueQuerySchema.parse(raw);
}

export function resolveDateRange(query: Pick<QueueQuery, 'from' | 'to'>): {
  fromIso?: string;
  toIso?: string;
} {
  return {
    fromIso: query.from ? `${query.from}T00:00:00.000Z` : undefined,
    toIso: query.to ? `${query.to}T23:59:59.999Z` : undefined,
  };
}

const APPLICATION_REF_PATTERN = /^SC-\d{4}-[A-Z0-9]{8}$/;

export type SearchIntent =
  | { kind: 'reference'; reference: string }
  | { kind: 'mobile'; patterns: string[] }
  | { kind: 'name'; tokens: string[] };

/**
 * Decide what one search box means. Returns null for input that is too short
 * or empty after cleaning. Everything returned is safe to place in a
 * PostgREST `ilike` / `eq` filter: only letters, digits, spaces, dots,
 * apostrophes and hyphens survive, and `%` / `_` never do.
 */
/**
 * Mobile numbers are stored as 09XXXXXXXXX or +639XXXXXXXXX. A full number
 * typed in either form finds both; a fragment (the last digits) is matched
 * as typed.
 */
export function mobilePatterns(typed: string): string[] {
  const digits = typed.replace(/^\+/, '');
  if (/^09\d{9}$/.test(digits)) return [digits, `+63${digits.slice(1)}`];
  if (/^639\d{9}$/.test(digits)) return [`+${digits}`, `0${digits.slice(2)}`];
  return [digits];
}

export function interpretSearch(raw: string): SearchIntent | null {
  const trimmed = raw.trim();
  if (trimmed.length < 2) return null;

  const upper = trimmed.toUpperCase();
  if (APPLICATION_REF_PATTERN.test(upper)) return { kind: 'reference', reference: upper };

  const digits = trimmed.replace(/[\s()+-]/g, '');
  if (/^\+?\d{4,13}$/.test(digits)) return { kind: 'mobile', patterns: mobilePatterns(digits) };

  const tokens = trimmed
    .split(/\s+/)
    .map((token) => token.replace(/[^\p{L}\p{N}.'-]/gu, ''))
    .filter((token) => token.length >= 2)
    .slice(0, 4);
  if (tokens.length === 0) return null;
  return { kind: 'name', tokens };
}
