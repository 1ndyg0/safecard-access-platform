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
import { useCallback, useEffect, useState } from "react";
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
                <div className="notice-panel">
                  <strong>{t("paymentReplacementTitle", lang)}</strong>
                  <span>{t("paymentReplacementIntro", lang)}</span>
                  {status.payment.reason && <span>{status.payment.reason}</span>}
                  <Link className="button-quiet" href="/apply/payment">
                    {t("paymentReplacementTitle", lang)}
                  </Link>
                </div>
              )}

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
