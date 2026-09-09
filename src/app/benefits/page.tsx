import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { BenefitsExperience } from "@/components/BenefitsExperience";
import { loadStoryboard } from "@/lib/storyboard/governed";

export const metadata = { title: "Working SafeCard guide" };

export default async function BenefitsPage() {
  // Resolved on the server so the storyboard is in the first paint.
  // Never throws: an unreachable registry yields repository fallback.
  const { content, source } = await loadStoryboard();
  return <main className="content-page"><header className="content-nav"><Link href="/"><BrandMark /></Link><Link href="/apply" className="button-primary">Start walkthrough →</Link></header><article className="content-shell"><p className="eyebrow">Information before consent</p><h1>What the working SafeCard pilot means—and does not mean.</h1><p className="content-lede">This is a provisional information guide, not an official benefits schedule. Exact coverage, limits, eligibility, exclusions, activation, and claims rules require approved Philippine Red Cross source content before live collection opens.</p><BenefitsExperience cards={content.cards} provenance={source === "approved" ? "approved" : "provisional"} /></article></main>;
}
