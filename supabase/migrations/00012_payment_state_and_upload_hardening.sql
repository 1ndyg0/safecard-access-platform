-- SafeCard Access Platform
-- Migration 00012: database-enforced state transitions, transactional audit
-- coverage, and idempotent direct-to-private-storage payment-proof uploads.

alter table public.payment_intents
  add column if not exists handoff_opened_by uuid references auth.users(id),
  add column if not exists payer_marked_paid_by uuid references auth.users(id);

alter table public.payment_evidence_versions
  add column if not exists purged_at timestamptz,
  add column if not exists purge_job_id uuid references public.jobs(id);

create table if not exists public.payment_upload_sessions (
  id                     uuid primary key,
  payment_intent_id      uuid not null references public.payment_intents(id),
  case_id                uuid not null references public.recipient_cases(id),
  campaign_id            uuid not null references public.pilot_campaigns(id),
  uploader_user_id       uuid not null references auth.users(id),
  idempotency_key        text not null unique,
  request_hash           text not null check (request_hash ~ '^[a-f0-9]{64}$'),
  quarantine_object_path text not null unique,
  claimed_content_type   text not null check (claimed_content_type in ('image/jpeg', 'image/png', 'image/webp')),
  declared_size_bytes    bigint not null check (declared_size_bytes > 0 and declared_size_bytes <= 10485760),
  state                  text not null default 'initiated'
    check (state in ('initiated', 'processing', 'completed', 'failed', 'expired')),
  expires_at             timestamptz not null,
  processing_started_at  timestamptz,
  evidence_version_id    uuid references public.payment_evidence_versions(id),
  failure_code           text,
  quarantine_deleted_at  timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists idx_payment_upload_sessions_intent
  on public.payment_upload_sessions(payment_intent_id, created_at desc);
create index if not exists idx_payment_upload_sessions_cleanup
  on public.payment_upload_sessions(expires_at)
  where quarantine_deleted_at is null;

drop trigger if exists trg_payment_upload_sessions_updated_at on public.payment_upload_sessions;
create trigger trg_payment_upload_sessions_updated_at
  before update on public.payment_upload_sessions
  for each row execute function public.set_updated_at();

alter table public.payment_upload_sessions enable row level security;
revoke all on public.payment_upload_sessions from anon, authenticated;

-- The service role is the only direct writer. User ownership is checked again
-- inside every SECURITY DEFINER function, rather than trusting the BFF alone.

create or replace function public.user_can_access_payment(
  p_user_id uuid,
  p_payment_intent_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.payment_intents pi
    join public.recipient_cases rc on rc.id = pi.case_id
    left join public.sponsors s on s.id = pi.payer_sponsor_id
    where pi.id = p_payment_intent_id
      and (rc.auth_user_id = p_user_id or s.auth_user_id = p_user_id)
  );
$$;

revoke all on function public.user_can_access_payment(uuid, uuid) from public, anon, authenticated;
grant execute on function public.user_can_access_payment(uuid, uuid) to service_role;

-- Reject invalid cross-machine transitions even when a future application path
-- accidentally bypasses the TypeScript validators.
create or replace function public.enforce_recipient_case_transitions()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.consent_state is distinct from old.consent_state and not (
    (old.consent_state = 'not_started' and new.consent_state in ('reviewing', 'agreed')) or
    (old.consent_state = 'reviewing' and new.consent_state in ('not_started', 'agreed')) or
    (old.consent_state = 'agreed' and new.consent_state in ('withdrawn', 'expired_due_to_content_change')) or
    (old.consent_state = 'expired_due_to_content_change' and new.consent_state = 'reviewing')
  ) then raise exception 'Invalid consent transition: % -> %', old.consent_state, new.consent_state; end if;

  if new.application_state is distinct from old.application_state and not (
    (old.application_state = 'draft' and new.application_state in ('ready_for_review', 'submitted', 'withdrawn')) or
    (old.application_state = 'ready_for_review' and new.application_state in ('draft', 'submitted', 'withdrawn')) or
    (old.application_state = 'submitted' and new.application_state in ('correction_needed', 'withdrawn')) or
    (old.application_state = 'correction_needed' and new.application_state in ('resubmitted', 'withdrawn')) or
    (old.application_state = 'resubmitted' and new.application_state in ('correction_needed', 'withdrawn'))
  ) then raise exception 'Invalid application transition: % -> %', old.application_state, new.application_state; end if;

  if new.application_review_state is distinct from old.application_review_state and not (
    (old.application_review_state = 'pending' and new.application_review_state in ('approved', 'resubmission_requested', 'rejected')) or
    (old.application_review_state = 'resubmission_requested' and new.application_review_state = 'pending')
  ) then raise exception 'Invalid application review transition: % -> %', old.application_review_state, new.application_review_state; end if;

  if new.payment_state is distinct from old.payment_state and not (
    (old.payment_state = 'not_started' and new.payment_state = 'official_handoff_opened') or
    (old.payment_state = 'official_handoff_opened' and new.payment_state in ('payer_marked_paid', 'failed_or_cancelled')) or
    (old.payment_state = 'payer_marked_paid' and new.payment_state in ('verification_pending', 'verified_by_official_source', 'failed_or_cancelled')) or
    (old.payment_state = 'verification_pending' and new.payment_state in ('verified_by_official_source', 'failed_or_cancelled')) or
    (old.payment_state = 'verified_by_official_source' and new.payment_state = 'refunded_or_reversed') or
    (old.payment_state = 'failed_or_cancelled' and new.payment_state = 'official_handoff_opened')
  ) then raise exception 'Invalid payment transition: % -> %', old.payment_state, new.payment_state; end if;

  if new.prc_handoff_state is distinct from old.prc_handoff_state and not (
    (old.prc_handoff_state = 'not_ready' and new.prc_handoff_state = 'ready_for_export') or
    (old.prc_handoff_state = 'ready_for_export' and new.prc_handoff_state in ('not_ready', 'exported')) or
    (old.prc_handoff_state = 'exported' and new.prc_handoff_state in ('acknowledged', 'correction_requested', 'accepted', 'rejected')) or
    (old.prc_handoff_state = 'acknowledged' and new.prc_handoff_state in ('accepted', 'rejected', 'correction_requested')) or
    (old.prc_handoff_state = 'correction_requested' and new.prc_handoff_state = 'ready_for_export')
  ) then raise exception 'Invalid PRC handoff transition: % -> %', old.prc_handoff_state, new.prc_handoff_state; end if;

  if new.membership_state is distinct from old.membership_state and not (
    (old.membership_state = 'not_active' and new.membership_state = 'pending_prc_confirmation') or
    (old.membership_state = 'pending_prc_confirmation' and new.membership_state in ('active_confirmed', 'declined')) or
    (old.membership_state = 'active_confirmed' and new.membership_state in ('expired', 'renewed')) or
    (old.membership_state = 'expired' and new.membership_state = 'renewed') or
    (old.membership_state = 'renewed' and new.membership_state = 'expired')
  ) then raise exception 'Invalid membership transition: % -> %', old.membership_state, new.membership_state; end if;

  return new;
end;
$$;

drop trigger if exists trg_recipient_cases_state_transitions on public.recipient_cases;
create trigger trg_recipient_cases_state_transitions
  before update on public.recipient_cases
  for each row execute function public.enforce_recipient_case_transitions();

-- Transactional audit triggers. If the immutable audit insert fails, the
-- associated state mutation fails too; no state can commit without evidence.
create or replace function public.audit_application_submission_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_actor uuid;
begin
  select auth_user_id into v_actor from public.recipient_cases where id = new.case_id;
  insert into public.audit_events (
    event_type, actor_id, actor_type, target_type, target_id, case_id, action, details
  ) values (
    'application_submit', v_actor, case when v_actor is null then 'anonymous' else 'user' end,
    'application_submission', new.id, new.case_id, 'Application submission version committed',
    pg_catalog.jsonb_build_object('application_ref', new.application_ref, 'submitted_by', new.submitted_by)
  );
  return new;
end;
$$;

drop trigger if exists trg_application_submission_atomic_audit on public.application_submissions;
create trigger trg_application_submission_atomic_audit
  after insert on public.application_submissions
  for each row execute function public.audit_application_submission_insert();

create or replace function public.audit_application_review_transition()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.application_review_state is distinct from old.application_review_state then
    insert into public.audit_events (
      event_type, actor_id, actor_type, target_type, target_id, case_id, campaign_id,
      action, details, severity
    ) values (
      'application_review', new.application_reviewed_by,
      case when new.application_reviewed_by is null then 'system' else 'user' end,
      'recipient_case', new.id, new.id, new.campaign_id,
      'Application review state changed',
      pg_catalog.jsonb_build_object(
        'from', old.application_review_state,
        'to', new.application_review_state,
        'reason', new.application_review_reason
      ),
      case when new.application_review_state = 'rejected' then 'warning' else 'info' end
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_recipient_case_review_atomic_audit on public.recipient_cases;
create trigger trg_recipient_case_review_atomic_audit
  after update on public.recipient_cases
  for each row execute function public.audit_application_review_transition();

create or replace function public.audit_payment_intent_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_actor uuid;
begin
  if tg_op = 'INSERT' or new.state is distinct from old.state then
    v_actor := case
      when new.state = 'verified_by_official_source' then new.verified_by
      when new.state = 'payer_marked_paid' then new.payer_marked_paid_by
      else new.handoff_opened_by
    end;
    insert into public.audit_events (
      event_type, actor_id, actor_type, target_type, target_id, case_id, campaign_id, action, details
    ) values (
      'payment_status_change', v_actor, case when v_actor is null then 'system' else 'user' end,
      'payment_intent', new.id, new.case_id, new.campaign_id, 'Payment intent state changed',
      pg_catalog.jsonb_build_object(
        'from', case when tg_op = 'INSERT' then null else old.state::text end,
        'to', new.state::text,
        'payment_route', new.payment_route
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_payment_intent_atomic_audit on public.payment_intents;
create trigger trg_payment_intent_atomic_audit
  after insert or update on public.payment_intents
  for each row execute function public.audit_payment_intent_state();

create or replace function public.audit_payment_evidence_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case_id uuid;
  v_campaign_id uuid;
begin
  if tg_op = 'INSERT' or new.state is distinct from old.state then
    select case_id, campaign_id into v_case_id, v_campaign_id
    from public.payment_intents where id = new.payment_intent_id;
    insert into public.audit_events (
      event_type, actor_id, actor_type, target_type, target_id, case_id, campaign_id, action, details
    ) values (
      'payment_status_change', coalesce(new.reviewed_by, new.uploaded_by), 'user',
      'payment_evidence_version', new.id, v_case_id, v_campaign_id,
      'Payment evidence state changed',
      pg_catalog.jsonb_build_object(
        'from', case when tg_op = 'INSERT' then null else old.state end,
        'to', new.state,
        'version_number', new.version_number,
        'sha256', new.sha256
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_payment_evidence_atomic_audit on public.payment_evidence_versions;
create trigger trg_payment_evidence_atomic_audit
  after insert or update on public.payment_evidence_versions
  for each row execute function public.audit_payment_evidence_state();

-- A payment intent is derived from the case and campaign records. The browser
-- cannot select the campaign fee or substitute another campaign identifier.
create or replace function public.create_payment_intent_secure(
  p_payment_intent_id uuid,
  p_case_id uuid,
  p_payer_type text,
  p_payer_name text,
  p_payer_sponsor_id uuid,
  p_payment_route text,
  p_idempotency_key text,
  p_request_hash text,
  p_actor_id uuid
)
returns table(payment_intent_id uuid, campaign_id uuid, expected_amount numeric, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case public.recipient_cases%rowtype;
  v_campaign public.pilot_campaigns%rowtype;
  v_existing public.payment_intents%rowtype;
  v_approval_type text;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_idempotency_key, 0));

  select * into v_existing from public.payment_intents where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> p_request_hash then
      raise exception 'Idempotency key was already used with a different payment request';
    end if;
    return query select v_existing.id, v_existing.campaign_id, v_existing.expected_amount, 'exists'::text;
    return;
  end if;

  select * into v_case from public.recipient_cases where id = p_case_id for update;
  if not found then raise exception 'Case not found'; end if;
  if v_case.auth_user_id is distinct from p_actor_id then raise exception 'Payment case ownership required'; end if;
  if v_case.consent_state <> 'agreed' then raise exception 'Cannot create payment: consent must be active'; end if;
  if v_case.application_state not in ('submitted', 'resubmitted') then
    raise exception 'Cannot create payment: application must be submitted first';
  end if;

  select * into v_campaign from public.pilot_campaigns
  where id = v_case.campaign_id and is_active = true;
  if not found then raise exception 'Campaign is not active'; end if;

  v_approval_type := case when p_payment_route like 'bank_transfer_%' then 'bank_transfer' else p_payment_route end;
  if not exists (
    select 1 from pg_catalog.jsonb_array_elements(v_campaign.approved_payment_routes) route
    where route->>'type' = v_approval_type
      and coalesce((route->>'is_active')::boolean, false)
  ) then raise exception 'Payment route is not approved for this campaign'; end if;

  if p_payer_type = 'sponsor' then
    if p_payer_sponsor_id is null or v_case.referral_link_id is null then
      raise exception 'Sponsor payment requires the sponsor linked to this referral';
    end if;
    if not exists (
      select 1 from public.referral_links rl
      join public.sponsors s on s.id = rl.sponsor_id
      where rl.id = v_case.referral_link_id
        and rl.sponsor_id = p_payer_sponsor_id
        and s.campaign_id = v_case.campaign_id
        and s.is_active = true
        and (not s.is_minor or s.guardian_approved)
    ) then raise exception 'Payer sponsor is not eligible for this application'; end if;
  elsif p_payer_sponsor_id is not null then
    raise exception 'payer_sponsor_id is only valid for sponsor payments';
  end if;

  insert into public.payment_intents (
    id, case_id, campaign_id, payer_type, payer_name, payer_sponsor_id,
    expected_amount, currency, payment_route, state, handoff_opened_at,
    handoff_opened_by, idempotency_key, request_hash
  ) values (
    p_payment_intent_id, p_case_id, v_case.campaign_id, p_payer_type, p_payer_name,
    p_payer_sponsor_id, v_campaign.membership_fee, 'PHP', p_payment_route,
    'official_handoff_opened', pg_catalog.now(), p_actor_id, p_idempotency_key, p_request_hash
  );

  update public.recipient_cases set payment_state = 'official_handoff_opened' where id = p_case_id;
  return query select p_payment_intent_id, v_case.campaign_id, v_campaign.membership_fee, 'created'::text;
end;
$$;

create or replace function public.mark_payment_paid_secure(
  p_payment_intent_id uuid,
  p_payment_reference text,
  p_actor_id uuid
)
returns table(case_id uuid, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare v_intent public.payment_intents%rowtype;
begin
  select * into v_intent from public.payment_intents where id = p_payment_intent_id for update;
  if not found then raise exception 'Payment intent not found'; end if;
  if not public.user_can_access_payment(p_actor_id, p_payment_intent_id) then raise exception 'Payment access required'; end if;

  if v_intent.state in ('payer_marked_paid', 'verification_pending') then
    if v_intent.payment_reference is distinct from trim(p_payment_reference) then
      raise exception 'Payment was already marked paid with a different reference';
    end if;
    return query select v_intent.case_id, 'exists'::text;
    return;
  end if;
  if v_intent.state <> 'official_handoff_opened' then raise exception 'Payment intent is not ready to be marked paid'; end if;

  update public.payment_intents set
    state = 'payer_marked_paid',
    payment_reference = trim(p_payment_reference),
    payer_declaration = 'I confirm this transfer was completed outside SafeCard and understand that verification does not activate membership.',
    payer_declared_at = pg_catalog.now(),
    payer_marked_paid_at = pg_catalog.now(),
    payer_marked_paid_by = p_actor_id
  where id = p_payment_intent_id;
  update public.recipient_cases set payment_state = 'payer_marked_paid' where id = v_intent.case_id;
  return query select v_intent.case_id, 'updated'::text;
end;
$$;

create or replace function public.create_payment_upload_session(
  p_session_id uuid,
  p_payment_intent_id uuid,
  p_uploader_user_id uuid,
  p_idempotency_key text,
  p_request_hash text,
  p_quarantine_object_path text,
  p_claimed_content_type text,
  p_declared_size_bytes bigint,
  p_expires_at timestamptz
)
returns table(
  session_id uuid,
  quarantine_object_path text,
  upload_state text,
  evidence_version_id uuid,
  expires_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_intent public.payment_intents%rowtype;
  v_existing public.payment_upload_sessions%rowtype;
  v_latest public.payment_evidence_versions%rowtype;
begin
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_idempotency_key, 0));
  select * into v_existing from public.payment_upload_sessions where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> p_request_hash or v_existing.uploader_user_id <> p_uploader_user_id then
      raise exception 'Idempotency key was already used with a different upload request';
    end if;
    return query select v_existing.id, v_existing.quarantine_object_path, v_existing.state,
      v_existing.evidence_version_id, v_existing.expires_at;
    return;
  end if;

  if p_claimed_content_type not in ('image/jpeg', 'image/png', 'image/webp') then raise exception 'Unsupported payment proof type'; end if;
  if p_declared_size_bytes <= 0 or p_declared_size_bytes > 10485760 then raise exception 'Payment proof must be 10 MB or smaller'; end if;
  if p_expires_at <= pg_catalog.now() or p_expires_at > pg_catalog.now() + interval '2 hours' then raise exception 'Invalid upload expiry'; end if;

  select * into v_intent from public.payment_intents where id = p_payment_intent_id for update;
  if not found then raise exception 'Payment intent not found'; end if;
  if not public.user_can_access_payment(p_uploader_user_id, p_payment_intent_id) then raise exception 'Payment access required'; end if;

  select * into v_latest from public.payment_evidence_versions
  where payment_intent_id = p_payment_intent_id order by version_number desc limit 1 for update;
  if v_intent.state = 'payer_marked_paid' then
    if v_latest.id is not null then raise exception 'Existing payment evidence must be reviewed before replacement'; end if;
  elsif v_intent.state = 'verification_pending' then
    if v_latest.id is null or v_latest.state <> 'reupload_requested' then
      raise exception 'Replacement payment evidence has not been requested';
    end if;
  else
    raise exception 'Payment intent is not ready for evidence upload';
  end if;

  insert into public.payment_upload_sessions (
    id, payment_intent_id, case_id, campaign_id, uploader_user_id,
    idempotency_key, request_hash, quarantine_object_path,
    claimed_content_type, declared_size_bytes, expires_at
  ) values (
    p_session_id, p_payment_intent_id, v_intent.case_id, v_intent.campaign_id,
    p_uploader_user_id, p_idempotency_key, p_request_hash, p_quarantine_object_path,
    p_claimed_content_type, p_declared_size_bytes, p_expires_at
  );

  return query select p_session_id, p_quarantine_object_path, 'initiated'::text, null::uuid, p_expires_at;
end;
$$;

create or replace function public.claim_payment_upload_session(
  p_session_id uuid,
  p_uploader_user_id uuid
)
returns table(
  session_id uuid,
  payment_intent_id uuid,
  case_id uuid,
  campaign_id uuid,
  quarantine_object_path text,
  claimed_content_type text,
  declared_size_bytes bigint,
  upload_state text,
  evidence_version_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare v_session public.payment_upload_sessions%rowtype;
begin
  select * into v_session from public.payment_upload_sessions where id = p_session_id for update;
  if not found then raise exception 'Payment upload session not found'; end if;
  if v_session.uploader_user_id <> p_uploader_user_id then raise exception 'Payment upload session access required'; end if;

  if v_session.state = 'completed' then
    return query select v_session.id, v_session.payment_intent_id, v_session.case_id,
      v_session.campaign_id, v_session.quarantine_object_path, v_session.claimed_content_type,
      v_session.declared_size_bytes, v_session.state, v_session.evidence_version_id;
    return;
  end if;
  if v_session.state in ('failed', 'expired') or v_session.expires_at <= pg_catalog.now() then
    raise exception 'Payment upload session has expired';
  end if;
  if v_session.state = 'processing' and v_session.processing_started_at > pg_catalog.now() - interval '10 minutes' then
    raise exception 'Payment upload session is already being processed';
  end if;

  update public.payment_upload_sessions
  set state = 'processing', processing_started_at = pg_catalog.now(), failure_code = null
  where id = p_session_id;
  v_session.state := 'processing';
  return query select v_session.id, v_session.payment_intent_id, v_session.case_id,
    v_session.campaign_id, v_session.quarantine_object_path, v_session.claimed_content_type,
    v_session.declared_size_bytes, v_session.state, v_session.evidence_version_id;
end;
$$;

create or replace function public.release_payment_upload_session(
  p_session_id uuid,
  p_uploader_user_id uuid,
  p_failure_code text,
  p_permanent_failure boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.payment_upload_sessions
  set state = case when p_permanent_failure then 'failed' else 'initiated' end,
      processing_started_at = null,
      failure_code = left(p_failure_code, 80)
  where id = p_session_id and uploader_user_id = p_uploader_user_id and state = 'processing';
end;
$$;

create or replace function public.finalize_payment_upload_session(
  p_session_id uuid,
  p_uploader_user_id uuid,
  p_object_path text,
  p_content_type text,
  p_file_size_bytes bigint,
  p_sha256 text,
  p_image_width integer,
  p_image_height integer,
  p_retention_review_at timestamptz default null
)
returns table(evidence_id uuid, version_number integer, upload_state text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.payment_upload_sessions%rowtype;
  v_intent public.payment_intents%rowtype;
  v_previous public.payment_evidence_versions%rowtype;
  v_version integer;
  v_extension text;
  v_expected_path text;
begin
  select * into v_session from public.payment_upload_sessions where id = p_session_id for update;
  if not found then raise exception 'Payment upload session not found'; end if;
  if v_session.uploader_user_id <> p_uploader_user_id then raise exception 'Payment upload session access required'; end if;
  if v_session.state = 'completed' then
    select pev.version_number into v_version from public.payment_evidence_versions pev where pev.id = v_session.evidence_version_id;
    return query select v_session.evidence_version_id, v_version, 'completed'::text;
    return;
  end if;
  if v_session.state <> 'processing' then raise exception 'Payment upload session is not being processed'; end if;

  select * into v_intent from public.payment_intents where id = v_session.payment_intent_id for update;
  if not found then raise exception 'Payment intent not found'; end if;
  if v_intent.state not in ('payer_marked_paid', 'verification_pending') then raise exception 'Payment intent is not ready for evidence upload'; end if;

  v_extension := case p_content_type when 'image/jpeg' then 'jpg' when 'image/png' then 'png' when 'image/webp' then 'webp' else null end;
  if v_extension is null then raise exception 'Unsupported payment proof type'; end if;
  v_expected_path := 'campaigns/' || v_session.campaign_id || '/cases/' || v_session.case_id ||
    '/payments/' || v_session.payment_intent_id || '/evidence/' || v_session.id || '.' || v_extension;
  if p_object_path <> v_expected_path then raise exception 'Unexpected payment evidence object path'; end if;
  if p_file_size_bytes <= 0 or p_file_size_bytes > 10485760 then raise exception 'Invalid sanitized payment proof size'; end if;
  if p_sha256 !~ '^[a-f0-9]{64}$' then raise exception 'Invalid payment proof digest'; end if;

  select * into v_previous from public.payment_evidence_versions
  where payment_intent_id = v_session.payment_intent_id
  order by version_number desc limit 1 for update;
  if v_intent.state = 'payer_marked_paid' and v_previous.id is not null then
    raise exception 'Existing payment evidence must be reviewed before replacement';
  end if;
  if v_intent.state = 'verification_pending' and (v_previous.id is null or v_previous.state <> 'reupload_requested') then
    raise exception 'Replacement payment evidence has not been requested';
  end if;
  v_version := coalesce(v_previous.version_number, 0) + 1;

  insert into public.payment_evidence (
    id, payment_intent_id, evidence_type, reference_number,
    amount_confirmed, currency, source, is_verified, metadata
  ) values (
    v_session.id, v_session.payment_intent_id, 'manual_receipt_reference', v_intent.payment_reference,
    v_intent.expected_amount, 'PHP', 'payer_upload', false,
    '{"upload_metadata_only":true}'::jsonb
  );

  insert into public.payment_evidence_versions (
    id, payment_evidence_id, payment_intent_id, version_number, object_path,
    content_type, file_size_bytes, sha256, image_width, image_height,
    state, uploaded_by, supersedes_id, retention_review_at, metadata
  ) values (
    v_session.id, v_session.id, v_session.payment_intent_id, v_version, p_object_path,
    p_content_type, p_file_size_bytes, p_sha256, p_image_width, p_image_height,
    'verification_pending', p_uploader_user_id, v_previous.id, p_retention_review_at,
    '{"original_filename_omitted":true,"metadata_stripped":true,"direct_storage_upload":true}'::jsonb
  );

  if v_previous.id is not null then
    update public.payment_evidence_versions set state = 'superseded' where id = v_previous.id;
  end if;
  update public.payment_intents
  set state = 'verification_pending', verification_started_at = coalesce(verification_started_at, pg_catalog.now())
  where id = v_session.payment_intent_id;
  update public.recipient_cases set payment_state = 'verification_pending' where id = v_session.case_id;
  update public.payment_upload_sessions
  set state = 'completed', evidence_version_id = v_session.id, processing_started_at = null
  where id = v_session.id;

  return query select v_session.id, v_version, 'completed'::text;
end;
$$;

create or replace function public.request_payment_evidence_reupload(
  p_evidence_version_id uuid,
  p_reviewed_by uuid,
  p_reason text
)
returns table(evidence_version_id uuid, evidence_state text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evidence public.payment_evidence_versions%rowtype;
  v_intent public.payment_intents%rowtype;
begin
  if p_reason is null or length(trim(p_reason)) < 5 then raise exception 'A review reason is required'; end if;
  select * into v_evidence from public.payment_evidence_versions where id = p_evidence_version_id for update;
  if not found then raise exception 'Payment evidence version not found'; end if;
  select * into v_intent from public.payment_intents where id = v_evidence.payment_intent_id for update;
  if not found then raise exception 'Payment intent not found'; end if;

  if v_evidence.state = 'reupload_requested' then
    if coalesce(v_evidence.metadata->>'reupload_reason', '') <> trim(p_reason) then
      raise exception 'Replacement was already requested with a different reason';
    end if;
    return query select v_evidence.id, v_evidence.state;
    return;
  end if;
  if v_evidence.state <> 'verification_pending' or v_intent.state <> 'verification_pending' then
    raise exception 'Only pending payment evidence can be returned for replacement';
  end if;

  update public.payment_evidence_versions
  set state = 'reupload_requested', reviewed_by = p_reviewed_by, reviewed_at = pg_catalog.now(),
      metadata = coalesce(metadata, '{}'::jsonb) || pg_catalog.jsonb_build_object('reupload_reason', trim(p_reason))
  where id = p_evidence_version_id;
  return query select p_evidence_version_id, 'reupload_requested'::text;
end;
$$;

create or replace function public.record_payment_evidence_purge(
  p_evidence_version_id uuid,
  p_job_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_evidence public.payment_evidence_versions%rowtype;
  v_case_id uuid;
  v_campaign_id uuid;
begin
  select * into v_evidence from public.payment_evidence_versions
  where id = p_evidence_version_id for update;
  if not found then raise exception 'Payment evidence version not found'; end if;
  if v_evidence.purged_at is not null then return false; end if;
  if v_evidence.retention_review_at is null or v_evidence.retention_review_at > pg_catalog.now() then
    raise exception 'Payment evidence is not due for retention purge';
  end if;
  if v_evidence.state not in ('verified', 'rejected', 'superseded') then
    raise exception 'Payment evidence state is not eligible for retention purge';
  end if;

  select case_id, campaign_id into v_case_id, v_campaign_id
  from public.payment_intents where id = v_evidence.payment_intent_id;
  update public.payment_evidence_versions
  set purged_at = pg_catalog.now(), purge_job_id = p_job_id,
      metadata = coalesce(metadata, '{}'::jsonb) || '{"object_deleted":true}'::jsonb
  where id = p_evidence_version_id;
  insert into public.audit_events (
    event_type, actor_id, actor_type, target_type, target_id, case_id, campaign_id,
    action, details, severity
  ) values (
    'data_deletion', null, 'system', 'payment_evidence_version', p_evidence_version_id,
    v_case_id, v_campaign_id, 'Payment evidence object removed under approved retention policy',
    pg_catalog.jsonb_build_object('job_id', p_job_id, 'sha256', v_evidence.sha256), 'info'
  );
  return true;
end;
$$;

revoke all on function public.create_payment_intent_secure(uuid, uuid, text, text, uuid, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.mark_payment_paid_secure(uuid, text, uuid) from public, anon, authenticated;
revoke all on function public.create_payment_upload_session(uuid, uuid, uuid, text, text, text, text, bigint, timestamptz) from public, anon, authenticated;
revoke all on function public.claim_payment_upload_session(uuid, uuid) from public, anon, authenticated;
revoke all on function public.release_payment_upload_session(uuid, uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.finalize_payment_upload_session(uuid, uuid, text, text, bigint, text, integer, integer, timestamptz) from public, anon, authenticated;
revoke all on function public.request_payment_evidence_reupload(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.record_payment_evidence_purge(uuid, uuid) from public, anon, authenticated;
revoke execute on function public.create_payment_intent_with_case_state(uuid, uuid, uuid, text, text, uuid, numeric, text, text, text) from service_role;
revoke execute on function public.mark_payment_paid_with_case_state(uuid, text, text) from service_role;
revoke execute on function public.register_payment_evidence_version(uuid, uuid, uuid, uuid, text, numeric, text, text, bigint, text, integer, integer, uuid) from service_role;
grant execute on function public.create_payment_intent_secure(uuid, uuid, text, text, uuid, text, text, text, uuid) to service_role;
grant execute on function public.mark_payment_paid_secure(uuid, text, uuid) to service_role;
grant execute on function public.create_payment_upload_session(uuid, uuid, uuid, text, text, text, text, bigint, timestamptz) to service_role;
grant execute on function public.claim_payment_upload_session(uuid, uuid) to service_role;
grant execute on function public.release_payment_upload_session(uuid, uuid, text, boolean) to service_role;
grant execute on function public.finalize_payment_upload_session(uuid, uuid, text, text, bigint, text, integer, integer, timestamptz) to service_role;
grant execute on function public.request_payment_evidence_reupload(uuid, uuid, text) to service_role;
grant execute on function public.record_payment_evidence_purge(uuid, uuid) to service_role;
