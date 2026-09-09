"use client";

/**
 * Locale-aware wrapper.
 *
 * Content is fetched on the server and passed in, so the storyboard is
 * present in the first paint. Nothing here waits on the network before
 * rendering: the page is readable before any analytics request exists.
 */

import { useLocale } from "@/components/LocaleProvider";
import { BenefitStoryboard } from "@/components/BenefitStoryboard";
import type { BenefitCard } from "@/lib/storyboard/schema";

export function BenefitStoryboardSection({
  cards,
  provenance,
}: {
  cards: BenefitCard[];
  provenance: "approved" | "provisional";
}) {
  const { locale } = useLocale();
  return (
    <BenefitStoryboard
      cards={cards}
      locale={locale === "en" ? "en" : "fil"}
      provenance={provenance}
    />
  );
}
