-- SafeCard Access Platform
-- Migration 00023: simplify the administrator console.
--
-- The administrator only works with applications that are COMPLETE (details
-- submitted and proof of payment uploaded) and only decides two things:
-- approve (which also verifies the payment) or reject (with a reason).
--
-- What this migration does
--   1. Records the outcome on the case itself: rejection_reason, reviewed_by,
--      reviewed_at. They are kept in step with the append-only ledger
--      public.application_review_decisions by an AFTER INSERT trigger, and are
--      backfilled from it. The ledger stays the source of truth.
--   2. Adds public.admin_applications_view: one row per complete application
--      with a three-value status (awaiting_review / approved / rejected). This
--      is the single definition of "complete", so no API route filters for it.
--   3. Adds public.admin_application_counts(): the four numbers on the dashboard.
--   4. Drops what the console no longer uses: the old queue/context views, the
--      dashboard/analytics/suppression functions, the staff role-management
--      functions, the replacement-proof request function and users.mfa_enabled.
--
-- Forward-only and re-runnable. Nothing here edits, disables or drops an
-- immutability trigger or touches rows of audit_events, application_submissions,
-- payment_evidence_versions, membership_status_events or
-- application_review_decisions. Enum labels are not removed (PostgreSQL cannot
-- drop them in place and history may use them).
--
-- Run it on a staging copy first, then production, in the Supabase SQL editor
-- or with `supabase db push`. See docs/admin-console.md.

-- ============================================================
-- 1. Outcome columns on the case
-- ============================================================
alter table public.recipient_cases
  add column if not exists rejection_reason text,
  add column if not exists reviewed_by uuid references public.users(id),
  add column if not exists reviewed_at timestamptz;

comment on column public.recipient_cases.rejection_reason is
  'Reason the administrator gave when rejecting. Read by the applicant on their status page. Mirrors the latest ledger row.';
comment on column public.recipient_cases.reviewed_by is
  'Administrator who made the latest approve/reject decision.';
comment on column public.recipient_cases.reviewed_at is
  'When the latest approve/reject decision was made.';

-- Backfill from the ledger: the latest decision per case.
update public.recipient_cases c
set
  rejection_reason = case when l.resulting_state = 'rejected' then l.reason else null end,
  reviewed_by = case when l.resulting_state in ('approved', 'rejected') then l.reviewer_id else null end,
  reviewed_at = case when l.resulting_state in ('approved', 'rejected') then l.decided_at else null end
from (
  select distinct on (case_id) case_id, resulting_state, reason, reviewer_id, decided_at
  from public.application_review_decisions
  order by case_id, decided_at desc, created_at desc
) l
where c.id = l.case_id
  and c.reviewed_at is null;

create or replace function public.sync_case_review_outcome()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.recipient_cases
  set
    rejection_reason = case when new.resulting_state = 'rejected' then new.reason else null end,
    reviewed_by = case when new.resulting_state in ('approved', 'rejected') then new.reviewer_id else null end,
    reviewed_at = case when new.resulting_state in ('approved', 'rejected') then new.decided_at else null end
  where id = new.case_id;
  return new;
end;
$$;

revoke all on function public.sync_case_review_outcome() from public, anon, authenticated;

drop trigger if exists trg_sync_case_review_outcome on public.application_review_decisions;
create trigger trg_sync_case_review_outcome
  after insert on public.application_review_decisions
  for each row execute function public.sync_case_review_outcome();

-- ============================================================
-- 2. Queue index (partial: only complete, active applications)
-- ============================================================
create index if not exists idx_recipient_cases_admin_queue
  on public.recipient_cases (campaign_id, application_review_state, created_at desc)
  where is_active = true
    and application_state in ('submitted', 'resubmitted');

-- ============================================================
-- 3. The applications view
--    Complete = details submitted (submitted/resubmitted) and a payment has
--    reached the proof stage (anything beyond the applicant still paying).
--    status: approved / rejected come from the review decision; everything
--    else that is complete is awaiting_review.
--    The view carries contact fields because the console searches on them; the
--    API removes whatever the caller's role may not see. Service role only.
-- ============================================================
drop view if exists public.admin_applications_view;
create view public.admin_applications_view as
select
  c.id,
  c.campaign_id,
  c.application_ref,
  case c.application_review_state
    when 'approved' then 'approved'
    when 'rejected' then 'rejected'
    else 'awaiting_review'
  end                                         as status,
  p.first_name,
  p.middle_name,
  p.last_name,
  p.mobile_number,
  coalesce(s.submitted_at, c.created_at)      as received_at,
  exists (
    select 1
    from public.payment_intents pi
    join public.payment_evidence_versions v on v.payment_intent_id = pi.id
    where pi.case_id = c.id
  )                                           as has_payment_proof,
  c.rejection_reason,
  c.reviewed_by,
  c.reviewed_at
from public.recipient_cases c
left join public.application_submissions s
  on s.case_id = c.id and s.is_current = true
left join public.recipient_profiles p
  on p.case_id = c.id
where c.is_active = true
  and c.application_state in ('submitted', 'resubmitted')
  and c.payment_state not in ('not_started', 'official_handoff_opened', 'payer_marked_paid');

comment on view public.admin_applications_view is
  'Complete applications only (details submitted and proof of payment uploaded), with a three-value status. The one place the console defines what staff may see.';
revoke all on public.admin_applications_view from public, anon, authenticated;
grant select on public.admin_applications_view to service_role;

-- ============================================================
-- 4. Dashboard counts
-- ============================================================
create or replace function public.admin_application_counts(p_campaign_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select pg_catalog.jsonb_build_object(
    'awaiting_review', count(*) filter (where status = 'awaiting_review'),
    'approved',        count(*) filter (where status = 'approved'),
    'rejected',        count(*) filter (where status = 'rejected'),
    'total',           count(*)
  )
  from public.admin_applications_view
  where campaign_id = p_campaign_id;
$$;

revoke all on function public.admin_application_counts(uuid) from public, anon, authenticated;
grant execute on function public.admin_application_counts(uuid) to service_role;

-- ============================================================
-- 5. Drop what the console no longer uses
-- ============================================================
drop view if exists public.admin_case_queue_view;
drop view if exists public.application_review_context;

drop function if exists public.admin_dashboard_counts(uuid);
drop function if exists public.admin_campaign_analytics(uuid);
drop function if exists public.admin_safe_count(bigint);
drop function if exists public.admin_safe_rate(bigint, bigint);
drop function if exists public.admin_suppression_threshold();

-- Staff role management is no longer a console feature. role_assignments (and
-- has_role / is_staff, which permissions use) stay.
drop function if exists public.assign_staff_role_atomic(uuid, uuid, public.staff_role, uuid, uuid, text);
drop function if exists public.revoke_staff_role_atomic(uuid, uuid, text);
drop function if exists public.provision_invited_staff_atomic(uuid, uuid, text, text, uuid, public.staff_role, text);

-- The administrator no longer asks for a replacement payment proof.
drop function if exists public.request_payment_evidence_reupload_atomic(uuid, uuid, uuid, text, public.payment_state);

-- MFA was removed in 00022's PR; the flag is unused.
alter table public.users drop column if exists mfa_enabled;

-- ============================================================
-- 6. Post-conditions
-- ============================================================
do $$
begin
  if to_regclass('public.admin_applications_view') is null then
    raise exception 'admin_applications_view is missing';
  end if;
  if to_regclass('public.admin_case_queue_view') is not null
     or to_regclass('public.application_review_context') is not null then
    raise exception 'A retired view is still present';
  end if;
  if (select count(*) from pg_trigger
      where not tgisinternal
        and tgname in (
          'trg_audit_events_immutable',
          'trg_membership_status_events_immutable',
          'trg_review_decisions_immutable',
          'trg_submission_snapshot_immutable',
          'trg_payment_evidence_snapshot_immutable'
        )) < 5 then
    raise exception 'An immutability trigger is missing';
  end if;
end;
$$;
