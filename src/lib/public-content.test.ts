import { describe, expect, it } from 'vitest';
import { copy } from './public-content';
import { benefitStoryboards } from './benefit-storyboards';

/**
 * Public copy must read like a live product. Pilot, demo and
 * validation wording belongs in internal docs, not in what visitors read.
 */
const PILOT_WORDING = /pilot|school-project|for validation|working baseline|illustrative|synthetic|demo\b/i;

function strings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === 'object') return Object.values(value).flatMap(strings);
  return [];
}

describe('public copy', () => {
  it('has no pilot or test wording', () => {
    for (const text of strings(copy)) expect(text, text).not.toMatch(PILOT_WORDING);
  });

  it('keeps the benefit examples free of pilot wording', () => {
    for (const text of strings(benefitStoryboards.map((card) => card.scenario))) expect(text, text).not.toMatch(PILOT_WORDING);
  });

  it('keeps English and Filipino copy in step', () => {
    expect(Object.keys(copy.fil).sort()).toEqual(Object.keys(copy.en).sort());
    expect(copy.fil.steps).toHaveLength(copy.en.steps.length);
  });
});
