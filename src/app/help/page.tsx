import { HelpPage } from "@/components/HelpPage";
import { PublicPage } from "@/components/PublicPage";

export const metadata = { title: "Help — SafeCard" };

export default function Help() {
  return <PublicPage wide><HelpPage /></PublicPage>;
}
