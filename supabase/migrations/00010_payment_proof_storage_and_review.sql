-- SafeCard Access Platform
-- Migration 00010: private payment-proof storage, versioned evidence, and payer declaration
-- The bucket is private. Application routes use the server-only service role and
-- short-lived signed URLs; browser clients never receive a service-role key.

alter table public.payment_intents
  add column if not exists payer_declaration text,
  add column if not exists payer_declared_at timestamptz;

create table if not exists public.payment_evidence_versions (
  id                  uuid primary key default extensions.uuid_generate_v4(),
  payment_evidence_id uuid not null references public.payment_evidence(id),
  payment_intent_id   uuid not null references public.payment_intents(id),
  version_number      integer not null check (version_number > 0),
  object_path         text not null unique,
  content_type        text not null check (content_type in ('image/jpeg', 'image/png', 'image/webp')),
  file_size_bytes     bigint not null check (file_size_bytes > 0 and file_size_bytes <= 10485760),
  sha256              text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  image_width         integer check (image_width is null or image_width > 0),
  image_height        integer check (image_height is null or image_height > 0),
  state               text not null default 'verification_pending'
    check (state in ('verification_pending', 'verified', 'reupload_requested', 'superseded', 'rejected')),
  uploaded_by         uuid not null references auth.users(id),
  uploaded_at         timestamptz not null default now(),
  reviewed_by         uuid references auth.users(id),
  reviewed_at         timestamptz,
  retention_review_at timestamptz,
  supersedes_id       uuid references public.payment_evidence_versions(id),
  metadata            jsonb not null default '{}'
);

create unique index if not exists uq_payment_evidence_versions_number
  on public.payment_evidence_versions(payment_intent_id, version_number);
create index if not exists idx_payment_evidence_versions_intent
  on public.payment_evidence_versions(payment_intent_id, uploaded_at desc);

alter table public.payment_evidence_versions enable row level security;
revoke all on public.payment_evidence_versions from anon, authenticated;
grant select on public.payment_evidence_versions to authenticated;

create policy "Staff can read payment evidence versions"
  on public.payment_evidence_versions for select
  to authenticated
  using (public.is_staff());

create policy "Case owner can read own evidence metadata"
  on public.payment_evidence_versions for select
  to authenticated
  using (
    exists (
      select 1 from public.payment_intents pi
      where pi.id = payment_intent_id and public.owns_case(pi.case_id)
    )
  );

-- A private bucket is created idempotently. The production QR asset and
-- receipt objects must be uploaded through the server-side adapter.
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
  file_size_limit = 10485760,
  allowed_mime_types = excluded.allowed_mime_types;

-- No direct authenticated insert/update/delete policy is granted. The BFF
-- validates signatures, dimensions, size, ownership, and staff role before
-- using the service-role storage client. This prevents object enumeration.
