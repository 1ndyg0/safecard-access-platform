-- SafeCard Access Platform
-- Migration 00020: production reconciliation guard
--
-- Production's legacy pilot created only public.sponsorships, its enum,
-- functions, and policy. Those objects are intentionally retained and are
-- not used by R1. Canonical migrations 00001-00019 create the separate R1
-- schema. This final guard reapplies the private bucket configuration and
-- fails the migration if any required R1 relation or RLS boundary is absent.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'payment-proofs',
  'payment-proofs',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

do $$
declare
  required_relations constant text[] := array[
    'aggregate_metrics',
    'application_review_context',
    'application_review_decisions',
    'application_submissions',
    'audit_events',
    'consent_records',
    'content_versions',
    'jobs',
    'membership_status_events',
    'notification_events',
    'organizations',
    'payment_evidence',
    'payment_evidence_versions',
    'payment_intents',
    'pilot_campaigns',
    'prc_export_batches',
    'prc_export_items',
    'rate_limit_buckets',
    'recipient_cases',
    'recipient_profiles',
    'referral_links',
    'relationships',
    'role_assignments',
    'sponsors',
    'storyboard_events',
    'support_cases',
    'users',
    'admin_case_queue_view'
  ];
  required_rls_tables constant text[] := array[
    'aggregate_metrics',
    'application_review_decisions',
    'application_submissions',
    'audit_events',
    'consent_records',
    'content_versions',
    'jobs',
    'membership_status_events',
    'notification_events',
    'organizations',
    'payment_evidence',
    'payment_evidence_versions',
    'payment_intents',
    'pilot_campaigns',
    'prc_export_batches',
    'prc_export_items',
    'rate_limit_buckets',
    'recipient_cases',
    'recipient_profiles',
    'referral_links',
    'relationships',
    'role_assignments',
    'sponsors',
    'storyboard_events',
    'support_cases',
    'users'
  ];
  missing_relations text[];
  rls_disabled text[];
begin
  select array_agg(relation_name order by relation_name)
    into missing_relations
  from unnest(required_relations) as relation_name
  where to_regclass(format('public.%I', relation_name)) is null;

  if coalesce(cardinality(missing_relations), 0) > 0 then
    raise exception 'SafeCard R1 reconciliation missing relations: %', missing_relations;
  end if;

  select array_agg(required_name order by required_name)
    into rls_disabled
  from unnest(required_rls_tables) as required_name
  join pg_class relation on relation.relname = required_name
  join pg_namespace namespace on namespace.oid = relation.relnamespace
  where namespace.nspname = 'public'
    and relation.relkind = 'r'
    and not relation.relrowsecurity;

  if coalesce(cardinality(rls_disabled), 0) > 0 then
    raise exception 'SafeCard R1 reconciliation found RLS disabled: %', rls_disabled;
  end if;

  if not exists (
    select 1
    from storage.buckets
    where id = 'payment-proofs'
      and public = false
      and file_size_limit = 10485760
      and allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]
  ) then
    raise exception 'SafeCard payment-proofs bucket configuration is invalid';
  end if;
end;
$$;
