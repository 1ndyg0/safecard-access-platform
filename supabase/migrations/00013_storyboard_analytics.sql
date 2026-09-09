-- ============================================================
-- Benefit storyboard analytics
--
-- Additive: one table, one view, one function. No existing table,
-- column or enum is altered.
--
-- The privacy design, stated plainly because it is the point:
--
--   * An event row carries a benefit id, a locale, an event name, a
--     bounded duration and a timestamp. Nothing else.
--   * There is no applicant column, no case id, no reference, no
--     mobile number, no IP address and no free-text field. There is
--     nothing to redact later because nothing identifying is written.
--   * The visit id is a random per-visit value with no cross-site
--     meaning and no link to a person. It exists solely to give
--     completion rate an honest denominator: without it, "completions"
--     is a number with no population.
--   * Raw events are never readable by the browser. Only the
--     suppressed aggregate function is exposed, and only to staff.
-- ============================================================

create table public.storyboard_events (
  id                  uuid primary key default extensions.uuid_generate_v4(),

  -- One of the four benefit identifiers. Constrained so an unexpected
  -- value cannot quietly create a new bucket.
  benefit_id          text not null check (benefit_id in (
    'ambulance',
    'blood',
    'hospital_allowance',
    'exclusions'
  )),

  event_name          text not null check (event_name in (
    'benefit_opened',
    'benefit_closed',
    'story_completed',
    'hotline_action_selected'
  )),

  locale              text not null check (locale in ('fil', 'en')),

  -- Milliseconds a panel was open. Bounded: an unbounded duration is a
  -- way to smuggle a payload into a numeric column, and a session left
  -- open overnight is not a meaningful reading anyway.
  duration_ms         integer check (duration_ms is null or (duration_ms >= 0 and duration_ms <= 1800000)),

  -- Random per visit, generated client-side, never persisted anywhere
  -- else and never joined to a person. Purely a denominator.
  visit_id            uuid not null,

  occurred_at         timestamptz not null default now(),
  created_at          timestamptz not null default now()
);

create index idx_storyboard_events_occurred on public.storyboard_events(occurred_at desc);
create index idx_storyboard_events_benefit on public.storyboard_events(benefit_id, event_name);
create index idx_storyboard_events_visit on public.storyboard_events(visit_id);

comment on table public.storyboard_events is
  'Privacy-safe benefit storyboard telemetry. Contains no personal data by construction.';

-- ------------------------------------------------------------
-- Suppression threshold, shared by every aggregate below.
-- ------------------------------------------------------------
create or replace function public.storyboard_suppression_threshold()
returns integer language sql immutable as $$ select 5; $$;

-- ------------------------------------------------------------
-- Aggregate reporting
--
-- Returns per-benefit opens, completions and hotline actions, plus a
-- completion rate whose denominator is the number of distinct visits
-- that opened that benefit — not the number of events, which would let
-- one enthusiastic visitor look like a trend.
--
-- Every cell below the threshold is suppressed, and so is its
-- complement, so a small cohort cannot be recovered by subtraction.
-- ------------------------------------------------------------
create or replace function public.storyboard_analytics(p_days integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_threshold integer := public.storyboard_suppression_threshold();
  v_since     timestamptz := now() - make_interval(days => greatest(1, least(coalesce(p_days, 30), 365)));
  v_visits    bigint;
  v_result    jsonb;
begin
  -- The denominator: distinct visits that produced any storyboard event.
  select count(distinct visit_id) into v_visits
  from public.storyboard_events
  where occurred_at >= v_since;

  select coalesce(jsonb_object_agg(benefit_id, payload), '{}'::jsonb)
  into v_result
  from (
    select
      benefit_id,
      jsonb_build_object(
        'opened_visits', case when opened_visits >= v_threshold
                              then to_jsonb(opened_visits) else 'null'::jsonb end,
        'completed_visits', case when completed_visits >= v_threshold
                                 then to_jsonb(completed_visits) else 'null'::jsonb end,
        'hotline_visits', case when hotline_visits >= v_threshold
                               then to_jsonb(hotline_visits) else 'null'::jsonb end,
        'completion_rate', case
          when opened_visits >= v_threshold
           and completed_visits >= v_threshold
           and (opened_visits - completed_visits) >= v_threshold
          then to_jsonb(round(completed_visits::numeric / opened_visits::numeric, 4))
          else 'null'::jsonb
        end,
        'median_open_ms', case when opened_visits >= v_threshold
                               then to_jsonb(median_ms) else 'null'::jsonb end,
        'suppressed', (opened_visits < v_threshold)
      ) as payload
    from (
      select
        benefit_id,
        count(distinct visit_id) filter (where event_name = 'benefit_opened')          as opened_visits,
        count(distinct visit_id) filter (where event_name = 'story_completed')         as completed_visits,
        count(distinct visit_id) filter (where event_name = 'hotline_action_selected') as hotline_visits,
        percentile_cont(0.5) within group (order by duration_ms)
          filter (where duration_ms is not null)                                       as median_ms
      from public.storyboard_events
      where occurred_at >= v_since
      group by benefit_id
    ) per_benefit
  ) shaped;

  return jsonb_build_object(
    'window_days', greatest(1, least(coalesce(p_days, 30), 365)),
    -- The denominator is itself suppressed when small.
    'visits', case when v_visits >= v_threshold then to_jsonb(v_visits) else 'null'::jsonb end,
    'suppression_threshold', v_threshold,
    'benefits', v_result
  );
end;
$$;

comment on function public.storyboard_analytics(integer) is
  'Suppressed storyboard aggregates. Authorization is enforced by the calling route.';

-- ------------------------------------------------------------
-- Grants
--
-- Raw events are never selectable by a browser role: that would allow
-- public enumeration of the event stream. Insert goes through the
-- rate-limited route using the service-role client, and reading is only
-- ever the aggregate function.
-- ------------------------------------------------------------
revoke all on public.storyboard_events from public, anon, authenticated;
revoke all on function public.storyboard_analytics(integer) from public, anon, authenticated;
grant insert, select on public.storyboard_events to service_role;
grant execute on function public.storyboard_analytics(integer) to service_role;

alter table public.storyboard_events enable row level security;
-- No policy is created for anon or authenticated: with RLS enabled and
-- no policy, those roles can read nothing even if a grant is added by
-- mistake later.
