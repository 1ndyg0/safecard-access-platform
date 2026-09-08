-- SafeCard Access Platform
-- Migration 00007: Support cases, notification events, audit events, jobs, metrics

-- ============================================================
-- Support cases
-- Categorized and auditable support queue
-- 8 categories from the spec
-- ============================================================
create table public.support_cases (
  id                  uuid primary key default extensions.uuid_generate_v4(),
  case_id             uuid references public.recipient_cases(id),
  -- Nullable: some support requests are general
  campaign_id         uuid references public.pilot_campaigns(id),

  category            public.support_category not null,
  state               public.support_state not null default 'open',
  subject             text not null,
  description         text not null,

  -- Who submitted
  submitted_by_type   text not null check (submitted_by_type in (
    'recipient', 'sponsor', 'guardian', 'staff', 'system'
  )),
  submitted_by_user_id uuid references auth.users(id) on delete set null,
  contact_method      text,

  -- Assignment
  assigned_to         uuid references public.users(id),
  assigned_at         timestamptz,
  priority            text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),

  -- Resolution
  resolved_at         timestamptz,
  resolved_by         uuid references public.users(id),
  resolution_summary  text,
  escalated_to        text,
  -- 'prc', 'privacy_admin', 'school_admin'

  -- Privacy-specific fields
  is_privacy_request  boolean not null default false,
  privacy_request_type text check (privacy_request_type in (
    'consent_withdrawal',
    'data_correction',
    'access_request',
    'deletion_request',
    'incident_report'
  )),

  idempotency_key     text unique,
  metadata            jsonb not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_support_cases_case on public.support_cases(case_id) where case_id is not null;
create index idx_support_cases_state on public.support_cases(state);
create index idx_support_cases_category on public.support_cases(category);
create index idx_support_cases_assigned on public.support_cases(assigned_to) where assigned_to is not null;
create index idx_support_cases_privacy on public.support_cases(is_privacy_request)
  where is_privacy_request = true;

create trigger trg_support_cases_updated_at
  before update on public.support_cases
  for each row execute function public.set_updated_at();

-- ============================================================
-- Notification events
-- Reminders, failures, opt-outs, consent-based eligibility
-- SMS only if approved; must respect consent withdrawal
-- ============================================================
create table public.notification_events (
  id                  uuid primary key default extensions.uuid_generate_v4(),
  case_id             uuid references public.recipient_cases(id),
  channel             public.notification_channel not null,
  notification_type   text not null,
  -- e.g. 'application_received', 'payment_pending', 'membership_confirmed'
  recipient_contact   text,
  -- Phone number or email (stored only if notification approved)
  status              public.notification_status not null default 'pending',
  sent_at             timestamptz,
  delivered_at        timestamptz,
  failed_at           timestamptz,
  failure_reason      text,
  opted_out_at        timestamptz,
  -- Consent check: was consent still valid at send time?
  consent_valid       boolean not null default true,
  content_preview     text,
  -- Summary of what was sent (no PII in the preview)
  metadata            jsonb not null default '{}',
  created_at          timestamptz not null default now()
);

create index idx_notification_events_case on public.notification_events(case_id)
  where case_id is not null;
create index idx_notification_events_status on public.notification_events(status);

-- ============================================================
-- Audit events
-- Immutable-style audit log
-- Covers: role changes, content approvals, application submit,
-- consent withdrawal, export creation, PRC acknowledgment,
-- membership status changes, staff access, security events
-- ============================================================
create table public.audit_events (
  id                  uuid primary key default extensions.uuid_generate_v4(),
  event_type          public.audit_event_type not null,
  actor_id            uuid,
  -- The user or system that performed the action
  actor_type          text not null default 'user'
    check (actor_type in ('user', 'system', 'anonymous')),
  actor_ip_hash       text,
  -- Hashed IP, not raw

  -- What was affected
  target_type         text,
  -- e.g. 'role_assignment', 'content_version', 'application_submission'
  target_id           uuid,
  case_id             uuid references public.recipient_cases(id),
  campaign_id         uuid references public.pilot_campaigns(id),

  -- What happened
  action              text not null,
  -- Human-readable action description
  details             jsonb not null default '{}',
  -- Structured event details (before/after state, etc.)
  severity            text not null default 'info'
    check (severity in ('info', 'warning', 'error', 'critical')),

  -- Immutable timestamp
  created_at          timestamptz not null default now()
);

create index idx_audit_events_type on public.audit_events(event_type);
create index idx_audit_events_actor on public.audit_events(actor_id) where actor_id is not null;
create index idx_audit_events_case on public.audit_events(case_id) where case_id is not null;
create index idx_audit_events_campaign on public.audit_events(campaign_id) where campaign_id is not null;
create index idx_audit_events_created on public.audit_events(created_at);
create index idx_audit_events_severity on public.audit_events(severity)
  where severity in ('warning', 'error', 'critical');

-- Prevent modification of audit records
create trigger trg_audit_events_immutable
  before update or delete on public.audit_events
  for each row execute function public.prevent_audit_mutation();

-- ============================================================
-- Jobs
-- Durable database-backed job queue
-- Vercel cron triggers execution; state lives in the database
-- ============================================================
create table public.jobs (
  id                  uuid primary key default extensions.uuid_generate_v4(),
  job_type            text not null,
  -- e.g. 'send_notification', 'aggregate_metrics', 'check_content_expiry'
  status              public.job_status not null default 'pending',
  payload             jsonb not null default '{}',
  result              jsonb,
  error               text,

  -- Scheduling
  scheduled_for       timestamptz not null default now(),
  started_at          timestamptz,
  completed_at        timestamptz,
  failed_at           timestamptz,

  -- Retry logic
  attempts            integer not null default 0,
  max_attempts        integer not null default 3,
  last_error          text,
  next_retry_at       timestamptz,

  -- Ownership (prevents double-processing)
  locked_by           text,
  locked_at           timestamptz,
  lock_expires_at     timestamptz,

  -- Context
  campaign_id         uuid references public.pilot_campaigns(id),
  case_id             uuid references public.recipient_cases(id),

  idempotency_key     text unique,
  metadata            jsonb not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_jobs_status on public.jobs(status) where status in ('pending', 'running');
create index idx_jobs_scheduled on public.jobs(scheduled_for)
  where status = 'pending';
create index idx_jobs_type on public.jobs(job_type);
create index idx_jobs_locked on public.jobs(lock_expires_at)
  where status = 'running';

create trigger trg_jobs_updated_at
  before update on public.jobs
  for each row execute function public.set_updated_at();

-- ============================================================
-- Aggregate metrics
-- Privacy-safe daily or campaign-level metrics
-- Small-cohort suppression: "not enough data" when N < threshold
-- ============================================================
create table public.aggregate_metrics (
  id                  uuid primary key default extensions.uuid_generate_v4(),
  campaign_id         uuid not null references public.pilot_campaigns(id),
  metric_date         date not null,
  metric_type         text not null,
  -- e.g. 'referral_visits', 'start_rate', 'comprehension_pass_rate',
  -- 'consent_to_submit_rate', 'submitted_to_confirmed_rate',
  -- 'support_categories', 'error_rate'

  -- Values
  count_value         integer,
  rate_value          numeric(5,4),
  -- As a decimal, e.g. 0.8000 = 80%
  json_value          jsonb,
  -- For structured metrics like category breakdowns

  -- Small-cohort suppression
  cohort_size         integer not null default 0,
  is_suppressed       boolean not null default false,
  -- true if cohort_size < suppression threshold
  suppression_threshold integer not null default 5,

  metadata            jsonb not null default '{}',
  created_at          timestamptz not null default now(),

  -- One metric per campaign per day per type
  unique (campaign_id, metric_date, metric_type)
);

create index idx_aggregate_metrics_campaign on public.aggregate_metrics(campaign_id);
create index idx_aggregate_metrics_date on public.aggregate_metrics(metric_date);
create index idx_aggregate_metrics_type on public.aggregate_metrics(metric_type);

-- Durable, privacy-preserving API rate-limit buckets. Keys are salted hashes;
-- raw IP addresses are never stored.
create table public.rate_limit_buckets (
  key_hash      text not null,
  scope         text not null,
  window_start  timestamptz not null,
  request_count integer not null default 1 check (request_count > 0),
  expires_at    timestamptz not null,
  primary key (key_hash, scope, window_start)
);

create index idx_rate_limit_buckets_expiry on public.rate_limit_buckets(expires_at);
