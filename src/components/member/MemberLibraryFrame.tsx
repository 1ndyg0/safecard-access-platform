"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { BackLink } from "@/components/BackLink";
import { BrandMark } from "@/components/BrandMark";
import { useLocale } from "@/components/LocaleProvider";
import { MemberNav } from "@/components/member/MemberNav";
import { library } from "@/lib/education/content";
import "@/components/education/education.css";

/** Page frame for the library: the same portal header as the other member pages, plus the member navigation. */
export function MemberLibraryFrame({ children, back }: { children: React.ReactNode; back?: string }) {
  const router = useRouter();
  const { locale } = useLocale();

  async function signOut() {
    await fetch("/api/member/logout", { method: "POST" });
    router.replace("/member");
    router.refresh();
  }

  return (
    <main className="portal-page">
      <div className="portal-shell">
        <header className="portal-header">
          <Link href="/" aria-label="SafeCard"><BrandMark /></Link>
          <button type="button" className="button-quiet" onClick={signOut}>{library.signOut[locale]}</button>
        </header>
        <div className="library-wrap">
          <MemberNav current="library" />
          {back && <div className="portal-toolbar"><BackLink fallbackHref={back} label={library.backToLibrary[locale]} /></div>}
          {children}
        </div>
      </div>
    </main>
  );
}
