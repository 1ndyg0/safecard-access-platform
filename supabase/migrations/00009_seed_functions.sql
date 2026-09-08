-- SafeCard Access Platform
-- Migration 00009: Database functions for server-side operations
-- These functions run with service-role or security definer privileges

-- ============================================================
-- Idempotent write helper
-- Returns: { "status": "created" | "exists" | "conflict", "id": uuid }
-- ============================================================
create or replace function public.idempotent_insert(
  p_table       text,
  p_key         text,
  p_data        jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_id uuid;
  new_id uuid;
  result jsonb;
begin
  -- Check if idempotency key already exists
  execute format(
    'select id from public.%I where idempotency_key = $1',
    p_table
  ) into existing_id using p_key;

  if existing_id is not null then
    return jsonb_build_object('status', 'exists', 'id', existing_id);
  end if;

  -- Insert new record
  new_id := extensions.uuid_generate_v4();
  p_data := p_data || jsonb_build_object('id', new_id, 'idempotency_key', p_key);

  -- The caller (server action) builds and validates the full insert
  return jsonb_build_object('status', 'created', 'id', new_id, 'data', p_data);
end;
$$;

-- ============================================================
-- Acquire a job for processing (prevents double-processing)
-- ============================================================
create or replace function public.acquire_job(
  p_job_type    text,
  p_worker_id   text,
  p_lock_duration interval default '5 minutes'
)
returns setof public.jobs
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  update public.jobs
  set
    status = 'running',
    locked_by = p_worker_id,
    locked_at = now(),
    lock_expires_at = now() + p_lock_duration,
    started_at = coalesce(started_at, now()),
    attempts = attempts + 1
  where id = (
    select id from public.jobs
    where status = 'pending'
      and (p_job_type is null or job_type = p_job_type)
      and scheduled_for <= now()
      and attempts < max_attempts
    order by scheduled_for asc
    limit 1
    for update skip locked
  )
  returning *;
end;
$$;

-- ============================================================
-- Complete a job
-- ============================================================
create or replace function public.complete_job(
  p_job_id uuid,
  p_result jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.jobs
  set
    status = 'completed',
    result = p_result,
    completed_at = now(),
    locked_by = null,
    locked_at = null,
    lock_expires_at = null
  where id = p_job_id;
end;
$$;

-- ============================================================
-- Fail a job (with retry support)
-- ============================================================
create or replace function public.fail_job(
  p_job_id uuid,
  p_error  text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  job_record public.jobs;
begin
  select * into job_record from public.jobs where id = p_job_id;

  if job_record.attempts >= job_record.max_attempts then
    update public.jobs
    set
      status = 'failed',
      error = p_error,
      last_error = p_error,
      failed_at = now(),
      locked_by = null,
      locked_at = null,
      lock_expires_at = null
    where id = p_job_id;
  else
    -- Schedule retry with exponential backoff
    update public.jobs
    set
      status = 'pending',
      last_error = p_error,
      next_retry_at = now() + (power(2, job_record.attempts) || ' minutes')::interval,
      scheduled_for = now() + (power(2, job_record.attempts) || ' minutes')::interval,
      locked_by = null,
      locked_at = null,
      lock_expires_at = null
    where id = p_job_id;
  end if;
end;
$$;

-- ============================================================
-- Release stale job locks (called by cron)
-- ============================================================
create or replace function public.release_stale_locks()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  released integer;
begin
  update public.jobs
  set
    status = 'pending',
    locked_by = null,
    locked_at = null,
    lock_expires_at = null
  where status = 'running'
    and lock_expires_at < now();

  get diagnostics released = row_count;
  return released;
end;
$$;

-- ============================================================
-- Write an audit event (convenience function)
-- ============================================================
create or replace function public.write_audit_event(
  p_event_type    public.audit_event_type,
  p_actor_id      uuid,
  p_actor_type    text,
  p_action        text,
  p_target_type   text default null,
  p_target_id     uuid default null,
  p_case_id       uuid default null,
  p_campaign_id   uuid default null,
  p_details       jsonb default '{}',
  p_severity      text default 'info',
  p_actor_ip_hash text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_id uuid;
begin
  insert into public.audit_events (
    event_type, actor_id, actor_type, actor_ip_hash,
    target_type, target_id, case_id, campaign_id,
    action, details, severity
  ) values (
    p_event_type, p_actor_id, p_actor_type, p_actor_ip_hash,
    p_target_type, p_target_id, p_case_id, p_campaign_id,
    p_action, p_details, p_severity
  )
  returning id into event_id;

  return event_id;
end;
$$;

-- ============================================================
-- Update aggregate metrics safely (with suppression)
-- ============================================================
create or replace function public.upsert_metric(
  p_campaign_id   uuid,
  p_metric_date   date,
  p_metric_type   text,
  p_count         integer default null,
  p_rate          numeric default null,
  p_json          jsonb default null,
  p_cohort_size   integer default 0,
  p_threshold     integer default 5
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.aggregate_metrics (
    campaign_id, metric_date, metric_type,
    count_value, rate_value, json_value,
    cohort_size, is_suppressed, suppression_threshold
  ) values (
    p_campaign_id, p_metric_date, p_metric_type,
    p_count, p_rate, p_json,
    p_cohort_size, p_cohort_size < p_threshold, p_threshold
  )
  on conflict (campaign_id, metric_date, metric_type)
  do update set
    count_value = excluded.count_value,
    rate_value = excluded.rate_value,
    json_value = excluded.json_value,
    cohort_size = excluded.cohort_size,
    is_suppressed = excluded.cohort_size < excluded.suppression_threshold;
end;
$$;

-- Atomically consume one request from a fixed-window rate-limit bucket.
-- The caller supplies only a salted hash; raw network identifiers are never
-- persisted. This function is service-role only.
create or replace function public.consume_rate_limit(
  p_key_hash text,
  p_scope text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  bucket_start timestamptz;
  updated_count integer;
begin
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'Invalid rate-limit configuration';
  end if;

  bucket_start := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  insert into public.rate_limit_buckets (
    key_hash, scope, window_start, request_count, expires_at
  ) values (
    p_key_hash,
    p_scope,
    bucket_start,
    1,
    bucket_start + make_interval(secs => p_window_seconds * 2)
  )
  on conflict (key_hash, scope, window_start)
  do update set request_count = public.rate_limit_buckets.request_count + 1
  returning request_count into updated_count;

  delete from public.rate_limit_buckets
  where expires_at < clock_timestamp();

  return updated_count <= p_limit;
end;
$$;

create or replace function public.increment_referral_visits(p_referral_link_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.referral_links
  set total_visits = total_visits + 1
  where id = p_referral_link_id and is_active = true;
$$;

create or replace function public.increment_referral_starts(p_referral_link_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.referral_links
  set total_starts = total_starts + 1
  where id = p_referral_link_id and is_active = true;
$$;

revoke all on all functions in schema public from public, anon, authenticated;
grant execute on function public.idempotent_insert(text, text, jsonb) to service_role;
grant execute on function public.acquire_job(text, text, interval) to service_role;
grant execute on function public.complete_job(uuid, jsonb) to service_role;
grant execute on function public.fail_job(uuid, text) to service_role;
grant execute on function public.release_stale_locks() to service_role;
grant execute on function public.write_audit_event(
  public.audit_event_type, uuid, text, text, text, uuid, uuid, uuid, jsonb, text, text
) to service_role;
grant execute on function public.upsert_metric(uuid, date, text, integer, numeric, jsonb, integer, integer) to service_role;
grant execute on function public.consume_rate_limit(text, text, integer, integer) to service_role;
grant execute on function public.increment_referral_visits(uuid) to service_role;
grant execute on function public.increment_referral_starts(uuid) to service_role;
