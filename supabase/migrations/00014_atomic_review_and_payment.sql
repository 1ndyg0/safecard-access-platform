-- SafeCard Access Platform
-- Migration 00014: transactional application-review and payment-reconciliation decisions
--
-- These functions are service-role-only BFF primitives. They lock the relevant
-- records, enforce stale-screen guards, update every related state, and append
-- the audit event in one database transaction. A failed step rolls back all of
-- the others.

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
  prc_handoff_state public.prc_handoff_state,
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
    if v_prior = 'approved'
       and v_case.prc_handoff_state not in ('not_ready', 'ready_for_export') then
      raise exception 'Application review cannot change after PRC handoff has started';
    end if;
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
    end,
    prc_handoff_state = case
      when p_decision = 'approved'
        and c.payment_state = 'verified_by_official_source'
        and c.prc_handoff_state in ('not_ready', 'correction_requested')
        then 'ready_for_export'::public.prc_handoff_state
      when p_decision in ('pending', 'resubmission_requested', 'rejected')
        and c.prc_handoff_state = 'ready_for_export'
        then 'not_ready'::public.prc_handoff_state
      else c.prc_handoff_state
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
      'prc_handoff_state', v_case.prc_handoff_state,
      'membership_state', v_case.membership_state
    ),
    case when p_is_reopen or p_decision = 'rejected' then 'critical' else 'warning' end
  );

  return query select
    v_prior,
    v_case.application_review_state,
    v_case.application_state,
    v_case.payment_state,
    v_case.prc_handoff_state,
    v_case.membership_state;
end;
$$;

create or replace function public.mark_payment_paid_atomic(
  p_payment_intent_id uuid,
  p_payment_reference text,
  p_payer_declaration text,
  p_actor_id uuid
)
returns table(case_id uuid, payment_state public.payment_state)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_intent public.payment_intents%rowtype;
begin
  select * into v_intent
  from public.payment_intents
  where id = p_payment_intent_id
  for update;
  if not found then raise exception 'Payment intent not found'; end if;
  if v_intent.state <> 'official_handoff_opened' then
    raise exception 'Payment intent is not ready to be marked paid';
  end if;

  update public.payment_intents
  set state = 'payer_marked_paid',
      payment_reference = pg_catalog.btrim(p_payment_reference),
      payer_declaration = p_payer_declaration,
      payer_declared_at = pg_catalog.now(),
      payer_marked_paid_at = pg_catalog.now()
  where id = p_payment_intent_id;

  update public.recipient_cases
  set payment_state = 'payer_marked_paid'
  where id = v_intent.case_id;

  insert into public.audit_events (
    event_type, actor_id, actor_type, target_type, target_id, case_id,
    campaign_id, action, details
  ) values (
    'payment_status_change', p_actor_id,
    case when p_actor_id is null then 'anonymous' else 'user' end,
    'payment_intent', p_payment_intent_id, v_intent.case_id,
    v_intent.campaign_id, 'Payment marked as paid',
    pg_catalog.jsonb_build_object(
      'prior_state', v_intent.state,
      'resulting_state', 'payer_marked_paid',
      'payment_reference_recorded', true,
      'payer_declaration_recorded', true
    )
  );

  return query select v_intent.case_id, 'payer_marked_paid'::public.payment_state;
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
  prc_handoff_state public.prc_handoff_state,
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

  update public.recipient_cases as c
  set payment_state = 'verified_by_official_source',
      prc_handoff_state = case
        when c.application_review_state = 'approved' and c.prc_handoff_state = 'not_ready'
          then 'ready_for_export'::public.prc_handoff_state
        else c.prc_handoff_state
      end
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
    v_case.prc_handoff_state,
    v_case.membership_state;
end;
$$;

create or replace function public.request_payment_evidence_reupload_atomic(
  p_payment_intent_id uuid,
  p_evidence_version_id uuid,
  p_requested_by uuid,
  p_reason text,
  p_expected_state public.payment_state
)
returns table(case_id uuid, payment_state public.payment_state, membership_state public.membership_state)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_intent public.payment_intents%rowtype;
  v_version public.payment_evidence_versions%rowtype;
  v_case public.recipient_cases%rowtype;
begin
  if p_reason is null or length(pg_catalog.btrim(p_reason)) < 10 then
    raise exception 'A clear replacement reason is required';
  end if;

  select * into v_intent
  from public.payment_intents
  where id = p_payment_intent_id
  for update;
  if not found then raise exception 'Payment intent not found'; end if;
  if v_intent.state <> p_expected_state then
    raise exception 'This payment moved to "%" since it was loaded', v_intent.state;
  end if;
  if v_intent.state <> 'verification_pending' then
    raise exception 'Payment evidence is not awaiting verification';
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
  set state = 'reupload_requested',
      reviewed_by = p_requested_by,
      reviewed_at = pg_catalog.now(),
      metadata = coalesce(metadata, '{}'::jsonb)
        || pg_catalog.jsonb_build_object('reupload_reason', pg_catalog.btrim(p_reason))
  where id = p_evidence_version_id;

  select * into v_case from public.recipient_cases where id = v_intent.case_id for update;

  insert into public.audit_events (
    event_type, actor_id, actor_type, target_type, target_id, case_id,
    campaign_id, action, details, severity
  ) values (
    'payment_status_change', p_requested_by, 'user', 'payment_evidence_version',
    p_evidence_version_id, v_intent.case_id, v_intent.campaign_id,
    'Requested replacement payment evidence',
    pg_catalog.jsonb_build_object(
      'prior_state', v_version.state,
      'resulting_state', 'reupload_requested',
      'reason', pg_catalog.btrim(p_reason),
      'payment_state', v_case.payment_state,
      'membership_unchanged', v_case.membership_state
    ),
    'warning'
  );

  return query select v_intent.case_id, v_case.payment_state, v_case.membership_state;
end;
$$;

create or replace function public.create_payment_intent_atomic(
  p_payment_intent_id uuid,
  p_case_id uuid,
  p_campaign_id uuid,
  p_payer_type text,
  p_payer_name text,
  p_payer_sponsor_id uuid,
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

  if p_payer_type = 'sponsor' then
    if p_payer_sponsor_id is null or v_case.referral_link_id is null then
      raise exception 'Sponsor payment requires the sponsor linked to this referral';
    end if;
    if not exists (
      select 1
      from public.referral_links rl
      join public.sponsors s on s.id = rl.sponsor_id
      where rl.id = v_case.referral_link_id
        and rl.sponsor_id = p_payer_sponsor_id
        and s.campaign_id = p_campaign_id
        and s.is_active = true
        and (not s.is_minor or s.guardian_approved)
    ) then
      raise exception 'Payer sponsor is not eligible for this application';
    end if;
  elsif p_payer_sponsor_id is not null then
    raise exception 'payer_sponsor_id is only valid when payer_type is sponsor';
  end if;

  insert into public.payment_intents (
    id, case_id, campaign_id, payer_type, payer_name, payer_sponsor_id,
    expected_amount, currency, payment_route, state, handoff_opened_at,
    idempotency_key, request_hash
  ) values (
    p_payment_intent_id, p_case_id, p_campaign_id, p_payer_type, p_payer_name,
    p_payer_sponsor_id, v_campaign.membership_fee, 'PHP', p_payment_route,
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

create or replace function public.register_payment_evidence_atomic(
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

  select * into v_previous
  from public.payment_evidence_versions
  where payment_intent_id = p_payment_intent_id
  order by version_number desc
  limit 1
  for update;

  if v_intent.state = 'payer_marked_paid' then
    if v_previous.id is not null then
      raise exception 'Existing payment evidence must be reviewed before replacement';
    end if;
  elsif v_intent.state = 'verification_pending' then
    if v_previous.id is null or v_previous.state <> 'reupload_requested' then
      raise exception 'Replacement payment evidence has not been requested';
    end if;
  else
    raise exception 'Payment intent is not ready for evidence upload';
  end if;

  v_version := coalesce(v_previous.version_number, 0) + 1;

  insert into public.payment_evidence (
    id, payment_intent_id, evidence_type, reference_number,
    amount_confirmed, currency, source, is_verified, metadata
  ) values (
    p_evidence_id, p_payment_intent_id, 'manual_receipt_reference',
    nullif(pg_catalog.btrim(p_reference_number), ''), p_amount, 'PHP',
    'payer_upload', false, '{"upload_metadata_only":true}'::jsonb
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

  if v_previous.id is not null then
    update public.payment_evidence_versions
    set state = 'superseded'
    where id = v_previous.id;
  end if;

  update public.payment_intents
  set state = 'verification_pending',
      verification_started_at = coalesce(verification_started_at, pg_catalog.now())
  where id = p_payment_intent_id;

  update public.recipient_cases
  set payment_state = 'verification_pending'
  where id = p_case_id;

  insert into public.audit_events (
    event_type, actor_id, actor_type, target_type, target_id, case_id,
    campaign_id, action, details
  ) values (
    'payment_status_change', p_uploaded_by, 'anonymous',
    'payment_evidence_version', p_evidence_id, p_case_id, p_campaign_id,
    'Uploaded payment evidence',
    pg_catalog.jsonb_build_object(
      'version_number', v_version,
      'content_type', p_content_type,
      'size_bytes', p_file_size_bytes,
      'sha256', p_sha256,
      'resulting_payment_state', 'verification_pending'
    )
  );

  return query select p_evidence_id, v_version;
end;
$$;

revoke all on function public.record_application_review_atomic(uuid, uuid, public.application_review_state, text, public.application_review_state, text, boolean) from public, anon, authenticated;
revoke all on function public.create_payment_intent_atomic(uuid, uuid, uuid, text, text, uuid, numeric, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.register_payment_evidence_atomic(uuid, uuid, uuid, uuid, text, numeric, text, text, bigint, text, integer, integer, uuid) from public, anon, authenticated;
revoke all on function public.mark_payment_paid_atomic(uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.verify_payment_evidence_atomic(uuid, uuid, uuid, text, public.payment_state, jsonb) from public, anon, authenticated;
revoke all on function public.request_payment_evidence_reupload_atomic(uuid, uuid, uuid, text, public.payment_state) from public, anon, authenticated;

grant execute on function public.record_application_review_atomic(uuid, uuid, public.application_review_state, text, public.application_review_state, text, boolean) to service_role;
grant execute on function public.create_payment_intent_atomic(uuid, uuid, uuid, text, text, uuid, numeric, text, text, text, uuid) to service_role;
grant execute on function public.register_payment_evidence_atomic(uuid, uuid, uuid, uuid, text, numeric, text, text, bigint, text, integer, integer, uuid) to service_role;
grant execute on function public.mark_payment_paid_atomic(uuid, text, text, uuid) to service_role;
grant execute on function public.verify_payment_evidence_atomic(uuid, uuid, uuid, text, public.payment_state, jsonb) to service_role;
grant execute on function public.request_payment_evidence_reupload_atomic(uuid, uuid, uuid, text, public.payment_state) to service_role;
