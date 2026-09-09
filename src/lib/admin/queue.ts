/**
 * Submission queue filtering, sorting and pagination
 *
 * The five workflow states are independent state machines backed by five
 * distinct PostgreSQL enum types. Each filter therefore targets exactly
 * one column with a value drawn from that column's own enum.
 *
 * There is deliberately no generic "state" filter that compares one
 * value across all five columns. In PostgreSQL such a comparison is not
 * merely imprecise: `consent_state = 'active_confirmed'` raises
 * `invalid input value for enum consent_state` and fails the whole
 * query, because 'active_confirmed' is not a label of that enum type.
 * A cross-enum OR turns most filter selections into a 500.
 */

import { z } from 'zod';

export const CONSENT_STATES = [
  'not_started',
  'reviewing',
  'agreed',
  'withdrawn',
  'expired_due_to_content_change',
] as const;

export const APPLICATION_STATES = [
  'draft',
  'ready_for_review',
  'submitted',
  'correction_needed',
  'resubmitted',
  'withdrawn',
] as const;

export const PAYMENT_STATES = [
  'not_started',
  'official_handoff_opened',
  'payer_marked_paid',
  'verification_pending',
  'verified_by_official_source',
  'failed_or_cancelled',
  'refunded_or_reversed',
] as const;

export const PRC_HANDOFF_STATES = [
  'not_ready',
  'ready_for_export',
  'exported',
  'acknowledged',
  'correction_requested',
  'accepted',
  'rejected',
] as const;

export const MEMBERSHIP_STATES = [
  'not_active',
  'pending_prc_confirmation',
  'active_confirmed',
  'declined',
  'expired',
  'renewed',
] as const;

/**
 * Application-review buckets.
 *
 * Derived from application_state because no dedicated review-decision
 * state exists in the schema yet. When the application-review module
 * lands one, this maps onto it directly.
 */
export const REVIEW_BUCKETS = ['awaiting', 'correction_requested', 'not_in_review'] as const;
export type ReviewBucket = (typeof REVIEW_BUCKETS)[number];

const REVIEW_BUCKET_TO_APPLICATION_STATES: Record<
  ReviewBucket,
  ReadonlyArray<(typeof APPLICATION_STATES)[number]>
> = {
  awaiting: ['ready_for_review', 'submitted', 'resubmitted'],
  correction_requested: ['correction_needed'],
  not_in_review: ['draft', 'withdrawn'],
};

export const SORT_OPTIONS = ['newest', 'oldest', 'longest_waiting'] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

/**
 * An application reference is matched exactly, never as a prefix or a
 * substring. Partial matching over a unique identifier is a way to walk
 * the register one character at a time.
 */
const APPLICATION_REF_PATTERN = /^SC-\d{4}-[A-Z0-9]{8}$/;

export const queueQuerySchema = z.object({
  campaign_id: z.string().uuid(),
  application_ref: z
    .string()
    .trim()
    .toUpperCase()
    .regex(APPLICATION_REF_PATTERN, 'Enter a full application reference, for example SC-2026-AB12CD34')
    .optional(),
  consent_state: z.enum(CONSENT_STATES).optional(),
  application_state: z.enum(APPLICATION_STATES).optional(),
  review_bucket: z.enum(REVIEW_BUCKETS).optional(),
  payment_state: z.enum(PAYMENT_STATES).optional(),
  prc_handoff_state: z.enum(PRC_HANDOFF_STATES).optional(),
  membership_state: z.enum(MEMBERSHIP_STATES).optional(),
  from: z.string().date().optional(),
  to: z.string().date().optional(),
  sort: z.enum(SORT_OPTIONS).default('newest'),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});

export type QueueQuery = z.infer<typeof queueQuerySchema>;

/**
 * Parse a raw query string into a validated queue query.
 * Empty strings are dropped so that `?payment_state=` behaves as absent
 * rather than as an invalid enum value.
 */
export function parseQueueQuery(params: URLSearchParams): QueueQuery {
  const raw: Record<string, string> = {};
  for (const [key, value] of params.entries()) {
    if (value !== '') raw[key] = value;
  }
  return queueQuerySchema.parse(raw);
}

/**
 * Inclusive UTC day boundaries for a from/to date range.
 *
 * `to` covers the whole of its day. Dates arrive as calendar days and
 * are resolved in UTC so that a filter returns the same rows for staff
 * in Manila and staff reviewing from elsewhere; the console labels the
 * range as UTC rather than silently applying a viewer-local window.
 */
export function resolveDateRange(query: QueueQuery): {
  fromIso?: string;
  toIso?: string;
} {
  return {
    fromIso: query.from ? `${query.from}T00:00:00.000Z` : undefined,
    toIso: query.to ? `${query.to}T23:59:59.999Z` : undefined,
  };
}

export function reviewBucketStates(
  bucket: ReviewBucket,
): ReadonlyArray<(typeof APPLICATION_STATES)[number]> {
  return REVIEW_BUCKET_TO_APPLICATION_STATES[bucket];
}

/**
 * Serialize a queue query back into a URL search string so the console
 * can keep filters in the address bar and staff can share a view.
 */
export function serializeQueueQuery(query: Partial<QueueQuery>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    if (key === 'page' && value === 1) continue;
    if (key === 'sort' && value === 'newest') continue;
    params.set(key, String(value));
  }
  return params.toString();
}
