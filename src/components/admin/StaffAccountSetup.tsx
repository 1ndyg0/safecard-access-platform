'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState, type FormEvent } from 'react';
import { createSupabaseBrowserClient } from '@/lib/db/browser';
import { AdminShell } from './AdminShell';

export function StaffAccountSetup() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [verifiedFactor, setVerifiedFactor] = useState<string | null>(null);
  const [pendingFactor, setPendingFactor] = useState<{ id: string; qr: string } | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const client = createSupabaseBrowserClient();
        const { data, error: authError } = await client.auth.getUser();
        if (authError || !data.user || data.user.is_anonymous) return;
        const staff = await fetch('/api/admin/account', { cache: 'no-store' });
        if (!staff.ok) return;
        const factors = await client.auth.mfa.listFactors();
        if (factors.error) throw factors.error;
        if (active) {
          setEmail(data.user.email ?? null);
          setVerifiedFactor(factors.data.totp.find((factor) => factor.status === 'verified')?.id ?? null);
        }
      } catch {
        if (active) setError('Account setup is temporarily unavailable. Please try again.');
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, []);

  async function savePassword(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage('');
    if (password.length < 12 || password !== confirmation) {
      setError('Use at least 12 characters and enter the same password twice.'); return;
    }
    setBusy(true);
    try {
      const { error: authError } = await createSupabaseBrowserClient().auth.updateUser({ password });
      if (authError) throw authError;
      setPassword(''); setConfirmation(''); setMessage('Your password has been saved.');
    } catch {
      setError('The password could not be saved. Use a strong, new password or request a fresh invitation.');
    } finally { setBusy(false); }
  }

  async function enroll() {
    setBusy(true); setError(''); setMessage('');
    try {
      const { data, error: authError } = await createSupabaseBrowserClient().auth.mfa.enroll({
        factorType: 'totp', friendlyName: `SafeCard authenticator ${Date.now()}`,
      });
      if (authError || !data) throw authError;
      setPendingFactor({ id: data.id, qr: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(data.totp.qr_code)}` });
    } catch {
      setError('Authenticator setup could not start. Please try again.');
    } finally { setBusy(false); }
  }

  async function verify(event: FormEvent) {
    event.preventDefault(); setError(''); setMessage('');
    const factorId = pendingFactor?.id ?? verifiedFactor;
    if (!factorId || !/^\d{6}$/.test(code)) { setError('Enter the current six-digit authenticator code.'); return; }
    setBusy(true);
    try {
      const { error: authError } = await createSupabaseBrowserClient().auth.mfa.challengeAndVerify({ factorId, code });
      if (authError) throw authError;
      setVerifiedFactor(factorId); setPendingFactor(null); setCode('');
      setMessage('Authenticator verified for this session. Your assigned permissions still apply.');
    } catch {
      setError('The code could not be verified. Enter the current code from your authenticator.');
    } finally { setBusy(false); }
  }

  return <AdminShell><section className="portal-card">
    <h1>Your staff account</h1>
    {loading ? <p>Checking your account…</p> : !email ? <p>
      Open your individual invitation or <Link href="/admin/login">sign in</Link> with an active staff account.
    </p> : <>
      <p>Signed in as {email}. Set your own password and keep your authenticator codes private.</p>
      <form className="portal-form" onSubmit={savePassword}>
        <h2>Set your password</h2>
        <label>New password<input type="password" autoComplete="new-password" minLength={12} required value={password} onChange={(event) => setPassword(event.target.value)} /></label>
        <label>Confirm new password<input type="password" autoComplete="new-password" minLength={12} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>
        <button className="button-primary" disabled={busy}>Save password</button>
      </form>
      <h2>Authenticator</h2>
      <p>Use an authenticator app for sensitive actions such as PRC export. Verify again here after a new password sign-in when an action asks for it.</p>
      {!verifiedFactor && !pendingFactor && <button className="button-primary" disabled={busy} onClick={enroll}>Set up authenticator</button>}
      {pendingFactor && <div><p>Scan this account setup code with your authenticator app. Do not share it.</p>
        <Image src={pendingFactor.qr} alt="Private authenticator setup code" width={220} height={220} unoptimized />
      </div>}
      {(pendingFactor || verifiedFactor) && <form className="portal-form" onSubmit={verify}>
        <label>Authenticator code<input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={code} onChange={(event) => setCode(event.target.value)} /></label>
        <button className="button-primary" disabled={busy}>Verify authenticator</button>
      </form>}
    </>}
    {error && <p className="form-message error" role="alert">{error}</p>}
    {message && <p className="form-message" role="status">{message}</p>}
  </section></AdminShell>;
}
