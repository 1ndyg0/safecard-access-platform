"use client";

import { useEffect, useRef, useState } from "react";
import { useLocale } from "@/components/LocaleProvider";
import { sectionIndex } from "@/lib/education/content";
import "./education.css";

/**
 * "On this page" bar for the landing page.
 *
 * Real in-page links, so it works before JavaScript loads and with the
 * keyboard. With JavaScript it also marks the section being read
 * (`aria-current`) and keeps that link visible when the bar scrolls
 * sideways on a phone.
 */
export function SectionIndex() {
  const { locale } = useLocale();
  const [active, setActive] = useState<string>(sectionIndex[0].id);
  const nav = useRef<HTMLElement>(null);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
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
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const bar = nav.current;
    const link = bar?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!bar || !link || bar.scrollWidth <= bar.clientWidth) return;
    bar.scrollTo({ left: link.offsetLeft - (bar.clientWidth - link.offsetWidth) / 2, behavior: "smooth" });
  }, [active]);

  return (
    <div className="section-index">
      <nav ref={nav} aria-label={locale === "fil" ? "Sa pahinang ito" : "On this page"}>
        {sectionIndex.map(({ id, label }) => (
          <a key={id} href={`#${id}`} aria-current={active === id ? "true" : undefined} onClick={() => setActive(id)}>{label[locale]}</a>
        ))}
      </nav>
    </div>
  );
}
