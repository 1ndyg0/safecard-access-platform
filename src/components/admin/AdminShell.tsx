"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { createSupabaseBrowserClient } from "@/lib/db/browser";
import "./admin-console.css";

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/applications", label: "Applications" },
] as const;

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  async function signOut() {
    await fetch("/api/admin/session/audit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) }).catch(() => undefined);
    await createSupabaseBrowserClient().auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }
  return (
    <main className="admin-page">
      <aside className="admin-sidebar">
        <Link href="/" aria-label="SafeCard home"><BrandMark /></Link>
        <nav aria-label="Administration">
          {NAV.map((item) => {
            const current = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href} aria-current={current ? "page" : undefined}>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <button type="button" onClick={signOut}>Sign out</button>
      </aside>
      <section className="admin-content">{children}</section>
    </main>
  );
}
