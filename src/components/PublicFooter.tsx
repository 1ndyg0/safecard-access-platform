"use client";

import Link from "next/link";
import { BrandMark } from "@/components/BrandMark";
import { useLocale } from "@/components/LocaleProvider";
import { copy } from "@/lib/public-content";
import { SeasonFooterTag } from "@/components/seasonal/Season"; // SEASONAL:christmas-2026

export function PublicFooter() {
  const { locale } = useLocale();
  const t = copy[locale];
  return (
    <footer className="public-footer">
      <div className="footer-brand">
        <BrandMark />
        <p>{t.footerNote}</p>
      </div>
      <nav className="footer-links" aria-label={t.footerLinks}>
        <Link href="/#benefits">{t.navBenefits}</Link>
        <Link href="/#process">{t.navProcess}</Link>
        <Link href="/#faq">{t.navFaq}</Link>
        <Link href="/#downloads">{t.navDownloads}</Link>
        <Link href="/help">{t.navHelp}</Link>
        <Link href="/privacy">{t.privacy}</Link>
        <Link href="/member">{t.memberLogin}</Link>
      </nav>
      <a className="footer-emergency" href="tel:143">{t.emergency}</a>
      <SeasonFooterTag /> {/* SEASONAL:christmas-2026 */}
    </footer>
  );
}
