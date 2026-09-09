/**
 * Benefit storyboard content contract.
 *
 * The shape is validated in full wherever content arrives, including
 * from the governed registry. Partial validation is the failure mode
 * worth guarding against: a payload missing a disclaimer still renders,
 * and what renders is an unqualified promise about what PRC will pay
 * for. The disclaimer is a required field for that reason.
 *
 * The four benefit identifiers must each appear exactly once. Not "at
 * least once" — a duplicated card would let one approved scenario be
 * silently replaced by another under the same heading.
 */

import { z } from 'zod';

export const BENEFIT_IDS = ['ambulance', 'blood', 'hospital_allowance', 'exclusions'] as const;
export type BenefitId = (typeof BENEFIT_IDS)[number];

export const STORYBOARD_LOCALES = ['fil', 'en'] as const;
export type StoryboardLocale = (typeof STORYBOARD_LOCALES)[number];

const localized = z.object({
  fil: z.string().trim().min(1),
  en: z.string().trim().min(1),
});

const scenario = z.object({
  /** Named, and fictional. Never a real applicant. */
  persona: z.string().trim().min(3).max(160),
  situation: z.string().trim().min(10).max(600),
  action: z.string().trim().min(10).max(600),
  mayProvide: z.string().trim().min(10).max(600),
  /** Optional: an exclusions card has no cost example. */
  costExample: z.string().trim().max(400).optional(),
  /** Required. This is what stops a scenario reading as a promise. */
  disclaimer: z.string().trim().min(20).max(600),
  hotlineGuidance: z.string().trim().min(10).max(400),
});

export const benefitCardSchema = z.object({
  id: z.enum(BENEFIT_IDS),
  icon: z.string().trim().min(1).max(8),
  title: localized,
  summary: localized,
  scenario: z.object({ fil: scenario, en: scenario }),
});

export type BenefitCard = z.infer<typeof benefitCardSchema>;

export const storyboardContentSchema = z
  .object({
    version: z.string().trim().min(1).max(40),
    /** 'approved' only when it came from the published registry. */
    provenance: z.enum(['approved', 'provisional']),
    approvedBy: z.string().trim().max(200).nullable().optional(),
    approvedAt: z.string().trim().max(40).nullable().optional(),
    cards: z.array(benefitCardSchema).length(BENEFIT_IDS.length),
  })
  .superRefine((value, context) => {
    const seen = new Map<string, number>();
    for (const card of value.cards) {
      seen.set(card.id, (seen.get(card.id) ?? 0) + 1);
    }
    for (const id of BENEFIT_IDS) {
      const count = seen.get(id) ?? 0;
      if (count !== 1) {
        context.addIssue({
          code: 'custom',
          path: ['cards'],
          message: `Benefit "${id}" must appear exactly once; found ${count}.`,
        });
      }
    }
  });

export type StoryboardContent = z.infer<typeof storyboardContentSchema>;

/** Parse without throwing, so a bad payload can fall back rather than 500. */
export function safeParseStoryboard(input: unknown) {
  return storyboardContentSchema.safeParse(input);
}
