"use client";

/**
 * Case detail.
 *
 * The server decides what this screen may show. `capabilities` comes
 * back with the response and reflects the columns that were actually
 * selected, so a role that cannot see an address does not receive one.
 * Nothing here is hidden with CSS.
 *
 * Application review decisions are displayed but not committed here:
 * approve, request resubmission and reject belong to the
 * application-review module, which owns those states.
 */

import Link from "next/link";
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { PaymentActions } from "@/components/admin/PaymentActions";
import { AuditTimeline } from "@/components/admin/AuditTimeline";
import { readJson, useAsyncLoad } from "@/components/admin/use-async-load";

type Payment = {
  id: string;
  expected_amount: string | number;
  currency: string;
  payment_route: string | null;
  payment_state: string;
  payment_reference: string | null;
  created_at: string;
  evidence?: Array<{
    id: string;
    evidence_type: string;
    reference_number: string | null;
    amount_confirmed: string | number | null;
    is_verified: boolean;
    created_at: string;
  }>;
};

type Detail = {
  case: Record<string, string>;
  profile: Record<string, string> | null;
  submission: {
    id: string;
    submitted_at: string;
    correction_reason: string | null;
    original_submission_id: string | null;
  } | null;
  payments: Payment[];
  capabilities: {
    canViewPayments: boolean;
    canActOnPayments: boolean;
    canViewAudit: boolean;
    canReviewApplication: boolean;
    profileFields: string[];
  };
};

const STATE_KEYS = [
  ["consent_state", "Consent"],
  ["application_state", "Application"],
  ["payment_state", "Payment"],
  ["prc_handoff_state", "PRC handoff"],
  ["membership_state", "Membership"],
] as const;

const FIELD_LABELS: Record<string, string> = {
  first_name: "First name",
  middle_name: "Middle name",
  last_name: "Last name",
  date_of_birth: "Date of birth",
  sex: "Sex",
  mobile_number: "Mobile number",
  email: "Email",
  address_line1: "Address line 1",
  address_line2: "Address line 2",
  city: "City",
  province: "Province",
  zip_code: "ZIP code",
  fields_completed: "Fields completed",
  updated_at: "Profile updated",
};

export function CaseDetail({ id }: { id: string }) {
  const router = useRouter();
  const [data, setData] = useState<Detail | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const loader = useCallback(
    async (isActive: () => boolean) => {
      // reloadToken is read so that a completed payment action re-runs
      // this loader and the states below reflect the new reality.
      void reloadToken;
      const response = await fetch(`/api/admin/cases/${id}`, { cache: "no-store" });
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const body = await readJson(response, "Unable to load this case.");
      if (!isActive()) return;
      setData(body);
    },
    [id, router, reloadToken],
  );

  const { status, error, reload } = useAsyncLoad(loader, "Unable to load this case.");

  return (
    <AdminShell>
      <header className="admin-heading">
        <div>
          <p className="eyebrow">Authorized case detail</p>
          <h1>{data?.case.application_ref ?? "Submission"}</h1>
        </div>
        <Link href="/admin/submissions" className="button-quiet">
          Back to queue
        </Link>
      </header>

      <div aria-live="polite" role="status">
        {status === "loading" && <p className="form-message">Loading case…</p>}
        {status === "error" && (
          <p className="form-message error">
            {error}{" "}
            <button type="button" className="link-button" onClick={reload}>
              Try again
            </button>
          </p>
        )}
      </div>

      {status === "ready" && data && (
        <>
          <h2 className="section-title">Workflow states</h2>
          <div className="state-grid">
            {STATE_KEYS.map(([key, label]) => (
              <article key={key}>
                <span>{label}</span>
                <strong>{data.case[key]?.replaceAll("_", " ")}</strong>
              </article>
            ))}
          </div>
          <p className="muted-note">
            These advance independently. A verified payment is not an approved application,
            and neither one activates membership.
          </p>

          <section className="admin-panel stack">
            <p className="eyebrow">Minimum necessary profile</p>
            {data.capabilities.profileFields.length === 0 ? (
              <p>Your role does not include profile access for this case.</p>
            ) : data.profile ? (
              <dl className="review-list">
                {data.capabilities.profileFields.map((field) => (
                  <div key={field}>
                    <dt>{FIELD_LABELS[field] ?? field}</dt>
                    <dd>{data.profile?.[field] ?? "—"}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p>No profile has been submitted.</p>
            )}
          </section>

          {data.capabilities.canReviewApplication && (
            <section className="admin-panel stack">
              <p className="eyebrow">Application review</p>
              <p>
                Current state: <strong>{data.case.application_state?.replaceAll("_", " ")}</strong>
                {data.submission?.original_submission_id
                  ? " · this is a resubmission"
                  : ""}
              </p>
              {data.submission?.correction_reason && (
                <p className="form-message">
                  Correction requested: {data.submission.correction_reason}
                </p>
              )}
              <p className="muted-note">
                Approve, request resubmission and reject are committed by the application
                review module and are not available from this screen yet.
              </p>
            </section>
          )}

          {data.capabilities.canViewPayments && (
            <section className="admin-panel stack">
              <p className="eyebrow">Payment intents and evidence</p>
              {data.payments.length === 0 ? (
                <p>No payment intent. Provider-dependent payment is parked.</p>
              ) : (
                data.payments.map((payment) => (
                  <article key={payment.id} className="payment-row">
                    <div>
                      <strong>{payment.payment_state.replaceAll("_", " ")}</strong>
                      <span>
                        {payment.payment_route ?? "No route"} · {payment.expected_amount}{" "}
                        {payment.currency}
                      </span>
                    </div>
                    {data.capabilities.canActOnPayments && (
                      <PaymentActions
                        caseId={id}
                        paymentIntentId={payment.id}
                        paymentState={payment.payment_state}
                        evidence={payment.evidence ?? []}
                        onCompleted={() => setReloadToken((value) => value + 1)}
                      />
                    )}
                  </article>
                ))
              )}
            </section>
          )}

          {data.capabilities.canViewAudit && <AuditTimeline caseId={id} />}
        </>
      )}
    </AdminShell>
  );
}
