/**
 * Governed storyboard content loader.
 *
 * Rules this encodes:
 *
 *   - In live mode, only approved AND published content is used.
 *   - The payload is validated in full. A malformed approved payload is
 *     treated exactly like an unreachable service: fall back, do not
 *     render half a scenario.
 *   - The registry read is bounded. An unbounded await here would hold
 *     the benefits page open behind a service that may never answer.
 *   - Unavailable governed content is not an error the visitor should
 *     see. There is safe fallback content in the repository, so the page
 *     renders and reports its provenance rather than returning 500.
 */

import 'server-only';

import { getSupabaseAdminClient } from '@/lib/db/client';
import { fallbackStoryboard } from './fallback';
import { safeParseStoryboard, type StoryboardContent } from './schema';

/** Bounded so a slow registry cannot hold the page open. */
export const REGISTRY_TIMEOUT_MS = Number(process.env.STORYBOARD_TIMEOUT_MS ?? 1_500);

export type ContentSource = 'approved' | 'fallback';

export interface LoadedStoryboard {
  content: StoryboardContent;
  source: ContentSource;
  /** Why the fallback was used, for the admin view and the logs. */
  fallbackReason?: 'timeout' | 'unavailable' | 'not_published' | 'malformed';
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T | 'timeout'> {
  return Promise.race([
    work,
    new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), ms)),
  ]);
}

/**
 * Load the storyboard.
 *
 * Always resolves. Never throws, and never returns a partial document:
 * the caller gets approved content or the repository fallback.
 */
export async function loadStoryboard(): Promise<LoadedStoryboard> {
  try {
    const admin = getSupabaseAdminClient();
    const query = admin
      .from('content_versions')
      .select('id,version,body,approval_status,is_published,approved_by,approved_at,published_at')
      .eq('content_type', 'benefit')
      .eq('approval_status', 'published')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const outcome = await withTimeout(Promise.resolve(query), REGISTRY_TIMEOUT_MS);
    if (outcome === 'timeout') {
      return { content: fallbackStoryboard, source: 'fallback', fallbackReason: 'timeout' };
    }

    const { data, error } = outcome;
    if (error || !data) {
      return { content: fallbackStoryboard, source: 'fallback', fallbackReason: 'not_published' };
    }

    let parsedBody: unknown;
    try {
      parsedBody = typeof data.body === 'string' ? JSON.parse(data.body) : data.body;
    } catch {
      return { content: fallbackStoryboard, source: 'fallback', fallbackReason: 'malformed' };
    }

    const validated = safeParseStoryboard({
      version: String(data.version ?? data.id),
      provenance: 'approved',
      approvedBy: data.approved_by ?? null,
      approvedAt: data.approved_at ?? null,
      // The registry stores the cards; the envelope is assembled here so
      // an editor cannot claim their own draft is "approved".
      cards: (parsedBody as { cards?: unknown })?.cards ?? parsedBody,
    });

    if (!validated.success) {
      // An approved-but-malformed payload is the dangerous case: it
      // looks authoritative. Refuse it the same as a missing one.
      return { content: fallbackStoryboard, source: 'fallback', fallbackReason: 'malformed' };
    }

    return { content: validated.data, source: 'approved' };
  } catch {
    return { content: fallbackStoryboard, source: 'fallback', fallbackReason: 'unavailable' };
  }
}
