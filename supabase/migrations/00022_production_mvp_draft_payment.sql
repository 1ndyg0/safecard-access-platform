-- Additive production MVP migration. Apply only after verifying the hosted
-- migration history and a recoverable backup. Payment verification, application
-- review and PRC activation remain independent states.

alter table public.recipient_cases
  add column if not exists comprehension_answers jsonb;

alter table public.recipient_cases
  add constraint recipient_cases_comprehension_answers_object
  check (comprehension_answers is null or pg_catalog.jsonb_typeof(comprehension_answers) = 'object');

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
  if v_case.application_state = 'draft' then
    if v_case.comprehension_passed is distinct from true then
      raise exception 'Complete comprehension before payment';
    end if;
    if not exists (
      select 1 from public.recipient_profiles p
      where p.case_id = p_case_id and p.fields_completed = true
        and p.first_name is not null and p.last_name is not null
        and p.date_of_birth is not null and p.sex is not null
        and p.mobile_number is not null and p.address_line1 is not null
        and p.city is not null and p.province is not null and p.zip_code is not null
    ) then
      raise exception 'Complete applicant details before payment';
    end if;
    if p_payment_route not in ('bank_transfer_bpi', 'bank_transfer_bdo', 'bank_transfer_security_bank', 'bank_transfer_metrobank') then
      raise exception 'Choose an approved bank transfer method';
    end if;
  elsif v_case.application_state not in ('submitted', 'resubmitted') then
    raise exception 'Application is not ready for payment';
  end if;
  if p_payment_route not in ('bank_transfer_bpi', 'bank_transfer_bdo', 'bank_transfer_security_bank', 'bank_transfer_metrobank') then
    raise exception 'Choose an approved bank transfer method';
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
    p_payment_intent_id, p_case_id, p_campaign_id, 'Manual payment handoff opened',
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

revoke all on function public.create_payment_intent_atomic(uuid, uuid, uuid, text, text, uuid, numeric, text, text, text, uuid)
  from public, anon, authenticated;
grant execute on function public.create_payment_intent_atomic(uuid, uuid, uuid, text, text, uuid, numeric, text, text, text, uuid)
  to service_role;
