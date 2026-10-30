"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRightIcon, CheckIcon } from "@/components/icons";
import { useLocale } from "@/components/LocaleProvider";
import { whatYouGet } from "@/lib/education/content";
import { seasonalCopy as c } from "@/lib/seasonal/copy";
import "./christmas.css";

/**
 * Gift band that sits under the landing hero during the season. The hero and
 * every other section stay exactly as they are; this only adds to the page.
 * Amounts come from the same content the benefits section uses.
 */
export function GiftBand() {
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
              <Link className="button-primary" href="/gift/card">{c.giveCta[locale]}<ArrowRightIcon size={18} /></Link>
              <Link className="button-quiet" href="/gift">{c.howCta[locale]}</Link>
            </div>
            <p className="xmas-trust"><CheckIcon size={16} />{c.trust[locale]}</p>
          </div>
          <div className="xmas-art">
            <Image src="/seasonal/gift-box.svg" width={560} height={440} alt={c.bandArt[locale]} unoptimized />
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
