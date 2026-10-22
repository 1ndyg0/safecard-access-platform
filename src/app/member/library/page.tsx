import { LibraryHome } from "@/components/member/LibraryHome";
import { MemberLibraryFrame } from "@/components/member/MemberLibraryFrame";
import { requireMemberPage } from "@/lib/auth/member-page";

export const metadata = { title: "Library — SafeCard" };

export default async function MemberLibraryPage() {
  await requireMemberPage();
  return <MemberLibraryFrame><LibraryHome /></MemberLibraryFrame>;
}
