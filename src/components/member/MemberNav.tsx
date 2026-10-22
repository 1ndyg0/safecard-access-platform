"use client";

import Link from "next/link";
import { useLocale } from "@/components/LocaleProvider";
import { library } from "@/lib/education/content";
import "@/components/education/education.css";

export type MemberSection = "card" | "status" | "library";

/** The three places a signed-in member can go. A row of real links, so it also works as a plain list. */
export function MemberNav({ current }: { current: MemberSection }) {
  const { locale } = useLocale();
  const items: { id: MemberSection; href: string; label: string }[] = [
    { id: "card", href: "/member/card", label: library.navCard[locale] },
    { id: "status", href: "/member/status", label: library.navStatus[locale] },
    { id: "library", href: "/member/library", label: library.navLibrary[locale] },
  ];
  return (
    <nav aria-label={library.navLabel[locale]}>
      <ul className="member-nav">
        {items.map((item) => (
          <li key={item.id}><Link href={item.href} aria-current={current === item.id ? "page" : undefined}>{item.label}</Link></li>
        ))}
      </ul>
    </nav>
  );
}
