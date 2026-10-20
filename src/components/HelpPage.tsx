"use client";

import Link from "next/link";
import { ArrowRightIcon } from "@/components/icons";
import { HelpBlock } from "@/components/HelpBlock";
import { useLocale } from "@/components/LocaleProvider";

export function HelpPage() {
  const { locale } = useLocale();
  const isFil = locale === "fil";
  return (
    <>
      <HelpBlock showMoreLink={false} headingLevel={1} />
      <section className="content-section">
        <h2>{isFil ? "Saan makakatulong ang platform" : "What the platform can help with"}</h2>
        <p>
          {isFil
            ? "Nakakatulong ang SafeCard sa pag-navigate ng application, privacy rights, pag-access gamit ang reference number, correction workflow, at mga teknikal na problema. Hindi nito magagarantiya ang pagtanggap, hindi ito nag-a-activate ng membership, at hindi ito nagdedesisyon ng claim."
            : "SafeCard can help with navigating the application, privacy rights, accessing your application with your reference number, corrections, and technical problems. It cannot guarantee acceptance, activate a membership, or decide a claim."}
        </p>
        <p>
          {isFil
            ? "Ang mga tanong tungkol sa opisyal na benepisyo, eligibility, activation, o claims ay sa Philippine Red Cross, hindi sa nagbabayad, paaralan, o sa SafeCard."
            : "Questions about official benefits, eligibility, activation, or claims belong with the Philippine Red Cross, not a payer, a school, or SafeCard."}
        </p>
      </section>
      <div className="page-actions">
        <Link href="/apply" className="button-primary">{isFil ? "Mag-apply na" : "Apply now"}<ArrowRightIcon size={18} /></Link>
        <Link href="/privacy" className="button-quiet">{isFil ? "Paunawa sa privacy" : "Privacy notice"}</Link>
      </div>
    </>
  );
}
