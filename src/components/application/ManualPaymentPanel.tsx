"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useLocale } from "@/components/LocaleProvider";

type BankRoute = {
  id: string;
  label: string;
  bank: string;
  accountName: string;
  accountType: string;
  currency: string;
  accountNumber: string;
};
type PaymentConfig = { available: boolean; reason: string | null; amount: number | null; currency: string; routes: BankRoute[] };
type PaymentSummary = { routeLabel: string; reference: string };

export function ManualPaymentPanel({ caseId, campaignId, live, onBack, onComplete }: { caseId: string; campaignId: string; live: boolean; onBack?: () => void; onComplete: (summary: PaymentSummary) => void }) {
  const { locale } = useLocale();
  const fil = locale === "fil";
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [routeId, setRouteId] = useState("");
  const [intentId, setIntentId] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [declaration, setDeclaration] = useState(false);
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [referenceLocked, setReferenceLocked] = useState(false);
  const [handoffAttempt, setHandoffAttempt] = useState(0);
  const declaredReference = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch(`/api/payment-config?campaign_id=${encodeURIComponent(campaignId)}`, { cache: "no-store" })
      .then(async (response) => {
        const data = await response.json() as PaymentConfig;
        if (!response.ok || !data.available || data.routes?.length !== 4) throw new Error(data.reason ?? "Approved bank transfer is unavailable.");
        if (active) setConfig(data);
      })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Payment configuration is unavailable."); });
    return () => { active = false; };
  }, [campaignId]);

  useEffect(() => {
    if (!live || !config?.available || !config.amount || !routeId || intentId) return;
    let active = true;
    const payload = { case_id: caseId, campaign_id: campaignId, payer_type: "other", expected_amount: config.amount, payment_route: routeId, idempotency_key: `payment-${caseId}`, data_mode: "live" };
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreparing(true);
    setError("");
    fetch("/api/payment/handoff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
      .then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Payment record could not be opened.");
        if (active) setIntentId(body.paymentIntentId);
      })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "Payment record could not be opened."); })
      .finally(() => { if (active) setPreparing(false); });
    return () => { active = false; };
  }, [caseId, campaignId, config, live, routeId, intentId, handoffAttempt]);

  useEffect(() => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const route = config?.routes.find((item) => item.id === routeId);

  async function copyAccount() {
    if (!route || !navigator.clipboard) return;
    await navigator.clipboard.writeText(route.accountNumber);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  async function submitProof() {
    setError("");
    if (!live || !route || !intentId || !config?.amount) { setError("Choose an approved bank first."); return; }
    if (!file || !declaration) { setError(fil ? "Kailangan ang proof at declaration." : "A proof image and declaration are required."); return; }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size === 0 || file.size > 10 * 1024 * 1024) {
      setError(fil ? "JPEG, PNG, o WebP lamang, hanggang 10 MB." : "Choose a JPEG, PNG, or WebP image up to 10 MB."); return;
    }
    setBusy(true);
    try {
      const payerDeclaration = `I transferred PHP ${config.amount} to Philippine Red Cross by ${route.bank} outside SafeCard and understand this does not activate membership.`;
      declaredReference.current ??= reference.trim();
      setReferenceLocked(true);
      const marked = await fetch("/api/payment/mark-paid", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payment_intent_id: intentId, payment_reference: declaredReference.current, payer_declaration: payerDeclaration, data_mode: "live" }) });
      const markedBody = await marked.json();
      if (!marked.ok) throw new Error(markedBody.error ?? "Payment declaration failed.");
      const form = new FormData();
      form.set("payment_intent_id", intentId);
      form.set("case_id", caseId);
      form.set("campaign_id", campaignId);
      form.set("amount", String(config.amount));
      form.set("reference_number", declaredReference.current);
      form.set("payer_declaration", payerDeclaration);
      form.set("data_mode", "live");
      form.set("file", file);
      const uploaded = await fetch("/api/payment/evidence/upload", { method: "POST", body: form });
      const result = await uploaded.json();
      if (!uploaded.ok) throw new Error(result.error ?? "Proof upload failed.");
      onComplete({ routeLabel: route.bank, reference: declaredReference.current || result.evidenceId });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Payment proof could not be recorded."); }
    finally { setBusy(false); }
  }

  if (!config) return <div className="payment-panel" role="status">{error || (fil ? "Nilo-load ang mga bank account…" : "Loading approved bank accounts…")}{error && <button type="button" className="button-quiet" onClick={() => window.location.reload()}>{fil ? "Subukan muli" : "Try again"}</button>}</div>;
  return <div className="payment-panel">
    <p className="eyebrow">06 · {fil ? "Bank transfer at proof" : "Bank transfer and proof"}</p>
    <h1>{fil ? "Pumili ng bank, magbayad sa labas ng SafeCard, at mag-upload ng proof." : "Choose a bank, pay outside SafeCard, and upload proof."}</h1>
    <p className="wizard-lede">{fil ? "Application fee" : "Application fee"}: <strong>₱{config.amount?.toLocaleString()}</strong></p>
    <p className="content-footnote">{fil ? "Ang payment verification ay hiwalay sa application review at PRC membership activation." : "Payment verification is separate from application review and PRC membership activation."}</p>
    <label className="field-block"><span>{fil ? "Bank na gagamitin mo" : "Bank you will use"}</span>
      <select value={routeId} disabled={Boolean(intentId) || preparing} onChange={(event) => setRouteId(event.target.value)}>
        <option value="">{fil ? "Pumili ng bank" : "Choose a bank"}</option>
        {config.routes.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
      </select>
    </label>
    {preparing && <p className="form-message" role="status">{fil ? "Inihahanda ang payment record…" : "Preparing payment record…"}</p>}
    {route && intentId && <section className="payment-details" aria-live="polite">
      <h2>{route.bank}</h2>
      <dl className="review-list">
        <div><dt>{fil ? "Pangalan ng account" : "Account name"}</dt><dd>{route.accountName}</dd></div>
        <div><dt>{fil ? "Uri ng account" : "Account type"}</dt><dd>{route.accountType}</dd></div>
        <div><dt>{fil ? "Currency" : "Currency"}</dt><dd>{route.currency}</dd></div>
        <div><dt>{fil ? "Account number" : "Account number"}</dt><dd>{route.accountNumber} <button type="button" className="button-quiet" onClick={() => void copyAccount()}>{copied ? "Copied" : "Copy"}</button></dd></div>
        <div><dt>{fil ? "Halaga" : "Amount"}</dt><dd>₱{config.amount?.toLocaleString()}</dd></div>
      </dl>
      <p className="content-footnote">{fil ? "I-transfer ang eksaktong halaga gamit ang bank app o branch. Itago ang receipt at bumalik dito para i-upload ito." : "Transfer the exact amount using your bank app or branch. Save the receipt and return here to upload it."}</p>
    </section>}
    {intentId && <>
      <label className="field-block"><span>{fil ? "Transaction reference (kung mayroon)" : "Transaction reference (if available)"}</span><input value={reference} maxLength={100} disabled={referenceLocked} onChange={(event) => setReference(event.target.value)} /></label>
      <label className="upload-field"><span>{fil ? "Proof image (JPEG, PNG, o WebP; max 10 MB)" : "Proof image (JPEG, PNG, or WebP; max 10 MB)"}</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setPreviewUrl(""); }} />{previewUrl && <Image src={previewUrl} alt={fil ? "Preview ng receipt" : "Receipt preview"} className="receipt-preview" width={720} height={960} unoptimized />}</label>
      <label className="consent-row"><input type="checkbox" checked={declaration} onChange={(event) => setDeclaration(event.target.checked)} /><span>{fil ? "Kinukumpirma kong nag-transfer ako sa napiling bank sa labas ng SafeCard at hindi nito ina-activate ang membership." : "I confirm I transferred using the selected bank outside SafeCard and understand this does not activate membership."}</span></label>
    </>}
    {error && <p className="form-message error" role="alert">{error}</p>}
    {error && routeId && !intentId && <button type="button" className="button-quiet" onClick={() => setHandoffAttempt((value) => value + 1)}>{fil ? "Subukan muli" : "Retry payment record"}</button>}
    <div className="wizard-actions">
      <button className="button-primary" type="button" disabled={busy || !intentId || !file || !declaration} onClick={() => void submitProof()}>{busy ? (fil ? "Ina-upload…" : "Uploading…") : (fil ? "I-upload ang proof →" : "Upload proof →")}</button>
      {onBack && <button className="button-quiet" type="button" onClick={onBack}>{fil ? "← Bumalik" : "← Back"}</button>}
    </div>
  </div>;
}
