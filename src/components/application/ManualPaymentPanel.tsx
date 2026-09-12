"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useLocale } from "@/components/LocaleProvider";

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

type PaymentSummary = { routeLabel: string; reference: string };

export function ManualPaymentPanel({ caseId, campaignId, live, onBack, onComplete }: { caseId: string; campaignId: string; live: boolean; onBack?: () => void; onComplete: (summary: PaymentSummary) => void }) {
  const { locale } = useLocale();
  const isFil = locale === "fil";
  const ui = isFil ? {
    unavailable: "Hindi available ang payment configuration.", chooseRoute: "Pumili ng approved payment route.", required: "Pumili ng route, ilagay ang payment reference, mag-upload ng proof, at kumpirmahin ang payer declaration.", handoffError: "Hindi mabuksan ang payment handoff.", referenceError: "Hindi ma-record ang payment reference.", uploadError: "Hindi na-upload ang proof.", completeError: "Hindi nakumpleto ang payment.", received: "Natanggap ang proof. Naka-pending ang staff verification; hindi pa active ang membership.", loading: "Nilo-load ang approved payment routes…", eyebrow: "06 · Bayad at proof", title: "Magbayad sa labas ng SafeCard, pagkatapos ay bumalik kasama ang proof.", fee: "Membership fee:", monthly: "Ang monthly equivalent ay paliwanag lamang at hindi installment offer.", separateTitle: "Hiwalay na state ang payment", separateBody: "Ang payment ay hindi consent, application submission, approval, PRC handoff, o membership activation. PRC lamang ang makakapagkumpirma.", warning: "Babala para sa controlled pilot", parked: "Hindi pa naka-enable ang official payment handoff.", routeLegend: "Pumili ng payment route", accountName: "Account name", bank: "Bank", accountNumber: "Account number", swift: "SWIFT", branch: "Branch", transferHelp: "Kumpletuhin ang transfer sa bank o GCash app. Hindi humahawak, naglilipat, o nagsi-settle ng funds ang SafeCard.", reference: "Payment reference o transaction number", referencePlaceholder: "Ilagay ang reference mula sa bank o GCash", proof: "Proof of payment (JPEG, PNG, o WebP; max 10 MB)", preview: "Preview ng napiling payment proof", declaration: "Kinukumpirma kong ginawa ang transfer sa labas ng SafeCard at naiintindihan kong hindi ina-activate ng verification ang membership.", uploading: "Secure na ina-upload…", submit: "Isumite ang proof para ma-review →", copied: "Na-copy na", recorded: "Naitala ang payment reference. Ire-review ng staff ang proof; mananatiling inactive ang membership hanggang kumpirmahin ng PRC.", qrAlt: "Official GCash QR code"
  } : {
    unavailable: "Payment configuration is unavailable.", chooseRoute: "Choose an approved payment route.", required: "Choose a route, add the payment reference, upload proof, and confirm the payer declaration.", handoffError: "Payment handoff could not be opened.", referenceError: "Payment reference could not be recorded.", uploadError: "Proof upload failed.", completeError: "Payment could not be completed.", received: "Proof received. Staff verification is pending; membership is not active.", loading: "Loading approved payment routes…", eyebrow: "06 · Payment and proof", title: "Pay outside SafeCard, then return with proof.", fee: "Membership fee:", monthly: "The monthly equivalent is only explanatory and is not an installment offer.", separateTitle: "Payment is a separate state", separateBody: "Payment does not equal consent, application submission, approval, PRC handoff, or membership activation. Only PRC confirmation can activate membership.", warning: "Controlled pilot warning", parked: "Official payment handoff is not yet enabled.", routeLegend: "Choose a payment route", accountName: "Account name", bank: "Bank", accountNumber: "Account number", swift: "SWIFT", branch: "Branch", transferHelp: "Complete the transfer in your bank or GCash app. SafeCard does not hold, move, or settle funds.", reference: "Payment reference or transaction number", referencePlaceholder: "Enter the reference shown by your bank or GCash", proof: "Proof of payment (JPEG, PNG, or WebP; max 10 MB)", preview: "Selected payment proof preview", declaration: "I confirm this transfer was completed outside SafeCard and understand that verification does not activate membership.", uploading: "Uploading securely…", submit: "Submit proof for review →", copied: "Copied", recorded: "Payment reference recorded. Staff will review the proof; your membership remains inactive until PRC confirms it.", qrAlt: "Official GCash QR code"
  };
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
    fetch(`/api/payment-config?campaign_id=${encodeURIComponent(campaignId)}`, { cache: "no-store" }).then((response) => response.json()).then((data: PaymentConfig) => setConfig(data)).catch(() => setConfig({ available: false, reason: "Payment configuration is unavailable.", amount: null, currency: "PHP", routes: [] }));
  }, [campaignId]);

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
  const selectedPaymentRoute = selectedRoute?.bank
    ? `bank_transfer_${selectedRoute.id.replaceAll("-", "_")}`
    : selectedRoute?.id ?? "";

  async function copy(value: string, label: string) {
    if (!value || !navigator.clipboard) return;
    await navigator.clipboard.writeText(value); setCopied(label); window.setTimeout(() => setCopied(""), 1800);
  }

  async function submitPayment() {
    setError(""); setNotice("");
    if (!config?.available || !config.amount || !selectedRoute) { setError(config?.reason ?? ui.chooseRoute); return; }
    if (!reference.trim() || !file || !declaration) { setError(ui.required); return; }
    setBusy(true);
    try {
      const handoffPayload = { case_id: caseId, campaign_id: campaignId, payer_type: "other", expected_amount: config.amount, payment_route: selectedPaymentRoute, idempotency_key: key("payment"), data_mode: live ? "live" : "synthetic", ...(live ? {} : { payer_name: "Synthetic payer" }) };
      const handoff = await fetch("/api/payment/handoff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(handoffPayload) });
      const handoffBody = await handoff.json(); if (!handoff.ok) throw new Error(handoffBody.error ?? ui.handoffError);
      const intentId = handoffBody.paymentIntentId as string; setPaymentIntentId(intentId);
      const marked = await fetch("/api/payment/mark-paid", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payment_intent_id: intentId, payment_reference: reference.trim(), payer_declaration: "I completed this transfer outside SafeCard and understand it does not activate membership.", data_mode: live ? "live" : "synthetic" }) });
      const markedBody = await marked.json(); if (!marked.ok) throw new Error(markedBody.error ?? ui.referenceError);
      const form = new FormData(); form.set("payment_intent_id", intentId); form.set("case_id", caseId); form.set("campaign_id", campaignId); form.set("amount", String(config.amount)); form.set("reference_number", reference.trim()); form.set("payer_declaration", "I completed this transfer outside SafeCard and understand it does not activate membership."); form.set("data_mode", live ? "live" : "synthetic"); form.set("file", file);
      const uploaded = await fetch("/api/payment/evidence/upload", { method: "POST", body: form });
      const uploadBody = await uploaded.json(); if (!uploaded.ok) throw new Error(uploadBody.error ?? ui.uploadError);
      setNotice(ui.received); onComplete({ routeLabel: selectedRoute?.label ?? '', reference: reference.trim() });
    } catch (caught) { setError(caught instanceof Error ? caught.message : ui.completeError); }
    finally { setBusy(false); }
  }

  if (!config) return <div className="payment-panel" aria-live="polite">{ui.loading}</div>;
  return <div className="payment-panel">
    <p className="eyebrow">{ui.eyebrow}</p>
    <h1>{ui.title}</h1>
    <p className="wizard-lede">{ui.fee} <strong>₱{config.amount?.toLocaleString() ?? "1,200"} / year</strong>. {ui.monthly}</p>
    <div className="notice-panel amber"><strong>{ui.separateTitle}</strong><span>{ui.separateBody}</span></div>
    {!config.available && <div className="parked-panel"><strong>{ui.warning}</strong><p>{isFil ? ui.parked : (config.reason ?? ui.parked)}</p></div>}
    {config.available && <>
      <fieldset className="payment-route-list"><legend>{ui.routeLegend}</legend>{config.routes.map((route) => <label className={`payment-route ${route.id === routeId ? "selected" : ""}`} key={route.id}><input type="radio" name="payment-route" value={route.id} checked={route.id === routeId} onChange={() => setRouteId(route.id)} /><span><strong>{route.label}</strong><small>{route.instructions}</small></span></label>)}</fieldset>
      {selectedRoute && <section className="payment-details" aria-live="polite"><h2>{selectedRoute.label}</h2>{(selectedRoute.accountName ?? config.accountName) && <CopyRow label={ui.accountName} value={selectedRoute.accountName ?? config.accountName ?? ""} copied={copied} onCopy={copy} />}{selectedRoute.bank && <CopyRow label={ui.bank} value={selectedRoute.bank} copied={copied} onCopy={copy} />}{selectedRoute.qrImageUrl && <Image src={selectedRoute.qrImageUrl} alt={ui.qrAlt} className="payment-qr" width={360} height={360} unoptimized />}{selectedRoute.accountNumber && <CopyRow label={ui.accountNumber} value={selectedRoute.accountNumber} copied={copied} onCopy={copy} />}{selectedRoute.swiftCode && <CopyRow label={ui.swift} value={selectedRoute.swiftCode} copied={copied} onCopy={copy} />}{selectedRoute.branch && <CopyRow label={ui.branch} value={selectedRoute.branch} copied={copied} onCopy={copy} />}<p className="content-footnote">{ui.transferHelp}</p></section>}
      <label className="field-block"><span>{ui.reference}</span><input value={reference} onChange={(event) => setReference(event.target.value)} placeholder={ui.referencePlaceholder} autoComplete="off" /></label>
      <label className="upload-field"><span>{ui.proof}</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />{previewUrl && <Image src={previewUrl} alt={ui.preview} className="receipt-preview" width={720} height={960} unoptimized />}</label>
      <label className="consent-row"><input type="checkbox" checked={declaration} onChange={(event) => setDeclaration(event.target.checked)} /><span>{ui.declaration}</span></label>
      {error && <p className="form-message error" role="alert">{error}</p>}{notice && <p className="form-message" role="status">{notice}</p>}
      <div className="wizard-actions">
        <button className="button-primary" type="button" disabled={busy} onClick={submitPayment}>{busy ? ui.uploading : ui.submit}</button>
        {onBack && <button className="button-quiet" type="button" onClick={onBack}>{isFil ? "← Bumalik" : "← Back"}</button>}
      </div>
    </>}
    {copied && <p className="form-message" role="status">{ui.copied} {copied}.</p>}
    {paymentIntentId && <p className="content-footnote">{ui.recorded}</p>}
  </div>;
}

function CopyRow({ label, value, copied, onCopy }: { label: string; value: string; copied: string; onCopy: (value: string, label: string) => void }) {
  return <div className="copy-row"><span><small>{label}</small><strong>{value}</strong></span><button type="button" className="button-quiet" onClick={() => onCopy(value, label)}>Copy</button>{copied === label && <span className="sr-only">Copied</span>}</div>;
}
