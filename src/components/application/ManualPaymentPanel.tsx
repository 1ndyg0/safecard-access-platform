"use client";

import { useEffect, useMemo, useState } from "react";

type PaymentRoute = {
  id: string;
  label: string;
  instructions: string;
  accountName?: string;
  qrImageUrl?: string | null;
  qrObjectPath?: string;
  bank?: string;
  accountType?: string;
  currency?: string;
  accountNumber?: string;
  swiftCode?: string;
  branch?: string;
};
type PaymentConfig = { available: boolean; reason: string | null; amount: number | null; monthlyEquivalent?: number; currency: string; accountName?: string; routes: PaymentRoute[]; controlledPilotWarning?: string };

function key(prefix: string) { return `${prefix}-${crypto.randomUUID()}`; }

export function ManualPaymentPanel({ caseId, campaignId, live, onComplete }: { caseId: string; campaignId: string; live: boolean; onComplete: () => void }) {
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [routeId, setRouteId] = useState("");
  const [paymentIntentId, setPaymentIntentId] = useState("");
  const [reference, setReference] = useState("");
  const [declaration, setDeclaration] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [copied, setCopied] = useState("");

  useEffect(() => {
    fetch("/api/payment-config", { cache: "no-store" }).then((response) => response.json()).then((data: PaymentConfig) => setConfig(data)).catch(() => setConfig({ available: false, reason: "Payment configuration is unavailable.", amount: null, currency: "PHP", routes: [] }));
  }, []);

  useEffect(() => {
    if (!file) {
      // The preview URL is derived from the selected file and must be cleared when it changes.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPreviewUrl("");
      return;
    }
    const url = URL.createObjectURL(file); setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const selectedRoute = useMemo(() => config?.routes.find((route) => route.id === routeId), [config, routeId]);
  const selectedPaymentRoute = selectedRoute?.bank ? "bank_transfer" : selectedRoute?.id ?? "";

  async function copy(value: string, label: string) {
    if (!value || !navigator.clipboard) return;
    await navigator.clipboard.writeText(value); setCopied(label); window.setTimeout(() => setCopied(""), 1800);
  }

  async function submitPayment() {
    setError(""); setNotice("");
    if (!config?.available || !config.amount || !selectedRoute) { setError(config?.reason ?? "Choose an approved payment route."); return; }
    if (!reference.trim() || !file || !declaration) { setError("Choose a route, add the payment reference, upload proof, and confirm the payer declaration."); return; }
    setBusy(true);
    try {
      const handoffPayload = { case_id: caseId, campaign_id: campaignId, payer_type: "other", expected_amount: config.amount, payment_route: selectedPaymentRoute, idempotency_key: key("payment"), data_mode: live ? "live" : "synthetic", ...(live ? {} : { payer_name: "Synthetic payer" }) };
      const handoff = await fetch("/api/payment/handoff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(handoffPayload) });
      const handoffBody = await handoff.json(); if (!handoff.ok) throw new Error(handoffBody.error ?? "Payment handoff could not be opened.");
      const intentId = handoffBody.paymentIntentId as string; setPaymentIntentId(intentId);
      const marked = await fetch("/api/payment/mark-paid", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payment_intent_id: intentId, payment_reference: reference.trim(), payer_declaration: "I completed this transfer outside SafeCard and understand it does not activate membership.", data_mode: live ? "live" : "synthetic" }) });
      const markedBody = await marked.json(); if (!marked.ok) throw new Error(markedBody.error ?? "Payment reference could not be recorded.");
      const form = new FormData(); form.set("payment_intent_id", intentId); form.set("case_id", caseId); form.set("campaign_id", campaignId); form.set("amount", String(config.amount)); form.set("reference_number", reference.trim()); form.set("payer_declaration", "I completed this transfer outside SafeCard and understand it does not activate membership."); form.set("data_mode", live ? "live" : "synthetic"); form.set("file", file);
      const uploaded = await fetch("/api/payment/evidence/upload", { method: "POST", body: form });
      const uploadBody = await uploaded.json(); if (!uploaded.ok) throw new Error(uploadBody.error ?? "Proof upload failed.");
      setNotice("Proof received. Staff verification is pending; membership is not active."); onComplete();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Payment could not be completed."); }
    finally { setBusy(false); }
  }

  if (!config) return <div className="payment-panel" aria-live="polite">Loading approved payment routes…</div>;
  return <div className="payment-panel">
    <p className="eyebrow">06 · Payment and proof</p>
    <h1>Pay outside SafeCard, then return with proof.</h1>
    <p className="wizard-lede">Membership fee: <strong>₱{config.amount?.toLocaleString() ?? "1,200"} / year</strong>. The monthly equivalent is only explanatory and is not an installment offer.</p>
    <div className="notice-panel amber"><strong>Payment is a separate state</strong><span>Payment does not equal consent, application submission, approval, PRC handoff, or membership activation. Only PRC confirmation can activate membership.</span></div>
    {!config.available && <div className="parked-panel"><strong>Controlled pilot warning</strong><p>{config.reason ?? "Official payment handoff is not yet enabled."}</p></div>}
    {config.available && <>
      <fieldset className="payment-route-list"><legend>Choose a payment route</legend>{config.routes.map((route) => <label className={`payment-route ${route.id === routeId ? "selected" : ""}`} key={route.id}><input type="radio" name="payment-route" value={route.id} checked={route.id === routeId} onChange={() => setRouteId(route.id)} /><span><strong>{route.label}</strong><small>{route.instructions}</small></span></label>)}</fieldset>
      {selectedRoute && <section className="payment-details" aria-live="polite"><h2>{selectedRoute.label}</h2>{(selectedRoute.accountName ?? config.accountName) && <CopyRow label="Account name" value={selectedRoute.accountName ?? config.accountName ?? ""} copied={copied} onCopy={copy} />}{selectedRoute.bank && <CopyRow label="Bank" value={selectedRoute.bank} copied={copied} onCopy={copy} />}{selectedRoute.qrImageUrl && <img src={selectedRoute.qrImageUrl} alt="Official GCash QR code" className="payment-qr" />}{selectedRoute.accountNumber && <CopyRow label="Account number" value={selectedRoute.accountNumber} copied={copied} onCopy={copy} />}{selectedRoute.swiftCode && <CopyRow label="SWIFT" value={selectedRoute.swiftCode} copied={copied} onCopy={copy} />}{selectedRoute.branch && <CopyRow label="Branch" value={selectedRoute.branch} copied={copied} onCopy={copy} />}<p className="content-footnote">Complete the transfer in your bank or GCash app. SafeCard does not hold, move, or settle funds.</p></section>}
      <label className="field-block"><span>Payment reference or transaction number</span><input value={reference} onChange={(event) => setReference(event.target.value)} placeholder="Enter the reference shown by your bank or GCash" autoComplete="off" /></label>
      <label className="upload-field"><span>Proof of payment (JPEG, PNG, or WebP; max 10 MB)</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />{previewUrl && <img src={previewUrl} alt="Selected payment proof preview" className="receipt-preview" />}</label>
      <label className="consent-row"><input type="checkbox" checked={declaration} onChange={(event) => setDeclaration(event.target.checked)} /><span>I confirm this transfer was completed outside SafeCard and understand that verification does not activate membership.</span></label>
      {error && <p className="form-message error" role="alert">{error}</p>}{notice && <p className="form-message" role="status">{notice}</p>}
      <button className="button-primary" type="button" disabled={busy} onClick={submitPayment}>{busy ? "Uploading securely…" : "Submit proof for review →"}</button>
    </>}
    {copied && <p className="form-message" role="status">Copied {copied}.</p>}
    {paymentIntentId && <p className="content-footnote">Payment reference recorded. Staff will review the proof; your membership remains inactive until PRC confirms it.</p>}
  </div>;
}

function CopyRow({ label, value, copied, onCopy }: { label: string; value: string; copied: string; onCopy: (value: string, label: string) => void }) {
  return <div className="copy-row"><span><small>{label}</small><strong>{value}</strong></span><button type="button" className="button-quiet" onClick={() => onCopy(value, label)}>Copy</button>{copied === label && <span className="sr-only">Copied</span>}</div>;
}
