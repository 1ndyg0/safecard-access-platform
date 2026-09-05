"use client";

import Link from "next/link";
import type { ReactNode } from "react";

export default function AppShell({ children, active = "overview" }: { children: ReactNode; active?: string }) {
  return <div className="app-shell">
    <aside className="sidebar">
      <Link className="brand" href="/"><span className="brand-mark" aria-hidden="true" />SafeCard</Link>
      <nav className="nav" aria-label="Primary navigation">
        <Link className={active === "overview" ? "active" : ""} href="/">Overview</Link>
        <Link href="/#sponsorships">Sponsorships</Link>
        <Link className={active === "learn" ? "active" : ""} href="/#learn">Learn</Link>
        <Link href="/#help">Help</Link>
      </nav>
      <div className="sidebar-note"><strong>Prototype mode</strong>Use synthetic information only. No payment or personal data is sent unless Supabase is configured.</div>
    </aside>
    <main className="main">
      <div className="topbar"><p>One-school pilot · Consent-first workspace</p><span className="mode-chip">For validation</span></div>
      {children}
    </main>
  </div>;
}
