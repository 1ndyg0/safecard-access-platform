"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { BrandMark } from "@/components/BrandMark";

export default function MemberLoginPage() {
  const router = useRouter();
  const [mobileNumber, setMobileNumber] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setMessage(""); setBusy(true);
    try {
      const response = await fetch("/api/member/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mobileNumber }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unable to sign in.");
      router.push("/member/card"); router.refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to sign in."); }
    finally { setBusy(false); }
  }

  return <main className="portal-page dark"><div className="portal-shell narrow"><Link href="/" className="portal-brand"><BrandMark /></Link><section className="portal-card"><p className="eyebrow">Member access</p><h1>Your application and electronic SafeCard</h1><p>Sign in with the mobile number used in your application.</p><div className="notice-panel"><strong>No SMS OTP</strong><span>Provider-dependent OTP is parked. This controlled-pilot login uses your registered mobile number and a short-lived secure browser session.</span></div><form className="portal-form" onSubmit={submit}><label><span>Registered mobile number</span><input value={mobileNumber} onChange={(event) => setMobileNumber(event.target.value)} placeholder="09XXXXXXXXX" inputMode="tel" autoComplete="tel" required /></label>{message && <p className="form-message error">{message}</p>}<button className="button-primary" disabled={busy}>{busy ? "Checking…" : "Continue securely →"}</button></form><p className="portal-footnote">For assistance, call Philippine Red Cross Hotline <a href="tel:143">143</a>. SafeCard never decides claims or membership activation.</p></section></div></main>;
}
