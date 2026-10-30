"use client";

import { useLocale } from "@/components/LocaleProvider";
import { seasonalCopy as c } from "@/lib/seasonal/copy";
import { GiftIcon } from "./GiftIcon";
import "./christmas.css";

/** A short seasonal greeting under the member card. Hidden outside the season. */
export function MemberGreeting() {
  const { locale } = useLocale();
  return (
    <div className="xmas-only">
      <aside className="xmas-greeting">
        <GiftIcon size={24} />
        <div><strong>{c.memberGreetingTitle[locale]}</strong><p>{c.memberGreetingBody[locale]}</p></div>
      </aside>
    </div>
  );
}
