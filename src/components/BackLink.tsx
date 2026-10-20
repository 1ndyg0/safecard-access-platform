"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { ArrowLeftIcon } from "@/components/icons";
import { useLocale } from "@/components/LocaleProvider";

/**
 * Counts client-side navigations in this tab. `document.referrer` does not
 * change when Next.js navigates without a reload, so on its own it cannot
 * tell whether "back" would stay inside the site.
 */
let inAppNavigations = 0;

export function NavigationTracker() {
  const pathname = usePathname();
  const previous = useRef(pathname);
  useEffect(() => {
    if (previous.current !== pathname) {
      inAppNavigations += 1;
      previous.current = pathname;
    }
  }, [pathname]);
  return null;
}

function canGoBackInSite(): boolean {
  if (inAppNavigations > 0) return true;
  try {
    return Boolean(document.referrer) && new URL(document.referrer).origin === window.location.origin;
  } catch {
    return false;
  }
}

type BackProps = {
  /** Where to go when the visitor arrived directly (no earlier page on this site). */
  fallbackHref?: string;
  /** Replaces history navigation, for in-page steps such as the application wizard. */
  onBack?: () => void;
  label?: string;
  className?: string;
};

/**
 * One back control for every inner screen: same position, same style.
 * It is a real link to the fallback page, so it still works without
 * JavaScript; with JavaScript it returns to the previous page.
 */
export function BackLink({ fallbackHref = "/", onBack, label, className = "" }: BackProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const text = label ?? (locale === "fil" ? "Bumalik" : "Back");
  const classes = `back-link ${className}`.trim();

  if (onBack) {
    return (
      <button type="button" className={classes} onClick={onBack}>
        <ArrowLeftIcon size={18} />
        <span>{text}</span>
      </button>
    );
  }

  return (
    <Link
      href={fallbackHref}
      className={classes}
      onClick={(event) => {
        if (canGoBackInSite()) {
          event.preventDefault();
          router.back();
        }
      }}
    >
      <ArrowLeftIcon size={18} />
      <span>{text}</span>
    </Link>
  );
}
