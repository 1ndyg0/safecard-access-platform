import { describe, expect, it } from 'vitest';
import { BENEFIT_IDS, safeParseStoryboard, storyboardContentSchema } from './schema';
import { fallbackStoryboard } from './fallback';
import {
  FORBIDDEN_EVENT_FIELDS,
  MAX_DURATION_MS,
  storyboardEventBatchSchema,
  storyboardEventSchema,
} from './events';

const validEvent = {
  benefit_id: 'ambulance',
  event_name: 'benefit_opened',
  locale: 'fil',
  duration_ms: 4200,
  visit_id: '11111111-1111-4111-8111-111111111111',
};

describe('fallback content is complete and shippable', () => {
  it('validates against the full contract', () => {
    expect(storyboardContentSchema.safeParse(fallbackStoryboard).success).toBe(true);
  });

  it('contains each of the four benefits exactly once', () => {
    const ids = fallbackStoryboard.cards.map((card) => card.id);
    expect(ids.sort()).toEqual([...BENEFIT_IDS].sort());
    expect(new Set(ids).size).toBe(4);
  });

  it('carries a Filipino and an English scenario for every card', () => {
    for (const card of fallbackStoryboard.cards) {
      for (const locale of ['fil', 'en'] as const) {
        const scenario = card.scenario[locale];
        expect(scenario.persona.length).toBeGreaterThan(3);
        expect(scenario.situation.length).toBeGreaterThan(10);
        expect(scenario.action.length).toBeGreaterThan(10);
        expect(scenario.mayProvide.length).toBeGreaterThan(10);
        expect(scenario.disclaimer.length).toBeGreaterThan(20);
        expect(scenario.hotlineGuidance).toContain('143');
      }
    }
  });

  it('never presents itself as approved', () => {
    // Repository content has not been through PRC approval.
    expect(fallbackStoryboard.provenance).toBe('provisional');
    expect(fallbackStoryboard.approvedBy).toBeNull();
  });

  it('says every scenario is illustrative', () => {
    for (const card of fallbackStoryboard.cards) {
      expect(card.scenario.en.disclaimer.toLowerCase()).toContain('illustrative');
      expect(card.scenario.fil.disclaimer.toLowerCase()).toContain('halimbawa');
    }
  });
});

describe('content validation refuses partial documents', () => {
  it('rejects a duplicated benefit', () => {
    const duplicated = {
      ...fallbackStoryboard,
      cards: [
        fallbackStoryboard.cards[0],
        fallbackStoryboard.cards[0],
        fallbackStoryboard.cards[1],
        fallbackStoryboard.cards[2],
      ],
    };
    const result = safeParseStoryboard(duplicated);
    expect(result.success).toBe(false);
  });

  it('rejects a missing benefit', () => {
    expect(safeParseStoryboard({ ...fallbackStoryboard, cards: fallbackStoryboard.cards.slice(0, 3) }).success).toBe(
      false,
    );
  });

  it('rejects a card with no disclaimer', () => {
    const cards = structuredClone(fallbackStoryboard.cards);
    // A scenario without a disclaimer reads as a promise about payouts.
    (cards[0].scenario.en as Record<string, unknown>).disclaimer = '';
    expect(safeParseStoryboard({ ...fallbackStoryboard, cards }).success).toBe(false);
  });

  it('rejects a card missing one language', () => {
    const cards = structuredClone(fallbackStoryboard.cards) as Array<Record<string, unknown>>;
    delete (cards[1].title as Record<string, unknown>).fil;
    expect(safeParseStoryboard({ ...fallbackStoryboard, cards }).success).toBe(false);
  });

  it('rejects an unknown benefit id', () => {
    const cards = structuredClone(fallbackStoryboard.cards) as Array<Record<string, unknown>>;
    cards[0].id = 'dental';
    expect(safeParseStoryboard({ ...fallbackStoryboard, cards }).success).toBe(false);
  });

  it('rejects a completely malformed payload without throwing', () => {
    expect(safeParseStoryboard(null).success).toBe(false);
    expect(safeParseStoryboard('a string').success).toBe(false);
    expect(safeParseStoryboard({ cards: 'nope' }).success).toBe(false);
  });
});

describe('analytics events carry no personal data', () => {
  it('accepts a well-formed event', () => {
    expect(storyboardEventSchema.safeParse(validEvent).success).toBe(true);
  });

  it('rejects any additional field rather than dropping it', () => {
    for (const field of FORBIDDEN_EVENT_FIELDS) {
      const result = storyboardEventSchema.safeParse({
        ...validEvent,
        [field]: 'Maria Santos',
      });
      expect(result.success, `${field} should be rejected`).toBe(false);
    }
  });

  it('rejects an unknown event name', () => {
    expect(
      storyboardEventSchema.safeParse({ ...validEvent, event_name: 'page_view' }).success,
    ).toBe(false);
  });

  it('rejects an unknown benefit id', () => {
    expect(
      storyboardEventSchema.safeParse({ ...validEvent, benefit_id: 'dental' }).success,
    ).toBe(false);
  });

  it('rejects an unsupported locale', () => {
    expect(storyboardEventSchema.safeParse({ ...validEvent, locale: 'es' }).success).toBe(
      false,
    );
  });

  it('rejects a negative or absurd duration', () => {
    expect(storyboardEventSchema.safeParse({ ...validEvent, duration_ms: -1 }).success).toBe(
      false,
    );
    expect(
      storyboardEventSchema.safeParse({ ...validEvent, duration_ms: MAX_DURATION_MS + 1 })
        .success,
    ).toBe(false);
    expect(
      storyboardEventSchema.safeParse({ ...validEvent, duration_ms: MAX_DURATION_MS }).success,
    ).toBe(true);
  });

  it('requires a visit id, and requires it to be a UUID', () => {
    const withoutVisit: Record<string, unknown> = { ...validEvent };
    delete withoutVisit.visit_id;
    expect(storyboardEventSchema.safeParse(withoutVisit).success).toBe(false);
    expect(
      storyboardEventSchema.safeParse({ ...validEvent, visit_id: 'visitor-1' }).success,
    ).toBe(false);
  });

  it('refuses an oversized batch', () => {
    const events = Array.from({ length: 21 }, () => validEvent);
    expect(storyboardEventBatchSchema.safeParse({ events }).success).toBe(false);
    expect(storyboardEventBatchSchema.safeParse({ events: [] }).success).toBe(false);
    expect(
      storyboardEventBatchSchema.safeParse({ events: events.slice(0, 20) }).success,
    ).toBe(true);
  });

  it('refuses a batch whole when one event is bad', () => {
    const result = storyboardEventBatchSchema.safeParse({
      events: [validEvent, { ...validEvent, event_name: 'nope' }],
    });
    expect(result.success).toBe(false);
  });
});
