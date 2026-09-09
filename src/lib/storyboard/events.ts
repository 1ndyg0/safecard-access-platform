/**
 * Storyboard analytics event contract.
 *
 * The schema is strict on purpose. `z.strictObject` rejects unknown
 * keys rather than dropping them, so a well-meaning future change that
 * starts attaching a reference number to events fails loudly at the
 * boundary instead of quietly writing it to the table.
 *
 * Everything a caller can influence is a closed set or a bounded
 * number. There is no free-text field anywhere in an event, which is
 * the only reliable way to guarantee no personal data arrives: a
 * validator can constrain a string's shape, but it cannot tell whether
 * someone typed their name into it.
 */

import { z } from 'zod';
import { BENEFIT_IDS, STORYBOARD_LOCALES } from './schema';

export const STORYBOARD_EVENT_NAMES = [
  'benefit_opened',
  'benefit_closed',
  'story_completed',
  'hotline_action_selected',
] as const;

export type StoryboardEventName = (typeof STORYBOARD_EVENT_NAMES)[number];

/** Thirty minutes. Longer readings are noise, not engagement. */
export const MAX_DURATION_MS = 1_800_000;

export const storyboardEventSchema = z.strictObject({
  benefit_id: z.enum(BENEFIT_IDS),
  event_name: z.enum(STORYBOARD_EVENT_NAMES),
  locale: z.enum(STORYBOARD_LOCALES),
  duration_ms: z.number().int().min(0).max(MAX_DURATION_MS).nullable().optional(),
  /** Random per visit. Not a user id, not persisted anywhere else. */
  visit_id: z.string().uuid(),
});

export type StoryboardEvent = z.infer<typeof storyboardEventSchema>;

/** A small batch, so a page can flush a few events in one request. */
export const storyboardEventBatchSchema = z.strictObject({
  events: z.array(storyboardEventSchema).min(1).max(20),
});

/**
 * Field names that must never appear in an event payload.
 *
 * Enforced by `strictObject` above; listed here so a test can assert the
 * intent directly rather than inferring it from a schema.
 */
export const FORBIDDEN_EVENT_FIELDS = [
  'name',
  'first_name',
  'last_name',
  'mobile_number',
  'email',
  'application_ref',
  'reference',
  'referral_code',
  'ip',
  'ip_address',
  'user_agent',
  'case_id',
  'notes',
  'comment',
] as const;
