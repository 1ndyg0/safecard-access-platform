"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type CSSProperties } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { seasonalCopy as c } from "@/lib/seasonal/copy";
import "./christmas.css";

/**
 * Pieces of Christmas decoration shared by the public pages. Each one renders
 * markup that stays hidden (`.xmas-only`) until the head script switches the
 * season on, so the same HTML is correct before, during and after the season.
 */

/** Green banner with the apply-by date, then the twinkling light string. */
export function SeasonTop() {
  const { locale } = useLocale();
  return (
    <div className="xmas-only" data-testid="xmas-top">
      <p className="xmas-strip">
        {c.strip[locale]}
        <Link href="/gift">{c.stripLink[locale]}</Link>
      </p>
      <div className="xmas-lights" aria-hidden="true" />
    </div>
  );
}

/** Garland that hangs under the header. `light` is the quieter size for the application. */
export function SeasonGarland({ light = false }: { light?: boolean }) {
  return (
    <div className="xmas-only" aria-hidden="true">
      <div className={`xmas-garland ${light ? "light" : ""}`} />
    </div>
  );
}

const FLAKES = Array.from({ length: 16 }, (_, index) => ({
  x: `${(index * 61 + 7) % 100}%`,
  s: `${3 + ((index * 5) % 5)}px`,
  d: `${11 + ((index * 3) % 9)}s`,
  delay: `-${(index * 7) % 13}s`,
}));

/** Slow snowfall behind the content. It is decoration only and is off for reduced motion. */
export function SeasonSnow() {
  return (
    <div className="xmas-only" aria-hidden="true">
      <div className="xmas-snow">
        {FLAKES.map((flake, index) => (
          <i key={index} style={{ "--x": flake.x, "--s": flake.s, "--d": flake.d, "--delay": flake.delay } as CSSProperties} />
        ))}
      </div>
    </div>
  );
}

/** "Gift" link for the main navigation. The wrapper vanishes so the link sits in the nav row. */
export function SeasonNavLink({ onNavigate, current }: { onNavigate?: () => void; current?: boolean }) {
  const { locale } = useLocale();
  return (
    <span className="xmas-only xmas-contents">
      <Link href="/gift" className="xmas-nav-link" onClick={onNavigate} aria-current={current ? "page" : undefined}>{c.navGift[locale]}</Link>
    </span>
  );
}

export function SeasonFooterTag() {
  const { locale } = useLocale();
  return (
    <div className="xmas-only">
      <p className="xmas-foot-tag"><span>{c.footerTag[locale]}</span><span>{c.footerTagApplyBy[locale]}</span></p>
    </div>
  );
}

/**
 * Shown on the gift pages once the season is over. If the page is opened out of
 * season it sends the visitor home; without JavaScript the notice stays.
 */
export function SeasonEnded() {
  const { locale } = useLocale();
  const router = useRouter();
  useEffect(() => {
    if (document.documentElement.getAttribute("data-season") !== "christmas") router.replace("/");
  }, [router]);
  return (
    <div className="xmas-off">
      <div className="xmas-ended">
        <h1>{c.endedTitle[locale]}</h1>
        <p>{c.endedBody[locale]}</p>
        <Link className="button-primary" href="/">{c.endedCta[locale]}</Link>
      </div>
    </div>
  );
}
