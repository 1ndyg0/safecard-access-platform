-- SafeCard Access Platform
-- Migration 00015: transactional PRC export and acknowledgement

create or replace function public.create_prc_export_batch_atomic(
  p_batch_id uuid,
  p_campaign_id uuid,
  p_batch_ref text,
  p_created_by uuid,
  p_creation_reason text,
  p_reauth_method text,
  p_column_order jsonb,
  p_checksum text,
  p_format text,
  p_case_ids uuid[],
  p_submission_ids uuid[],
  p_original_values jsonb,
  p_actor_ip_hash text default null
)
returns table(batch_id uuid, record_count integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_expected integer;
  v_eligible integer;
  v_updated integer;
  v_index integer;
begin
  v_expected := coalesce(pg_catalog.array_length(p_case_ids, 1), 0);
  if v_expected = 0 or v_expected > 100 then
    raise exception 'Export requires between 1 and 100 cases';
  end if;
  if pg_catalog.array_length(p_submission_ids, 1) <> v_expected
     or pg_catalog.jsonb_typeof(p_original_values) <> 'array'
     or pg_catalog.jsonb_array_length(p_original_values) <> v_expected then
    raise exception 'Export rows do not match the selected cases';
  end if;
  if p_creation_reason is null or length(pg_catalog.btrim(p_creation_reason)) < 10 then
    raise exception 'A detailed export reason is required';
  end if;
  if p_format not in ('csv', 'json') or p_reauth_method <> 'mfa' then
    raise exception 'Invalid export format or reauthentication method';
  end if;
  if p_checksum !~ '^[a-f0-9]{64}$' then
    raise exception 'Invalid export checksum';
  end if;

  perform 1
  from public.recipient_cases
  where id = any(p_case_ids)
  order by id
  for update;

  select count(*)::integer into v_eligible
  from public.recipient_cases c
  where c.id = any(p_case_ids)
    and c.campaign_id = p_campaign_id
    and c.is_active = true
    and c.consent_state = 'agreed'
    and c.application_state in ('submitted', 'resubmitted')
    and c.application_review_state = 'approved'
    and c.payment_state = 'verified_by_official_source'
    and c.prc_handoff_state = 'ready_for_export'
    and c.membership_state = 'not_active'
    and exists (
      select 1 from public.application_submissions s
      where s.case_id = c.id and s.is_current = true
        and s.id = p_submission_ids[pg_catalog.array_position(p_case_ids, c.id)]
    )
    and exists (
      select 1 from public.payment_intents pi
      where pi.case_id = c.id and pi.state = 'verified_by_official_source'
    );
  if v_eligible <> v_expected then
    raise exception 'One or more records changed or are not eligible for export';
  end if;

  insert into public.prc_export_batches (
    id, campaign_id, batch_ref, created_by, creation_reason, reauth_method,
    reauth_at, record_count, column_order, checksum, format
  ) values (
    p_batch_id, p_campaign_id, p_batch_ref, p_created_by,
    pg_catalog.btrim(p_creation_reason), p_reauth_method, pg_catalog.now(),
    v_expected, p_column_order, p_checksum, p_format
  );

  for v_index in 1..v_expected loop
    insert into public.prc_export_items (
      batch_id, case_id, submission_id, export_order, prc_status, original_values
    ) values (
      p_batch_id, p_case_ids[v_index], p_submission_ids[v_index],
      v_index - 1, 'pending', p_original_values->(v_index - 1)
    );
  end loop;

  update public.recipient_cases
  set prc_handoff_state = 'exported',
      membership_state = 'pending_prc_confirmation'
  where id = any(p_case_ids)
    and campaign_id = p_campaign_id
    and prc_handoff_state = 'ready_for_export'
    and membership_state = 'not_active';
  get diagnostics v_updated = row_count;
  if v_updated <> v_expected then
    raise exception 'Export state changed while the batch was being created';
  end if;

  insert into public.audit_events (
    event_type, actor_id, actor_type, actor_ip_hash, target_type, target_id,
    campaign_id, action, details
  ) values (
    'export_created', p_created_by, 'user', p_actor_ip_hash,
    'prc_export_batch', p_batch_id, p_campaign_id,
    'Created PRC export batch ' || p_batch_ref,
    pg_catalog.jsonb_build_object(
      'batch_ref', p_batch_ref,
      'record_count', v_expected,
      'format', p_format,
      'checksum', p_checksum,
      'reauth_method', p_reauth_method,
      'case_ids', p_case_ids
    )
  );

  return query select p_batch_id, v_expected;
end;
$$;

create or replace function public.acknowledge_prc_export_item_atomic(
  p_export_item_id uuid,
  p_prc_status text,
  p_prc_notes text,
  p_correction_reason text,
  p_correction_fields jsonb,
  p_prc_membership_id text,
  p_prc_effective_date date,
  p_prc_expiry_date date,
  p_actor_id uuid
)
returns table(
  case_id uuid,
  campaign_id uuid,
  prc_handoff_state public.prc_handoff_state,
  membership_state public.membership_state
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.prc_export_items%rowtype;
  v_case public.recipient_cases%rowtype;
  v_campaign_id uuid;
  v_new_handoff public.prc_handoff_state;
  v_prior_membership public.membership_state;
begin
  select i, b.campaign_id into v_item, v_campaign_id
  from public.prc_export_items i
  join public.prc_export_batches b on b.id = i.batch_id
  where i.id = p_export_item_id
  for update of i;
  if not found then raise exception 'Export item not found'; end if;

  select * into v_case
  from public.recipient_cases
  where id = v_item.case_id
  for update;
  if not found then raise exception 'Case not found'; end if;
  v_prior_membership := v_case.membership_state;

  if p_prc_status not in ('acknowledged', 'correction_requested', 'accepted', 'rejected') then
    raise exception 'Invalid PRC response';
  end if;
  if not (
    (v_item.prc_status = 'pending' and p_prc_status in ('acknowledged', 'correction_requested', 'accepted', 'rejected'))
    or (v_item.prc_status = 'acknowledged' and p_prc_status in ('correction_requested', 'accepted', 'rejected'))
  ) then
    raise exception 'Invalid PRC response transition from % to %', v_item.prc_status, p_prc_status;
  end if;
  if p_prc_status = 'correction_requested'
     and (p_correction_reason is null or length(pg_catalog.btrim(p_correction_reason)) < 10) then
    raise exception 'A clear correction reason is required';
  end if;
  if p_prc_status = 'accepted'
     and (p_prc_membership_id is null or p_prc_effective_date is null) then
    raise exception 'PRC acceptance requires a membership ID and effective date';
  end if;

  v_new_handoff := p_prc_status::public.prc_handoff_state;
  update public.prc_export_items
  set prc_status = p_prc_status,
      prc_responded_at = pg_catalog.now(),
      prc_response_by = p_actor_id::text,
      prc_notes = nullif(pg_catalog.btrim(p_prc_notes), ''),
      correction_reason = nullif(pg_catalog.btrim(p_correction_reason), ''),
      correction_fields = p_correction_fields,
      prc_membership_id = nullif(pg_catalog.btrim(p_prc_membership_id), ''),
      prc_effective_date = p_prc_effective_date,
      prc_expiry_date = p_prc_expiry_date,
      prc_source_timestamp = pg_catalog.now()
  where id = p_export_item_id;

  update public.recipient_cases
  set prc_handoff_state = v_new_handoff,
      application_state = case
        when p_prc_status = 'correction_requested'
          then 'correction_needed'::public.application_state
        else application_state
      end,
      application_review_state = case
        when p_prc_status = 'correction_requested'
          then 'resubmission_requested'::public.application_review_state
        else application_review_state
      end,
      membership_state = case
        when p_prc_status = 'accepted' then 'active_confirmed'::public.membership_state
        when p_prc_status = 'rejected' then 'declined'::public.membership_state
        when p_prc_status = 'correction_requested' then 'not_active'::public.membership_state
        else membership_state
      end
  where id = v_item.case_id;

  if p_prc_status in ('correction_requested', 'accepted', 'rejected') then
    insert into public.membership_status_events (
      case_id, previous_state, new_state, changed_by, change_source,
      prc_export_item_id, prc_membership_id, prc_effective_date,
      prc_expiry_date, reason, evidence
    ) values (
      v_item.case_id, v_case.membership_state,
      case when p_prc_status = 'accepted'
        then 'active_confirmed'::public.membership_state
        when p_prc_status = 'rejected'
        then 'declined'::public.membership_state
        else 'not_active'::public.membership_state end,
      p_actor_id::text,
      case when p_prc_status = 'accepted' then 'prc_confirmation'
           when p_prc_status = 'rejected' then 'prc_rejection'
           else 'prc_correction_request' end,
      p_export_item_id, nullif(pg_catalog.btrim(p_prc_membership_id), ''),
      p_prc_effective_date, p_prc_expiry_date,
      coalesce(nullif(pg_catalog.btrim(p_prc_notes), ''),
        case when p_prc_status = 'accepted' then 'Membership confirmed by PRC'
             when p_prc_status = 'rejected' then 'Rejected by PRC'
             else 'PRC requested an application correction' end),
      case when p_prc_status = 'accepted'
        then pg_catalog.jsonb_build_object('prc_membership_id', p_prc_membership_id)
        else '{}'::jsonb end
    );
  end if;

  select * into v_case from public.recipient_cases where id = v_item.case_id;

  insert into public.audit_events (
    event_type, actor_id, actor_type, target_type, target_id, case_id,
    campaign_id, action, details,
    severity
  ) values (
    'prc_acknowledgment', p_actor_id, 'user', 'prc_export_item',
    p_export_item_id, v_item.case_id, v_campaign_id,
    'PRC response: ' || p_prc_status,
    pg_catalog.jsonb_build_object(
      'prior_status', v_item.prc_status,
      'prc_status', p_prc_status,
      'correction_reason', nullif(pg_catalog.btrim(p_correction_reason), ''),
      'membership_state', v_case.membership_state
    ),
    case when p_prc_status in ('correction_requested', 'accepted', 'rejected') then 'warning' else 'info' end
  );

  if p_prc_status in ('correction_requested', 'accepted', 'rejected') then
    insert into public.audit_events (
      event_type, actor_id, actor_type, target_type, target_id, case_id,
      campaign_id, action, details
    ) values (
      'membership_status_change', p_actor_id, 'user', 'recipient_case',
      v_item.case_id, v_item.case_id, v_campaign_id,
      case when p_prc_status = 'accepted'
        then 'Membership activated from PRC confirmation'
        when p_prc_status = 'rejected'
        then 'Membership declined from PRC rejection'
        else 'Membership returned to inactive for PRC correction' end,
      pg_catalog.jsonb_build_object(
        'prior_state', v_prior_membership,
        'resulting_state', case when p_prc_status = 'accepted' then 'active_confirmed'
                                when p_prc_status = 'rejected' then 'declined'
                                else 'not_active' end,
        'prc_export_item_id', p_export_item_id
      )
    );
  end if;

  return query select v_item.case_id, v_campaign_id, v_case.prc_handoff_state, v_case.membership_state;
end;
$$;

revoke all on function public.create_prc_export_batch_atomic(uuid, uuid, text, uuid, text, text, jsonb, text, text, uuid[], uuid[], jsonb, text) from public, anon, authenticated;
revoke all on function public.acknowledge_prc_export_item_atomic(uuid, text, text, text, jsonb, text, date, date, uuid) from public, anon, authenticated;
grant execute on function public.create_prc_export_batch_atomic(uuid, uuid, text, uuid, text, text, jsonb, text, text, uuid[], uuid[], jsonb, text) to service_role;
grant execute on function public.acknowledge_prc_export_item_atomic(uuid, text, text, text, jsonb, text, date, date, uuid) to service_role;
