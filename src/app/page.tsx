import { Suspense } from "react";
import { LandingExperience } from "@/components/LandingExperience";
import { loadStoryboard } from "@/lib/storyboard/governed";

export default async function LandingPage() {
  let loaded: Awaited<ReturnType<typeof loadStoryboard>> | null = null;
  try {
    loaded = await loadStoryboard();
  } catch {
    // Live mode exposes an explicit unavailable state below.
  }
  return <Suspense><LandingExperience cards={loaded?.content.cards ?? null} provenance={loaded?.source === "approved" ? "approved" : "provisional"} /></Suspense>;
}
