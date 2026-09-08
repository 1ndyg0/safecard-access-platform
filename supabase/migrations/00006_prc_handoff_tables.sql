-- SafeCard Access Platform
-- Migration 00006: PRC export batches, export items, membership status events

-- ============================================================
-- PRC export batches
-- Immutable export package metadata
-- Permission-gated, reauthenticated, reason-logged
-- ============================================================
create table public.prc_export_batches (
  id                  uuid primary key default extensions.uuid_generate_v4(),
  campaign_id         uuid not null references public.pilot_campaigns(id),
  batch_ref           text not null unique,
  -- Stable batch reference, e.g. EXP-2026-001

  -- Who created and why
  created_by          uuid not null references public.users(id),
  creation_reason     text not null,
  -- Reason must be logged per architecture spec

  -- Reauthentication evidence
  reauth_method       text not null check (reauth_method in ('password', 'mfa', 'session_refresh')),
  reauth_at           timestamptz not null,

  -- Batch contents
  record_count        integer not null default 0,
  column_order        jsonb not null default '[]',
  -- PRC-approved column order for CSV

  -- Integrity
  checksum            text not null,
  -- SHA-256 of the export contents
  format              text not null default 'csv' check (format in ('csv', 'json')),

  -- Transfer
  transfer_method     text,
  -- e.g. 'secure_email', 'encrypted_upload', 'manual_handoff'
  transferred_at      timestamptz,
  transfer_evidence   text,

  -- PRC receipt
  prc_received_at     timestamptz,
  prc_received_by     text,
  prc_acknowledgment  text,

  -- Immutability — this row should never be modified after creation
  -- (enforced by trigger)
  metadata            jsonb not null default '{}',
  created_at          timestamptz not null default now()
);

create index idx_prc_export_batches_campaign on public.prc_export_batches(campaign_id);

-- Prevent modification of export batch records
create trigger trg_prc_export_batches_immutable
  before update or delete on public.prc_export_batches
  for each row execute function public.prevent_audit_mutation();

-- ============================================================
-- PRC export items
-- Individual records included in each batch
-- Per-record PRC acknowledgment tracking
-- ============================================================
create table public.prc_export_items (
  id                  uuid primary key default extensions.uuid_generate_v4(),
  batch_id            uuid not null references public.prc_export_batches(id),
  case_id             uuid not null references public.recipient_cases(id),
  submission_id       uuid not null references public.application_submissions(id),
  export_order        integer not null check (export_order >= 0),

  -- Per-record PRC response
  prc_status          text not null default 'pending'
    check (prc_status in ('pending', 'acknowledged', 'correction_requested', 'accepted', 'rejected')),
  prc_responded_at    timestamptz,
  prc_response_by     text,
  prc_notes           text,

  -- Correction tracking
  correction_reason   text,
  correction_fields   jsonb,
  -- Which fields need correction and why
  original_values     jsonb,
  -- Preserve original submitted values
  corrected_values    jsonb,
  -- Corrected values (if correction applied)

  -- PRC-assigned identifiers
  prc_membership_id   text,
  -- The official Safe Card ID assigned by PRC
  prc_effective_date  date,
  prc_expiry_date     date,

  -- Source timestamps from PRC
  prc_source_timestamp timestamptz,

  metadata            jsonb not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index uq_prc_export_items_batch_order
  on public.prc_export_items(batch_id, export_order);

create index idx_prc_export_items_batch on public.prc_export_items(batch_id);
create index idx_prc_export_items_case on public.prc_export_items(case_id);
create index idx_prc_export_items_status on public.prc_export_items(prc_status);

create trigger trg_prc_export_items_updated_at
  before update on public.prc_export_items
  for each row execute function public.set_updated_at();

-- ============================================================
-- Membership status events
-- Event log of every membership state change
-- PRC confirmation is the ONLY source of active membership
-- ============================================================
create table public.membership_status_events (
  id                  uuid primary key default extensions.uuid_generate_v4(),
  case_id             uuid not null references public.recipient_cases(id),
  previous_state      public.membership_state,
  new_state           public.membership_state not null,
  changed_by          text not null,
  -- 'system', 'prc_liaison', user UUID
  change_source       text not null,
  -- 'prc_confirmation', 'prc_rejection', 'expiry', 'renewal', 'withdrawal'

  -- PRC evidence (only for active_confirmed)
  prc_export_item_id  uuid references public.prc_export_items(id),
  prc_membership_id   text,
  prc_effective_date  date,
  prc_expiry_date     date,

  reason              text,
  evidence            jsonb,
  metadata            jsonb not null default '{}',
  created_at          timestamptz not null default now()
  -- No updated_at: these are immutable event records
);

create index idx_membership_status_events_case on public.membership_status_events(case_id);
create index idx_membership_status_events_state on public.membership_status_events(new_state);

-- Prevent modification of membership events
create trigger trg_membership_status_events_immutable
  before update or delete on public.membership_status_events
  for each row execute function public.prevent_audit_mutation();
