"use client";

import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import { BenefitStoryboard } from "@/components/BenefitStoryboard";
import { HelpBlock } from "@/components/HelpBlock";
import { useLocale } from "@/components/LocaleProvider";
import type { BenefitCard } from "@/lib/storyboard/schema";

export function BenefitsExperience({
  cards,
  provenance,
}: {
  cards: BenefitCard[] | null;
  provenance: "approved" | "provisional";
}) {
  const { locale } = useLocale();
  const isFil = locale === "fil";
  return (
    <>
      <header className="page-intro">
        <p className="eyebrow">{isFil ? "Bago ka magpasya" : "Before you decide"}</p>
        <h1>{isFil ? "Ano ang maaasahan mo sa SafeCard — at ano ang hindi." : "What to expect from SafeCard, and what not to."}</h1>
        <p className="content-lede">
          {isFil
            ? "Isang malinaw na gabay sa mga benepisyo. Hindi ito kumpletong iskedyul ng benepisyo: ang PRC lamang ang nagkukumpirma ng eksaktong saklaw, limitasyon, eligibility, exclusions, at claims."
            : "A plain-language guide to the benefits. It is not a complete benefits schedule: only PRC confirms exact coverage, limits, eligibility, exclusions, and claims decisions."}
        </p>
        <div className="notice-panel amber">
          <strong>{isFil ? "Mahalagang tandaan" : "Good to know"}</strong>
          <span>
            {isFil
              ? "Ang bayad ay hindi pahintulot, submission, approval, o membership activation. Ang PRC lamang ang nagkukumpirma ng membership."
              : "Payment is not consent, submission, approval, or membership activation. Only PRC confirms membership."}
          </span>
        </div>
      </header>

      {cards ? (
        <BenefitStoryboard cards={cards} locale={locale} provenance={provenance} />
      ) : (
        <div className="parked-panel" role="alert">
          <strong>{isFil ? "Pansamantalang hindi available ang benefit guide." : "The benefit guide is temporarily unavailable."}</strong>
          <p>{isFil ? "Hindi magbubukas ang application hangga't hindi naibabalik ang nilalaman." : "Applications will remain unavailable until the content is restored."}</p>
        </div>
      )}

      <div className="page-actions">
        <Link href="/apply" className="button-primary">{isFil ? "Mag-apply na" : "Apply now"}<ArrowRightIcon size={18} /></Link>
        <Link href="/privacy" className="button-quiet">{isFil ? "Paunawa sa privacy" : "Privacy notice"}</Link>
      </div>

      <HelpBlock />
    </>
  );
}
