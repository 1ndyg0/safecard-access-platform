/**
 * Version-controlled fallback storyboard content.
 *
 * The content itself lives in `src/lib/benefit-storyboards.ts`, which is
 * the file the presentation layer already used. Keeping one copy matters
 * more than owning it: two content files would drift, and the one that
 * drifts is always the one nobody is editing.
 *
 * This module's job is to put that content behind the same validation
 * the governed registry has to pass. If an edit to the content file ever
 * drops a disclaimer or a language, the tests fail here rather than the
 * page rendering an unqualified promise about what PRC will pay for.
 */

import { benefitStoryboards } from '@/lib/benefit-storyboards';
import { storyboardContentSchema, type StoryboardContent } from './schema';

export const FALLBACK_VERSION = 'fallback-2026-09-09';

/**
 * Hotline guidance per card.
 *
 * The component renders the hotline action on every panel regardless, so
 * this is the sentence that tells the reader *when* calling is the right
 * move — which differs by card.
 */
const HOTLINE_GUIDANCE: Record<string, { fil: string; en: string }> = {
  ambulance: {
    fil: 'Sa emergency, Hotline 143 muna bago ang anumang iba pang hakbang.',
    en: 'In an emergency, call Hotline 143 before anything else.',
  },
  blood: {
    fil: 'Tumawag sa Hotline 143 para sa tamang proseso at mga kailangang dokumento.',
    en: 'Call Hotline 143 for the correct process and the documents required.',
  },
  hospital: {
    fil: 'Tumawag sa Hotline 143 bago mag-file para malaman ang aktwal na proseso.',
    en: 'Call Hotline 143 before filing so you know the actual process.',
  },
  exclusions: {
    fil: 'Bago umasa sa anumang saklaw, itanong muna sa Hotline 143.',
    en: 'Before relying on any coverage, ask Hotline 143 first.',
  },
};

function buildFallback(): StoryboardContent {
  const candidate = {
    version: FALLBACK_VERSION,
    // Repository content has not been through PRC approval, and must
    // never present itself as if it had.
    provenance: 'provisional' as const,
    approvedBy: null,
    approvedAt: null,
    cards: benefitStoryboards.map((card) => ({
      id: card.id,
      icon: card.icon,
      title: card.title,
      summary: card.summary,
      scenario: {
        fil: { ...card.scenario.fil, hotlineGuidance: HOTLINE_GUIDANCE[card.id]?.fil },
        en: { ...card.scenario.en, hotlineGuidance: HOTLINE_GUIDANCE[card.id]?.en },
      },
    })),
  };

  const validated = storyboardContentSchema.safeParse(candidate);
  if (!validated.success) {
    // Shipping unvalidated fallback content would defeat the point of
    // validating the governed registry at all: the fallback is what most
    // readers will actually see until PRC content is published.
    throw new Error(
      `Fallback storyboard content is invalid: ${validated.error.issues
        .map((issue) => `${issue.path.join('.')} ${issue.message}`)
        .join('; ')}`,
    );
  }
  return validated.data;
}

export const fallbackStoryboard: StoryboardContent = buildFallback();
