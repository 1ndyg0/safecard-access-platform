import { GuideReader } from "@/components/member/GuideReader";
import { MemberLibraryFrame } from "@/components/member/MemberLibraryFrame";
import { requireMemberPage } from "@/lib/auth/member-page";

export const metadata = { title: "Member Guide — SafeCard" };

export default async function MemberGuidePage() {
  await requireMemberPage();
  return <MemberLibraryFrame back="/member/library"><GuideReader /></MemberLibraryFrame>;
}
