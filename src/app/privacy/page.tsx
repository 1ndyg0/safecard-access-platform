import { PrivacyNotice } from "@/components/PrivacyNotice";
import { PublicPage } from "@/components/PublicPage";

export const metadata = { title: "Privacy notice — SafeCard" };

export default function PrivacyPage() {
  return <PublicPage><PrivacyNotice /></PublicPage>;
}
