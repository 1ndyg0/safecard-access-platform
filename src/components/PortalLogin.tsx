"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { createSupabaseBrowserClient } from "@/lib/db/browser";

export function PortalLogin() {
  const router = useRouter(); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    const supabase = createSupabaseBrowserClient();
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });
      if (authError) throw authError;
      const audit = await fetch("/api/admin/session/audit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "login" }) });
      if (!audit.ok) { await supabase.auth.signOut(); throw new Error("No active staff assignment."); }
      router.push("/admin"); router.refresh();
    } catch { setError("Sign-in failed. Check your credentials and account assignment."); } finally { setBusy(false); }
  }
  return <main className="portal-page dark"><div className="portal-shell narrow"><Link href="/" className="portal-brand"><BrandMark /></Link><section className="portal-card"><p className="eyebrow">Protected operations</p><h1>SafeCard administration</h1><p>Authorized operators and administrators only. Permissions are checked again for every protected action.</p><div className="notice-panel"><strong>Password login—no SMS OTP</strong><span>Cost-bearing SMS delivery is parked. Sign in with your staff email and password.</span></div><form className="portal-form" onSubmit={submit}><label><span>Email</span><input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label><span>Password</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{error && <p className="form-message error">{error}</p>}<button className="button-primary" disabled={busy}>{busy ? "Signing in…" : "Sign in securely →"}</button></form></section></div></main>;
}
