-- SafeCard Access Platform
-- Migration 00016: transactional member correction submission
--
-- A correction supersedes one immutable submission, creates the replacement,
-- updates the approved profile fields, resets application review, and appends
-- its audit event. These writes must either all commit or all roll back.

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
  prc_handoff_state public.prc_handoff_state,
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
    v_case.prc_handoff_state,
    v_case.membership_state;
end;
$$;

revoke all on function public.submit_member_correction_atomic(uuid, jsonb, text, text)
  from public, anon, authenticated;
grant execute on function public.submit_member_correction_atomic(uuid, jsonb, text, text)
  to service_role;
