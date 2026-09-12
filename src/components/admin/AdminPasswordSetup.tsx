"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { createSupabaseBrowserClient } from "@/lib/db/browser";

export function AdminPasswordSetup() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    void createSupabaseBrowserClient().auth.getUser().then(({ data }) => {
      if (!active) return;
      if (!data.user) router.replace("/admin/login");
      else setReady(true);
    });
    return () => { active = false; };
  }, [router]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (password.length < 12) {
      setError("Use at least 12 characters.");
      return;
    }
    if (password !== confirmation) {
      setError("The passwords do not match.");
      return;
    }
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      const audit = await fetch("/api/admin/session/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "login" }),
      });
      if (!audit.ok) {
        await supabase.auth.signOut();
        throw new Error("The staff assignment is inactive or unavailable.");
      }
      router.replace("/admin");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Password setup could not be completed.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="portal-page dark"><div className="portal-shell narrow"><Link href="/" className="portal-brand"><BrandMark /></Link><section className="portal-card"><p className="eyebrow">Secure invitation setup</p><h1>Create your staff password</h1><p>This password is sent only to Supabase over the authenticated invitation session. SafeCard does not store it in the application database.</p><form className="portal-form" onSubmit={submit}><label><span>New password</span><input type="password" autoComplete="new-password" minLength={12} value={password} onChange={(event) => setPassword(event.target.value)} required disabled={!ready || busy} /></label><label><span>Confirm new password</span><input type="password" autoComplete="new-password" minLength={12} value={confirmation} onChange={(event) => setConfirmation(event.target.value)} required disabled={!ready || busy} /></label>{!ready && <p className="form-message" role="status">Checking the invitation session…</p>}{error && <p className="form-message error" role="alert">{error}</p>}<button className="button-primary" disabled={!ready || busy}>{busy ? "Saving securely…" : "Save password and continue →"}</button></form></section></div></main>;
}
