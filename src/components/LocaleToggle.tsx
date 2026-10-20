"use client";

import { useLocale } from "@/components/LocaleProvider";

/**
 * Two-option language switch. Both options are real buttons so the current
 * choice is announced (`aria-pressed`) and each is a full-size touch target.
 */
export function LocaleToggle({ className = "" }: { className?: string }) {
  const { locale, setLocale } = useLocale();
  return (
    <div className={`locale-switch ${className}`} role="group" aria-label={locale === "fil" ? "Wika" : "Language"}>
      <button type="button" lang="fil" aria-pressed={locale === "fil"} onClick={() => setLocale("fil")}>FIL</button>
      <button type="button" lang="en" aria-pressed={locale === "en"} onClick={() => setLocale("en")}>EN</button>
    </div>
  );
}
