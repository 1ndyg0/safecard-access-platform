-- SafeCard Access Platform
-- Migration 00022: remove ambassador/sponsor/referral, PRC export/handoff,
-- the finance_export / prc_liaison roles, and the payer-sponsor path.
--
-- Owner decision: the only approval process is the administrator approving an
-- application, and that single action also verifies the payment proof
-- (/api/admin/cases/[id]/approve-with-payment).
--
-- Forward-only and re-runnable. Nothing here edits or disables an immutability
-- trigger, and the kept records are not touched:
--   recipient_cases, recipient_profiles, consent_records,
--   application_submissions, application_review_decisions, payment_intents,
--   payment_evidence, payment_evidence_versions, audit_events,
--   membership_status_events.
-- Dropped tables are dropped without CASCADE, after every kept column that
-- referenced them has been removed, so an unexpected dependency fails the
-- migration instead of silently taking something else with it.
--
-- Deliberately retained because PostgreSQL cannot drop enum labels in place and
-- historical rows may carry them: the staff_role labels prc_liaison and
-- finance_export (blocked by a CHECK constraint below), and the audit_event_type,
-- content_type, support_category and membership_state labels. The legacy
-- public.sponsorships table from the original pilot is also left alone.

-- ============================================================
-- 0. Safety guards
-- ============================================================
do $$
declare
  v_count bigint;
begin
  -- Export batches are immutable history. Never drop them if any exist.
  if to_regclass('public.prc_export_batches') is not null then
    execute 'select count(*) from public.prc_export_batches' into v_count;
    if v_count > 0 then
      raise exception 'Refusing to drop prc_export_batches: it contains % export batch(es)', v_count;
    end if;
  end if;
  if to_regclass('public.prc_export_items') is not null then
    execute 'select count(*) from public.prc_export_items' into v_count;
    if v_count > 0 then
      raise exception 'Refusing to drop prc_export_items: it contains % export item(s)', v_count;
    end if;
  end if;
  -- A sponsor-paid intent cannot be re-expressed once the sponsor tables are gone.
  if exists (select 1 from public.payment_intents where payer_type = 'sponsor') then
    raise exception 'Refusing to continue: a payment intent has payer_type sponsor';
  end if;
  -- A membership event that points at an export item would lose its evidence link.
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'membership_status_events'
      and column_name = 'prc_export_item_id'
  ) then
    execute 'select count(*) from public.membership_status_events where prc_export_item_id is not null' into v_count;
    if v_count > 0 then
      raise exception 'Refusing to continue: % membership event(s) reference a PRC export item', v_count;
    end if;
  end if;
end;
$$;

-- ============================================================
-- 1. Retire scheduled work and derived metrics
-- ============================================================
update public.jobs
set status = 'cancelled'
where job_type = 'deactivate_expired_referrals'
  and status in ('pending', 'running');

delete from public.aggregate_metrics where metric_type = 'referral_visits';

-- ============================================================
-- 2. Retired staff roles
--    Revoke any active assignment (kept as history), then block new ones.
-- ============================================================
update public.role_assignments
set is_active = false,
    revoked_at = coalesce(revoked_at, now()),
    reason = coalesce(reason, 'Role retired: PRC export and finance verification were removed')
where role in ('prc_liaison', 'finance_export')
  and is_active;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'public.role_assignments'::regclass
      and conname = 'role_assignments_retired_roles_chk'
  ) then
    alter table public.role_assignments
      add constraint role_assignments_retired_roles_chk
      check (role not in ('prc_liaison', 'finance_export')) not valid;
  end if;
end;
$$;

-- ============================================================
-- 3. Row-level-security policies that named retired roles or sponsors
-- ============================================================
drop policy if exists "Sponsors can read payment for referred cases" on public.payment_intents;

drop policy if exists "Authorized staff can read profiles" on public.recipient_profiles;
create policy "Authorized staff can read profiles"
  on public.recipient_profiles for select
  to authenticated
  using (
    public.has_role('school_admin')
    or public.has_role('privacy_admin_owner')
    or public.has_role('support_agent')
  );

drop policy if exists "Staff can read payment evidence" on public.payment_evidence;
create policy "Staff can read payment evidence"
  on public.payment_evidence for select
  to authenticated
  using (
    public.has_role('school_admin')
    or public.has_role('privacy_admin_owner')
  );

-- ============================================================
-- 4. Functions of the removed features
-- ============================================================
drop function if exists public.create_prc_export_batch_atomic(uuid, uuid, text, uuid, text, text, jsonb, text, text, uuid[], uuid[], jsonb, text);
drop function if exists public.acknowledge_prc_export_item_atomic(uuid, text, text, text, jsonb, text, date, date, uuid);
drop function if exists public.increment_referral_visits(uuid);
drop function if exists public.increment_referral_starts(uuid);
drop function if exists public.is_case_sponsor(uuid);

-- ============================================================
-- 5. Views that expose prc_handoff_state are rebuilt without it
-- ============================================================
drop view if exists public.admin_case_queue_view;
drop view if exists public.application_review_context;

-- ============================================================
-- 6. Remove the columns that tied kept tables to the removed ones
-- ============================================================
alter table public.recipient_cases drop column if exists referral_link_id;
alter table public.recipient_cases drop column if exists prc_handoff_state;
alter table public.payment_intents drop column if exists payer_sponsor_id;
alter table public.membership_status_events drop column if exists prc_export_item_id;
alter table public.pilot_campaigns drop column if exists max_sponsors;

-- payer_type no longer allows 'sponsor'.
do $$
declare
  v_name text;
begin
  for v_name in
    select conname from pg_constraint
    where conrelid = 'public.payment_intents'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%payer_type%'
  loop
    execute format('alter table public.payment_intents drop constraint %I', v_name);
  end loop;
end;
$$;
alter table public.payment_intents
  add constraint payment_intents_payer_type_check
  check (payer_type in ('guardian', 'other'));

-- ============================================================
-- 7. Drop the removed tables (children first, no CASCADE)
-- ============================================================
drop table if exists public.relationships;
drop table if exists public.referral_links;
drop table if exists public.sponsors;
drop table if exists public.prc_export_items;
drop table if exists public.prc_export_batches;

drop type if exists public.relationship_type;

-- ============================================================
-- 8. Atomic functions whose signatures or results mentioned removed things.
--    Same behaviour and the same append-only ledgers; only the PRC handoff
--    state and the sponsor payer path are gone.
-- ============================================================
drop function if exists public.record_application_review_atomic(uuid, uuid, public.application_review_state, text, public.application_review_state, text, boolean);
drop function if exists public.verify_payment_evidence_atomic(uuid, uuid, uuid, text, public.payment_state, jsonb);
drop function if exists public.submit_member_correction_atomic(uuid, jsonb, text, text);
drop function if exists public.create_payment_intent_atomic(uuid, uuid, uuid, text, text, uuid, numeric, text, text, text, uuid);

create or replace function public.record_application_review_atomic(
  p_case_id uuid,
  p_reviewer_id uuid,
  p_decision public.application_review_state,
  p_reason text,
  p_expected_state public.application_review_state,
  p_idempotency_key text,
  p_is_reopen boolean default false
)
returns table(
  prior_state public.application_review_state,
  resulting_state public.application_review_state,
  application_state public.application_state,
  payment_state public.payment_state,
  membership_state public.membership_state
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case public.recipient_cases%rowtype;
  v_prior public.application_review_state;
  v_submission_id uuid;
begin
  if exists (
    select 1 from public.application_review_decisions
    where idempotency_key = p_idempotency_key
  ) then
    raise exception 'This review decision has already been recorded';
  end if;

  select * into v_case
  from public.recipient_cases
  where id = p_case_id
  for update;
  if not found then raise exception 'Case not found'; end if;

  v_prior := v_case.application_review_state;
  if v_prior <> p_expected_state then
    raise exception 'This application moved to "%" since it was loaded', v_prior;
  end if;

  if p_is_reopen then
    if v_prior <> 'rejected' or p_decision <> 'pending' then
      raise exception 'Only a rejected application can be reopened';
    end if;
  else
    if p_decision = 'pending' then
      raise exception 'Pending is not a staff review decision';
    end if;
    if not (
      (v_prior = 'pending' and p_decision in ('approved', 'resubmission_requested', 'rejected'))
      or (v_prior = 'approved' and p_decision in ('resubmission_requested', 'rejected'))
    ) then
      raise exception 'Invalid application review transition from % to %', v_prior, p_decision;
    end if;
  end if;

  if (p_is_reopen or p_decision <> 'approved')
     and (p_reason is null or length(pg_catalog.btrim(p_reason)) < 10) then
    raise exception 'A clear applicant-safe reason is required';
  end if;

  select id into v_submission_id
  from public.application_submissions
  where case_id = p_case_id and is_current = true;

  insert into public.application_review_decisions (
    case_id, campaign_id, submission_id, reviewer_id, decision,
    prior_state, resulting_state, reason, is_reopen, idempotency_key
  ) values (
    p_case_id, v_case.campaign_id, v_submission_id, p_reviewer_id, p_decision,
    v_prior, p_decision, nullif(pg_catalog.btrim(p_reason), ''), p_is_reopen,
    p_idempotency_key
  );

  update public.recipient_cases as c
  set
    application_review_state = p_decision,
    application_state = case
      when p_decision = 'resubmission_requested'
        then 'correction_needed'::public.application_state
      else c.application_state
    end
  where id = p_case_id;

  if p_decision = 'resubmission_requested' and v_submission_id is not null then
    update public.application_submissions
    set correction_reason = pg_catalog.btrim(p_reason)
    where id = v_submission_id;
  end if;

  select * into v_case
  from public.recipient_cases
  where id = p_case_id;

  insert into public.audit_events (
    event_type, actor_id, actor_type, target_type, target_id, case_id,
    campaign_id, action, details, severity
  ) values (
    'data_correction', p_reviewer_id, 'user', 'application_review', p_case_id,
    p_case_id, v_case.campaign_id,
    case when p_is_reopen then 'Reopened a rejected application'
         else 'Application review decision: ' || p_decision::text end,
    pg_catalog.jsonb_build_object(
      'prior_state', v_prior,
      'resulting_state', p_decision,
      'reason', nullif(pg_catalog.btrim(p_reason), ''),
      'submission_id', v_submission_id,
      'is_reopen', p_is_reopen,
      'payment_state', v_case.payment_state,
      'membership_state', v_case.membership_state
    ),
    case when p_is_reopen or p_decision = 'rejected' then 'critical' else 'warning' end
  );

  return query select
    v_prior,
    v_case.application_review_state,
    v_case.application_state,
    v_case.payment_state,
    v_case.membership_state;
end;
$$;

create or replace function public.verify_payment_evidence_atomic(
  p_payment_intent_id uuid,
  p_evidence_version_id uuid,
  p_verified_by uuid,
  p_verification_source text,
  p_expected_state public.payment_state,
  p_verification_evidence jsonb default null
)
returns table(
  case_id uuid,
  payment_state public.payment_state,
  membership_state public.membership_state
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_intent public.payment_intents%rowtype;
  v_version public.payment_evidence_versions%rowtype;
  v_case public.recipient_cases%rowtype;
begin
  select * into v_intent
  from public.payment_intents
  where id = p_payment_intent_id
  for update;
  if not found then raise exception 'Payment intent not found'; end if;
  if v_intent.state <> p_expected_state then
    raise exception 'This payment moved to "%" since it was loaded', v_intent.state;
  end if;
  if v_intent.state not in ('payer_marked_paid', 'verification_pending') then
    raise exception 'Payment intent is not verifiable from its current state';
  end if;

  select * into v_version
  from public.payment_evidence_versions
  where id = p_evidence_version_id
    and payment_intent_id = p_payment_intent_id
  for update;
  if not found then raise exception 'Payment evidence version not found'; end if;
  if v_version.state <> 'verification_pending' then
    raise exception 'Payment evidence version is not pending verification';
  end if;

  update public.payment_evidence_versions
  set state = 'verified', reviewed_by = p_verified_by, reviewed_at = pg_catalog.now()
  where id = p_evidence_version_id;

  update public.payment_evidence
  set is_verified = true, confirmed_at = pg_catalog.now(), confirmed_by = p_verified_by
  where id = v_version.payment_evidence_id;

  update public.payment_intents
  set state = 'verified_by_official_source',
      verified_at = pg_catalog.now(),
      verified_by = p_verified_by,
      verification_source = p_verification_source,
      verification_evidence = p_verification_evidence
  where id = p_payment_intent_id;

  select * into v_case
  from public.recipient_cases
  where id = v_intent.case_id
  for update;

  update public.recipient_cases
  set payment_state = 'verified_by_official_source'
  where id = v_intent.case_id;

  select * into v_case from public.recipient_cases where id = v_intent.case_id;

  insert into public.audit_events (
    event_type, actor_id, actor_type, target_type, target_id, case_id,
    campaign_id, action, details
  ) values (
    'payment_status_change', p_verified_by, 'user', 'payment_intent',
    p_payment_intent_id, v_intent.case_id, v_intent.campaign_id,
    'Verified payment evidence',
    pg_catalog.jsonb_build_object(
      'prior_state', v_intent.state,
      'resulting_state', 'verified_by_official_source',
      'evidence_version_id', p_evidence_version_id,
      'verification_source', p_verification_source,
      'membership_unchanged', v_case.membership_state
    )
  );

  return query select
    v_intent.case_id,
    v_case.payment_state,
    v_case.membership_state;
end;
$$;

create or replace function public.submit_member_correction_atomic(
  p_case_id uuid,
  p_profile_data jsonb,
  p_idempotency_key text,
  p_request_hash text
)
returns table(
  submission_id uuid,
  previous_submission_id uuid,
  review_state public.application_review_state,
  payment_state public.payment_state,
  membership_state public.membership_state
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case public.recipient_cases%rowtype;
  v_current public.application_submissions%rowtype;
  v_submission_id uuid := extensions.uuid_generate_v4();
begin
  if p_profile_data is null or jsonb_typeof(p_profile_data) <> 'object' then
    raise exception 'Correction profile must be a JSON object';
  end if;
  if p_idempotency_key is null or length(pg_catalog.btrim(p_idempotency_key)) < 8 then
    raise exception 'A valid idempotency key is required';
  end if;
  if p_request_hash is null or length(p_request_hash) <> 64 then
    raise exception 'A valid request hash is required';
  end if;
  if exists (
    select 1 from public.application_submissions
    where idempotency_key = p_idempotency_key
  ) then
    raise exception 'This correction has already been submitted';
  end if;

  select * into v_case
  from public.recipient_cases
  where id = p_case_id
  for update;
  if not found then raise exception 'Case not found'; end if;

  if v_case.consent_state <> 'agreed' then
    raise exception 'Active consent is required';
  end if;
  if v_case.application_state <> 'correction_needed'
     or v_case.application_review_state <> 'resubmission_requested' then
    raise exception 'A correction has not been requested for this application';
  end if;

  select * into v_current
  from public.application_submissions
  where case_id = p_case_id and is_current = true
  for update;
  if not found then raise exception 'There is no submission to correct'; end if;

  update public.recipient_profiles
  set
    first_name = p_profile_data->>'first_name',
    middle_name = nullif(p_profile_data->>'middle_name', ''),
    last_name = p_profile_data->>'last_name',
    date_of_birth = (p_profile_data->>'date_of_birth')::date,
    sex = p_profile_data->>'sex',
    civil_status = nullif(p_profile_data->>'civil_status', ''),
    address_line1 = p_profile_data->>'address_line1',
    address_line2 = nullif(p_profile_data->>'address_line2', ''),
    city = p_profile_data->>'city',
    province = p_profile_data->>'province',
    zip_code = p_profile_data->>'zip_code',
    mobile_number = p_profile_data->>'mobile_number',
    email = nullif(p_profile_data->>'email', '')
  where case_id = p_case_id;
  if not found then raise exception 'Recipient profile not found'; end if;

  update public.application_submissions
  set is_current = false
  where id = v_current.id;

  insert into public.application_submissions (
    id, case_id, application_ref, submitted_data, consent_record_id,
    content_versions_seen, privacy_notice_version_id, comprehension_score,
    comprehension_passed, submitted_by, original_submission_id,
    correction_reason, idempotency_key, request_hash, is_current
  ) values (
    v_submission_id, p_case_id, v_current.application_ref, p_profile_data,
    v_current.consent_record_id, v_current.content_versions_seen,
    v_current.privacy_notice_version_id, v_current.comprehension_score,
    v_current.comprehension_passed, 'recipient', v_current.id,
    v_current.correction_reason, p_idempotency_key, p_request_hash, true
  );

  update public.recipient_cases
  set application_state = 'resubmitted',
      application_review_state = 'pending'
  where id = p_case_id;

  insert into public.audit_events (
    event_type, actor_id, actor_type, target_type, target_id, case_id,
    campaign_id, action, details, severity
  ) values (
    'application_submit', null, 'anonymous', 'application_submission',
    v_submission_id, p_case_id, v_case.campaign_id,
    'Applicant submitted a correction',
    pg_catalog.jsonb_build_object(
      'prior_state', v_case.application_review_state,
      'resulting_state', 'pending',
      'superseded_submission_id', v_current.id,
      'fields_submitted', (
        select coalesce(pg_catalog.jsonb_agg(key order by key), '[]'::jsonb)
        from pg_catalog.jsonb_object_keys(p_profile_data) as key
      )
    ),
    'info'
  );

  return query
  select
    v_submission_id,
    v_current.id,
    'pending'::public.application_review_state,
    v_case.payment_state,
    v_case.membership_state;
end;
$$;

create or replace function public.create_payment_intent_atomic(
  p_payment_intent_id uuid,
  p_case_id uuid,
  p_campaign_id uuid,
  p_payer_type text,
  p_payer_name text,
  p_expected_amount numeric,
  p_payment_route text,
  p_idempotency_key text,
  p_request_hash text,
  p_actor_id uuid
)
returns table(payment_intent_id uuid, status text)
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

  select * into v_existing
  from public.payment_intents
  where idempotency_key = p_idempotency_key;
  if found then
    if v_existing.request_hash <> p_request_hash then
      raise exception 'Idempotency key was already used with a different payment request';
    end if;
    return query select v_existing.id, 'exists'::text;
    return;
  end if;

  select * into v_case
  from public.recipient_cases
  where id = p_case_id
  for update;
  if not found then raise exception 'Case not found'; end if;
  if v_case.auth_user_id is distinct from p_actor_id then
    raise exception 'Payment case ownership required';
  end if;
  if v_case.campaign_id <> p_campaign_id then
    raise exception 'Payment campaign does not match the application';
  end if;
  if v_case.consent_state <> 'agreed' then
    raise exception 'Cannot create payment: consent must be active';
  end if;
  if v_case.application_state not in ('submitted', 'resubmitted') then
    raise exception 'Cannot create payment: application must be submitted first';
  end if;

  select * into v_campaign
  from public.pilot_campaigns
  where id = p_campaign_id and is_active = true
  for share;
  if not found then raise exception 'Campaign is not active'; end if;
  if v_campaign.membership_fee <> p_expected_amount then
    raise exception 'Payment amount does not match the approved campaign fee';
  end if;

  v_approval_type := case
    when p_payment_route like 'bank_transfer_%' then 'bank_transfer'
    else p_payment_route
  end;
  if not exists (
    select 1
    from pg_catalog.jsonb_array_elements(v_campaign.approved_payment_routes) route
    where route->>'type' = v_approval_type
      and coalesce((route->>'is_active')::boolean, false)
  ) then
    raise exception 'Payment route is not approved for this campaign';
  end if;

  if p_payer_type not in ('guardian', 'other') then
    raise exception 'Unsupported payer type %', p_payer_type;
  end if;

  insert into public.payment_intents (
    id, case_id, campaign_id, payer_type, payer_name,
    expected_amount, currency, payment_route, state, handoff_opened_at,
    idempotency_key, request_hash
  ) values (
    p_payment_intent_id, p_case_id, p_campaign_id, p_payer_type, p_payer_name,
    v_campaign.membership_fee, 'PHP', p_payment_route,
    'official_handoff_opened', pg_catalog.now(), p_idempotency_key, p_request_hash
  );

  update public.recipient_cases
  set payment_state = 'official_handoff_opened'
  where id = p_case_id;

  insert into public.audit_events (
    event_type, actor_id, actor_type, target_type, target_id, case_id,
    campaign_id, action, details
  ) values (
    'payment_status_change', p_actor_id, 'anonymous', 'payment_intent',
    p_payment_intent_id, p_case_id, p_campaign_id, 'Payment handoff opened',
    pg_catalog.jsonb_build_object(
      'prior_state', v_case.payment_state,
      'resulting_state', 'official_handoff_opened',
      'payer_type', p_payer_type,
      'expected_amount', v_campaign.membership_fee,
      'payment_route', p_payment_route,
      'direct_gateway_integration', false
    )
  );

  return query select p_payment_intent_id, 'created'::text;
end;
$$;


-- The approving administrator verifies payment inside the approval; the
-- separate reupload request stays for asking an applicant for a new proof.
-- (request_payment_evidence_reupload_atomic is unchanged.)

-- Staff role changes no longer treat the retired prc_liaison role as privileged.
create or replace function public.assign_staff_role_atomic(
  p_actor_id uuid,
  p_user_id uuid,
  p_role public.staff_role,
  p_organization_id uuid,
  p_campaign_id uuid,
  p_reason text
)
returns table(role_assignment_id uuid, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_assignment_id uuid;
  v_actor_is_admin boolean;
  v_actor_is_privacy_admin boolean;
begin
  if (p_organization_id is null) = (p_campaign_id is null) then
    raise exception 'Exactly one role scope is required';
  end if;
  if p_reason is null or length(pg_catalog.btrim(p_reason)) < 10 then
    raise exception 'A clear audit reason is required';
  end if;

  if p_campaign_id is not null then
    select organization_id into v_organization_id
    from public.pilot_campaigns where id = p_campaign_id;
    if not found then raise exception 'Campaign not found'; end if;
  else
    select id into v_organization_id
    from public.organizations where id = p_organization_id;
    if not found then raise exception 'Organization not found'; end if;
  end if;

  select exists (
    select 1 from public.role_assignments ra
    where ra.user_id = p_actor_id
      and ra.role in ('privacy_admin_owner', 'school_admin')
      and ra.is_active and ra.revoked_at is null
      and (
        (p_campaign_id is not null and (
          ra.campaign_id = p_campaign_id
          or (ra.campaign_id is null and ra.organization_id = v_organization_id)
        ))
        or (p_campaign_id is null and ra.campaign_id is null
          and ra.organization_id = v_organization_id)
      )
  ), exists (
    select 1 from public.role_assignments ra
    where ra.user_id = p_actor_id
      and ra.role = 'privacy_admin_owner'
      and ra.is_active and ra.revoked_at is null
      and (
        (p_campaign_id is not null and (
          ra.campaign_id = p_campaign_id
          or (ra.campaign_id is null and ra.organization_id = v_organization_id)
        ))
        or (p_campaign_id is null and ra.campaign_id is null
          and ra.organization_id = v_organization_id)
      )
  ) into v_actor_is_admin, v_actor_is_privacy_admin;

  if not v_actor_is_admin then raise exception 'Administrator role required for this scope'; end if;
  if p_role in ('privacy_admin_owner', 'school_admin')
     and not v_actor_is_privacy_admin then
    raise exception 'Privacy administrator role required for privileged role changes';
  end if;
  if not exists (select 1 from public.users where id = p_user_id and is_active) then
    raise exception 'Target staff user is not active';
  end if;

  select id into v_assignment_id
  from public.role_assignments
  where user_id = p_user_id and role = p_role
    and is_active and revoked_at is null
    and campaign_id is not distinct from p_campaign_id
    and organization_id is not distinct from p_organization_id
  for update;
  if found then
    return query select v_assignment_id, 'already_assigned'::text;
    return;
  end if;

  v_assignment_id := extensions.uuid_generate_v4();
  insert into public.role_assignments (
    id, user_id, role, organization_id, campaign_id, granted_by, reason
  ) values (
    v_assignment_id, p_user_id, p_role, p_organization_id, p_campaign_id,
    p_actor_id, pg_catalog.btrim(p_reason)
  );

  insert into public.audit_events (
    event_type, actor_id, actor_type, target_type, target_id,
    campaign_id, action, details
  ) values (
    'role_change', p_actor_id, 'user', 'role_assignment', v_assignment_id,
    p_campaign_id, 'Assigned staff role ' || p_role::text,
    pg_catalog.jsonb_build_object(
      'role', p_role,
      'target_user_id', p_user_id,
      'campaign_id', p_campaign_id,
      'organization_id', p_organization_id,
      'reason', pg_catalog.btrim(p_reason)
    )
  );

  return query select v_assignment_id, 'assigned'::text;
end;
$$;

create or replace function public.revoke_staff_role_atomic(
  p_actor_id uuid,
  p_role_assignment_id uuid,
  p_reason text
)
returns table(role_assignment_id uuid, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment public.role_assignments%rowtype;
  v_organization_id uuid;
  v_actor_is_admin boolean;
  v_actor_is_privacy_admin boolean;
  v_owner_count integer;
begin
  if p_reason is null or length(pg_catalog.btrim(p_reason)) < 10 then
    raise exception 'A clear audit reason is required';
  end if;

  select * into v_assignment
  from public.role_assignments
  where id = p_role_assignment_id and is_active and revoked_at is null
  for update;
  if not found then raise exception 'Active role assignment not found'; end if;
  if v_assignment.user_id = p_actor_id then
    raise exception 'Administrators cannot revoke their own active role';
  end if;

  if v_assignment.campaign_id is not null then
    select organization_id into v_organization_id
    from public.pilot_campaigns where id = v_assignment.campaign_id;
  else
    v_organization_id := v_assignment.organization_id;
  end if;

  select exists (
    select 1 from public.role_assignments ra
    where ra.user_id = p_actor_id
      and ra.role in ('privacy_admin_owner', 'school_admin')
      and ra.is_active and ra.revoked_at is null
      and (
        (v_assignment.campaign_id is not null and (
          ra.campaign_id = v_assignment.campaign_id
          or (ra.campaign_id is null and ra.organization_id = v_organization_id)
        ))
        or (v_assignment.campaign_id is null and ra.campaign_id is null
          and ra.organization_id = v_organization_id)
      )
  ), exists (
    select 1 from public.role_assignments ra
    where ra.user_id = p_actor_id
      and ra.role = 'privacy_admin_owner'
      and ra.is_active and ra.revoked_at is null
      and (
        (v_assignment.campaign_id is not null and (
          ra.campaign_id = v_assignment.campaign_id
          or (ra.campaign_id is null and ra.organization_id = v_organization_id)
        ))
        or (v_assignment.campaign_id is null and ra.campaign_id is null
          and ra.organization_id = v_organization_id)
      )
  ) into v_actor_is_admin, v_actor_is_privacy_admin;

  if not v_actor_is_admin then raise exception 'Administrator role required for this scope'; end if;
  if v_assignment.role in ('privacy_admin_owner', 'school_admin')
     and not v_actor_is_privacy_admin then
    raise exception 'Privacy administrator role required for privileged role changes';
  end if;

  if v_assignment.role = 'privacy_admin_owner' then
    if v_assignment.campaign_id is not null then
      select count(*)::integer into v_owner_count
      from public.role_assignments ra
      where ra.role = 'privacy_admin_owner' and ra.is_active and ra.revoked_at is null
        and (
          ra.campaign_id = v_assignment.campaign_id
          or (ra.campaign_id is null and ra.organization_id = v_organization_id)
        );
    else
      select count(*)::integer into v_owner_count
      from public.role_assignments ra
      where ra.role = 'privacy_admin_owner' and ra.is_active and ra.revoked_at is null
        and ra.campaign_id is null and ra.organization_id = v_organization_id;
    end if;
    if v_owner_count <= 1 then raise exception 'The last privacy administrator cannot be revoked'; end if;
  end if;

  update public.role_assignments
  set is_active = false,
      revoked_at = pg_catalog.now(),
      revoked_by = p_actor_id,
      reason = pg_catalog.btrim(p_reason)
  where id = p_role_assignment_id;

  insert into public.audit_events (
    event_type, actor_id, actor_type, target_type, target_id,
    campaign_id, action, details, severity
  ) values (
    'role_change', p_actor_id, 'user', 'role_assignment', p_role_assignment_id,
    v_assignment.campaign_id, 'Revoked staff role ' || v_assignment.role::text,
    pg_catalog.jsonb_build_object(
      'role', v_assignment.role,
      'target_user_id', v_assignment.user_id,
      'campaign_id', v_assignment.campaign_id,
      'organization_id', v_assignment.organization_id,
      'reason', pg_catalog.btrim(p_reason)
    ),
    'warning'
  );

  return query select p_role_assignment_id, 'revoked'::text;
end;
$$;

revoke all on function public.record_application_review_atomic(uuid, uuid, public.application_review_state, text, public.application_review_state, text, boolean) from public, anon, authenticated;
revoke all on function public.verify_payment_evidence_atomic(uuid, uuid, uuid, text, public.payment_state, jsonb) from public, anon, authenticated;
revoke all on function public.submit_member_correction_atomic(uuid, jsonb, text, text) from public, anon, authenticated;
revoke all on function public.create_payment_intent_atomic(uuid, uuid, uuid, text, text, numeric, text, text, text, uuid) from public, anon, authenticated;
grant execute on function public.record_application_review_atomic(uuid, uuid, public.application_review_state, text, public.application_review_state, text, boolean) to service_role;
grant execute on function public.verify_payment_evidence_atomic(uuid, uuid, uuid, text, public.payment_state, jsonb) to service_role;
grant execute on function public.submit_member_correction_atomic(uuid, jsonb, text, text) to service_role;
grant execute on function public.create_payment_intent_atomic(uuid, uuid, uuid, text, text, numeric, text, text, text, uuid) to service_role;

-- ============================================================
-- 9. Views and dashboard functions rebuilt without prc_handoff_state
-- ============================================================
create view public.admin_case_queue_view as
select
  c.id,
  c.campaign_id,
  c.application_ref,
  c.consent_state,
  c.application_state,
  c.payment_state,
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

revoke all on public.admin_case_queue_view from public, anon, authenticated;
grant select on public.admin_case_queue_view to service_role;

create view public.application_review_context as
select
  c.id                            as case_id,
  c.campaign_id,
  c.application_ref,
  c.consent_state,
  c.application_state,
  c.application_review_state,
  c.payment_state,
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
    'approved',                 count(*) filter (where application_review_state = 'approved')
  )
  from public.recipient_cases
  where campaign_id = p_campaign_id
    and is_active = true;
$$;

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
                        or application_review_state <> 'pending'
                        or membership_state <> 'not_active'),
    count(*) filter (where payment_state = 'verified_by_official_source'),
    count(*) filter (where created_at >= now() - interval '7 days'),
    count(*) filter (where created_at >= now() - interval '30 days')
  into v_started, v_submitted, v_payment_verified, v_intake_7d, v_intake_30d
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
      'submitted_to_payment_verified',  public.admin_safe_rate(v_payment_verified, v_submitted)
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

revoke all on function public.admin_dashboard_counts(uuid) from public, anon, authenticated;
revoke all on function public.admin_campaign_analytics(uuid) from public, anon, authenticated;
grant execute on function public.admin_dashboard_counts(uuid) to service_role;
grant execute on function public.admin_campaign_analytics(uuid) to service_role;

-- ============================================================
-- 10. The PRC handoff state type goes last, once nothing references it
-- ============================================================
drop type if exists public.prc_handoff_state;

-- ============================================================
-- 11. Post-conditions: fail the migration if anything kept is missing or
--     anything removed is still there.
-- ============================================================
do $$
declare
  v_missing text[];
  v_present text[];
begin
  select array_agg(name order by name) into v_missing
  from unnest(array[
    'recipient_cases', 'recipient_profiles', 'consent_records',
    'application_submissions', 'application_review_decisions',
    'payment_intents', 'payment_evidence', 'payment_evidence_versions',
    'audit_events', 'membership_status_events', 'users', 'role_assignments',
    'pilot_campaigns', 'admin_case_queue_view', 'application_review_context'
  ]) as name
  where to_regclass(format('public.%I', name)) is null;
  if coalesce(cardinality(v_missing), 0) > 0 then
    raise exception 'Kept relations are missing after the removal: %', v_missing;
  end if;

  select array_agg(name order by name) into v_present
  from unnest(array['sponsors', 'referral_links', 'relationships', 'prc_export_batches', 'prc_export_items']) as name
  where to_regclass(format('public.%I', name)) is not null;
  if coalesce(cardinality(v_present), 0) > 0 then
    raise exception 'Removed relations are still present: %', v_present;
  end if;

  -- The immutability triggers on the kept evidence must still be in place.
  if (select count(*) from pg_trigger
      where not tgisinternal
        and tgname in (
          'trg_audit_events_immutable',
          'trg_membership_status_events_immutable',
          'trg_review_decisions_immutable',
          'trg_submission_snapshot_immutable',
          'trg_payment_evidence_snapshot_immutable'
        )) < 5 then
    raise exception 'An immutability trigger is missing after the removal';
  end if;
end;
$$;
