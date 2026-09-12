"use client";

/**
 * Submission queue.
 *
 * Each workflow state has its own filter control targeting its own
 * column. There is deliberately no combined "status" dropdown: the five
 * state machines are independent, and a single control implying
 * otherwise is what produced cross-enum queries in the first place.
 *
 * Filters are mirrored into the URL so a reviewer can bookmark a view,
 * reload without losing their place, or paste it to a colleague.
 */

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AdminShell } from "@/components/admin/AdminShell";
import { readJson, useAsyncLoad } from "@/components/admin/use-async-load";
import {
  APPLICATION_STATES,
  CONSENT_STATES,
  MEMBERSHIP_STATES,
  PAYMENT_STATES,
  PRC_HANDOFF_STATES,
  REVIEW_BUCKETS,
  SORT_OPTIONS,
} from "@/lib/admin/queue";

type CaseRow = {
  id: string;
  application_ref: string | null;
  consent_state: string;
  application_state: string;
  payment_state: string;
  prc_handoff_state: string;
  membership_state: string;
  created_at: string;
  review_waiting_since: string | null;
  is_resubmission: boolean;
};

type QueueResponse = {
  cases: CaseRow[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  dateRangeTimezone: string;
};

const FILTER_KEYS = [
  "consent_state",
  "application_state",
  "review_bucket",
  "payment_state",
  "prc_handoff_state",
  "membership_state",
  "application_ref",
  "from",
  "to",
  "sort",
  "page",
] as const;

type FilterKey = (typeof FILTER_KEYS)[number];
type Filters = Partial<Record<FilterKey, string>>;

function humanize(value: string): string {
  return value.replaceAll("_", " ");
}

/** How long a case has been waiting, in whole days and hours. */
function waitingFor(since: string | null): string {
  if (!since) return "—";
  const ms = Date.now() - new Date(since).getTime();
  if (ms < 0) return "just now";
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

export function SubmissionsTable() {
  const params = useSearchParams();
  const router = useRouter();

  /** Campaign from the URL. Never rewritten by a response. */
  const urlCampaignId = params.get("campaign_id") ?? "";
  /** Campaign actually in use, once the server has resolved a default. */
  const [campaignId, setCampaignId] = useState(urlCampaignId);
  const [filters, setFilters] = useState<Filters>(() => {
    const initial: Filters = {};
    FILTER_KEYS.forEach((key) => {
      const value = params.get(key);
      if (value) initial[key] = value;
    });
    return initial;
  });
  const [result, setResult] = useState<QueueResponse | null>(null);

  const queryString = useMemo(() => {
    const search = new URLSearchParams();
    if (urlCampaignId) search.set("campaign_id", urlCampaignId);
    FILTER_KEYS.forEach((key) => {
      const value = filters[key];
      if (value) search.set(key, value);
    });
    return search.toString();
  }, [urlCampaignId, filters]);

  const loader = useCallback(
    async (isActive: () => boolean) => {
      let selected = urlCampaignId;
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

      const search = new URLSearchParams(queryString);
      search.set("campaign_id", selected);
      const response = await fetch(`/api/admin/cases?${search.toString()}`, {
        cache: "no-store",
      });
      if (response.status === 401) {
        router.replace("/admin/login");
        return;
      }
      const body = await readJson(response, "Unable to load submissions.");
      if (!isActive()) return;
      setResult(body);
    },
    [urlCampaignId, queryString, router],
  );

  const { status, error, reload } = useAsyncLoad(loader, "Unable to load submissions.");

  // Keep the address bar in step with the current view so a reviewer can
  // bookmark it, reload without losing their place, or share the link.
  useEffect(() => {
    if (!campaignId) return;
    const search = new URLSearchParams(queryString);
    search.set("campaign_id", campaignId);
    router.replace(`/admin/submissions?${search.toString()}`, { scroll: false });
  }, [campaignId, queryString, router]);

  function setFilter(key: FilterKey, value: string) {
    setFilters((current) => {
      const next = { ...current };
      if (value) next[key] = value;
      else delete next[key];
      // Any filter change returns to the first page; staying on page 4
      // of a different result set shows an empty table for no reason.
      if (key !== "page") delete next.page;
      return next;
    });
  }

  const page = Number(filters.page ?? 1);
  const totalPages = result?.pagination.totalPages ?? 1;

  return (
    <AdminShell>
      <header className="admin-heading">
        <div>
          <p className="eyebrow">Privacy-controlled queue</p>
          <h1>Submissions</h1>
          <p className="muted-note">
            States are independent. Filtering on payment does not filter on application.
          </p>
        </div>
      </header>

      <form
        className="filter-bar"
        onSubmit={(event) => {
          event.preventDefault();
          reload();
        }}
      >
        <div className="field-block compact">
          <label htmlFor="filter-ref">Application reference</label>
          <input
            id="filter-ref"
            name="application_ref"
            placeholder="SC-2026-AB12CD34"
            value={filters.application_ref ?? ""}
            onChange={(event) => setFilter("application_ref", event.target.value.trim())}
            aria-describedby="filter-ref-hint"
          />
          <p id="filter-ref-hint" className="field-hint">
            Full reference only.
          </p>
        </div>

        <FilterSelect
          id="filter-consent"
          label="Consent"
          value={filters.consent_state ?? ""}
          options={CONSENT_STATES}
          onChange={(value) => setFilter("consent_state", value)}
        />
        <FilterSelect
          id="filter-application"
          label="Application"
          value={filters.application_state ?? ""}
          options={APPLICATION_STATES}
          onChange={(value) => setFilter("application_state", value)}
        />
        <FilterSelect
          id="filter-review"
          label="Application review"
          value={filters.review_bucket ?? ""}
          options={REVIEW_BUCKETS}
          onChange={(value) => setFilter("review_bucket", value)}
        />
        <FilterSelect
          id="filter-payment"
          label="Payment"
          value={filters.payment_state ?? ""}
          options={PAYMENT_STATES}
          onChange={(value) => setFilter("payment_state", value)}
        />
        <FilterSelect
          id="filter-handoff"
          label="PRC handoff"
          value={filters.prc_handoff_state ?? ""}
          options={PRC_HANDOFF_STATES}
          onChange={(value) => setFilter("prc_handoff_state", value)}
        />
        <FilterSelect
          id="filter-membership"
          label="Membership"
          value={filters.membership_state ?? ""}
          options={MEMBERSHIP_STATES}
          onChange={(value) => setFilter("membership_state", value)}
        />

        <div className="field-block compact">
          <label htmlFor="filter-from">From ({result?.dateRangeTimezone ?? "UTC"})</label>
          <input
            id="filter-from"
            type="date"
            value={filters.from ?? ""}
            onChange={(event) => setFilter("from", event.target.value)}
          />
        </div>
        <div className="field-block compact">
          <label htmlFor="filter-to">To ({result?.dateRangeTimezone ?? "UTC"})</label>
          <input
            id="filter-to"
            type="date"
            value={filters.to ?? ""}
            onChange={(event) => setFilter("to", event.target.value)}
          />
        </div>

        <FilterSelect
          id="filter-sort"
          label="Sort"
          value={filters.sort ?? "newest"}
          options={SORT_OPTIONS}
          includeAnyOption={false}
          onChange={(value) => setFilter("sort", value)}
        />

        <div className="filter-actions">
          <button type="submit" className="button-primary">
            Apply
          </button>
          <button
            type="button"
            className="link-button"
            onClick={() => setFilters({})}
            disabled={Object.keys(filters).length === 0}
          >
            Clear filters
          </button>
        </div>
      </form>

      <div aria-live="polite" role="status">
        {status === "loading" && <p className="form-message">Loading submissions…</p>}
        {status === "error" && (
          <p className="form-message error">
            {error}{" "}
            <button type="button" className="link-button" onClick={reload}>
              Try again
            </button>
          </p>
        )}
        {status === "ready" && result && (
          <p className="visually-hidden">
            {result.pagination.total} submissions match these filters.
          </p>
        )}
      </div>

      {status === "ready" && !campaignId && (
        <p className="empty-state">No campaign is assigned to this account.</p>
      )}

      {status === "ready" && campaignId && result && (
        <>
          <div className="table-wrap">
            <table className="admin-table">
              <caption className="visually-hidden">
                Submissions matching the selected filters
              </caption>
              <thead>
                <tr>
                  <th scope="col">Reference</th>
                  <th scope="col">Consent</th>
                  <th scope="col">Application</th>
                  <th scope="col">Payment</th>
                  <th scope="col">PRC handoff</th>
                  <th scope="col">Membership</th>
                  <th scope="col">Waiting on review</th>
                  <th scope="col">Received</th>
                </tr>
              </thead>
              <tbody>
                {result.cases.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <Link href={`/admin/submissions/${row.id}`}>
                        {row.application_ref ?? "Draft"}
                      </Link>
                      {row.is_resubmission && (
                        <span className="row-tag"> resubmitted</span>
                      )}
                    </td>
                    <td>{humanize(row.consent_state)}</td>
                    <td>{humanize(row.application_state)}</td>
                    <td>{humanize(row.payment_state)}</td>
                    <td>{humanize(row.prc_handoff_state)}</td>
                    <td>{humanize(row.membership_state)}</td>
                    <td>{waitingFor(row.review_waiting_since)}</td>
                    <td>{new Date(row.created_at).toISOString().slice(0, 10)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {result.cases.length === 0 && (
              <p className="empty-state">
                No submissions match these filters. Try clearing one of them.
              </p>
            )}
          </div>

          <nav className="pagination" aria-label="Submission pages">
            <button
              type="button"
              onClick={() => setFilter("page", String(page - 1))}
              disabled={page <= 1}
            >
              ← Previous
            </button>
            <span>
              Page {page} of {totalPages} · {result.pagination.total} cases
            </span>
            <button
              type="button"
              onClick={() => setFilter("page", String(page + 1))}
              disabled={page >= totalPages}
            >
              Next →
            </button>
          </nav>
        </>
      )}
    </AdminShell>
  );
}

function FilterSelect({
  id,
  label,
  value,
  options,
  onChange,
  includeAnyOption = true,
}: {
  id: string;
  label: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  includeAnyOption?: boolean;
}) {
  return (
    <div className="field-block compact">
      <label htmlFor={id}>{label}</label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)}>
        {includeAnyOption && <option value="">Any</option>}
        {options.map((option) => (
          <option key={option} value={option}>
            {humanize(option)}
          </option>
        ))}
      </select>
    </div>
  );
}
