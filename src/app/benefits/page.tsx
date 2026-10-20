import { BenefitsExperience } from "@/components/BenefitsExperience";
import { PublicPage } from "@/components/PublicPage";
import { loadStoryboard } from "@/lib/storyboard/governed";

export const metadata = { title: "Benefits — SafeCard" };

export default async function BenefitsPage() {
  let loaded: Awaited<ReturnType<typeof loadStoryboard>> | null = null;
  try {
    loaded = await loadStoryboard();
  } catch {
    // Live mode exposes an explicit unavailable state below.
  }
  return (
    <PublicPage wide>
      <BenefitsExperience cards={loaded?.content.cards ?? null} provenance={loaded?.source === "approved" ? "approved" : "provisional"} />
    </PublicPage>
  );
}
