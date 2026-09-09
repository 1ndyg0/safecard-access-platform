"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { readJson } from "@/components/admin/use-async-load";

type Campaign = { id: string; name: string };
type EligibleCase = {
  id: string;
  application_ref: string;
  application_state: string;
  application_review_state: string;
  payment_state: string;
  prc_handoff_state: string;
};
type Batch = {
  id: string;
  batch_ref: string;
  record_count: number;
  checksum: string;
  format: "csv" | "json";
  created_at: string;
};
type ExportItem = {
  id: string;
  application_ref: string;
  prc_status: string;
  prc_notes: string | null;
  correction_reason: string | null;
  prc_membership_id: string | null;
  prc_effective_date: string | null;
};
type ConsoleData = {
  campaigns: Campaign[];
  selectedCampaignId: string;
  capabilities: { canCreateBatch: boolean; canAcknowledge: boolean };
  eligibleCases: EligibleCase[];
  batches: Batch[];
  selectedBatch: Batch | null;
  items: ExportItem[];
};

export function ExportConsole() {
  const router = useRouter();
  const [data, setData] = useState<ConsoleData | null>(null);
  const [campaignId, setCampaignId] = useState("");
  const [selectedCases, setSelectedCases] = useState<string[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState("");
  const [reason, setReason] = useState("");
  const [format, setFormat] = useState<"csv" | "json">("csv");
  const [eligibilityConfirmed, setEligibilityConfirmed] = useState(false);
  const [transferConfirmed, setTransferConfirmed] = useState(false);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (nextCampaign = "", nextBatch = "") => {
    setState("loading");
    setError("");
    try {
      const params = new URLSearchParams();
      if (nextCampaign) params.set("campaign_id", nextCampaign);
      if (nextBatch) params.set("batch_id", nextBatch);
      const response = await fetch(`/api/export/console?${params}`, { cache: "no-store" });
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const body = await readJson(response, "Unable to load the PRC export workspace.");
      setData(body);
      setCampaignId(body.selectedCampaignId);
      setSelectedBatchId(body.selectedBatch?.id ?? "");
      setSelectedCases((current) =>
        current.filter((id) => body.eligibleCases.some((item: EligibleCase) => item.id === id)),
      );
      setState("ready");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to load exports.");
      setState("error");
    }
  }, [router]);

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

  const allEligibleSelected = useMemo(
    () => Boolean(data?.eligibleCases.length)
      && data!.eligibleCases.every((item) => selectedCases.includes(item.id)),
    [data, selectedCases],
  );

  function chooseCampaign(next: string) {
    setCampaignId(next);
    setSelectedCases([]);
    setSelectedBatchId("");
    void load(next, "");
  }

  async function createBatch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch("/api/export/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: campaignId,
          creation_reason: reason.trim(),
          case_ids: selectedCases,
          format,
        }),
      });
      const body = await readJson(
        response,
        response.status === 403
          ? "Export requires a finance/school role and an AAL2 authenticator session."
          : "The export batch could not be created.",
      );
      setNotice(
        `${body.batchRef} created with ${body.recordCount} record(s). SHA-256 ${body.checksum}.`,
      );
      setReason("");
      setSelectedCases([]);
      setEligibilityConfirmed(false);
      setTransferConfirmed(false);
      setSelectedBatchId(body.batchId);
      await load(campaignId, body.batchId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Export creation failed.");
    } finally {
      setBusy(false);
    }
  }

  async function acknowledge(event: FormEvent<HTMLFormElement>, itemId: string) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setNotice("");
    const form = new FormData(event.currentTarget);
    const status = String(form.get("prc_status"));
    try {
      const response = await fetch("/api/export/acknowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          export_item_id: itemId,
          prc_status: status,
          prc_notes: optional(form.get("prc_notes")),
          correction_reason: status === "correction_requested"
            ? optional(form.get("correction_reason"))
            : undefined,
          correction_fields: status === "correction_requested"
            ? { applicant_follow_up_required: true }
            : undefined,
          prc_membership_id: status === "accepted"
            ? optional(form.get("prc_membership_id"))
            : undefined,
          prc_effective_date: status === "accepted"
            ? optional(form.get("prc_effective_date"))
            : undefined,
          prc_expiry_date: status === "accepted"
            ? optional(form.get("prc_expiry_date"))
            : undefined,
        }),
      });
      const body = await readJson(response, "The PRC response could not be recorded.");
      setNotice(body.message);
      await load(campaignId, selectedBatchId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "PRC response failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AdminShell>
      <header className="admin-heading">
        <div>
          <p className="eyebrow">Controlled PRC handoff</p>
          <h1>Export and acknowledgement</h1>
          <p className="muted-note">
            Prepare an immutable, checksum-verified package and reconcile every PRC response.
          </p>
        </div>
        <label className="field-block compact">
          <span>Campaign</span>
          <select value={campaignId} disabled={!data?.campaigns.length || busy} onChange={(event) => chooseCampaign(event.target.value)}>
            {data?.campaigns.map((campaign) => <option key={campaign.id} value={campaign.id}>{campaign.name}</option>)}
          </select>
        </label>
      </header>

      <div aria-live="polite" role="status">
        {state === "loading" && <p className="form-message">Loading export controls…</p>}
        {error && <p className="form-message error">{error}</p>}
        {notice && <p className="form-message">{notice}</p>}
      </div>

      {state === "ready" && data && (
        <div className="export-workspace">
          <section className="admin-panel stack">
            <div>
              <p className="eyebrow">Eligibility preview</p>
              <h2>{data.eligibleCases.length} case(s) ready for export</h2>
              <p className="muted-note">Approved application + verified payment + ready handoff. No profile data is exposed in this preview.</p>
            </div>
            {data.capabilities.canCreateBatch ? (
              <form className="stack" onSubmit={createBatch}>
                <label className="confirmation-check select-all">
                  <input
                    type="checkbox"
                    checked={allEligibleSelected}
                    onChange={(event) => setSelectedCases(event.target.checked ? data.eligibleCases.map((item) => item.id) : [])}
                  />
                  <span>Select every currently eligible case</span>
                </label>
                <div className="export-case-list">
                  {data.eligibleCases.map((item) => (
                    <label key={item.id}>
                      <input
                        type="checkbox"
                        checked={selectedCases.includes(item.id)}
                        onChange={(event) => setSelectedCases((current) => event.target.checked ? [...current, item.id] : current.filter((id) => id !== item.id))}
                      />
                      <span><strong>{item.application_ref}</strong><small>{item.application_state.replaceAll("_", " ")} · payment verified</small></span>
                    </label>
                  ))}
                  {!data.eligibleCases.length && <p>No case currently satisfies every export gate.</p>}
                </div>
                <label className="field-block"><span>Creation reason</span><textarea value={reason} minLength={10} maxLength={500} required onChange={(event) => setReason(event.target.value)} /></label>
                <label className="field-block compact"><span>Package format</span><select value={format} onChange={(event) => setFormat(event.target.value as "csv" | "json")}><option value="csv">CSV</option><option value="json">JSON</option></select></label>
                <label className="confirmation-check"><input type="checkbox" checked={eligibilityConfirmed} required onChange={(event) => setEligibilityConfirmed(event.target.checked)} /><span>I reviewed the selected application, payment, and handoff states.</span></label>
                <label className="confirmation-check"><input type="checkbox" checked={transferConfirmed} required onChange={(event) => setTransferConfirmed(event.target.checked)} /><span>I understand the package may be transferred only through the approved PRC procedure.</span></label>
                <button className="button-primary" type="submit" disabled={busy || !selectedCases.length || reason.trim().length < 10 || !eligibilityConfirmed || !transferConfirmed}>{busy ? "Creating…" : `Create ${format.toUpperCase()} batch`}</button>
                <p className="portal-footnote">Creation and download require an AAL2 authenticator session. Ordinary login remains password-only; no SMS OTP is used.</p>
              </form>
            ) : <p>Your role can reconcile PRC responses but cannot create export batches.</p>}
          </section>

          <section className="admin-panel stack">
            <div><p className="eyebrow">Immutable batches</p><h2>Recent handoffs</h2></div>
            <label className="field-block compact"><span>Open batch</span><select value={selectedBatchId} onChange={(event) => { setSelectedBatchId(event.target.value); void load(campaignId, event.target.value); }}><option value="">Choose a batch</option>{data.batches.map((batch) => <option key={batch.id} value={batch.id}>{batch.batch_ref} · {batch.record_count} records</option>)}</select></label>
            {data.selectedBatch && (
              <div className="batch-summary">
                <strong>{data.selectedBatch.batch_ref}</strong>
                <span>{data.selectedBatch.record_count} records · {data.selectedBatch.format.toUpperCase()}</span>
                <code>SHA-256 {data.selectedBatch.checksum}</code>
                <a className="button-quiet" href={`/api/export/download?batch_id=${encodeURIComponent(data.selectedBatch.id)}`}>Download verified package</a>
              </div>
            )}
            {data.items.map((item) => (
              <article className="export-item" key={item.id}>
                <div><strong>{item.application_ref}</strong><span className="status-pill">{item.prc_status.replaceAll("_", " ")}</span></div>
                {data.capabilities.canAcknowledge && !["accepted", "rejected"].includes(item.prc_status) && <PrcResponseForm busy={busy} onSubmit={(event) => void acknowledge(event, item.id)} />}
              </article>
            ))}
          </section>
        </div>
      )}
    </AdminShell>
  );
}

function PrcResponseForm({ busy, onSubmit }: { busy: boolean; onSubmit: (event: FormEvent<HTMLFormElement>) => void }) {
  const [status, setStatus] = useState("acknowledged");
  return <form className="stack" onSubmit={onSubmit}>
    <label className="field-block compact"><span>PRC response</span><select name="prc_status" value={status} onChange={(event) => setStatus(event.target.value)}><option value="acknowledged">Acknowledged</option><option value="correction_requested">Correction requested</option><option value="accepted">Accepted and membership confirmed</option><option value="rejected">Rejected</option></select></label>
    <label className="field-block"><span>PRC notes (optional)</span><textarea name="prc_notes" maxLength={1000} /></label>
    {status === "correction_requested" && <label className="field-block"><span>Applicant-safe correction reason</span><textarea name="correction_reason" minLength={10} maxLength={500} required /></label>}
    {status === "accepted" && <div className="form-grid"><label className="field-block"><span>Official PRC membership ID</span><input name="prc_membership_id" maxLength={50} required /></label><label className="field-block"><span>Effective date</span><input name="prc_effective_date" type="date" required /></label><label className="field-block"><span>Expiry date (optional)</span><input name="prc_expiry_date" type="date" /></label></div>}
    <label className="confirmation-check"><input type="checkbox" required /><span>I confirm this response came from the authorized PRC process.</span></label>
    <button className="button-primary" type="submit" disabled={busy}>Record PRC response</button>
  </form>;
}

function optional(value: FormDataEntryValue | null) {
  const text = String(value ?? "").trim();
  return text || undefined;
}
