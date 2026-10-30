"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { CloseIcon, MenuIcon } from "@/components/icons";
import { LocaleToggle } from "@/components/LocaleToggle";
import { useLocale } from "@/components/LocaleProvider";
import { copy } from "@/lib/public-content";
import { SeasonGarland, SeasonTop } from "@/components/seasonal/Season"; // SEASONAL:christmas-2026

/**
 * Header shared by every public page.
 *
 * Information links (Benefits, How it works, Help) sit in the centre.
 * Account actions (Member login, Admin) and the language switch form their
 * own visually separated group on the right. Below 960px that group moves
 * into a disclosure menu: a real button with aria-expanded, closed by
 * Escape, by choosing a link, or by tapping outside.
 */
export function SiteHeader() {
  const { locale } = useLocale();
  const t = copy[locale];
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLElement>(null);
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") { setOpen(false); toggle.current?.focus(); }
    }
    function onPointer(event: PointerEvent) {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => { document.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", onPointer); };
  }, [open]);

  const link = (href: string, label: string, extra = "") => (
    <Link href={href} className={extra} onClick={() => setOpen(false)} aria-current={pathname === href ? "page" : undefined}>{label}</Link>
  );

  return (
    <>
    <header className="site-header" ref={root}>
      <a className="skip-link" href="#main-content">{t.skip}</a>
      <SeasonTop /> {/* SEASONAL:christmas-2026 */}
      <div className="site-header-bar">
        <Link href="/" className="brand-link" aria-label="SafeCard"><BrandMark /></Link>

        <nav className="site-nav" aria-label={t.primaryNav}>
          {link("/#benefits", t.navBenefits)}
          {link("/#process", t.navProcess)}
          {link("/help", t.navHelp)}
        </nav>

        <div className="site-account">
          <LocaleToggle />
          <span className="site-divider" aria-hidden="true" />
          {link("/admin/login", t.adminLogin, "admin-link")}
          {link("/member", t.memberLogin, "member-login")}
        </div>

        <button
          ref={toggle}
          type="button"
          className="menu-button"
          aria-expanded={open}
          aria-controls="site-menu"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <CloseIcon size={22} /> : <MenuIcon size={22} />}
          <span className="sr-only">{open ? t.closeMenu : t.menu}</span>
        </button>
      </div>

      <div id="site-menu" className="site-menu" hidden={!open}>
        <nav aria-label={t.primaryNav}>
          {link("/#benefits", t.navBenefits)}
          {link("/#process", t.navProcess)}
          {link("/help", t.navHelp)}
        </nav>
        <div className="site-menu-account" role="group" aria-label={t.accountNav}>
          {link("/member", t.memberLogin, "member-login")}
          {link("/admin/login", t.adminLogin, "admin-link")}
          <LocaleToggle />
        </div>
      </div>
    </header>
    <SeasonGarland /> {/* SEASONAL:christmas-2026 */}
    </>
  );
}
