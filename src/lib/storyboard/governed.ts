/**
 * Governed storyboard content loader.
 *
 * Rules this encodes:
 *
 *   - In live mode, only approved AND published content is used.
 *   - The payload is validated in full. A malformed approved payload is
 *     treated exactly like an unreachable service: synthetic mode uses
 *     labelled fallback content; live mode fails closed.
 *   - The registry read is bounded. An unbounded await here would hold
 *     the benefits page open behind a service that may never answer.
 *   - The repository fallback is development/test content. It is never
 *     silently presented from a live deployment.
 */

import 'server-only';

import { getSupabaseAdminClient } from '@/lib/db/client';
import { resolveDataMode } from '@/lib/safety/data-mode';
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

export class GovernedContentUnavailableError extends Error {
  constructor(reason: LoadedStoryboard['fallbackReason']) {
    super(`Governed benefit content is unavailable (${reason ?? 'unknown'}).`);
    this.name = 'GovernedContentUnavailableError';
  }
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
 * Never returns a partial document. Synthetic mode gets labelled fallback
 * content; live mode throws an explicit governed-content error.
 */
export async function loadStoryboard(): Promise<LoadedStoryboard> {
  const mode = resolveDataMode();
  const unavailable = (reason: NonNullable<LoadedStoryboard['fallbackReason']>): LoadedStoryboard => {
    if (mode === 'live') throw new GovernedContentUnavailableError(reason);
    return { content: fallbackStoryboard, source: 'fallback', fallbackReason: reason };
  };
  try {
    const admin = getSupabaseAdminClient();
    let query = admin
      .from('content_versions')
      .select('id,version,body,approval_status,is_published,approved_by,approved_at,published_at')
      .eq('content_type', 'benefit')
      .eq('approval_status', 'approved')
      .eq('is_published', true)
      .order('published_at', { ascending: false })
      .limit(1);
    if (mode === 'live') {
      query = query.eq('version', Number(process.env.APPROVED_CONTENT_VERSION));
    }

    const outcome = await withTimeout(Promise.resolve(query.maybeSingle()), REGISTRY_TIMEOUT_MS);
    if (outcome === 'timeout') {
      return unavailable('timeout');
    }

    const { data, error } = outcome;
    if (error || !data) {
      return unavailable('not_published');
    }

    let parsedBody: unknown;
    try {
      parsedBody = typeof data.body === 'string' ? JSON.parse(data.body) : data.body;
    } catch {
      return unavailable('malformed');
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
      return unavailable('malformed');
    }

    return { content: validated.data, source: 'approved' };
  } catch (error) {
    if (error instanceof GovernedContentUnavailableError) throw error;
    return unavailable('unavailable');
  }
}
