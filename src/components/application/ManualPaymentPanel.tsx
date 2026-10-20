"use client";

import { useEffect, useRef, useState, type DragEvent } from "react";
import Image from "next/image";
import { CheckIcon, CopyIcon, FileTextIcon, UploadIcon, WalletIcon } from "@/components/icons";
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

const MAX_PROOF_BYTES = 10 * 1024 * 1024;
const PROOF_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

function formatSize(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Pay, upload proof, confirm — one screen, three numbered parts.
 *
 * `beforeSubmit` runs first and is where the wizard saves the applicant's
 * details. Nothing reaches our team until this panel's final button is used,
 * so an application is only ever received complete: details plus proof.
 */
export function ManualPaymentPanel({ caseId, campaignId, live, beforeSubmit, onComplete }: {
  caseId?: string;
  campaignId: string;
  live: boolean;
  /** Creates the application and returns its case id. Runs first, once the applicant presses submit. */
  beforeSubmit?: () => Promise<{ caseId: string }>;
  onComplete: (summary: PaymentSummary) => void;
}) {
  const { locale } = useLocale();
  const isFil = locale === "fil";
  const ui = isFil ? {
    unavailable: "Hindi available ang payment configuration.", referenceError: "Hindi ma-record ang payment details.",
    reference: "Reference o transaction number", optional: "Opsyonal", required: "Kailangan",
    referencePlaceholder: "Makikita sa bank o GCash receipt mo", referenceHint: "Makakatulong ito sa pag-verify ng bayad mo.",
    paidDate: "Petsa ng bayad", amountPaid: "Halagang binayaran (PHP)", amountHint: "Dapat tugma sa membership fee.",
    chooseRoute: "Pumili ng payment route.", missing: "Kumpletuhin ang mga kailangang field at i-check ang kumpirmasyon bago isumite.",
    needRoute: "Pumili muna ng payment route.", needFile: "Mag-upload ng proof of payment.", needDate: "Ilagay ang petsa ng bayad.", needAmount: "Ang halaga ay dapat tugma sa membership fee.", needDeclaration: "I-check ang kumpirmasyon para magpatuloy.",
    handoffError: "Hindi mabuksan ang payment.", uploadError: "Hindi na-upload ang proof.", completeError: "Hindi nakumpleto ang pagsusumite.",
    loading: "Nilo-load ang mga paraan ng pagbabayad…", legendRequired: "Ang may * ay kailangan.",
    stepPay: "Bayaran ang membership fee", stepProof: "I-upload ang proof of payment", stepConfirm: "Kumpirmahin at isumite",
    due: "Halagang babayaran", perYear: "bawat taon", notHold: "Magbayad sa sarili mong bank o GCash app. Hindi humahawak o nagse-settle ng pera ang SafeCard.",
    routeLegend: "Paano ka magbabayad", accountName: "Account name", bank: "Bank", accountNumber: "Account number", swift: "SWIFT", branch: "Branch",
    scan: "I-scan ang QR code gamit ang GCash o bank app mo.", copy: "Kopyahin", copied: "Nakopya",
    dropTitle: "Pumili ng file o i-drop dito", dropHint: "JPEG, PNG, WebP o PDF · hanggang 10 MB", replace: "Palitan", remove: "Alisin", preview: "Preview ng proof of payment",
    badType: "JPEG, PNG, WebP o PDF lamang ang tinatanggap.", tooBig: "Masyadong malaki ang file. Hanggang 10 MB lamang.",
    declaration: "Kinukumpirma kong ginawa ko ang bayad sa labas ng SafeCard, at naiintindihan kong hindi pa nito inaaprubahan ang application ko o ina-activate ang membership.",
    uploading: "Ligtas na isinusumite…", submit: "Isumite ang application", submitNote: "Walang ipapadala sa aming team hanggang pindutin mo ang pindutang ito.",
    received: "Natanggap ang proof. Susuriin ito ng staff.", qrAlt: "Official payment QR code", parked: "Hindi pa available ang pagbabayad. Subukan muli mamaya o tumawag sa Hotline 143.",
  } : {
    unavailable: "Payment configuration is unavailable.", referenceError: "Payment details could not be recorded.",
    reference: "Reference or transaction number", optional: "Optional", required: "Required",
    referencePlaceholder: "Shown on your bank or GCash receipt", referenceHint: "This helps us verify your payment.",
    paidDate: "Date paid", amountPaid: "Amount paid (PHP)", amountHint: "Must match the membership fee.",
    chooseRoute: "Choose a payment route.", missing: "Complete the required fields and tick the confirmation before submitting.",
    needRoute: "Choose how you paid first.", needFile: "Upload your proof of payment.", needDate: "Enter the date you paid.", needAmount: "The amount must match the membership fee.", needDeclaration: "Tick the confirmation to continue.",
    handoffError: "Payment could not be opened.", uploadError: "Proof upload failed.", completeError: "Your application could not be submitted.",
    loading: "Loading payment options…", legendRequired: "Fields marked * are required.",
    stepPay: "Pay the membership fee", stepProof: "Upload your proof of payment", stepConfirm: "Confirm and submit",
    due: "Amount due", perYear: "per year", notHold: "Pay in your own bank or GCash app. SafeCard does not hold or settle funds.",
    routeLegend: "How will you pay?", accountName: "Account name", bank: "Bank", accountNumber: "Account number", swift: "SWIFT", branch: "Branch",
    scan: "Scan the QR code with your GCash or banking app.", copy: "Copy", copied: "Copied",
    dropTitle: "Choose a file or drop it here", dropHint: "JPEG, PNG, WebP or PDF · up to 10 MB", replace: "Replace", remove: "Remove", preview: "Payment proof preview",
    badType: "Only JPEG, PNG, WebP or PDF files are accepted.", tooBig: "That file is too large. The limit is 10 MB.",
    declaration: "I confirm I made this payment outside SafeCard, and I understand it does not by itself approve my application or activate a membership.",
    uploading: "Submitting securely…", submit: "Submit application", submitNote: "Nothing is sent to our team until you press this button.",
    received: "Proof received. Staff will review it.", qrAlt: "Official payment QR code", parked: "Payment is not available right now. Please try again later or call Hotline 143.",
  };

  // Payment details come only from the server (approved campaign routes). There is deliberately no
  // built-in fallback: showing unverified account numbers could send a payer's money to the wrong place.
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  const [routeId, setRouteId] = useState("");
  const [paymentIntentId, setPaymentIntentId] = useState("");
  const [reference, setReference] = useState("");
  const [paidDate, setPaidDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [amountPaid, setAmountPaid] = useState("");
  const [declaration, setDeclaration] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const unavailableConfig: PaymentConfig = { available: false, reason: ui.unavailable, amount: null, currency: "PHP", routes: [] };
    fetch(`/api/payment-config?campaign_id=${encodeURIComponent(campaignId)}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((data: PaymentConfig) => {
        if (data?.available && data.routes?.length) {
          setConfig(data);
          if (data.amount) setAmountPaid(String(data.amount));
          if (data.routes.length === 1) setRouteId(data.routes[0].id);
        } else setConfig({ ...unavailableConfig, ...(data ?? {}), available: false, routes: [] });
      })
      .catch(() => setConfig(unavailableConfig));
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const selectedRoute = config?.routes.find((route) => route.id === routeId);
  const selectedPaymentRoute = selectedRoute?.bank
    ? `bank_transfer_${selectedRoute.id.replaceAll("-", "_")}`
    : selectedRoute?.id ?? "";

  async function copy(value: string, label: string) {
    if (!value || !navigator.clipboard) return;
    await navigator.clipboard.writeText(value); setCopied(label); window.setTimeout(() => setCopied(""), 1800);
  }

  function chooseFile(next: File | null | undefined) {
    setFileError("");
    if (!next) return;
    if (!PROOF_TYPES.includes(next.type)) { setFileError(ui.badType); return; }
    if (next.size > MAX_PROOF_BYTES) { setFileError(ui.tooBig); return; }
    setFile(next);
    setFieldErrors((current) => ({ ...current, file: "" }));
  }

  function onDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault(); setDragging(false);
    chooseFile(event.dataTransfer.files?.[0]);
  }

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (!selectedRoute) next.route = ui.needRoute;
    if (!paidDate) next.paidDate = ui.needDate;
    if (!config?.amount || Number(amountPaid) !== config.amount) next.amount = ui.needAmount;
    if (!file) next.file = ui.needFile;
    if (!declaration) next.declaration = ui.needDeclaration;
    setFieldErrors(next);
    if (Object.keys(next).length) {
      setError(ui.missing);
      const first = ["route", "paidDate", "amount", "file", "declaration"].find((name) => next[name]);
      if (first) document.getElementById(`pay-${first}`)?.focus();
      return false;
    }
    return true;
  }

  async function submitPayment() {
    setError("");
    if (!config?.available || !config.amount || !selectedRoute) { setError(config?.reason ?? ui.chooseRoute); return; }
    if (!validate() || !file) return;
    setBusy(true);
    try {
      // Creates the application first; this is the moment anything is saved, and the moment staff can first see it.
      const prepared = beforeSubmit ? await beforeSubmit() : undefined;
      const activeCaseId = prepared?.caseId ?? caseId;
      if (live && !activeCaseId) throw new Error(ui.completeError);
      // Live path (works when caseId is a real case). If backend rejects (e.g. env flags off),
      // surface the error rather than silently faking a completion — this is a production flow.
      if (live) {
        let intentId = paymentIntentId;
        if (!intentId) {
          const handoffPayload = { case_id: activeCaseId, campaign_id: campaignId, payer_type: "other", expected_amount: config.amount, payment_route: selectedPaymentRoute, idempotency_key: key("payment"), data_mode: "live" };
          const handoff = await fetch("/api/payment/handoff", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(handoffPayload) });
          const handoffBody = await handoff.json(); if (!handoff.ok) throw new Error(handoffBody.error ?? ui.handoffError);
          intentId = handoffBody.paymentIntentId as string; setPaymentIntentId(intentId);
        }
        const declarationText = "I completed this transfer outside SafeCard and understand it does not activate membership.";
        const trimmedReference = reference.trim();
        const marked = await fetch("/api/payment/mark-paid", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ payment_intent_id: intentId, ...(trimmedReference ? { payment_reference: trimmedReference } : {}), paid_at: paidDate, amount_paid: Number(amountPaid), payer_declaration: declarationText, data_mode: "live" }) });
        const markedBody = await marked.json(); if (!marked.ok) throw new Error(markedBody.error ?? ui.referenceError);
        const form = new FormData(); form.set("payment_intent_id", intentId); form.set("case_id", activeCaseId as string); form.set("campaign_id", campaignId); form.set("amount", amountPaid); if (trimmedReference) form.set("reference_number", trimmedReference); form.set("payer_declaration", declarationText); form.set("data_mode", "live"); form.set("file", file);
        const uploaded = await fetch("/api/payment/evidence/upload", { method: "POST", body: form });
        const uploadBody = await uploaded.json(); if (!uploaded.ok) throw new Error(uploadBody.error ?? ui.uploadError);
        onComplete({ routeLabel: selectedRoute.label, reference: trimmedReference || intentId });
        return;
      }
      // Non-live path — no backend row is created.
      await new Promise((resolve) => window.setTimeout(resolve, 400));
      onComplete({ routeLabel: selectedRoute.label, reference: "" });
    } catch (caught) { setError(caught instanceof Error ? caught.message : ui.completeError); }
    finally { setBusy(false); }
  }

  if (!config) return <div className="pay-panel" aria-live="polite"><p className="form-message">{ui.loading}</p></div>;
  if (!config.available) return <div className="parked-panel" role="alert"><strong>{isFil ? "Hindi available ang pagbabayad" : "Payment is unavailable"}</strong><p>{ui.parked}</p></div>;

  const amount = config.amount ?? 1200;
  return (
    <div className="pay-panel">
      <p className="required-legend">{ui.legendRequired}</p>

      {/* 1 — Pay */}
      <section className="pay-step" aria-labelledby="pay-step-1">
        <header><span className="pay-step-badge" aria-hidden="true">1</span><h2 id="pay-step-1">{ui.stepPay}</h2></header>
        <div className="amount-due">
          <span className="amount-icon"><WalletIcon size={22} /></span>
          <div><small>{ui.due}</small><strong>₱{amount.toLocaleString("en-PH")}</strong><span>{ui.perYear}</span></div>
        </div>
        <p className="pay-note">{ui.notHold}</p>

        <fieldset className="route-choices" aria-describedby={fieldErrors.route ? "pay-route-error" : undefined}>
          <legend>{ui.routeLegend} <span className="req" aria-hidden="true">*</span></legend>
          {config.routes.map((route, index) => (
            <label className={`route-choice ${route.id === routeId ? "selected" : ""}`} key={route.id}>
              <input id={index === 0 ? "pay-route" : undefined} type="radio" name="payment-route" value={route.id} checked={route.id === routeId} disabled={Boolean(paymentIntentId)} onChange={() => { setRouteId(route.id); setFieldErrors((c) => ({ ...c, route: "" })); }} />
              <span className="route-choice-text"><strong>{route.label}</strong><small>{route.instructions}</small></span>
              <span className="route-choice-check" aria-hidden="true"><CheckIcon size={16} /></span>
            </label>
          ))}
        </fieldset>
        {fieldErrors.route && <p className="field-error" id="pay-route-error" role="alert">{fieldErrors.route}</p>}

        {selectedRoute && (
          <div className="payment-details" aria-live="polite">
            {selectedRoute.qrImageUrl && (
              <div className="qr-block">
                <Image src={selectedRoute.qrImageUrl} alt={ui.qrAlt} className="payment-qr" width={360} height={360} unoptimized />
                <p>{ui.scan}</p>
              </div>
            )}
            <div className="detail-rows">
              {(selectedRoute.accountName ?? config.accountName) && <CopyRow label={ui.accountName} value={selectedRoute.accountName ?? config.accountName ?? ""} copied={copied} onCopy={copy} copyLabel={ui.copy} copiedLabel={ui.copied} />}
              {selectedRoute.bank && <CopyRow label={ui.bank} value={selectedRoute.bank} copied={copied} onCopy={copy} copyLabel={ui.copy} copiedLabel={ui.copied} />}
              {selectedRoute.accountNumber && <CopyRow label={ui.accountNumber} value={selectedRoute.accountNumber} copied={copied} onCopy={copy} copyLabel={ui.copy} copiedLabel={ui.copied} />}
              {selectedRoute.swiftCode && <CopyRow label={ui.swift} value={selectedRoute.swiftCode} copied={copied} onCopy={copy} copyLabel={ui.copy} copiedLabel={ui.copied} />}
              {selectedRoute.branch && <CopyRow label={ui.branch} value={selectedRoute.branch} copied={copied} onCopy={copy} copyLabel={ui.copy} copiedLabel={ui.copied} />}
            </div>
          </div>
        )}
      </section>

      {/* 2 — Proof */}
      <section className="pay-step" aria-labelledby="pay-step-2">
        <header><span className="pay-step-badge" aria-hidden="true">2</span><h2 id="pay-step-2">{ui.stepProof}</h2></header>
        <div className="form-grid">
          <Field id="pay-paidDate" label={ui.paidDate} required requiredText={ui.required} type="date" value={paidDate} max={new Date().toISOString().slice(0, 10)} error={fieldErrors.paidDate} onChange={(v) => { setPaidDate(v); setFieldErrors((c) => ({ ...c, paidDate: "" })); }} />
          <Field id="pay-amount" label={ui.amountPaid} required requiredText={ui.required} type="number" inputMode="decimal" value={amountPaid} hint={ui.amountHint} error={fieldErrors.amount} onChange={(v) => { setAmountPaid(v); setFieldErrors((c) => ({ ...c, amount: "" })); }} />
          <div className="full"><Field id="pay-reference" label={ui.reference} optionalText={ui.optional} value={reference} placeholder={ui.referencePlaceholder} hint={ui.referenceHint} autoComplete="off" onChange={setReference} /></div>
        </div>

        <div className="proof-field">
          <span className="field-label" id="pay-file-label">{isFil ? "Proof of payment" : "Proof of payment"} <span className="req" aria-hidden="true">*</span><span className="sr-only"> ({ui.required})</span></span>
          {!file ? (
            <label className={`dropzone ${dragging ? "dragging" : ""} ${fieldErrors.file ? "invalid" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}>
              <input id="pay-file" ref={fileInput} type="file" accept={PROOF_TYPES.join(",")} aria-labelledby="pay-file-label" aria-describedby="pay-file-hint" onChange={(event) => chooseFile(event.target.files?.[0])} />
              <UploadIcon size={28} />
              <strong>{ui.dropTitle}</strong>
              <span id="pay-file-hint">{ui.dropHint}</span>
            </label>
          ) : (
            <div className="file-card">
              {previewUrl && file.type !== "application/pdf"
                ? <Image src={previewUrl} alt={ui.preview} className="file-thumb" width={96} height={96} unoptimized />
                : <span className="file-thumb pdf"><FileTextIcon size={30} /></span>}
              <div className="file-meta"><strong>{file.name}</strong><span>{formatSize(file.size)}</span></div>
              <div className="file-actions">
                <button type="button" className="link-button" onClick={() => fileInput.current?.click()}>{ui.replace}</button>
                <button type="button" className="link-button" onClick={() => { setFile(null); if (fileInput.current) fileInput.current.value = ""; }}>{ui.remove}</button>
                <input id="pay-file" ref={fileInput} className="sr-only" type="file" accept={PROOF_TYPES.join(",")} aria-labelledby="pay-file-label" onChange={(event) => chooseFile(event.target.files?.[0])} tabIndex={-1} />
              </div>
            </div>
          )}
          {(fileError || fieldErrors.file) && <p className="field-error" role="alert">{fileError || fieldErrors.file}</p>}
        </div>
      </section>

      {/* 3 — Confirm */}
      <section className="pay-step" aria-labelledby="pay-step-3">
        <header><span className="pay-step-badge" aria-hidden="true">3</span><h2 id="pay-step-3">{ui.stepConfirm}</h2></header>
        <label className="consent-row">
          <input id="pay-declaration" type="checkbox" checked={declaration} aria-required="true" onChange={(event) => { setDeclaration(event.target.checked); setFieldErrors((c) => ({ ...c, declaration: "" })); }} />
          <span>{ui.declaration} <span className="req" aria-hidden="true">*</span></span>
        </label>
        {fieldErrors.declaration && <p className="field-error" role="alert">{fieldErrors.declaration}</p>}
        {error && <p className="form-message error" role="alert">{error}</p>}
        <div className="pay-submit">
          <button className="button-primary" type="button" disabled={busy} onClick={submitPayment}>{busy ? ui.uploading : ui.submit}</button>
          <p>{ui.submitNote}</p>
        </div>
      </section>
    </div>
  );
}

function CopyRow({ label, value, copied, onCopy, copyLabel, copiedLabel }: { label: string; value: string; copied: string; onCopy: (value: string, label: string) => void; copyLabel: string; copiedLabel: string }) {
  return (
    <div className="copy-row">
      <span><small>{label}</small><strong>{value}</strong></span>
      <button type="button" className="chip-button" onClick={() => onCopy(value, label)} aria-label={`${copyLabel} ${label}`}>
        {copied === label ? <><CheckIcon size={14} />{copiedLabel}</> : <><CopyIcon size={14} />{copyLabel}</>}
      </button>
    </div>
  );
}

export function Field({ id, label, value, onChange, type = "text", required, requiredText, optionalText, hint, error, placeholder, autoComplete, inputMode, max, maxLength, onBlur }: {
  id: string; label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean; requiredText?: string; optionalText?: string;
  hint?: string; error?: string; placeholder?: string; autoComplete?: string; inputMode?: "text" | "numeric" | "decimal" | "tel" | "email"; max?: string; maxLength?: number; onBlur?: () => void;
}) {
  const describedBy = [hint ? `${id}-hint` : "", error ? `${id}-error` : ""].filter(Boolean).join(" ") || undefined;
  return (
    <div className={`field-block ${error ? "has-error" : ""}`}>
      <label htmlFor={id}>
        {label}
        {required && <><span className="req" aria-hidden="true"> *</span><span className="sr-only"> ({requiredText ?? "required"})</span></>}
        {optionalText && <span className="opt"> ({optionalText})</span>}
      </label>
      <input id={id} type={type} value={value} required={required} aria-required={required || undefined} aria-invalid={error ? true : undefined} aria-describedby={describedBy}
        placeholder={placeholder} autoComplete={autoComplete} inputMode={inputMode} max={max} maxLength={maxLength} onBlur={onBlur} onChange={(event) => onChange(event.target.value)} />
      {hint && !error && <p className="field-hint" id={`${id}-hint`}>{hint}</p>}
      {error && <p className="field-error" id={`${id}-error`} role="alert">{error}</p>}
    </div>
  );
}
