"use client";

import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import type { Locale } from "@/lib/public-content";

type LocaleContextValue = { locale: Locale; setLocale: (locale: Locale) => void };
const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const locale = useSyncExternalStore(
    (notify) => { window.addEventListener("safecard-locale", notify); return () => window.removeEventListener("safecard-locale", notify); },
    () => {
      const saved = window.localStorage.getItem("safecard-locale");
      return saved === "en" || saved === "fil" ? saved : "fil";
    },
    () => "fil" as Locale,
  );
  const value = useMemo(() => ({
    locale,
    setLocale(next: Locale) {
      window.localStorage.setItem("safecard-locale", next);
      document.documentElement.lang = next;
      window.dispatchEvent(new Event("safecard-locale"));
    },
  }), [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const value = useContext(LocaleContext);
  if (!value) throw new Error("useLocale must be used inside LocaleProvider");
  return value;
}
