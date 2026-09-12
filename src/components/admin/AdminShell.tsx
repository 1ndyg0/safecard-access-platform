"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { createSupabaseBrowserClient } from "@/lib/db/browser";

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  async function signOut() {
    await createSupabaseBrowserClient().auth.signOut();
    router.replace("/admin/login");
    router.refresh();
  }
  return (
    <main className="admin-page">
      <aside className="admin-sidebar">
        <Link href="/" aria-label="SafeCard home"><BrandMark /></Link>
        <nav aria-label="Administration">
          <Link href="/admin">Overview</Link>
          <Link href="/admin/submissions">Submissions</Link>
          <Link href="/admin/users">Staff &amp; roles</Link>
          <Link href="/admin/export">PRC export</Link>
        </nav>
        <button type="button" onClick={signOut}>Sign out</button>
      </aside>
      <section className="admin-content">{children}</section>
    </main>
  );
}
