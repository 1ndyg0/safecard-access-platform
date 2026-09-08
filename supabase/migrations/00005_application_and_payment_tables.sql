-- SafeCard Access Platform
-- Migration 00005: Application submissions, payment intents, payment evidence

-- ============================================================
-- Application submissions
-- Submitted application snapshot with idempotency
-- Separate from recipient_profiles to preserve the exact
-- submitted state vs. any later corrections
-- ============================================================
create table public.application_submissions (
  id                  uuid primary key default extensions.uuid_generate_v4(),
  case_id             uuid not null references public.recipient_cases(id),
  application_ref     text not null,
  -- SC-YYYY-XXXXXXXX — also stored on recipient_cases

  -- Snapshot of what was submitted
  submitted_data      jsonb not null,
  -- Approved fields only, validated before storage

  -- Version references frozen at submit time
  consent_record_id   uuid not null references public.consent_records(id),
  content_versions_seen jsonb not null default '[]',
  -- Array of content_version IDs the recipient saw
  privacy_notice_version_id uuid not null references public.content_versions(id),

  -- Comprehension check evidence
  comprehension_score integer,
  -- e.g. 4 out of 5
  comprehension_passed boolean,
  -- true if score >= 4/5

  -- Submission metadata
  submitted_at        timestamptz not null default now(),
  submitted_by        text not null default 'recipient'
    check (submitted_by in ('recipient', 'assisted_entry')),
  assisted_by_name    text,
  -- Name of helper if assisted entry

  -- Correction tracking
  original_submission_id uuid references public.application_submissions(id),
  -- Points to the original if this is a resubmission
  correction_reason   text,

  -- Idempotency
  idempotency_key     text not null unique,
  request_hash        text not null,

  -- Status
  is_current          boolean not null default true,
  -- false for superseded submissions

  metadata            jsonb not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_application_submissions_case on public.application_submissions(case_id);
create index idx_application_submissions_ref on public.application_submissions(application_ref);
create index idx_application_submissions_current
  on public.application_submissions(case_id)
  where is_current = true;
create unique index uq_application_submissions_one_current
  on public.application_submissions(case_id)
  where is_current = true;

create trigger trg_application_submissions_updated_at
  before update on public.application_submissions
  for each row execute function public.set_updated_at();

-- ============================================================
-- Payment intents
-- Official payment handoff record
-- Tracks the expected payment without processing it
-- Payment does NOT activate membership
-- ============================================================
create table public.payment_intents (
  id                    uuid primary key default extensions.uuid_generate_v4(),
  case_id               uuid not null references public.recipient_cases(id),
  campaign_id           uuid not null references public.pilot_campaigns(id),

  -- Payer identity (separate from recipient)
  payer_type            text not null check (payer_type in ('sponsor', 'guardian', 'other')),
  payer_name            text,
  payer_sponsor_id      uuid references public.sponsors(id),
  -- If the sponsor is paying

  -- Payment details
  expected_amount       numeric(10,2) not null check (expected_amount > 0),
  currency              text not null default 'PHP' check (currency = 'PHP'),
  payment_route         text not null,
  -- e.g. 'gcash_official', 'manual_prc', 'bank_transfer'
  payment_reference     text,
  -- The reference number for the payment

  -- State machine
  state                 public.payment_state not null default 'not_started',

  -- Timestamps for each state
  handoff_opened_at     timestamptz,
  payer_marked_paid_at  timestamptz,
  verification_started_at timestamptz,
  verified_at           timestamptz,
  failed_at             timestamptz,
  refunded_at           timestamptz,

  -- Verification
  verified_by           uuid references public.users(id),
  verification_source   text,
  -- e.g. 'gcash_callback', 'manual_reconciliation', 'prc_confirmation'
  verification_evidence jsonb,
  -- Minimal metadata only — no screenshots unless approved

  -- GCash integration (future-ready)
  gcash_transaction_id  text,
  gcash_reference_number text,
  gcash_callback_payload jsonb,
  -- Raw webhook payload, restricted access

  idempotency_key       text unique,
  request_hash          text not null,
  metadata              jsonb not null default '{}',
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index idx_payment_intents_case on public.payment_intents(case_id);
create index idx_payment_intents_campaign on public.payment_intents(campaign_id);
create index idx_payment_intents_state on public.payment_intents(state);
create index idx_payment_intents_gcash on public.payment_intents(gcash_transaction_id)
  where gcash_transaction_id is not null;

create trigger trg_payment_intents_updated_at
  before update on public.payment_intents
  for each row execute function public.set_updated_at();

-- ============================================================
-- Payment evidence
-- Optional status-only records
-- Not sensitive financial artifacts unless PRC approved
-- ============================================================
create table public.payment_evidence (
  id                  uuid primary key default extensions.uuid_generate_v4(),
  payment_intent_id   uuid not null references public.payment_intents(id),
  evidence_type       text not null check (evidence_type in (
    'gcash_callback',
    'manual_receipt_reference',
    'bank_reference',
    'prc_confirmation'
  )),
  reference_number    text,
  amount_confirmed    numeric(10,2),
  currency            text not null default 'PHP',
  confirmed_at        timestamptz,
  confirmed_by        uuid references public.users(id),
  source              text not null,
  -- Where this evidence came from
  is_verified         boolean not null default false,
  metadata            jsonb not null default '{}',
  created_at          timestamptz not null default now()
);

create index idx_payment_evidence_intent on public.payment_evidence(payment_intent_id);
