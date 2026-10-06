"use client";

import Link from "next/link";
import { ReactNode, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { createSupabaseBrowserClient } from "@/lib/db/browser";

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [navigation, setNavigation] = useState({ staff: false, export: false });
  useEffect(() => {
    let active = true;
    void fetch('/api/admin/account', { cache: 'no-store' }).then(async (response) => {
      if (!response.ok) return;
      const account = await response.json();
      if (active && account.navigation) setNavigation(account.navigation);
    }).catch(() => { /* Navigation stays restricted; server checks are authoritative. */ });
    return () => { active = false; };
  }, []);
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
          {navigation.staff && <Link href="/admin/users">Staff &amp; roles</Link>}
          {navigation.export && <Link href="/admin/export">PRC export</Link>}
          <Link href="/admin/account">Account setup</Link>
        </nav>
        <button type="button" onClick={signOut}>Sign out</button>
      </aside>
      <section className="admin-content">{children}</section>
    </main>
  );
}
