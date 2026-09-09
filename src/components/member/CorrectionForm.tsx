"use client";

/**
 * Correction form.
 *
 * Loaded with the fields currently on record so the applicant corrects
 * a real application rather than retyping it from memory. Submitting
 * creates a new immutable version; the previous one is preserved.
 *
 * Nothing here is written to localStorage or sessionStorage. The values
 * on screen are personal data, and a shared phone is the normal case for
 * this product, not the edge case.
 */

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/components/LocaleProvider";
import {
  correctionBlockMessage,
  fieldLabel,
  t,
  type Locale,
} from "@/lib/member/copy";
import { newIdempotencyKey } from "@/lib/idempotency";

type Eligibility = {
  allowed: boolean;
  reason?: string;
  renewedConsent?: { changeSummary: string | null };
};

type CorrectionData = {
  reference: string;
  eligibility: Eligibility;
  reviewReason: string | null;
  fields: string[];
  values: Record<string, string | null> | null;
};

const OPTIONAL_FIELDS = new Set(["middle_name", "address_line2", "civil_status", "email"]);
const SEX_VALUES = ["male", "female"];

export function CorrectionForm() {
  const router = useRouter();
  const { locale } = useLocale();
  const lang = locale as Locale;
  const formId = useId();

  const [data, setData] = useState<CorrectionData | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  // Generated on first submit rather than during render: a key minted
  // while rendering is an impure render, and React may render more than
  // once. Held in a ref so a double-click reuses it and the server's
  // idempotency check collapses the second request.
  const idempotencyKey = useRef<string>("");

  const load = useCallback(async () => {
    setStatus("loading");
    setError("");
    try {
      const response = await fetch(`/api/member/correction?locale=${lang}`, {
        cache: "no-store",
      });
      if (response.status === 401) {
        router.replace("/member");
        return;
      }
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? t("loadError", lang));
      setData(body);
      setValues(
        Object.fromEntries(
          (body.fields as string[]).map((field) => [
            field,
            (body.values?.[field] as string | null) ?? "",
          ]),
        ),
      );
      setStatus("ready");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("loadError", lang));
      setStatus("error");
    }
  }, [lang, router]);

  // Deferred one microtask so the fetch is not kicked off — and state not
  // set — inside the effect's synchronous body.
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

  function validate(): boolean {
    const errors: Record<string, string> = {};
    for (const field of data?.fields ?? []) {
      const value = (values[field] ?? "").trim();
      if (!value && !OPTIONAL_FIELDS.has(field)) errors[field] = t("required", lang);
    }
    if (values.mobile_number && !/^(09|\+639)\d{9}$/.test(values.mobile_number.trim())) {
      errors.mobile_number = t("invalidMobile", lang);
    }
    if (values.date_of_birth && !/^\d{4}-\d{2}-\d{2}$/.test(values.date_of_birth.trim())) {
      errors.date_of_birth = t("invalidDate", lang);
    }
    if (values.zip_code && !/^\d{4}$/.test(values.zip_code.trim())) {
      errors.zip_code = t("invalidZip", lang);
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function submit() {
    if (!validate()) return;
    if (!idempotencyKey.current) idempotencyKey.current = newIdempotencyKey();
    setBusy(true);
    setError("");
    try {
      const profile = Object.fromEntries(
        Object.entries(values)
          .map(([key, value]) => [key, value.trim()])
          .filter(([, value]) => value !== ""),
      );
      const response = await fetch("/api/member/correction", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profile,
          reviewed_all_fields: true,
          locale: lang,
          idempotency_key: idempotencyKey.current,
        }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? t("loadError", lang));
      setSubmitted(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("loadError", lang));
    } finally {
      setBusy(false);
    }
  }

  if (status === "loading") {
    return (
      <p className="form-message" role="status" aria-live="polite">
        {t("loading", lang)}
      </p>
    );
  }

  if (status === "error") {
    return (
      <p className="form-message error" role="alert">
        {error}{" "}
        <button type="button" className="link-button" onClick={() => void load()}>
          {t("retry", lang)}
        </button>
      </p>
    );
  }

  if (submitted) {
    return (
      <div className="notice-panel" role="status" aria-live="polite">
        <strong>{t("correctionSubmitted", lang)}</strong>
        <span>
          <a href="tel:143">{t("callHotline", lang)}</a>
        </span>
      </div>
    );
  }

  if (!data?.eligibility.allowed) {
    return (
      <div className="notice-panel" role="status">
        <strong>{correctionBlockMessage(data?.eligibility.reason, lang)}</strong>
        {data?.eligibility.renewedConsent?.changeSummary && (
          <span>
            {t("whatChanged", lang)}: {data.eligibility.renewedConsent.changeSummary}
          </span>
        )}
        <span>
          <a href="tel:143">{t("callHotline", lang)}</a>
        </span>
      </div>
    );
  }

  return (
    <form
      className="portal-form correction-form"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
      noValidate
    >
      <p>{t("correctionIntro", lang)}</p>

      {data.reviewReason && (
        <div className="notice-panel">
          <strong>{t("reasonFromReviewer", lang)}</strong>
          {/* Shown exactly as the reviewer wrote it. */}
          <span>{data.reviewReason}</span>
        </div>
      )}

      {/* Errors are announced, not only coloured. */}
      <div aria-live="assertive" role="alert">
        {error && <p className="form-message error">{error}</p>}
      </div>

      {data.fields.map((field) => {
        const inputId = `${formId}-${field}`;
        const errorId = `${inputId}-error`;
        const fieldError = fieldErrors[field];
        return (
          <div className="field-block" key={field}>
            <label htmlFor={inputId}>{fieldLabel(field, lang)}</label>
            {field === "sex" ? (
              <select
                id={inputId}
                value={values[field] ?? ""}
                onChange={(event) =>
                  setValues((current) => ({ ...current, [field]: event.target.value }))
                }
                aria-invalid={fieldError ? true : undefined}
                aria-describedby={fieldError ? errorId : undefined}
              >
                <option value="">—</option>
                {SEX_VALUES.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            ) : (
              <input
                id={inputId}
                type={field === "date_of_birth" ? "date" : "text"}
                inputMode={
                  field === "zip_code" || field === "mobile_number" ? "numeric" : undefined
                }
                value={values[field] ?? ""}
                autoComplete="off"
                onChange={(event) =>
                  setValues((current) => ({ ...current, [field]: event.target.value }))
                }
                aria-invalid={fieldError ? true : undefined}
                aria-describedby={fieldError ? errorId : undefined}
              />
            )}
            {fieldError && (
              <p className="field-error" id={errorId}>
                {fieldError}
              </p>
            )}
          </div>
        );
      })}

      <div className="checkbox-row">
        <input
          id={`${formId}-confirm`}
          type="checkbox"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
        />
        <label htmlFor={`${formId}-confirm`}>{t("reviewedAllFields", lang)}</label>
      </div>

      <button className="button-primary" type="submit" disabled={!confirmed || busy}>
        {busy ? t("submitting", lang) : t("submitCorrection", lang)}
      </button>

      <p className="portal-footnote">
        {t("hotlineHelp", lang)} <a href="tel:143">{t("callHotline", lang)}</a>
      </p>
    </form>
  );
}
