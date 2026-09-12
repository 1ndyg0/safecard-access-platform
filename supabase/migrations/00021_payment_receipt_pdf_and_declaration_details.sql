-- Forward-only support for PDF receipts and payer-reported payment details.
-- Payment remains unverified until an authorized reviewer accepts an evidence version.

alter table public.payment_intents
  add column if not exists payer_reported_paid_on date,
  add column if not exists payer_reported_amount numeric(10,2)
    check (payer_reported_amount is null or payer_reported_amount > 0);

alter table public.payment_evidence_versions
  drop constraint if exists payment_evidence_versions_content_type_check;
alter table public.payment_evidence_versions
  add constraint payment_evidence_versions_content_type_check
  check (content_type in ('image/jpeg', 'image/png', 'image/webp', 'application/pdf'));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs', 'payment-proofs', false, 10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = excluded.allowed_mime_types;

create or replace function public.mark_payment_paid_atomic(
  p_payment_intent_id uuid,
  p_payment_reference text,
  p_payer_declaration text,
  p_paid_at date,
  p_amount_paid numeric,
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

  if p_paid_at is null or p_paid_at > pg_catalog.now()::date then
    raise exception 'Payment date is required and cannot be in the future';
  end if;
  if p_paid_at < pg_catalog.now()::date - 90 then
    raise exception 'Payment date is outside the 90-day reconciliation window';
  end if;
  if p_amount_paid is null or p_amount_paid <> v_intent.expected_amount then
    raise exception 'Reported payment amount does not match the approved campaign fee';
  end if;

  if v_intent.payer_marked_paid_at is not null then
    if v_intent.payment_reference is distinct from pg_catalog.btrim(p_payment_reference)
       or v_intent.payer_declaration is distinct from p_payer_declaration
       or v_intent.payer_reported_paid_on is distinct from p_paid_at
       or v_intent.payer_reported_amount is distinct from p_amount_paid then
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
      payer_marked_paid_at = pg_catalog.now(),
      payer_reported_paid_on = p_paid_at,
      payer_reported_amount = p_amount_paid
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
      'payer_declaration_recorded', true,
      'payer_reported_paid_on', p_paid_at,
      'payer_reported_amount', p_amount_paid
    )
  );

  return query select v_intent.case_id, 'payer_marked_paid'::public.payment_state;
end;
$$;

revoke all on function public.mark_payment_paid_atomic(uuid,text,text,date,numeric,uuid) from public, anon, authenticated;
grant execute on function public.mark_payment_paid_atomic(uuid,text,text,date,numeric,uuid) to service_role;
revoke all on function public.mark_payment_paid_atomic(uuid,text,text,uuid) from service_role;
drop function if exists public.mark_payment_paid_atomic(uuid,text,text,uuid);
