"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { ReviewPanel } from "@/components/admin/ReviewPanel";

type Detail = { case: Record<string, string>; profile: Record<string, string> | null; payments: Array<Record<string, string>> };

export function CaseDetail({ id }: { id: string }) {
  const router = useRouter(); const [data, setData] = useState<Detail>(); const [error, setError] = useState(""); const [reloadToken, setReloadToken] = useState(0);
  useEffect(() => { fetch(`/api/admin/cases/${id}`, { cache: "no-store" }).then(async (response) => { const body = await response.json(); if (response.status === 401) { router.replace("/admin/login"); return; } if (!response.ok) throw new Error(body.error); setData(body); }).catch((caught) => setError(caught instanceof Error ? caught.message : "Unable to load.")); }, [id, router, reloadToken]);
  const profile = data?.profile;
  return <AdminShell><header className="admin-heading"><div><p className="eyebrow">Authorized case detail</p><h1>{data?.case.application_ref ?? "Submission"}</h1></div><Link href="/admin/submissions" className="button-quiet">Back to queue</Link></header>{error && <p className="form-message error">{error}</p>}{data && <><div className="state-grid">{["consent_state", "application_state", "application_review_state", "payment_state", "prc_handoff_state", "membership_state"].map((key) => <article key={key}><span>{key.replaceAll("_", " ")}</span><strong>{data.case[key]?.replaceAll("_", " ")}</strong></article>)}</div><section className="admin-panel stack"><p className="eyebrow">Minimum necessary profile</p>{profile ? <dl className="review-list"><div><dt>Name</dt><dd>{[profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(" ")}</dd></div><div><dt>Date of birth</dt><dd>{profile.date_of_birth}</dd></div><div><dt>Mobile</dt><dd>{profile.mobile_number}</dd></div><div><dt>Address</dt><dd>{[profile.address_line1, profile.address_line2, profile.city, profile.province, profile.zip_code].filter(Boolean).join(", ")}</dd></div></dl> : <p>No profile has been submitted.</p>}</section><ReviewPanel caseId={id} reviewState={data.case.application_review_state ?? "pending"} onDecided={() => setReloadToken((value) => value + 1)} /><section className="admin-panel stack"><p className="eyebrow">Payment evidence</p>{data.payments.length ? data.payments.map((payment) => <article key={payment.id} className="payment-row"><strong>{payment.payment_state?.replaceAll("_", " ")}</strong><span>{payment.payment_route} · {payment.expected_amount} PHP</span></article>) : <p>No payment intent. Provider-dependent payment is parked.</p>}</section></>}</AdminShell>;
}
