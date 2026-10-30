"use client";

import Image from "next/image";
import { useLocale } from "@/components/LocaleProvider";
import { seasonalCopy as c } from "@/lib/seasonal/copy";
import "./christmas.css";

/** A short seasonal greeting under the member card. */
export function MemberGreeting() {
  const { locale } = useLocale();
  return (
    <div className="xmas-only">
      <aside className="xmas-greeting">
        <Image src="/seasonal/stocking.svg" width={35} height={52} alt="" unoptimized />
        <div><strong>{c.memberGreetingTitle[locale]}</strong><p>{c.memberGreetingBody[locale]}</p></div>
        <Image src="/seasonal/tree.svg" width={44} height={66} alt="" unoptimized />
      </aside>
    </div>
  );
}
