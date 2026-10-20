"use client";

/**
 * Applications list.
 *
 * Only complete applications (details submitted and proof of payment
 * uploaded) ever reach this screen; the database view decides that. The
 * administrator narrows the list with one search box (name, mobile number or
 * application reference), one status control and, under "More", a date range
 * and the sort order. Everything is mirrored into the URL so a view can be
 * bookmarked or shared.
 *
 * "Review" opens a slide-over where the application is approved or rejected.
 * The row is updated in place when a decision lands, without reloading.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { ReviewDrawer, type DecisionResult } from "@/components/admin/ReviewDrawer";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { formatDate } from "@/components/admin/format";
import { readJson, useAsyncLoad } from "@/components/admin/use-async-load";
import { APPLICATION_STATUSES, STATUS_LABELS, type ApplicationStatus } from "@/lib/admin/queue";

type Row = {
  id: string;
  application_ref: string | null;
  status: ApplicationStatus;
  applicant_name: string | null;
  mobile_number: string | null;
  received_at: string;
  has_payment_proof: boolean;
  rejection_reason: string | null;
};

type ListResponse = {
  applications: Row[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
};

type StatusFilter = ApplicationStatus | "all";
const STATUS_OPTIONS: Array<{ value: StatusFilter; label: string }> = [
  ...APPLICATION_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] })),
  { value: "all", label: "All" },
];

function isStatusFilter(value: string | null): value is StatusFilter {
  return value === "all" || (APPLICATION_STATUSES as readonly string[]).includes(value ?? "");
}

export function ApplicationsList() {
  const params = useSearchParams();
  const router = useRouter();

  const urlCampaignId = params.get("campaign_id") ?? "";
  const [campaignId, setCampaignId] = useState(urlCampaignId);
  const initialStatus = params.get("status");
  const [status, setStatus] = useState<StatusFilter>(isStatusFilter(initialStatus) ? initialStatus : "awaiting_review");
  const [searchInput, setSearchInput] = useState(params.get("search") ?? "");
  const [search, setSearch] = useState(params.get("search") ?? "");
  const [from, setFrom] = useState(params.get("from") ?? "");
  const [to, setTo] = useState(params.get("to") ?? "");
  const [oldestFirst, setOldestFirst] = useState(params.get("sort") === "oldest");
  const [page, setPage] = useState(Number(params.get("page") ?? 1) || 1);
  const [moreOpen, setMoreOpen] = useState(Boolean(params.get("from") || params.get("to") || params.get("sort") === "oldest"));

  const [result, setResult] = useState<ListResponse | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const triggerRef = useRef<HTMLElement | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // One search request per pause in typing, not one per keystroke.
  const committedSearch = useRef(search);
  useEffect(() => {
    const handle = window.setTimeout(() => {
      const next = searchInput.trim();
      if (next === committedSearch.current) return;
      committedSearch.current = next;
      setSearch(next);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(handle);
  }, [searchInput]);

  const queryString = useMemo(() => {
    const query = new URLSearchParams();
    query.set("status", status);
    if (search.length >= 2) query.set("search", search);
    if (from) query.set("from", from);
    if (to) query.set("to", to);
    if (oldestFirst) query.set("sort", "oldest");
    if (page > 1) query.set("page", String(page));
    return query.toString();
  }, [status, search, from, to, oldestFirst, page]);

  const loader = useCallback(
    async (isActive: () => boolean) => {
      let selected = urlCampaignId || campaignId;
      if (!selected) {
        const overview = await fetch("/api/admin/overview", { cache: "no-store" });
        if (overview.status === 401) {
          router.replace("/admin/login");
          return;
        }
        const body = await readJson(overview, "Unable to load campaigns.");
        selected = body.selectedCampaignId ?? "";
        if (!isActive()) return;
        setCampaignId(selected);
        if (!selected) {
          setResult(null);
          return;
        }
      }
      const response = await fetch(`/api/admin/cases?${queryString}&campaign_id=${encodeURIComponent(selected)}`, {
        cache: "no-store",
      });
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const body: ListResponse = await readJson(response, "Unable to load applications.");
      if (!isActive()) return;
      setResult(body);
    },
    [urlCampaignId, campaignId, queryString, router],
  );

  const { status: loadStatus, error, reload } = useAsyncLoad(loader, "Unable to load applications.");

  // Keep the address bar in step with the view.
  useEffect(() => {
    if (!campaignId) return;
    router.replace(`/admin/applications?${queryString}&campaign_id=${campaignId}`, { scroll: false });
  }, [campaignId, queryString, router]);

  function changeStatus(next: StatusFilter) {
    setStatus(next);
    setPage(1);
  }

  const hasFilters = status !== "awaiting_review" || searchInput !== "" || from !== "" || to !== "" || oldestFirst;
  function clearAll() {
    setStatus("awaiting_review");
    setSearchInput("");
    committedSearch.current = "";
    setSearch("");
    setFrom("");
    setTo("");
    setOldestFirst(false);
    setPage(1);
  }

  function openReview(row: Row, element: HTMLElement) {
    triggerRef.current = element;
    setOpenId(row.id);
  }

  // A decision updates the row in place. The row stays visible, with its new
  // status, while the slide-over is open.
  const handleDecided = useCallback((id: string, decided: DecisionResult) => {
    setResult((current) =>
      current
        ? {
            ...current,
            applications: current.applications.map((row) =>
              row.id === id ? { ...row, status: decided.status, rejection_reason: decided.reason } : row,
            ),
          }
        : current,
    );
  }, []);

  const handleClosed = useCallback(() => {
    setOpenId(null);
    // Rows that no longer match the status filter leave the list now, not
    // while the reviewer is still reading the result.
    setResult((current) => {
      if (!current || status === "all") return current;
      const kept = current.applications.filter((row) => row.status === status);
      const removed = current.applications.length - kept.length;
      if (removed === 0) return current;
      return {
        applications: kept,
        pagination: { ...current.pagination, total: Math.max(0, current.pagination.total - removed) },
      };
    });
    // Return focus to the Review button that opened the panel. If that row
    // just left the list, land on the page heading instead of on <body>.
    window.setTimeout(() => {
      const trigger = triggerRef.current;
      if (trigger && trigger.isConnected) trigger.focus();
      else headingRef.current?.focus();
    }, 0);
  }, [status]);

  const totalPages = result?.pagination.totalPages ?? 1;

  return (
    <AdminShell>
      <header className="admin-heading">
        <div>
          <p className="eyebrow">Administration</p>
          <h1 ref={headingRef} tabIndex={-1} id="applications-heading">Applications</h1>
          <p className="muted-note">Complete applications only: details and proof of payment received.</p>
        </div>
      </header>

      <form className="apps-toolbar" role="search" onSubmit={(event) => event.preventDefault()}>
        <div className="field-block compact apps-search">
          <label htmlFor="apps-search">Search</label>
          <input
            id="apps-search"
            type="search"
            name="search"
            autoComplete="off"
            maxLength={120}
            placeholder="Name, mobile or application reference"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </div>

        <fieldset className="segmented" aria-label="Status">
          <legend className="visually-hidden">Status</legend>
          {STATUS_OPTIONS.map((option) => (
            <label key={option.value} className="segmented-option">
              <input
                type="radio"
                name="status"
                value={option.value}
                checked={status === option.value}
                onChange={() => changeStatus(option.value)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </fieldset>

        <div className="apps-controls">
          <button
            type="button"
            className="apps-more-toggle"
            aria-expanded={moreOpen}
            aria-controls="apps-more-panel"
            onClick={() => setMoreOpen((open) => !open)}
          >
            More
            <span aria-hidden="true">{moreOpen ? " ▴" : " ▾"}</span>
          </button>
          {hasFilters && (
            <button type="button" className="link-button" onClick={clearAll}>
              Clear filters
            </button>
          )}
        </div>

        {moreOpen && (
          <div id="apps-more-panel" className="apps-more-body">
            <div className="field-block compact">
              <label htmlFor="apps-from">Received from</label>
              <input id="apps-from" type="date" value={from} onChange={(event) => { setFrom(event.target.value); setPage(1); }} />
            </div>
            <div className="field-block compact">
              <label htmlFor="apps-to">Received to</label>
              <input id="apps-to" type="date" value={to} onChange={(event) => { setTo(event.target.value); setPage(1); }} />
            </div>
            <div className="checkbox-row apps-oldest">
              <input id="apps-oldest" type="checkbox" checked={oldestFirst} onChange={(event) => { setOldestFirst(event.target.checked); setPage(1); }} />
              <label htmlFor="apps-oldest">Oldest first</label>
            </div>
          </div>
        )}
      </form>

      <div aria-live="polite" role="status">
        {loadStatus === "loading" && <p className="form-message">Loading applications…</p>}
        {loadStatus === "error" && (
          <p className="form-message error">
            {error}{" "}
            <button type="button" className="link-button" onClick={reload}>
              Try again
            </button>
          </p>
        )}
        {loadStatus === "ready" && result && (
          <p className="visually-hidden">{result.pagination.total} applications match.</p>
        )}
      </div>

      {loadStatus === "ready" && !campaignId && <p className="empty-state">No campaign is assigned to this account.</p>}

      {campaignId && result && (
        <>
          {result.applications.length === 0 ? (
            <p className="empty-state" data-testid="apps-empty">
              {status === "awaiting_review" && !search && !from && !to
                ? "Nothing is waiting for review."
                : "No applications match these filters."}
            </p>
          ) : (
            <div className="apps-table-wrap">
              <table className="apps-table">
                <caption className="visually-hidden">Applications</caption>
                <thead>
                  <tr>
                    <th scope="col">Applicant</th>
                    <th scope="col">Application ref</th>
                    <th scope="col">Mobile</th>
                    <th scope="col">Received</th>
                    <th scope="col">Payment proof</th>
                    <th scope="col">Status</th>
                    <th scope="col"><span className="visually-hidden">Action</span></th>
                  </tr>
                </thead>
                <tbody>
                  {result.applications.map((row) => (
                    <tr key={row.id} data-testid="application-row" data-ref={row.application_ref ?? ""}>
                      <td data-label="Applicant" className="apps-name">{row.applicant_name ?? "—"}</td>
                      <td data-label="Application ref"><span className="apps-ref">{row.application_ref ?? "—"}</span></td>
                      <td data-label="Mobile">{row.mobile_number ?? "—"}</td>
                      <td data-label="Received">{formatDate(row.received_at)}</td>
                      <td data-label="Payment proof">{row.has_payment_proof ? "Yes" : "—"}</td>
                      <td data-label="Status"><StatusBadge status={row.status} /></td>
                      <td className="apps-action">
                        <button
                          type="button"
                          className="button-review"
                          onClick={(event) => openReview(row, event.currentTarget)}
                          aria-label={`Review ${row.applicant_name ?? row.application_ref ?? "application"}`}
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {result.pagination.total > result.pagination.limit && (
            <nav className="pagination" aria-label="Application pages">
              <button type="button" onClick={() => setPage(page - 1)} disabled={page <= 1}>
                ← Previous
              </button>
              <span>
                Page {page} of {totalPages} · {result.pagination.total} applications
              </span>
              <button type="button" onClick={() => setPage(page + 1)} disabled={page >= totalPages}>
                Next →
              </button>
            </nav>
          )}
        </>
      )}

      {openId && (
        <ReviewDrawer applicationId={openId} onDecided={handleDecided} onClose={handleClosed} />
      )}
    </AdminShell>
  );
}
