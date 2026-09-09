-- SafeCard Access Platform
-- Migration 00011: atomic payment evidence, application review, and anonymous storyboard analytics

alter type public.audit_event_type add value if not exists 'application_review';

alter table public.recipient_cases
  add column if not exists application_review_state text not null default 'pending'
    check (application_review_state in ('pending', 'approved', 'resubmission_requested', 'rejected')),
  add column if not exists application_reviewed_at timestamptz,
  add column if not exists application_reviewed_by uuid references public.users(id),
  add column if not exists application_review_reason text;

create index if not exists idx_recipient_cases_review_state
  on public.recipient_cases(campaign_id, application_review_state, updated_at);

create table if not exists public.storyboard_events (
  id uuid primary key default extensions.uuid_generate_v4(),
  event_type text not null check (event_type in ('benefit_opened', 'benefit_closed', 'story_completed', 'hotline_action_selected')),
  benefit_id text not null check (benefit_id in ('ambulance', 'blood', 'hospital', 'exclusions')),
  locale text not null check (locale in ('fil', 'en')),
  data_mode text not null check (data_mode in ('synthetic', 'live')),
  duration_ms integer check (duration_ms is null or (duration_ms >= 0 and duration_ms <= 3600000)),
  created_at timestamptz not null default now()
);

create index if not exists idx_storyboard_events_created
  on public.storyboard_events(created_at desc, event_type, benefit_id);

alter table public.storyboard_events enable row level security;
revoke all on public.storyboard_events from anon, authenticated;

create or replace function public.submit_application_version(
  p_submission_id uuid,
  p_case_id uuid,
  p_application_ref text,
  p_consent_record_id uuid,
  p_content_versions_seen jsonb,
  p_privacy_notice_version_id uuid,
  p_profile_data jsonb,
  p_comprehension_score integer,
  p_comprehension_passed boolean,
  p_submitted_by text,
  p_assisted_by_name text,
  p_idempotency_key text,
  p_request_hash text
)
returns table(submission_id uuid, application_ref text, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case public.recipient_cases%rowtype;
  v_consent public.consent_records%rowtype;
  v_prior_id uuid;
  v_existing_id uuid;
  v_existing_ref text;
  v_existing_hash text;
  v_target_state public.application_state;
  v_seen_count integer;
begin
  select id, s.application_ref, request_hash
  into v_existing_id, v_existing_ref, v_existing_hash
  from public.application_submissions s
  where idempotency_key = p_idempotency_key;

  if v_existing_id is not null then
    if v_existing_hash <> p_request_hash then raise exception 'Idempotency key conflict'; end if;
    return query select v_existing_id, v_existing_ref, 'exists'::text;
    return;
  end if;

  if p_submitted_by not in ('recipient', 'assisted_entry') then
    raise exception 'Invalid submission actor';
  end if;
  if jsonb_typeof(p_content_versions_seen) <> 'array' or jsonb_array_length(p_content_versions_seen) = 0 then
    raise exception 'Approved content version references are required';
  end if;

  select * into v_case from public.recipient_cases where id = p_case_id for update;
  if not found then raise exception 'Case not found'; end if;
  if v_case.consent_state <> 'agreed' then raise exception 'Cannot submit: consent must be granted first'; end if;

  select * into v_consent from public.consent_records
  where id = p_consent_record_id and case_id = p_case_id and state = 'agreed';
  if not found or v_consent.privacy_notice_version_id <> p_privacy_notice_version_id then
    raise exception 'Active consent record does not match this application';
  end if;
  if not p_content_versions_seen ? p_privacy_notice_version_id::text
     or not p_content_versions_seen ? v_consent.consent_content_version_id::text then
    raise exception 'Consent and privacy content must be included in content versions seen';
  end if;

  select count(distinct cv.id)::integer into v_seen_count
  from public.content_versions cv
  where cv.id in (select value::uuid from jsonb_array_elements_text(p_content_versions_seen))
    and cv.approval_status = 'approved'
    and cv.is_published = true;
  if v_seen_count <> jsonb_array_length(p_content_versions_seen) then
    raise exception 'All content versions seen must still be approved and published';
  end if;

  if v_case.application_state = 'draft' then
    v_target_state := 'submitted'::public.application_state;
  elsif v_case.application_state = 'correction_needed' then
    v_target_state := 'resubmitted'::public.application_state;
  else
    raise exception 'Application is not ready for submission';
  end if;

  update public.recipient_profiles set
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
    email = nullif(p_profile_data->>'email', '')::extensions.citext,
    fields_completed = true
  where case_id = p_case_id;

  select id into v_prior_id from public.application_submissions
  where case_id = p_case_id and is_current = true for update;
  if v_prior_id is not null then
    update public.application_submissions set is_current = false where id = v_prior_id;
  end if;

  insert into public.application_submissions (
    id, case_id, application_ref, submitted_data, consent_record_id,
    content_versions_seen, privacy_notice_version_id, comprehension_score,
    comprehension_passed, submitted_by, assisted_by_name, original_submission_id,
    idempotency_key, request_hash, is_current
  ) values (
    p_submission_id, p_case_id, p_application_ref, p_profile_data, p_consent_record_id,
    p_content_versions_seen, p_privacy_notice_version_id, p_comprehension_score,
    p_comprehension_passed, p_submitted_by, p_assisted_by_name, v_prior_id,
    p_idempotency_key, p_request_hash, true
  );

  update public.recipient_cases set
    application_ref = p_application_ref,
    application_state = v_target_state,
    application_review_state = 'pending',
    application_reviewed_at = null,
    application_reviewed_by = null,
    application_review_reason = null,
    prc_handoff_state = case
      when prc_handoff_state = 'ready_for_export' then 'not_ready'::public.prc_handoff_state
      else prc_handoff_state
    end
  where id = p_case_id;

  return query select p_submission_id, p_application_ref, 'created'::text;
end;
$$;

create or replace function public.create_payment_intent_with_case_state(
  p_payment_intent_id uuid,
  p_case_id uuid,
  p_campaign_id uuid,
  p_payer_type text,
  p_payer_name text,
  p_payer_sponsor_id uuid,
  p_expected_amount numeric,
  p_payment_route text,
  p_idempotency_key text,
  p_request_hash text
)
returns table(payment_intent_id uuid, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case public.recipient_cases%rowtype;
  v_existing_id uuid;
  v_existing_hash text;
begin
  select id, request_hash into v_existing_id, v_existing_hash
  from public.payment_intents where idempotency_key = p_idempotency_key;
  if v_existing_id is not null then
    if v_existing_hash <> p_request_hash then
      raise exception 'Idempotency key was already used with a different payment request';
    end if;
    return query select v_existing_id, 'exists'::text;
    return;
  end if;

  select * into v_case from public.recipient_cases where id = p_case_id for update;
  if not found then raise exception 'Case not found'; end if;
  if v_case.campaign_id <> p_campaign_id then raise exception 'Payment campaign does not match the application'; end if;
  if v_case.consent_state <> 'agreed' then raise exception 'Cannot create payment: consent must be active'; end if;
  if v_case.application_state not in ('submitted', 'resubmitted') then
    raise exception 'Cannot create payment: application must be submitted first';
  end if;

  insert into public.payment_intents (
    id, case_id, campaign_id, payer_type, payer_name, payer_sponsor_id,
    expected_amount, currency, payment_route, state, handoff_opened_at,
    idempotency_key, request_hash
  ) values (
    p_payment_intent_id, p_case_id, p_campaign_id, p_payer_type, p_payer_name,
    p_payer_sponsor_id, p_expected_amount, 'PHP', p_payment_route,
    'official_handoff_opened', pg_catalog.now(), p_idempotency_key, p_request_hash
  );

  update public.recipient_cases set payment_state = 'official_handoff_opened'
  where id = p_case_id;
  return query select p_payment_intent_id, 'created'::text;
end;
$$;

create or replace function public.mark_payment_paid_with_case_state(
  p_payment_intent_id uuid,
  p_payment_reference text,
  p_payer_declaration text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_intent public.payment_intents%rowtype;
begin
  select * into v_intent from public.payment_intents
  where id = p_payment_intent_id for update;
  if not found then raise exception 'Payment intent not found'; end if;
  if v_intent.state <> 'official_handoff_opened' then
    raise exception 'Payment intent is not ready to be marked paid';
  end if;

  update public.payment_intents set
    state = 'payer_marked_paid',
    payment_reference = p_payment_reference,
    payer_declaration = p_payer_declaration,
    payer_declared_at = pg_catalog.now(),
    payer_marked_paid_at = pg_catalog.now()
  where id = p_payment_intent_id;
  update public.recipient_cases set payment_state = 'payer_marked_paid'
  where id = v_intent.case_id;
  return v_intent.case_id;
end;
$$;

create or replace function public.register_payment_evidence_version(
  p_evidence_id uuid,
  p_payment_intent_id uuid,
  p_case_id uuid,
  p_campaign_id uuid,
  p_reference_number text,
  p_amount numeric,
  p_object_path text,
  p_content_type text,
  p_file_size_bytes bigint,
  p_sha256 text,
  p_image_width integer,
  p_image_height integer,
  p_uploaded_by uuid
)
returns table(evidence_id uuid, version_number integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_intent public.payment_intents%rowtype;
  v_previous public.payment_evidence_versions%rowtype;
  v_version integer;
begin
  select * into v_intent
  from public.payment_intents
  where id = p_payment_intent_id
  for update;

  if not found then raise exception 'Payment intent not found'; end if;
  if v_intent.case_id <> p_case_id or v_intent.campaign_id <> p_campaign_id then
    raise exception 'Payment evidence does not match the application case';
  end if;
  if v_intent.expected_amount <> p_amount then
    raise exception 'Payment evidence amount does not match the payment intent';
  end if;
  if v_intent.state not in ('payer_marked_paid', 'verification_pending') then
    raise exception 'Payment intent is not ready for evidence upload';
  end if;

  select * into v_previous
  from public.payment_evidence_versions
  where payment_intent_id = p_payment_intent_id
  order by version_number desc
  limit 1
  for update;

  v_version := coalesce(v_previous.version_number, 0) + 1;

  insert into public.payment_evidence (
    id, payment_intent_id, evidence_type, reference_number,
    amount_confirmed, currency, source, is_verified, metadata
  ) values (
    p_evidence_id, p_payment_intent_id, 'manual_receipt_reference', p_reference_number,
    p_amount, 'PHP', 'payer_upload', false, '{"upload_metadata_only":true}'::jsonb
  );

  insert into public.payment_evidence_versions (
    id, payment_evidence_id, payment_intent_id, version_number, object_path,
    content_type, file_size_bytes, sha256, image_width, image_height,
    state, uploaded_by, supersedes_id, metadata
  ) values (
    p_evidence_id, p_evidence_id, p_payment_intent_id, v_version, p_object_path,
    p_content_type, p_file_size_bytes, p_sha256, p_image_width, p_image_height,
    'verification_pending', p_uploaded_by, v_previous.id,
    '{"original_filename_omitted":true,"metadata_stripped":true}'::jsonb
  );

  if v_previous.id is not null and v_previous.state <> 'superseded' then
    update public.payment_evidence_versions set state = 'superseded' where id = v_previous.id;
  end if;

  update public.payment_intents
  set state = 'verification_pending', verification_started_at = coalesce(verification_started_at, pg_catalog.now())
  where id = p_payment_intent_id;

  update public.recipient_cases
  set payment_state = 'verification_pending'
  where id = p_case_id;

  return query select p_evidence_id, v_version;
end;
$$;

create or replace function public.verify_payment_with_evidence(
  p_payment_intent_id uuid,
  p_evidence_version_id uuid,
  p_verified_by uuid,
  p_verification_source text,
  p_verification_evidence jsonb default null
)
returns table(case_id uuid, handoff_ready boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_intent public.payment_intents%rowtype;
  v_version public.payment_evidence_versions%rowtype;
  v_review_state text;
begin
  select * into v_intent from public.payment_intents
  where id = p_payment_intent_id for update;
  if not found then raise exception 'Payment intent not found'; end if;
  if v_intent.state not in ('payer_marked_paid', 'verification_pending') then
    raise exception 'Payment intent is not verifiable from its current state';
  end if;

  if p_evidence_version_id is not null then
    select * into v_version from public.payment_evidence_versions
    where id = p_evidence_version_id and payment_intent_id = p_payment_intent_id
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
  end if;

  update public.payment_intents
  set state = 'verified_by_official_source', verified_at = pg_catalog.now(),
      verified_by = p_verified_by, verification_source = p_verification_source,
      verification_evidence = p_verification_evidence
  where id = p_payment_intent_id;

  select application_review_state into v_review_state
  from public.recipient_cases where id = v_intent.case_id for update;

  update public.recipient_cases
  set payment_state = 'verified_by_official_source',
      prc_handoff_state = case when v_review_state = 'approved' then 'ready_for_export'::public.prc_handoff_state else prc_handoff_state end
  where id = v_intent.case_id;

  return query select v_intent.case_id, v_review_state = 'approved';
end;
$$;

create or replace function public.record_application_review(
  p_case_id uuid,
  p_reviewed_by uuid,
  p_decision text,
  p_reason text default null
)
returns table(application_review_state text, application_state public.application_state, handoff_ready boolean)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_case public.recipient_cases%rowtype;
  v_application_state public.application_state;
  v_handoff_ready boolean;
begin
  if p_decision not in ('approved', 'resubmission_requested', 'rejected') then
    raise exception 'Invalid application review decision';
  end if;
  if p_decision <> 'approved' and (p_reason is null or length(trim(p_reason)) < 5) then
    raise exception 'A review reason is required';
  end if;

  select * into v_case from public.recipient_cases where id = p_case_id for update;
  if not found then raise exception 'Case not found'; end if;
  if v_case.application_state not in ('submitted', 'resubmitted', 'correction_needed') then
    raise exception 'Application is not ready for review';
  end if;
  if v_case.prc_handoff_state not in ('not_ready', 'ready_for_export') then
    raise exception 'Application review cannot change after PRC handoff';
  end if;

  v_application_state := case
    when p_decision = 'resubmission_requested' then 'correction_needed'::public.application_state
    else v_case.application_state
  end;
  v_handoff_ready := p_decision = 'approved' and v_case.payment_state = 'verified_by_official_source';

  update public.recipient_cases
  set application_review_state = p_decision,
      application_reviewed_at = pg_catalog.now(),
      application_reviewed_by = p_reviewed_by,
      application_review_reason = nullif(trim(p_reason), ''),
      application_state = v_application_state,
      prc_handoff_state = case
        when v_handoff_ready then 'ready_for_export'::public.prc_handoff_state
        when prc_handoff_state = 'ready_for_export' then 'not_ready'::public.prc_handoff_state
        else prc_handoff_state
      end,
      metadata = coalesce(metadata, '{}'::jsonb) || pg_catalog.jsonb_build_object(
        'application_review_state', p_decision,
        'application_reviewed_at', pg_catalog.now(),
        'application_review_reason', nullif(trim(p_reason), '')
      )
  where id = p_case_id;

  update public.application_submissions
  set correction_reason = case when p_decision = 'resubmission_requested' then p_reason else correction_reason end
  where case_id = p_case_id and is_current = true;

  return query select p_decision, v_application_state, v_handoff_ready;
end;
$$;

revoke all on function public.register_payment_evidence_version(uuid, uuid, uuid, uuid, text, numeric, text, text, bigint, text, integer, integer, uuid) from public, anon, authenticated;
revoke all on function public.verify_payment_with_evidence(uuid, uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.record_application_review(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.submit_application_version(uuid, uuid, text, uuid, jsonb, uuid, jsonb, integer, boolean, text, text, text, text) from public, anon, authenticated;
revoke all on function public.create_payment_intent_with_case_state(uuid, uuid, uuid, text, text, uuid, numeric, text, text, text) from public, anon, authenticated;
revoke all on function public.mark_payment_paid_with_case_state(uuid, text, text) from public, anon, authenticated;
grant execute on function public.register_payment_evidence_version(uuid, uuid, uuid, uuid, text, numeric, text, text, bigint, text, integer, integer, uuid) to service_role;
grant execute on function public.verify_payment_with_evidence(uuid, uuid, uuid, text, jsonb) to service_role;
grant execute on function public.record_application_review(uuid, uuid, text, text) to service_role;
grant execute on function public.submit_application_version(uuid, uuid, text, uuid, jsonb, uuid, jsonb, integer, boolean, text, text, text, text) to service_role;
grant execute on function public.create_payment_intent_with_case_state(uuid, uuid, uuid, text, text, uuid, numeric, text, text, text) to service_role;
grant execute on function public.mark_payment_paid_with_case_state(uuid, text, text) to service_role;
