"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { createSupabaseBrowserClient } from "@/lib/db/browser";

export function PortalLogin({ kind }: { kind: "admin" | "ambassador" }) {
  const router = useRouter(); const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  const [mfaFactorId, setMfaFactorId] = useState<string | null>(null); const [mfaCode, setMfaCode] = useState("");
  async function finishAdminSignIn(supabase: ReturnType<typeof createSupabaseBrowserClient>) {
    const audit = await fetch("/api/admin/session/audit", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "login" }) });
    if (!audit.ok) { await supabase.auth.signOut(); throw new Error("No active staff assignment."); }
  }
  async function submitMfa(event: FormEvent) {
    event.preventDefault(); if (!mfaFactorId) return; setBusy(true); setError("");
    const supabase = createSupabaseBrowserClient();
    try {
      const { error: mfaError } = await supabase.auth.mfa.challengeAndVerify({ factorId: mfaFactorId, code: mfaCode.trim() });
      if (mfaError) throw mfaError;
      await finishAdminSignIn(supabase);
      router.push("/admin"); router.refresh();
    } catch { setError("That code was not accepted. Check the code and try again."); } finally { setBusy(false); }
  }
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setError(""); const supabase = createSupabaseBrowserClient(); try { const { error: authError } = await supabase.auth.signInWithPassword({ email, password }); if (authError) throw authError; if (kind === "admin") {
      // Staff who enrolled an authenticator must enter a code before the session counts as signed in.
      const { data: level } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (level?.nextLevel === "aal2" && level.currentLevel !== "aal2") {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const factor = factors?.totp?.find((item) => item.status === "verified");
        if (factor) { setMfaFactorId(factor.id); setBusy(false); return; }
      }
      await finishAdminSignIn(supabase);
    } router.push(kind === "admin" ? "/admin" : "/ambassador"); router.refresh(); } catch { setError("Sign-in failed. Check your credentials and account assignment."); } finally { setBusy(false); } }
  return <main className="portal-page dark"><div className="portal-shell narrow"><Link href="/" className="portal-brand"><BrandMark /></Link><section className="portal-card"><p className="eyebrow">{kind === "admin" ? "Protected operations" : "Ambassador workspace"}</p><h1>{kind === "admin" ? "SafeCard administration" : "Share access, not private data"}</h1><p>{kind === "admin" ? "Authorized operators and administrators only. Permissions are checked again for every protected action." : "View privacy-safe referral totals and create your campaign link."}</p><div className="notice-panel"><strong>Password login—no SMS OTP</strong><span>Cost-bearing SMS delivery is parked. Export remains a separate high-risk action and may require an authenticator assurance gate.</span></div>{mfaFactorId ? <form className="portal-form" onSubmit={submitMfa}><label><span>Authenticator code</span><input inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} value={mfaCode} onChange={(event) => setMfaCode(event.target.value)} required autoFocus /></label>{error && <p className="form-message error">{error}</p>}<button className="button-primary" disabled={busy}>{busy ? "Verifying…" : "Verify and sign in →"}</button></form> : <form className="portal-form" onSubmit={submit}><label><span>Email</span><input type="email" autoComplete="username" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label><span>Password</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} required /></label>{error && <p className="form-message error">{error}</p>}<button className="button-primary" disabled={busy}>{busy ? "Signing in…" : "Sign in securely →"}</button></form>}</section></div></main>;
}
