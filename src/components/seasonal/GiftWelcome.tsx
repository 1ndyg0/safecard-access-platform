"use client";

import { useSearchParams } from "next/navigation";
import { useLocale } from "@/components/LocaleProvider";
import { seasonalCopy as c } from "@/lib/seasonal/copy";
import { GiftIcon } from "./GiftIcon";
import "./christmas.css";

/**
 * Shown above the first application step when someone opens a gift link
 * (/apply?gift=1). It adds one friendly panel and changes nothing about the
 * application, its consent steps or its privacy rules. The link carries no
 * name or other detail about the giver.
 */
export function GiftWelcome() {
  const { locale } = useLocale();
  const params = useSearchParams();
  if (params.get("gift") !== "1") return null;
  return (
    <div className="xmas-only">
      <aside className="xmas-welcome" data-testid="gift-welcome" aria-labelledby="gift-welcome-title">
        <span className="orb"><GiftIcon size={22} /></span>
        <div>
          <h2 id="gift-welcome-title">{c.welcomeTitle[locale]}</h2>
          <p>{c.welcomeBody[locale]}</p>
        </div>
      </aside>
    </div>
  );
}
