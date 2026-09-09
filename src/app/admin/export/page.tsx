"use client";

import { useEffect, useState, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";

type BatchResult = {
  batchId: string;
  batchRef: string;
  recordCount: number;
  checksum: string;
  format: string;
};

export default function ExportPage() {
  const router = useRouter();
  const [campaignId, setCampaignId] = useState("");
  const [creationReason, setCreationReason] = useState("");
  const [creating, setCreating] = useState(false);
  const [batch, setBatch] = useState<BatchResult | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // Acknowledgment State
  const [ackRef, setAckRef] = useState("");
  const [ackBy, setAckBy] = useState("");
  const [acknowledging, setAcknowledging] = useState(false);

  useEffect(() => {
    fetch("/api/admin/overview", { cache: "no-store" })
      .then(async (res) => {
        if (res.status === 401) {
          router.replace("/admin/login");
          return;
        }
        const data = await res.json();
        if (data.selectedCampaignId) setCampaignId(data.selectedCampaignId);
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load campaign"));
  }, [router]);

  async function handleCreateBatch(e: FormEvent) {
    e.preventDefault();
    if (!campaignId || !creationReason.trim()) return;
    setCreating(true);
    setError("");
    setMessage("");
    setBatch(null);

    try {
      const response = await fetch("/api/export/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaign_id: campaignId,
          creation_reason: creationReason.trim(),
          format: "prc_membership_v1",
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Export batch creation failed");
      setBatch(data);
      setMessage(`Export batch ${data.batchRef} created successfully with ${data.recordCount} records.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Export batch creation failed");
    } finally {
      setCreating(false);
    }
  }

  async function handleAcknowledge(e: FormEvent) {
    e.preventDefault();
    if (!batch?.batchId || !ackRef.trim() || !ackBy.trim()) return;
    setAcknowledging(true);
    setError("");

    try {
      const response = await fetch("/api/export/acknowledge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batch_id: batch.batchId,
          acknowledgment_reference: ackRef.trim(),
          acknowledged_by_name: ackBy.trim(),
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Acknowledgment failed");
      setMessage(`Batch ${batch.batchRef} acknowledged by PRC representative ${ackBy}.`);
      setAckRef("");
      setAckBy("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Acknowledgment failed");
    } finally {
      setAcknowledging(false);
    }
  }

  return (
    <AdminShell>
      <header className="admin-heading">
        <div>
          <p className="eyebrow">Dual-control handoff</p>
          <h1>PRC Export Management</h1>
        </div>
        <span className="status-pill">Restricted Access</span>
      </header>

      {error && <p className="form-message error">{error}</p>}
      {message && <p className="form-message info">{message}</p>}

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem", marginTop: "1rem" }}>
        <section className="admin-panel stack">
          <p className="eyebrow">1. Generate Export Batch</p>
          <p style={{ fontSize: "0.875rem", color: "var(--muted-foreground)" }}>
            Generates an immutable CSV package containing eligible, payment-verified cases for PRC submission.
          </p>

          <form onSubmit={handleCreateBatch} style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
              <span>Reason for Export Batch Creation:</span>
              <input
                type="text"
                value={creationReason}
                onChange={(e) => setCreationReason(e.target.value)}
                placeholder="e.g. Weekly Scheduled Handoff to PRC Chapter"
                required
                style={{ padding: "0.5rem", borderRadius: "0.25rem", border: "1px solid var(--border)", background: "var(--card)" }}
              />
            </label>

            <button type="submit" className="button-primary" disabled={creating || !creationReason.trim()}>
              {creating ? "Generating Batch..." : "Create Export Batch →"}
            </button>
          </form>
        </section>

        <section className="admin-panel stack">
          <p className="eyebrow">2. Active Batch Details & Download</p>
          {batch ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <div>
                <strong>Batch Ref:</strong> <code>{batch.batchRef}</code>
              </div>
              <div>
                <strong>Eligible Records:</strong> {batch.recordCount}
              </div>
              <div style={{ wordBreak: "break-all" }}>
                <strong>SHA-256 Checksum:</strong> <code style={{ fontSize: "0.75rem" }}>{batch.checksum}</code>
              </div>

              <a
                href={`/api/export/download?batch_id=${batch.batchId}`}
                download
                className="button-primary"
                style={{ textAlign: "center", textDecoration: "none" }}
              >
                Download Encrypted CSV Package ↓
              </a>

              <hr style={{ borderColor: "var(--border)", margin: "1rem 0" }} />

              <form onSubmit={handleAcknowledge} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                <p className="eyebrow">Record PRC Receipt Acknowledgment</p>
                <input
                  type="text"
                  value={ackRef}
                  onChange={(e) => setAckRef(e.target.value)}
                  placeholder="PRC Receipt Ref (e.g. PRC-ACK-9921)"
                  required
                  style={{ padding: "0.5rem", borderRadius: "0.25rem", border: "1px solid var(--border)", background: "var(--card)" }}
                />
                <input
                  type="text"
                  value={ackBy}
                  onChange={(e) => setAckBy(e.target.value)}
                  placeholder="PRC Representative Full Name"
                  required
                  style={{ padding: "0.5rem", borderRadius: "0.25rem", border: "1px solid var(--border)", background: "var(--card)" }}
                />
                <button type="submit" className="button-quiet" disabled={acknowledging}>
                  {acknowledging ? "Submitting..." : "Confirm PRC Acknowledgment"}
                </button>
              </form>
            </div>
          ) : (
            <p>No active batch generated yet. Click &quot;Create Export Batch&quot; on the left to begin.</p>
          )}
        </section>
      </div>
    </AdminShell>
  );
}
