-- Forward-only correction: replaying a declaration cannot duplicate audits or rewind state.
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
  -- A retry may arrive after evidence review progressed. Never rewind that state.
  if v_intent.payer_marked_paid_at is not null then
    if v_intent.payment_reference is distinct from pg_catalog.btrim(p_payment_reference)
       or v_intent.payer_declaration is distinct from p_payer_declaration then
      raise exception 'Idempotency key conflict: payment declaration differs from the recorded declaration';
    end if;
    return query select v_intent.case_id, v_intent.state;
    return;
  end if;
  if nullif(pg_catalog.btrim(p_payment_reference), '') is null
     or nullif(pg_catalog.btrim(p_payer_declaration), '') is null then
    raise exception 'Payment declaration requires a reference and confirmation';
  end if;
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

revoke all on function public.mark_payment_paid_atomic(uuid,text,text,uuid) from public, anon, authenticated;
grant execute on function public.mark_payment_paid_atomic(uuid,text,text,uuid) to service_role;
