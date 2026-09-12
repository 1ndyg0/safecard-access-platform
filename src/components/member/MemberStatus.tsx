"use client";

/**
 * Member status.
 *
 * Shows all six things separately — application reference, application
 * state, review outcome, payment, PRC handoff, membership — because the
 * whole product depends on the applicant understanding that they are
 * not the same thing. An approved application that reads as "you're a
 * member" is the failure mode this screen exists to prevent.
 */

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { useLocale } from "@/components/LocaleProvider";
import { reviewStateLabel, t, type Locale } from "@/lib/member/copy";

type StatusData = {
  reference: string;
  states: {
    application_state: string;
    application_review_state: string;
    payment_state: string;
    prc_handoff_state: string;
    membership_state: string;
    updated_at: string;
  };
  review: {
    state: string;
    reason: string | null;
    correctionRequested: boolean;
    rejected: boolean;
  };
  payment: { replacementRequested: boolean; reason: string | null };
  nextAction: string;
};

export function MemberStatus() {
  const router = useRouter();
  const { locale } = useLocale();
  const lang = locale as Locale;

  const [status, setStatus] = useState<StatusData | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);
  const [paymentBusy, setPaymentBusy] = useState(false);
  const [paymentMessage, setPaymentMessage] = useState("");
  const [replacementFile, setReplacementFile] = useState<File | null>(null);
  const [replacementConfirmed, setReplacementConfirmed] = useState(false);

  const load = useCallback(async () => {
    setState("loading");
    setError("");
    try {
      const response = await fetch("/api/member/status", { cache: "no-store" });
      if (response.status === 401) {
        router.replace("/member");
        return;
      }
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? t("loadError", lang));
      setStatus(body);
      setState("ready");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("loadError", lang));
      setState("error");
    }
  }, [lang, router]);

  async function reportPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPaymentBusy(true);
    setPaymentMessage("");
    setError("");
    try {
      const response = await fetch("/api/member/payment/mark-paid", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          payment_reference: paymentReference.trim(),
          confirm: paymentConfirmed,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "The reference could not be saved.");
      setPaymentMessage(
        lang === "fil"
          ? "Naitala ang reference. Hinihintay pa rin ang opisyal na beripikasyon; hindi pa aktibo ang membership."
          : "Reference saved. Official verification is still required; membership is not active yet.",
      );
      setPaymentReference("");
      setPaymentConfirmed(false);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The reference could not be saved.");
    } finally {
      setPaymentBusy(false);
    }
  }

  async function replacePaymentEvidence(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!replacementFile || !replacementConfirmed) return;
    setPaymentBusy(true);
    setPaymentMessage("");
    setError("");
    try {
      const form = new FormData();
      form.set("file", replacementFile);
      const response = await fetch("/api/member/payment/evidence", { method: "POST", body: form });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "The replacement proof could not be uploaded.");
      setPaymentMessage(
        lang === "fil"
          ? "Natanggap ang bagong proof. Hinihintay pa rin ang opisyal na beripikasyon."
          : "Replacement proof received. Official verification is still required.",
      );
      setReplacementFile(null);
      setReplacementConfirmed(false);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The replacement proof could not be uploaded.");
    } finally {
      setPaymentBusy(false);
    }
  }

  useEffect(() => {
    let active = true;
    void (async () => {
      await Promise.resolve();
      if (active) await load();
    })();
    return () => {
      active = false;
    };
  }, [load]);

  const rows = status
    ? [
        { label: t("labelApplication", lang), value: status.states.application_state },
        {
          label: t("labelReview", lang),
          value: reviewStateLabel(status.states.application_review_state, lang),
          raw: true,
        },
        { label: t("labelPayment", lang), value: status.states.payment_state },
        { label: t("labelHandoff", lang), value: status.states.prc_handoff_state },
        { label: t("labelMembership", lang), value: status.states.membership_state },
      ]
    : [];

  return (
    <main className="portal-page">
      <div className="portal-shell">
        <header className="portal-header">
          <Link href="/">
            <BrandMark />
          </Link>
          <Link href="/member/card" className="button-quiet">
            {lang === "fil" ? "Electronic card" : "Electronic card"}
          </Link>
        </header>

        <section className="portal-card">
          <p className="eyebrow">{t("statusTitle", lang)}</p>
          <h1>{status?.reference ?? t("statusTitle", lang)}</h1>

          <div aria-live="polite" role="status">
            {state === "loading" && <p className="form-message">{t("loading", lang)}</p>}
            {state === "error" && (
              <p className="form-message error">
                {error}{" "}
                <button type="button" className="link-button" onClick={() => void load()}>
                  {t("retry", lang)}
                </button>
              </p>
            )}
          </div>

          {state === "ready" && status && (
            <>
              <div className="table-wrap">
                <table className="admin-table status-table">
                  <caption className="visually-hidden">{t("statusTitle", lang)}</caption>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.label}>
                        <th scope="row">{row.label}</th>
                        <td>{row.raw ? row.value : row.value.replaceAll("_", " ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <p className="portal-footnote">{t("separateStates", lang)}</p>

              {status.states.application_review_state === "approved" && (
                <div className="notice-panel">
                  <strong>{t("reviewApproved", lang)}</strong>
                  <span>{t("approvedNotMembership", lang)}</span>
                </div>
              )}

              {status.review.reason && (
                <div className="notice-panel">
                  <strong>{t("reasonFromReviewer", lang)}</strong>
                  {/* The reviewer's own words, untranslated by design. */}
                  <span>{status.review.reason}</span>
                </div>
              )}

              {status.review.correctionRequested && (
                <Link className="button-primary" href="/member/correction">
                  {t("correctionTitle", lang)}
                </Link>
              )}

              {status.review.rejected && (
                <div className="notice-panel">
                  <strong>{t("reviewRejected", lang)}</strong>
                  <span>{t("rejectedGuidance", lang)}</span>
                </div>
              )}

              {status.payment.replacementRequested && (
                <form className="notice-panel member-evidence-replacement" onSubmit={replacePaymentEvidence}>
                  <strong>{t("paymentReplacementTitle", lang)}</strong>
                  <span>{t("paymentReplacementIntro", lang)}</span>
                  {status.payment.reason && <span>{status.payment.reason}</span>}
                  <label className="field-block">
                    <span>{lang === "fil" ? "Bagong proof (JPEG, PNG, o WebP; max 10 MB)" : "New proof (JPEG, PNG, or WebP; max 10 MB)"}</span>
                    <input type="file" accept="image/jpeg,image/png,image/webp" required onChange={(event) => setReplacementFile(event.target.files?.[0] ?? null)} />
                  </label>
                  <label className="confirmation-check">
                    <input type="checkbox" checked={replacementConfirmed} required onChange={(event) => setReplacementConfirmed(event.target.checked)} />
                    <span>{lang === "fil" ? "Kinukumpirma kong ito ang tamang replacement proof para sa bayad na ito." : "I confirm this is the correct replacement proof for this payment."}</span>
                  </label>
                  <button className="button-primary" type="submit" disabled={paymentBusy || !replacementFile || !replacementConfirmed}>
                    {paymentBusy ? (lang === "fil" ? "Ina-upload…" : "Uploading…") : t("paymentReplacementTitle", lang)}
                  </button>
                </form>
              )}

              {status.states.payment_state === "official_handoff_opened" && (
                <form className="member-payment-resume" onSubmit={reportPayment}>
                  <div>
                    <p className="eyebrow">
                      {lang === "fil" ? "I-report ang bayad" : "Report an off-platform payment"}
                    </p>
                    <h2>
                      {lang === "fil" ? "Ilagay ang transaction reference" : "Enter the transaction reference"}
                    </h2>
                    <p>
                      {lang === "fil"
                        ? "Gamitin ang reference mula sa opisyal na GCash o bank receipt. Susuriin pa ito ng authorized staff."
                        : "Use the reference from the official GCash or bank receipt. Authorized staff must still reconcile it."}
                    </p>
                  </div>
                  <label className="field-block">
                    <span>{lang === "fil" ? "Transaction reference" : "Transaction reference"}</span>
                    <input
                      value={paymentReference}
                      onChange={(event) => setPaymentReference(event.target.value)}
                      minLength={1}
                      maxLength={100}
                      autoComplete="off"
                      required
                    />
                  </label>
                  <label className="confirmation-check">
                    <input
                      type="checkbox"
                      checked={paymentConfirmed}
                      onChange={(event) => setPaymentConfirmed(event.target.checked)}
                      required
                    />
                    <span>
                      {lang === "fil"
                        ? "Kinukumpirma kong natapos ang transfer sa labas ng SafeCard at nauunawaan kong hindi nito awtomatikong ina-activate ang membership."
                        : "I confirm the transfer was completed outside SafeCard and understand that it does not automatically activate membership."}
                    </span>
                  </label>
                  <button
                    type="submit"
                    className="button-primary"
                    disabled={paymentBusy || !paymentConfirmed || !paymentReference.trim()}
                  >
                    {paymentBusy
                      ? (lang === "fil" ? "Itinatala…" : "Saving…")
                      : (lang === "fil" ? "Isumite para sa beripikasyon" : "Submit for verification")}
                  </button>
                </form>
              )}

              {paymentMessage && <p className="form-message" role="status">{paymentMessage}</p>}

              <p className="portal-footnote">
                {t("lastUpdated", lang)}{" "}
                {new Date(status.states.updated_at).toISOString().slice(0, 16).replace("T", " ")}.{" "}
                {t("hotlineHelp", lang)} <a href="tel:143">{t("callHotline", lang)}</a>
              </p>
            </>
          )}
        </section>
      </div>
    </main>
  );
}
