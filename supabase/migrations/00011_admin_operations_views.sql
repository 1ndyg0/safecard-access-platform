-- ============================================================
-- Admin operations, queue and analytics
--
-- Additive only. This migration creates read-only views and
-- functions. It does not alter, drop or extend any table, column
-- or enum owned by the database module.
--
-- Why SQL and not the application server: the operations console
-- must aggregate whole campaigns. Loading every case row into
-- Node to count it does not scale and widens the PII blast radius
-- for data the console never renders. Every aggregate below is
-- computed in the database and leaves it already reduced.
--
-- Privacy: nothing in this file returns a name, mobile number,
-- email address, application reference or raw case id from an
-- aggregate. Case identifiers appear only in the queue view,
-- which is row-level operational data for authorized staff and
-- is never used as an analytics source.
-- ============================================================

-- ------------------------------------------------------------
-- Suppression threshold
--
-- Cohorts below this are reported as suppressed rather than
-- counted. Kept as a function so the value has exactly one
-- definition shared by every aggregate.
-- ------------------------------------------------------------
create or replace function public.admin_suppression_threshold()
returns integer
language sql
immutable
as $$
  select 5;
$$;

comment on function public.admin_suppression_threshold() is
  'Minimum cohort size before an analytics value may be disclosed.';

-- ------------------------------------------------------------
-- Operational queue view
--
-- One row per case, carrying the five independent state machines
-- plus the review-wait timestamp.
--
-- review_waiting_since is the moment the case entered its CURRENT
-- review wait, taken from the current application submission. It
-- is deliberately not created_at: a case that submitted, was sent
-- back for correction and resubmitted has been waiting since the
-- resubmission, not since it was first opened. Cases not awaiting
-- review carry null and sort last.
-- ------------------------------------------------------------
create or replace view public.admin_case_queue_view as
select
  c.id,
  c.campaign_id,
  c.application_ref,
  c.consent_state,
  c.application_state,
  c.payment_state,
  c.prc_handoff_state,
  c.membership_state,
  c.created_at,
  c.updated_at,
  s.submitted_at                          as current_submitted_at,
  case
    when c.application_state in ('ready_for_review', 'submitted', 'resubmitted')
      then coalesce(s.submitted_at, c.updated_at)
    else null
  end                                     as review_waiting_since,
  (s.original_submission_id is not null)  as is_resubmission,
  s.correction_reason                     as current_correction_reason
from public.recipient_cases c
left join public.application_submissions s
  on s.case_id = c.id
 and s.is_current = true
where c.is_active = true;

comment on view public.admin_case_queue_view is
  'Operational queue rows for authorized staff. Row-level, never an analytics source.';

-- ------------------------------------------------------------
-- Dashboard counts
--
-- Exact operational counts for authorized operational staff.
-- Each bucket is an independent predicate over its own enum
-- column; no value is ever compared against a column whose enum
-- type does not define it.
-- ------------------------------------------------------------
create or replace function public.admin_dashboard_counts(p_campaign_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'total_cases',              count(*),
    'draft_or_incomplete',      count(*) filter (where application_state = 'draft'),
    'submitted',                count(*) filter (where application_state in ('submitted', 'resubmitted')),
    'awaiting_application_review',
                                count(*) filter (where application_state in ('ready_for_review', 'submitted', 'resubmitted')),
    'correction_requested',     count(*) filter (where application_state = 'correction_needed'),
    'payment_evidence_pending', count(*) filter (where payment_state in ('payer_marked_paid', 'verification_pending')),
    'payment_verified',         count(*) filter (where payment_state = 'verified_by_official_source'),
    'ready_for_prc_handoff',    count(*) filter (where prc_handoff_state = 'ready_for_export'),
    'sent_or_acknowledged_by_prc',
                                count(*) filter (where prc_handoff_state in ('exported', 'acknowledged')),
    'prc_confirmed_active',     count(*) filter (where membership_state = 'active_confirmed'),
    'prc_declined',             count(*) filter (where prc_handoff_state = 'rejected' or membership_state = 'declined')
  )
  from public.recipient_cases
  where campaign_id = p_campaign_id
    and is_active = true;
$$;

comment on function public.admin_dashboard_counts(uuid) is
  'Exact operational counts for one campaign. Authorization is enforced by the calling route.';

-- ------------------------------------------------------------
-- Suppressed rate helper
--
-- Returns a rate together with its denominator, or a suppressed
-- marker when the denominator is too small to disclose.
--
-- Complementary suppression: when the numerator cohort is small
-- the complement (denominator - numerator) is equally
-- identifying, so both ends are checked. Suppressing only the
-- small cell would still let a reader recover it by subtraction.
-- ------------------------------------------------------------
create or replace function public.admin_safe_rate(p_numerator bigint, p_denominator bigint)
returns jsonb
language sql
immutable
as $$
  select case
    when p_denominator is null or p_denominator = 0 then
      jsonb_build_object('available', false, 'suppressed', false, 'reason', 'no_data')
    when p_denominator < public.admin_suppression_threshold()
      or p_numerator < public.admin_suppression_threshold()
      or (p_denominator - p_numerator) < public.admin_suppression_threshold() then
      jsonb_build_object('available', false, 'suppressed', true, 'reason', 'cohort_below_threshold')
    else
      jsonb_build_object(
        'available', true,
        'suppressed', false,
        'rate', round(p_numerator::numeric / p_denominator::numeric, 4),
        'cohort_size', p_denominator
      )
  end;
$$;

comment on function public.admin_safe_rate(bigint, bigint) is
  'Rate with small-cohort and complementary suppression applied.';

-- ------------------------------------------------------------
-- Suppressed count helper
--
-- Used for analytics buckets (aging, trends). Operational
-- headline counts do not pass through here: they are exact by
-- policy for authorized operational staff.
-- ------------------------------------------------------------
create or replace function public.admin_safe_count(p_count bigint)
returns jsonb
language sql
immutable
as $$
  select case
    when p_count is null then
      jsonb_build_object('available', false, 'suppressed', false, 'reason', 'no_data')
    when p_count > 0 and p_count < public.admin_suppression_threshold() then
      jsonb_build_object('available', false, 'suppressed', true, 'reason', 'cohort_below_threshold')
    else
      jsonb_build_object('available', true, 'suppressed', false, 'count', p_count)
  end;
$$;

comment on function public.admin_safe_count(bigint) is
  'Analytics count with small-cohort suppression applied. Zero is disclosable; 1-4 is not.';

-- ------------------------------------------------------------
-- Analytics
--
-- Funnel rates, review aging, intake trends and turnarounds for
-- one campaign. Everything is reduced inside the database and
-- suppressed before it leaves.
--
-- Three required measures have no source of truth in this schema
-- and are reported as unavailable rather than estimated or
-- hard-coded:
--   * submitted_to_approved_rate  - no application review decision
--     state exists yet; owned by the application-review module.
--   * upload_success_rate         - no upload telemetry table exists.
--   * storyboard_open_completion  - storyboards are not in this schema.
-- Reporting them as unavailable keeps the console honest; an
-- invented number here would be indistinguishable from a real one.
-- ------------------------------------------------------------
create or replace function public.admin_campaign_analytics(p_campaign_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_started              bigint;
  v_submitted            bigint;
  v_payment_verified     bigint;
  v_active               bigint;
  v_aging_under_24h      bigint;
  v_aging_1_3d           bigint;
  v_aging_over_3d        bigint;
  v_intake_7d            bigint;
  v_intake_30d           bigint;
  v_payment_turnaround   numeric;
  v_payment_turnaround_n bigint;
  v_review_turnaround    numeric;
  v_review_turnaround_n  bigint;
  v_intents_total        bigint;
  v_intents_replaced     bigint;
  v_hotline_actions      bigint;
begin
  select
    count(*),
    count(*) filter (where application_state in ('submitted', 'resubmitted', 'correction_needed')
                        or prc_handoff_state <> 'not_ready'
                        or membership_state <> 'not_active'),
    count(*) filter (where payment_state = 'verified_by_official_source'),
    count(*) filter (where membership_state = 'active_confirmed'),
    count(*) filter (where created_at >= now() - interval '7 days'),
    count(*) filter (where created_at >= now() - interval '30 days')
  into v_started, v_submitted, v_payment_verified, v_active, v_intake_7d, v_intake_30d
  from public.recipient_cases
  where campaign_id = p_campaign_id
    and is_active = true;

  select
    count(*) filter (where now() - review_waiting_since < interval '24 hours'),
    count(*) filter (where now() - review_waiting_since >= interval '24 hours'
                       and now() - review_waiting_since < interval '3 days'),
    count(*) filter (where now() - review_waiting_since >= interval '3 days')
  into v_aging_under_24h, v_aging_1_3d, v_aging_over_3d
  from public.admin_case_queue_view
  where campaign_id = p_campaign_id
    and review_waiting_since is not null;

  -- Payment review turnaround: official handoff opened to evidence confirmed.
  select
    avg(extract(epoch from (e.confirmed_at - i.created_at)) / 3600.0),
    count(*)
  into v_payment_turnaround, v_payment_turnaround_n
  from public.payment_intents i
  join public.recipient_cases c on c.id = i.case_id
  join public.payment_evidence e on e.payment_intent_id = i.id
  where c.campaign_id = p_campaign_id
    and e.confirmed_at is not null
    and e.is_verified = true;

  -- Application review turnaround: submission to the recorded review
  -- decision. audit_events is the only state history in this schema, and
  -- the only review outcome it can currently carry is a correction
  -- decision ('data_correction'). Approve and reject are not yet
  -- representable, so this measures the correction path only and returns
  -- no_data until such events exist. It widens on its own once the
  -- application-review module lands its decision events.
  select
    avg(extract(epoch from (a.created_at - s.submitted_at)) / 3600.0),
    count(*)
  into v_review_turnaround, v_review_turnaround_n
  from public.application_submissions s
  join public.recipient_cases c on c.id = s.case_id
  join public.audit_events a
    on a.case_id = c.id
   and a.event_type = 'data_correction'
   and a.created_at > s.submitted_at
  where c.campaign_id = p_campaign_id
    and s.is_current = true;

  -- Evidence replacement: an intent carrying more than one evidence row
  -- had its evidence replaced at least once.
  select
    count(*),
    count(*) filter (where evidence_count > 1)
  into v_intents_total, v_intents_replaced
  from (
    select i.id, count(e.id) as evidence_count
    from public.payment_intents i
    join public.recipient_cases c on c.id = i.case_id
    left join public.payment_evidence e on e.payment_intent_id = i.id
    where c.campaign_id = p_campaign_id
    group by i.id
  ) intent_evidence;

  -- Hotline actions: support cases opened through the published hotline.
  -- contact_method is free text, so this matches rather than compares.
  select count(*)
  into v_hotline_actions
  from public.support_cases
  where campaign_id = p_campaign_id
    and contact_method is not null
    and (contact_method ilike '%hotline%' or contact_method like '%143%');

  return jsonb_build_object(
    'funnel', jsonb_build_object(
      'started_to_submitted',           public.admin_safe_rate(v_submitted, v_started),
      'submitted_to_approved',          jsonb_build_object(
                                          'available', false,
                                          'suppressed', false,
                                          'reason', 'no_application_review_state'),
      'submitted_to_payment_verified',  public.admin_safe_rate(v_payment_verified, v_submitted),
      'submitted_to_active',            public.admin_safe_rate(v_active, v_submitted)
    ),
    'review_aging', jsonb_build_object(
      'under_24h',  public.admin_safe_count(v_aging_under_24h),
      'one_to_three_days', public.admin_safe_count(v_aging_1_3d),
      'over_three_days',   public.admin_safe_count(v_aging_over_3d)
    ),
    'intake_trend', jsonb_build_object(
      'last_7_days',  public.admin_safe_count(v_intake_7d),
      'last_30_days', public.admin_safe_count(v_intake_30d)
    ),
    'turnaround_hours', jsonb_build_object(
      'application_review', case
        when v_review_turnaround_n >= public.admin_suppression_threshold()
          then jsonb_build_object('available', true, 'suppressed', false,
                                  'hours', round(v_review_turnaround, 2),
                                  'cohort_size', v_review_turnaround_n)
        when coalesce(v_review_turnaround_n, 0) = 0
          then jsonb_build_object('available', false, 'suppressed', false, 'reason', 'no_data')
        else jsonb_build_object('available', false, 'suppressed', true,
                                'reason', 'cohort_below_threshold')
      end,
      'payment_review', case
        when v_payment_turnaround_n >= public.admin_suppression_threshold()
          then jsonb_build_object('available', true, 'suppressed', false,
                                  'hours', round(v_payment_turnaround, 2),
                                  'cohort_size', v_payment_turnaround_n)
        when coalesce(v_payment_turnaround_n, 0) = 0
          then jsonb_build_object('available', false, 'suppressed', false, 'reason', 'no_data')
        else jsonb_build_object('available', false, 'suppressed', true,
                                'reason', 'cohort_below_threshold')
      end
    ),
    'evidence', jsonb_build_object(
      'replacement_rate', public.admin_safe_rate(v_intents_replaced, v_intents_total),
      'upload_success_rate', jsonb_build_object(
        'available', false, 'suppressed', false, 'reason', 'no_upload_telemetry')
    ),
    'storyboard', jsonb_build_object(
      'available', false, 'suppressed', false, 'reason', 'not_in_schema'),
    'hotline_actions', public.admin_safe_count(v_hotline_actions),
    'suppression_threshold', public.admin_suppression_threshold()
  );
end;
$$;

comment on function public.admin_campaign_analytics(uuid) is
  'Suppressed campaign analytics. Authorization is enforced by the calling route.';

-- ------------------------------------------------------------
-- Grants
--
-- These run through the server-only service-role client, which
-- bypasses RLS. anon and authenticated are deliberately not
-- granted: the browser has no direct access to operational
-- aggregates, and every caller passes a route that checks a
-- campaign-scoped staff role first.
-- ------------------------------------------------------------
revoke all on function public.admin_dashboard_counts(uuid) from public, anon, authenticated;
revoke all on function public.admin_campaign_analytics(uuid) from public, anon, authenticated;
grant execute on function public.admin_dashboard_counts(uuid) to service_role;
grant execute on function public.admin_campaign_analytics(uuid) to service_role;
grant select on public.admin_case_queue_view to service_role;
