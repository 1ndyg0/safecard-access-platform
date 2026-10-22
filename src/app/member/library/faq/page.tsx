import { FaqPage } from "@/components/member/FaqPage";
import { MemberLibraryFrame } from "@/components/member/MemberLibraryFrame";
import { requireMemberPage } from "@/lib/auth/member-page";

export const metadata = { title: "Questions — SafeCard" };

export default async function MemberFaqPage() {
  await requireMemberPage();
  return <MemberLibraryFrame back="/member/library"><FaqPage /></MemberLibraryFrame>;
}
