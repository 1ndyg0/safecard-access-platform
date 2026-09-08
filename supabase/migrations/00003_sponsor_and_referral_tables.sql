-- SafeCard Access Platform
-- Migration 00003: Sponsors, referral links, recipient cases, profiles, relationships

-- ============================================================
-- Sponsors
-- Student sponsor profile (Bea persona)
-- Minor/guardian constraints, active status
-- ============================================================
create table public.sponsors (
  id              uuid primary key default extensions.uuid_generate_v4(),
  campaign_id     uuid not null references public.pilot_campaigns(id),
  auth_user_id    uuid references auth.users(id) on delete set null,
  -- Nullable: anonymous sponsors possible in early flows
  display_name    text not null,
  is_minor        boolean not null default true,
  guardian_name   text,
  guardian_contact text,
  guardian_approved boolean not null default false,
  -- Parental/guardian approval for payment
  is_active       boolean not null default true,
  metadata        jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_sponsors_campaign on public.sponsors(campaign_id) where is_active = true;
create index idx_sponsors_auth_user on public.sponsors(auth_user_id) where auth_user_id is not null;
create unique index uq_sponsors_campaign_auth_user
  on public.sponsors(campaign_id, auth_user_id)
  where auth_user_id is not null and is_active = true;

create trigger trg_sponsors_updated_at
  before update on public.sponsors
  for each row execute function public.set_updated_at();

-- ============================================================
-- Referral links
-- Unique slugs, QR code metadata, sponsor attribution
-- Activation, expiration, revocation with audit
-- ============================================================
create table public.referral_links (
  id              uuid primary key default extensions.uuid_generate_v4(),
  sponsor_id      uuid not null references public.sponsors(id),
  campaign_id     uuid not null references public.pilot_campaigns(id),
  slug            citext not null unique,
  -- The unique slug used in the referral URL
  qr_metadata     jsonb not null default '{}',
  -- QR code generation metadata (not the image itself)
  is_active       boolean not null default true,
  activated_at    timestamptz,
  expires_at      timestamptz,
  revoked_at      timestamptz,
  revoked_by      uuid references public.users(id),
  revocation_reason text,
  total_visits    integer not null default 0,
  total_starts    integer not null default 0,
  -- Privacy-safe aggregate counts only
  idempotency_key text unique,
  metadata        jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_referral_links_sponsor on public.referral_links(sponsor_id);
create index idx_referral_links_campaign on public.referral_links(campaign_id) where is_active = true;
create index idx_referral_links_slug on public.referral_links(slug);

create trigger trg_referral_links_updated_at
  before update on public.referral_links
  for each row execute function public.set_updated_at();

-- ============================================================
-- Recipient cases
-- Privacy-preserving case record for each recipient journey
-- This is the "case file" that tracks the overall journey
-- without exposing personal data to unauthorized roles
-- ============================================================
create table public.recipient_cases (
  id                  uuid primary key default extensions.uuid_generate_v4(),
  campaign_id         uuid not null references public.pilot_campaigns(id),
  referral_link_id    uuid references public.referral_links(id),
  -- Nullable: referral attribution is optional
  application_ref     text unique,
  -- Generated on submit: SC-YYYY-XXXXXXXX
  auth_user_id        uuid references auth.users(id) on delete set null,
  -- Supabase Auth anonymous user id for session continuity
  decision            text not null default 'accept' check (decision = 'accept'),
  decision_at         timestamptz not null default now(),

  -- Separate state machines (never a single status field)
  consent_state       public.consent_state not null default 'not_started',
  application_state   public.application_state not null default 'draft',
  payment_state       public.payment_state not null default 'not_started',
  prc_handoff_state   public.prc_handoff_state not null default 'not_ready',
  membership_state    public.membership_state not null default 'not_active',

  -- Content version tracking for consent validity
  consent_content_version_id uuid,
  privacy_notice_version_id  uuid,

  -- Latest comprehension result. Answers themselves are not retained here.
  comprehension_score      integer check (comprehension_score between 0 and 4),
  comprehension_passed     boolean,
  comprehension_checked_at timestamptz,

  is_active           boolean not null default true,
  metadata            jsonb not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_recipient_cases_campaign on public.recipient_cases(campaign_id);
create index idx_recipient_cases_referral on public.recipient_cases(referral_link_id)
  where referral_link_id is not null;
create index idx_recipient_cases_auth_user on public.recipient_cases(auth_user_id)
  where auth_user_id is not null;
create index idx_recipient_cases_application_ref on public.recipient_cases(application_ref)
  where application_ref is not null;

create trigger trg_recipient_cases_updated_at
  before update on public.recipient_cases
  for each row execute function public.set_updated_at();

-- ============================================================
-- Recipient profiles
-- Approved personal fields ONLY
-- Separated from case record for RLS isolation
-- Sponsors and payers CANNOT access this table
-- ============================================================
create table public.recipient_profiles (
  id                uuid primary key default extensions.uuid_generate_v4(),
  case_id           uuid not null unique references public.recipient_cases(id),
  -- PRC-approved fields only (example set — actual fields from PRC approval)
  first_name        text,
  middle_name       text,
  last_name         text,
  date_of_birth     date,
  sex               text check (sex in ('male', 'female')),
  civil_status      text,
  address_line1     text,
  address_line2     text,
  city              text,
  province          text,
  zip_code          text,
  mobile_number     text,
  email             citext,
  -- Field-level completion tracking
  fields_completed  boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger trg_recipient_profiles_updated_at
  before update on public.recipient_profiles
  for each row execute function public.set_updated_at();

-- ============================================================
-- Relationships
-- Links between recipient, sponsor, payer, guardian, helper
-- One case may involve several people in different roles
-- ============================================================
create table public.relationships (
  id                  uuid primary key default extensions.uuid_generate_v4(),
  case_id             uuid not null references public.recipient_cases(id),
  relationship_type   public.relationship_type not null,
  -- Who is playing this role
  sponsor_id          uuid references public.sponsors(id),
  user_id             uuid references public.users(id),
  -- For staff/guardian who are platform users
  external_name       text,
  -- For payers/guardians who are not platform users
  is_active           boolean not null default true,
  notes               text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_relationships_case on public.relationships(case_id);
create index idx_relationships_sponsor on public.relationships(sponsor_id) where sponsor_id is not null;

create trigger trg_relationships_updated_at
  before update on public.relationships
  for each row execute function public.set_updated_at();
