"use client";

import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { whatYouGet } from "@/lib/education/content";
import { seasonalCopy as c } from "@/lib/seasonal/copy";
import "./christmas.css";

/**
 * Pieces of Christmas decoration shared by the public pages. All of it is
 * hidden from assistive technology, ignores the pointer, and is removed in
 * print, so it can never get in the way of a control or a screen reader.
 */

/** Artwork in /public/seasonal. Sizes are the files' own, so there is no layout shift. */
const ART = {
  santa: { src: "/seasonal/santa.svg", width: 210, height: 272 },
  reindeer: { src: "/seasonal/reindeer.svg", width: 250, height: 210 },
  snowman: { src: "/seasonal/snowman.svg", width: 160, height: 230 },
  tree: { src: "/seasonal/tree.svg", width: 180, height: 270 },
  gingerbread: { src: "/seasonal/gingerbread.svg", width: 110, height: 140 },
  candyCane: { src: "/seasonal/candy-cane.svg", width: 56, height: 130 },
  stocking: { src: "/seasonal/stocking.svg", width: 70, height: 104 },
  bell: { src: "/seasonal/bell.svg", width: 64, height: 76 },
  holly: { src: "/seasonal/holly.svg", width: 110, height: 56 },
  sleigh: { src: "/seasonal/sleigh.svg", width: 660, height: 230 },
  star: { src: "/seasonal/star.svg", width: 40, height: 40 },
} as const;
type ArtName = keyof typeof ART;

function Art({ name, className = "" }: { name: ArtName; className?: string }) {
  const art = ART[name];
  return <Image className={`xmas-art-${name} ${className}`} src={art.src} width={art.width} height={art.height} alt="" unoptimized />;
}

/** Green banner with the apply-by date, then the twinkling light string. */
export function SeasonTop() {
  return (
    <div className="xmas-only" data-testid="xmas-top">
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

const FLAKES = Array.from({ length: 22 }, (_, index) => ({
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

/**
 * A row of characters standing on a snow bank. It sits between sections and
 * takes its own space, so it never covers any text. The `opt` characters drop
 * out on narrow screens.
 */
const SCENES: Record<string, { name: ArtName; opt?: boolean }[]> = {
  village: [{ name: "candyCane", opt: true }, { name: "tree" }, { name: "santa" }, { name: "reindeer" }, { name: "snowman", opt: true }, { name: "gingerbread", opt: true }],
  friends: [{ name: "stocking", opt: true }, { name: "snowman" }, { name: "gingerbread" }, { name: "tree", opt: true }, { name: "candyCane" }, { name: "reindeer", opt: true }],
  workshop: [{ name: "tree", opt: true }, { name: "reindeer" }, { name: "santa" }, { name: "stocking", opt: true }, { name: "gingerbread" }],
  cheer: [{ name: "bell", opt: true }, { name: "stocking" }, { name: "snowman" }, { name: "holly", opt: true }, { name: "santa" }, { name: "candyCane", opt: true }],
  mini: [{ name: "candyCane" }, { name: "tree" }, { name: "snowman" }, { name: "stocking", opt: true }],
};

export function SeasonScene({ variant, flyby = false }: { variant: keyof typeof SCENES; flyby?: boolean }) {
  return (
    <div className="xmas-only" aria-hidden="true">
      <div className={`xmas-scene xmas-scene-${variant}`}>
        {flyby && <Art name="sleigh" className="xmas-flyby" />}
        <div className="xmas-scene-row">
          {SCENES[variant].map((item, index) => (
            <span key={index} className={item.opt ? "opt" : undefined}><Art name={item.name} /></span>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Closing scene and greeting at the foot of every public page. */
export function SeasonFooterTag() {
  const { locale } = useLocale();
  return (
    <div className="xmas-only xmas-footer-block">
      <SeasonScene variant="village" />
      <p className="xmas-foot-tag"><span>{c.footerTag[locale]}</span><span>{c.footerTagApplyBy[locale]}</span></p>
    </div>
  );
}

/** The festive band under the landing hero: Santa's sleigh over a snowy village. */
export function SeasonBand() {
  const { locale } = useLocale();
  const tiles = [whatYouGet.insurance.tiles[0], whatYouGet.insurance.tiles[4], whatYouGet.services.tiles[0]];
  return (
    <div className="xmas-only" data-testid="xmas-band">
      <section className="xmas-band" aria-labelledby="xmas-band-title">
        <div className="xmas-band-inner">
          <div>
            <p className="xmas-badge">{c.badge[locale]}</p>
            <h2 id="xmas-band-title">{c.bandTitle[locale]}</h2>
            <p className="lede">{c.bandBody[locale]}</p>
            <div className="xmas-actions">
              <Link className="button-primary" href="/apply">{c.bandApply[locale]}</Link>
              <a className="button-quiet" href="#benefits">{c.bandCovered[locale]}</a>
            </div>
          </div>
          <div className="xmas-art">
            <Image src="/seasonal/night.svg" width={640} height={440} alt={c.bandArt[locale]} unoptimized />
          </div>
        </div>
        <ul className="xmas-ornaments">
          {tiles.map((tile) => (
            <li key={tile.id}><strong>{tile.amount[locale]}</strong><span>{tile.text[locale]}</span></li>
          ))}
        </ul>
      </section>
    </div>
  );
}
