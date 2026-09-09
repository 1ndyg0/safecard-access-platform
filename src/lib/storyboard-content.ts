import 'server-only';
import { z } from 'zod';
import { getPublishedContent } from '@/lib/content';
import { benefitStoryboards, type BenefitStoryboard, type StoryboardLocale } from '@/lib/benefit-storyboards';

const localizedStorySchema = z.object({
  id: z.enum(['ambulance', 'blood', 'hospital', 'exclusions']),
  icon: z.string().min(1).max(8),
  title: z.string().min(1).max(120),
  summary: z.string().min(1).max(300),
  persona: z.string().min(1).max(200),
  situation: z.string().min(1).max(1000),
  action: z.string().min(1).max(1000),
  mayProvide: z.string().min(1).max(1000),
  cost: z.string().min(1).max(600),
  disclaimer: z.string().min(1).max(600),
});

const registryBodySchema = z.object({
  stories: z.array(localizedStorySchema).length(4),
}).superRefine((value, context) => {
  const ids = new Set(value.stories.map((story) => story.id));
  if (ids.size !== 4) context.addIssue({ code: 'custom', path: ['stories'], message: 'Each benefit must appear exactly once.' });
});

function localizeFallback(locale: StoryboardLocale): BenefitStoryboard[] {
  return benefitStoryboards.map((story) => ({
    ...story,
    title: { fil: story.title[locale], en: story.title[locale] },
    summary: { fil: story.summary[locale], en: story.summary[locale] },
    scenario: { fil: story.scenario[locale], en: story.scenario[locale] },
  }));
}

export async function getStoryboardContent(locale: StoryboardLocale) {
  const registryLocale = locale === 'fil' ? 'tl' : 'en';
  const published = await getPublishedContent('benefit', registryLocale);
  if (!published) return { stories: localizeFallback(locale), approved: false, contentVersionId: null };

  try {
    const parsed = registryBodySchema.parse(JSON.parse(published.body));
    const stories: BenefitStoryboard[] = parsed.stories.map((story) => ({
      id: story.id,
      icon: story.icon,
      title: { fil: story.title, en: story.title },
      summary: { fil: story.summary, en: story.summary },
      scenario: {
        fil: { persona: story.persona, situation: story.situation, action: story.action, mayProvide: story.mayProvide, cost: story.cost, disclaimer: story.disclaimer },
        en: { persona: story.persona, situation: story.situation, action: story.action, mayProvide: story.mayProvide, cost: story.cost, disclaimer: story.disclaimer },
      },
    }));
    return { stories, approved: true, contentVersionId: published.id };
  } catch {
    return { stories: localizeFallback(locale), approved: false, contentVersionId: null };
  }
}
