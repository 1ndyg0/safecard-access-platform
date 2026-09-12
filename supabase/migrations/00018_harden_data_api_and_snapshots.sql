-- Forward-only: private operational data is accessed through the BFF's
-- campaign-scoped authorization, projections and access auditing. Browser
-- Supabase clients are used for Auth only; no raw operational table or
-- owner-executed view may bypass those checks.
alter table public.organizations enable row level security;
revoke all on public.organizations from public, anon, authenticated;
alter table public.pilot_campaigns enable row level security;
revoke all on public.pilot_campaigns from public, anon, authenticated;
alter table public.users enable row level security;
revoke all on public.users from public, anon, authenticated;
alter table public.role_assignments enable row level security;
revoke all on public.role_assignments from public, anon, authenticated;
alter table public.sponsors enable row level security;
revoke all on public.sponsors from public, anon, authenticated;
alter table public.referral_links enable row level security;
revoke all on public.referral_links from public, anon, authenticated;
alter table public.recipient_cases enable row level security;
revoke all on public.recipient_cases from public, anon, authenticated;
alter table public.recipient_profiles enable row level security;
revoke all on public.recipient_profiles from public, anon, authenticated;
alter table public.relationships enable row level security;
revoke all on public.relationships from public, anon, authenticated;
alter table public.consent_records enable row level security;
revoke all on public.consent_records from public, anon, authenticated;
alter table public.content_versions enable row level security;
revoke all on public.content_versions from public, anon, authenticated;
alter table public.application_submissions enable row level security;
revoke all on public.application_submissions from public, anon, authenticated;
alter table public.payment_intents enable row level security;
revoke all on public.payment_intents from public, anon, authenticated;
alter table public.payment_evidence enable row level security;
revoke all on public.payment_evidence from public, anon, authenticated;
alter table public.prc_export_batches enable row level security;
revoke all on public.prc_export_batches from public, anon, authenticated;
alter table public.prc_export_items enable row level security;
revoke all on public.prc_export_items from public, anon, authenticated;
alter table public.membership_status_events enable row level security;
revoke all on public.membership_status_events from public, anon, authenticated;
alter table public.support_cases enable row level security;
revoke all on public.support_cases from public, anon, authenticated;
alter table public.notification_events enable row level security;
revoke all on public.notification_events from public, anon, authenticated;
alter table public.audit_events enable row level security;
revoke all on public.audit_events from public, anon, authenticated;
alter table public.jobs enable row level security;
revoke all on public.jobs from public, anon, authenticated;
alter table public.aggregate_metrics enable row level security;
revoke all on public.aggregate_metrics from public, anon, authenticated;
alter table public.rate_limit_buckets enable row level security;
revoke all on public.rate_limit_buckets from public, anon, authenticated;
alter table public.payment_evidence_versions enable row level security;
revoke all on public.payment_evidence_versions from public, anon, authenticated;
alter table public.application_review_decisions enable row level security;
revoke all on public.application_review_decisions from public, anon, authenticated;
alter table public.storyboard_events enable row level security;
revoke all on public.storyboard_events from public, anon, authenticated;
revoke all on public.admin_case_queue_view from public, anon, authenticated;
revoke all on public.application_review_context from public, anon, authenticated;

-- Operational flags may change; the originally submitted personal data,
-- consent references and timestamps are frozen for every submission version.
create or replace function public.protect_submission_snapshot()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'Application submissions are immutable'; end if;
  if (to_jsonb(new) - array['is_current', 'correction_reason', 'updated_at'])
     is distinct from (to_jsonb(old) - array['is_current', 'correction_reason', 'updated_at']) then
    raise exception 'Application submission snapshots are immutable';
  end if;
  return new;
end;
$$;
create trigger trg_submission_snapshot_immutable
before update or delete on public.application_submissions
for each row execute function public.protect_submission_snapshot();

-- A review may change status/reason, never the stored object identity,
-- checksum, dimensions, uploader, original metadata or version lineage.
create or replace function public.protect_payment_evidence_snapshot()
returns trigger language plpgsql set search_path = '' as $$
begin
  if tg_op = 'DELETE' then raise exception 'Payment evidence versions are immutable'; end if;
  if (to_jsonb(new) - array['state', 'reviewed_by', 'reviewed_at', 'retention_review_at', 'metadata'])
     is distinct from (to_jsonb(old) - array['state', 'reviewed_by', 'reviewed_at', 'retention_review_at', 'metadata'])
     or (new.metadata - 'reupload_reason') is distinct from (old.metadata - 'reupload_reason') then
    raise exception 'Payment evidence snapshots are immutable';
  end if;
  return new;
end;
$$;
create trigger trg_payment_evidence_snapshot_immutable
before update or delete on public.payment_evidence_versions
for each row execute function public.protect_payment_evidence_snapshot();

revoke all on function public.protect_submission_snapshot() from public, anon, authenticated;
revoke all on function public.protect_payment_evidence_snapshot() from public, anon, authenticated;
