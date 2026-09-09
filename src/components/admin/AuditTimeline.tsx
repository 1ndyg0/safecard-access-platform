"use client";

/**
 * Immutable audit history for one case.
 *
 * Rendered as a table rather than a styled list: the columns are the
 * point — who did what, when, from which state to which, and why.
 */

import { useCallback, useState } from "react";
import { readJson, useAsyncLoad } from "@/components/admin/use-async-load";

type AuditEvent = {
  id: string;
  action: string;
  actorName: string;
  actorType: string;
  occurredAt: string;
  priorState: string | null;
  resultingState: string | null;
  reason: string | null;
  severity: string;
};

export function AuditTimeline({ caseId }: { caseId: string }) {
  const [events, setEvents] = useState<AuditEvent[] | null>(null);

  const loader = useCallback(
    async (isActive: () => boolean) => {
      const response = await fetch(`/api/admin/cases/${caseId}/audit`, { cache: "no-store" });
      const body = await readJson(response, "Unable to load the audit history.");
      if (!isActive()) return;
      setEvents(body.events);
    },
    [caseId],
  );

  const { status, error, reload } = useAsyncLoad(loader, "Unable to load the audit history.");

  return (
    <section className="admin-panel stack">
      <p className="eyebrow">Audit history</p>

      <div aria-live="polite" role="status">
        {status === "loading" && <p className="form-message">Loading audit history…</p>}
        {status === "error" && (
          <p className="form-message error">
            {error}{" "}
            <button type="button" className="link-button" onClick={reload}>
              Try again
            </button>
          </p>
        )}
      </div>

      {status === "ready" && events && events.length === 0 && (
        <p className="empty-state">Nothing has been recorded against this case yet.</p>
      )}

      {status === "ready" && events && events.length > 0 && (
        <div className="table-wrap">
          <table className="admin-table">
            <caption className="visually-hidden">Audit history for this case</caption>
            <thead>
              <tr>
                <th scope="col">When</th>
                <th scope="col">Action</th>
                <th scope="col">Actor</th>
                <th scope="col">From</th>
                <th scope="col">To</th>
                <th scope="col">Reason</th>
                <th scope="col">Severity</th>
              </tr>
            </thead>
            <tbody>
              {events.map((event) => (
                <tr key={event.id}>
                  <td>{new Date(event.occurredAt).toISOString().replace("T", " ").slice(0, 16)}</td>
                  <td>{event.action}</td>
                  <td>{event.actorName}</td>
                  <td>{event.priorState?.replaceAll("_", " ") ?? "—"}</td>
                  <td>{event.resultingState?.replaceAll("_", " ") ?? "—"}</td>
                  <td className="wrap-cell">{event.reason ?? "—"}</td>
                  <td>{event.severity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
