-- SafeCard Access Platform
-- Migration 00004: Consent records, content versions

-- ============================================================
-- Content versions
-- Approved content by type, locale, version
-- PRC liaison (Elena) approves; school admin (Aira) publishes
-- ============================================================
create table public.content_versions (
  id                  uuid primary key default extensions.uuid_generate_v4(),
  content_type        public.content_type not null,
  locale              text not null default 'tl'
    check (locale in ('en', 'tl', 'ceb')),
  -- tl = Tagalog (primary), en = English, ceb = Cebuano/Bisaya
  version             integer not null default 1,
  created_by          uuid not null references public.users(id),
  title               text not null,
  body                text not null,
  -- The actual content (plain text or structured markdown)
  summary             text,
  -- Short summary for cards/previews

  -- Approval chain
  approval_status     public.content_approval_status not null default 'draft',
  approved_by         uuid references public.users(id),
  approved_at         timestamptz,
  source              text,
  -- Where this content came from (e.g. "PRC Safe Card brochure 2026")
  source_last_updated date,
  -- When the source material was last updated
  review_date         date,
  -- When this content should be reviewed again
  expiry_date         date,
  -- When this content expires and must not be shown

  -- Publishing
  is_published        boolean not null default false,
  published_at        timestamptz,
  published_by        uuid references public.users(id),
  unpublished_at      timestamptz,

  -- Affected surfaces (which parts of the app show this)
  affected_surfaces   jsonb not null default '[]',
  -- e.g. ["landing_page", "benefit_card", "consent_form"]

  -- Change tracking
  supersedes_id       uuid references public.content_versions(id),
  -- Points to the previous version this replaces
  change_summary      text,
  -- What changed from the previous version
  is_material_change  boolean not null default false,
  -- If true, existing consent may need re-review

  metadata            jsonb not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- Only one published version per type+locale at a time
  unique (content_type, locale, version)
);

create index idx_content_versions_published
  on public.content_versions(content_type, locale)
  where is_published = true and approval_status = 'approved';
create index idx_content_versions_approval
  on public.content_versions(approval_status);
create unique index uq_content_versions_one_published
  on public.content_versions(content_type, locale)
  where is_published = true;

create trigger trg_content_versions_updated_at
  before update on public.content_versions
  for each row execute function public.set_updated_at();

-- ============================================================
-- Consent records
-- What the recipient agreed to, which version, when
-- Supports withdrawal and content-change expiry
-- ============================================================
create table public.consent_records (
  id                      uuid primary key default extensions.uuid_generate_v4(),
  case_id                 uuid not null references public.recipient_cases(id),
  consent_type            text not null default 'membership_application'
    check (consent_type in (
      'membership_application',
      'data_processing',
      'notification_opt_in'
    )),
  -- Which content versions were shown at consent time
  consent_content_version_id  uuid not null references public.content_versions(id),
  privacy_notice_version_id   uuid not null references public.content_versions(id),
  locale                  text not null check (locale in ('en', 'tl', 'ceb')),
  state                   public.consent_state not null default 'agreed',

  -- Evidence
  agreed_at               timestamptz,
  ip_hash                 text,
  -- Hashed, not raw IP
  user_agent_hash         text,
  -- Hashed, not raw UA

  -- Withdrawal
  withdrawn_at            timestamptz,
  withdrawal_reason       text,
  withdrawal_requested_by text,
  -- "recipient" or "guardian"

  -- Content change expiry
  expired_at              timestamptz,
  expired_reason          text,
  -- e.g. "material content change in version X"

  idempotency_key         text unique,
  request_hash            text not null,
  metadata                jsonb not null default '{}',
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create index idx_consent_records_case on public.consent_records(case_id);
create index idx_consent_records_state on public.consent_records(state);

create trigger trg_consent_records_updated_at
  before update on public.consent_records
  for each row execute function public.set_updated_at();
