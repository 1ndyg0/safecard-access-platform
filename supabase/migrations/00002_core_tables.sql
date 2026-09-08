-- SafeCard Access Platform
-- Migration 00002: Core tables — organizations, campaigns, users, roles
-- These are the foundation that every other table references.

-- ============================================================
-- Organizations
-- PRC, school, pilot partner entities
-- ============================================================
create table public.organizations (
  id          uuid primary key default extensions.uuid_generate_v4(),
  name        text not null,
  slug        citext not null unique,
  org_type    text not null check (org_type in ('prc', 'school', 'partner')),
  is_active   boolean not null default true,
  metadata    jsonb not null default '{}',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger trg_organizations_updated_at
  before update on public.organizations
  for each row execute function public.set_updated_at();

-- ============================================================
-- Pilot campaigns
-- One-school pilot configuration, limits, stop conditions
-- ============================================================
create table public.pilot_campaigns (
  id                  uuid primary key default extensions.uuid_generate_v4(),
  organization_id     uuid not null references public.organizations(id),
  name                text not null,
  slug                citext not null unique,
  start_date          date not null,
  end_date            date,
  max_applications    integer not null default 50,
  max_sponsors        integer not null default 30,
  membership_fee     numeric(10,2) not null default 1200 check (membership_fee > 0),
  approved_fields     jsonb not null default '[]',
  -- Which personal fields PRC approved for collection
  approved_payment_routes jsonb not null default '[]',
  -- e.g. [{"type": "gcash", "details": {...}}, {"type": "manual", ...}]
  stop_conditions     jsonb not null default '[]',
  -- Conditions under which the pilot must pause or stop
  is_active           boolean not null default false,
  metadata            jsonb not null default '{}',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger trg_pilot_campaigns_updated_at
  before update on public.pilot_campaigns
  for each row execute function public.set_updated_at();

-- ============================================================
-- Users
-- Authenticated platform users: staff, school admins, PRC liaisons
-- NOT recipients (they use anonymous/lightweight sessions)
-- ============================================================
create table public.users (
  id              uuid primary key references auth.users(id) on delete cascade,
  -- Matches Supabase Auth user id
  email           citext not null unique,
  full_name       text not null,
  is_active       boolean not null default true,
  mfa_enabled     boolean not null default false,
  last_login_at   timestamptz,
  metadata        jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger trg_users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

-- ============================================================
-- Role assignments
-- Who has which role, scoped to which campaign or organization
-- One person may have multiple roles
-- ============================================================
create table public.role_assignments (
  id                uuid primary key default extensions.uuid_generate_v4(),
  user_id           uuid not null references public.users(id),
  role              public.staff_role not null,
  organization_id   uuid references public.organizations(id),
  campaign_id       uuid references public.pilot_campaigns(id),
  -- At least one of organization_id or campaign_id should be set
  granted_by        uuid references public.users(id),
  granted_at        timestamptz not null default now(),
  revoked_at        timestamptz,
  revoked_by        uuid references public.users(id),
  is_active         boolean not null default true,
  reason            text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint role_assignment_scope_required
    check (organization_id is not null or campaign_id is not null),

  -- Prevent exact duplicate active roles
  unique (user_id, role, organization_id, campaign_id)
);

create index idx_role_assignments_user on public.role_assignments(user_id) where is_active = true;
create index idx_role_assignments_org  on public.role_assignments(organization_id) where is_active = true;
create index idx_role_assignments_campaign on public.role_assignments(campaign_id) where is_active = true;
create unique index uq_role_assignments_active_campaign
  on public.role_assignments(user_id, role, campaign_id)
  where is_active = true and campaign_id is not null;
create unique index uq_role_assignments_active_organization
  on public.role_assignments(user_id, role, organization_id)
  where is_active = true and campaign_id is null and organization_id is not null;

create trigger trg_role_assignments_updated_at
  before update on public.role_assignments
  for each row execute function public.set_updated_at();
