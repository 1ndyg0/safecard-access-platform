-- ============================================================
-- Application review decisions
--
-- Adds the review state the platform was missing. Application state
-- ('submitted', 'correction_needed', ...) records what the applicant
-- did; it has never recorded what a reviewer decided. Approve and
-- reject were not representable at all.
--
-- Coordination note: this is additive but it is NOT confined to views.
-- It creates one enum type, adds one column to recipient_cases with a
-- safe default, and creates one append-only table. It alters no
-- existing column, drops nothing, and changes no existing enum. The
-- database module should sign this off before merge.
--
-- Separation of concerns, restated because the whole product depends on
-- it: a review decision moves application_review_state and nothing
-- else. It does not verify payment, it does not export to PRC, and it
-- cannot activate membership. Only a PRC confirmation may do that.
-- ============================================================

create type public.application_review_state as enum (
  'pending',
  'approved',
  'resubmission_requested',
  'rejected'
);

alter table public.recipient_cases
  add column application_review_state public.application_review_state
    not null default 'pending';

comment on column public.recipient_cases.application_review_state is
  'Staff review outcome. Independent of application, payment, handoff and membership state.';

create index idx_recipient_cases_review_state
  on public.recipient_cases(campaign_id, application_review_state);

-- ------------------------------------------------------------
-- Decision ledger
--
-- Append-only. Every decision records who made it, when, why, and the
-- states either side of it. Corrections to a decision are made by
-- recording a new decision, never by editing the old row — the same
-- rule the audit trail follows.
-- ------------------------------------------------------------
create table public.application_review_decisions (
  id                  uuid primary key default extensions.uuid_generate_v4(),
  case_id             uuid not null references public.recipient_cases(id),
  campaign_id         uuid not null references public.pilot_campaigns(id),

  -- The submission version the reviewer actually read. A decision is
  -- about one version of the application, not about the case in general.
  submission_id       uuid references public.application_submissions(id),

  reviewer_id         uuid not null references public.users(id),
  decision            public.application_review_state not null,
  prior_state         public.application_review_state not null,
  resulting_state     public.application_review_state not null,

  -- Shown to the applicant, so it must be safe to read. Required for
  -- everything except an approval, which needs no justification to the
  -- person being approved.
  reason              text,

  -- Set only by the privileged reopen action.
  is_reopen           boolean not null default false,

  -- Duplicate protection. A retried request carrying the same key is
  -- rejected by the unique index rather than applied twice.
  idempotency_key     text not null unique,

  decided_at          timestamptz not null default now(),
  created_at          timestamptz not null default now(),

  constraint reason_required_unless_approved check (
    decision = 'approved' or (reason is not null and length(btrim(reason)) >= 10)
  ),
  constraint reopen_only_from_rejected check (
    is_reopen = false or prior_state = 'rejected'
  )
);

create index idx_review_decisions_case
  on public.application_review_decisions(case_id, decided_at desc);
create index idx_review_decisions_reviewer
  on public.application_review_decisions(reviewer_id);

-- Append-only, enforced the same way audit_events is.
create trigger trg_review_decisions_immutable
  before update or delete on public.application_review_decisions
  for each row execute function public.prevent_audit_mutation();

-- ------------------------------------------------------------
-- Current review context for a case
--
-- Joins the case, its current submission and the most recent decision,
-- so the member screen and the staff screen read the same source rather
-- than each assembling their own idea of "the current reason".
-- ------------------------------------------------------------
create or replace view public.application_review_context as
select
  c.id                            as case_id,
  c.campaign_id,
  c.application_ref,
  c.consent_state,
  c.application_state,
  c.application_review_state,
  c.payment_state,
  c.prc_handoff_state,
  c.membership_state,
  c.consent_content_version_id,
  c.privacy_notice_version_id,
  s.id                            as current_submission_id,
  s.submitted_at                  as current_submitted_at,
  s.original_submission_id,
  latest.reason                   as latest_review_reason,
  latest.decision                 as latest_review_decision,
  latest.decided_at               as latest_decided_at
from public.recipient_cases c
left join public.application_submissions s
  on s.case_id = c.id and s.is_current = true
left join lateral (
  select d.reason, d.decision, d.decided_at
  from public.application_review_decisions d
  where d.case_id = c.id
  order by d.decided_at desc
  limit 1
) latest on true
where c.is_active = true;

comment on view public.application_review_context is
  'One row per active case: workflow states plus the latest review decision.';

revoke all on public.application_review_context from public, anon, authenticated;
grant select on public.application_review_context to service_role;
grant select, insert on public.application_review_decisions to service_role;
