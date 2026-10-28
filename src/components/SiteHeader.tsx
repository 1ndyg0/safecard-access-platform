"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BrandMark } from "@/components/BrandMark";
import { CloseIcon, MenuIcon } from "@/components/icons";
import { LocaleToggle } from "@/components/LocaleToggle";
import { useLocale } from "@/components/LocaleProvider";
import { sectionIndex } from "@/lib/education/content";
import { copy } from "@/lib/public-content";

/**
 * Header shared by every public page.
 *
 * The single access toolbar. It stays pinned to the top of the screen.
 * Section links (What you get … Downloads) and Help sit in the centre; on the
 * landing page the section being read is marked with `aria-current`. Account
 * actions (Member login, Admin) and the language switch form their own
 * visually separated group on the right. Below 1300px everything moves into
 * a disclosure menu: a real button with aria-expanded, closed by Escape, by
 * choosing a link, or by tapping outside.
 */
export function SiteHeader() {
  const { locale } = useLocale();
  const t = copy[locale];
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const onLanding = pathname === "/";
  const [active, setActive] = useState<string | null>(null);
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

  // Mark the landing-page section being read, so the bar answers "where am I?".
  useEffect(() => {
    if (!onLanding || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) if (entry.isIntersecting) setActive(entry.target.id);
      },
      { rootMargin: "-25% 0px -65% 0px" },
    );
    for (const { id } of sectionIndex) {
      const element = document.getElementById(id);
      if (element) observer.observe(element);
    }
    return () => { observer.disconnect(); setActive(null); };
  }, [onLanding]);

  const link = (href: string, label: string, extra = "", current?: "page" | "true") => (
    <Link key={href} href={href} className={extra} onClick={() => setOpen(false)} aria-current={current ?? (pathname === href ? "page" : undefined)}>{label}</Link>
  );

  const navLinks = (
    <>
      {sectionIndex.map(({ id, label }) => link(`/#${id}`, label[locale], "", onLanding && active === id ? "true" : undefined))}
      {link("/help", t.navHelp)}
    </>
  );

  return (
    <header className="site-header" ref={root}>
      <a className="skip-link" href="#main-content">{t.skip}</a>
      <div className="site-header-bar">
        <Link href="/" className="brand-link" aria-label="SafeCard"><BrandMark /></Link>

        <nav className="site-nav" aria-label={t.primaryNav}>
          {navLinks}
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
          {navLinks}
        </nav>
        <div className="site-menu-account" role="group" aria-label={t.accountNav}>
          {link("/member", t.memberLogin, "member-login")}
          {link("/admin/login", t.adminLogin, "admin-link")}
          <LocaleToggle />
        </div>
      </div>
    </header>
  );
}
