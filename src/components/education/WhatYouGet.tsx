"use client";

import Image from "next/image";
import Link from "next/link";
import { AmbulanceIcon, ArrowRightIcon, BadgeCheckIcon, BedIcon, FileTextIcon, HeartIcon, InfoIcon, ShieldAlertIcon } from "@/components/icons";
import { useLocale } from "@/components/LocaleProvider";
import { type BenefitTile, whatYouGet } from "@/lib/education/content";
import "./education.css";

function TileVisual({ visual }: { visual: BenefitTile["visual"] }) {
  if (visual.kind === "image") {
    return <span className="edu-visual"><Image src={visual.src} width={visual.width} height={visual.height} alt="" unoptimized /></span>;
  }
  const icon = { "shield-alert": <ShieldAlertIcon size={38} />, receipt: <FileTextIcon size={38} />, heart: <HeartIcon size={38} />, bed: <BedIcon size={38} /> }[visual.name];
  return <span className={`edu-visual ${visual.name === "heart" ? "heart" : ""}`}>{icon}</span>;
}

function Tiles({ tiles, locale, className = "" }: { tiles: readonly BenefitTile[]; locale: "fil" | "en"; className?: string }) {
  return (
    <ul className={`edu-tiles ${className}`}>
      {tiles.map((tile, index) => (
        <li key={tile.id} className={`edu-tile ${className === "" && index < 2 ? "big" : ""}`}>
          <TileVisual visual={tile.visual} />
          <span className="edu-amount">{tile.amount[locale]}</span>
          <p>{tile.text[locale]}</p>
          {tile.note && <small>{tile.note[locale]}</small>}
        </li>
      ))}
    </ul>
  );
}

/** "What you get": the two kinds of help, side by side, from two different organizations. */
export function WhatYouGet() {
  const { locale } = useLocale();
  const c = whatYouGet;
  return (
    <section className="edu-section first" id="benefits" aria-labelledby="benefits-title">
      <div className="edu-heading">
        <p className="eyebrow">{c.eyebrow[locale]}</p>
        <h2 id="benefits-title">{c.title[locale]}</h2>
        <p className="edu-intro">{c.intro[locale]}</p>
      </div>

      <div className="edu-band-card">
        <div className="edu-band-head insurance">
          <span className="edu-band-icon"><BadgeCheckIcon size={24} /></span>
          <div><h3>{c.insurance.title[locale]}</h3><p>{c.insurance.subtitle[locale]}</p></div>
        </div>
        <Tiles tiles={c.insurance.tiles} locale={locale} />
        <p className="edu-footnote"><InfoIcon size={18} /><span>{c.insurance.footnote[locale]}</span></p>
      </div>

      <div className="edu-band-card">
        <div className="edu-band-head services">
          <span className="edu-band-icon"><AmbulanceIcon size={24} /></span>
          <div><h3>{c.services.title[locale]}</h3><p>{c.services.subtitle[locale]}</p></div>
        </div>
        <Tiles tiles={c.services.tiles} locale={locale} className="two" />
        <p className="edu-footnote"><InfoIcon size={18} /><span>{c.services.footnote[locale]}</span></p>
      </div>

      <Link className="edu-text-link" href="/benefits">{c.examples[locale]}<ArrowRightIcon size={16} /></Link>
    </section>
  );
}
