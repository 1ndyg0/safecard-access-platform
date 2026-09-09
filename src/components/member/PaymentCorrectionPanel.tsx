"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { uploadPaymentEvidence } from "@/lib/payment/upload-client";

export type PaymentCorrection = {
  caseId: string;
  campaignId: string;
  paymentIntentId: string;
  amount: number;
  referenceNumber: string | null;
  reason: string;
  dataMode: "synthetic" | "live";
};

export function PaymentCorrectionPanel({ correction, onComplete }: { correction: PaymentCorrection; onComplete: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState("");
  const [progress, setProgress] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const uploadKey = useRef("");

  useEffect(() => {
    if (!file) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => setPreviewUrl(String(reader.result ?? "")));
    reader.readAsDataURL(file);
    return () => reader.abort();
  }, [file]);

  async function submit() {
    if (!file) { setError("Choose a replacement JPEG, PNG, or WebP receipt first."); return; }
    setBusy(true); setError(""); setProgress(0);
    try {
      if (!uploadKey.current) uploadKey.current = `evidence-${crypto.randomUUID()}`;
      await uploadPaymentEvidence({
        paymentIntentId: correction.paymentIntentId,
        file,
        idempotencyKey: uploadKey.current,
        onProgress: setProgress,
      });
      onComplete();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Replacement upload failed.");
    } finally { setBusy(false); }
  }

  return <section className="payment-correction" aria-labelledby="payment-correction-title">
    <p className="eyebrow">Action required</p>
    <h2 id="payment-correction-title">Replace your payment evidence</h2>
    <p className="review-reason"><strong>Reviewer note:</strong> {correction.reason}</p>
    <label className="upload-field"><span>Replacement image (JPEG, PNG, or WebP; maximum 10 MB)</span><input type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { const next = event.target.files?.[0] ?? null; uploadKey.current = ""; setFile(next); if (!next) setPreviewUrl(""); }} /></label>
    {previewUrl && <div className="upload-preview"><Image src={previewUrl} alt="Replacement payment evidence preview" width={720} height={960} unoptimized /><button className="button-quiet" type="button" disabled={busy} onClick={() => { uploadKey.current = ""; setFile(null); setPreviewUrl(""); }}>Remove</button></div>}
    {busy && <div className="upload-progress" aria-live="polite"><span>Uploading securely… {progress}%</span><progress value={progress} max={100} /></div>}
    {error && <p className="form-message error" role="alert">{error}</p>}
    <button className="button-primary" type="button" disabled={busy} onClick={() => void submit()}>{error ? "Retry replacement upload" : "Submit replacement evidence"}</button>
  </section>;
}
