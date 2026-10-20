import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { BenefitsExperience } from "@/components/BenefitsExperience";
import { loadStoryboard } from "@/lib/storyboard/governed";

export const metadata = { title: "Working SafeCard guide" };

export default async function BenefitsPage() {
  let loaded: Awaited<ReturnType<typeof loadStoryboard>> | null = null;
  try {
    loaded = await loadStoryboard();
  } catch {
    // Live mode exposes an explicit unavailable state below.
  }
  if (!loaded) return <main className="content-page"><header className="content-nav"><Link href="/"><BrandMark /></Link></header><article className="content-shell"><div className="parked-panel" role="alert"><strong>Governed benefit content is unavailable.</strong><p>The live application remains closed until the pinned published content is restored.</p></div></article></main>;
  return <main className="content-page"><header className="content-nav"><Link href="/"><BrandMark /></Link><Link href="/apply" className="button-primary">Start walkthrough →</Link></header><article className="content-shell"><p className="eyebrow">Information before consent</p><h1>What the working SafeCard pilot means—and does not mean.</h1><p className="content-lede">This governed controlled-pilot guide is not a final PRC benefits schedule. Only PRC confirms exact coverage, limits, eligibility, exclusions, activation, and claims decisions.</p><BenefitsExperience cards={loaded.content.cards} provenance={loaded.source === "approved" ? "approved" : "provisional"} /></article></main>;
}
