-- SafeCard Access Platform
-- Migration 00008: Row Level Security policies
--
-- SECURITY MODEL:
-- 1. Revoke all default grants from anon and authenticated roles
-- 2. Grant back only required permissions per table
-- 3. RLS policies enforce row-level access based on role
--
-- KEY RULES:
-- - Sponsors CANNOT read recipient personal data (recipient_profiles)
-- - Payers CANNOT read recipient personal data
-- - Anonymous users CANNOT enumerate applications, referrals, recipients, or statuses
-- - Service role (server-side only) bypasses RLS for server actions
-- - Staff access is scoped by role_assignments

-- ============================================================
-- Step 1: Enable RLS on EVERY table
-- ============================================================
alter table public.organizations enable row level security;
alter table public.pilot_campaigns enable row level security;
alter table public.users enable row level security;
alter table public.role_assignments enable row level security;
alter table public.sponsors enable row level security;
alter table public.referral_links enable row level security;
alter table public.recipient_cases enable row level security;
alter table public.recipient_profiles enable row level security;
alter table public.relationships enable row level security;
alter table public.consent_records enable row level security;
alter table public.content_versions enable row level security;
alter table public.application_submissions enable row level security;
alter table public.payment_intents enable row level security;
alter table public.payment_evidence enable row level security;
alter table public.prc_export_batches enable row level security;
alter table public.prc_export_items enable row level security;
alter table public.membership_status_events enable row level security;
alter table public.support_cases enable row level security;
alter table public.notification_events enable row level security;
alter table public.audit_events enable row level security;
alter table public.jobs enable row level security;
alter table public.aggregate_metrics enable row level security;
alter table public.rate_limit_buckets enable row level security;

-- ============================================================
-- Step 2: Revoke broad default grants
-- The anon key is public. Security comes from RLS + grants.
-- ============================================================
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;

-- ============================================================
-- Helper function: check if the current user has a specific staff role
-- ============================================================
create or replace function public.has_role(required_role public.staff_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.role_assignments
    where user_id = auth.uid()
      and role = required_role
      and is_active = true
      and (revoked_at is null)
  );
$$;

-- Check if user has ANY active staff role
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.role_assignments
    where user_id = auth.uid()
      and is_active = true
      and (revoked_at is null)
  );
$$;

-- Check if user is the recipient who owns this case
create or replace function public.owns_case(p_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.recipient_cases
    where id = p_case_id
      and auth_user_id = auth.uid()
  );
$$;

-- Check if user is the sponsor linked to a case
create or replace function public.is_case_sponsor(p_case_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.recipient_cases rc
    join public.referral_links rl on rl.id = rc.referral_link_id
    join public.sponsors s on s.id = rl.sponsor_id
    where rc.id = p_case_id
      and s.auth_user_id = auth.uid()
  );
$$;

-- ============================================================
-- Step 3: Grant minimal permissions and create RLS policies
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- organizations: read-only for authenticated staff
-- ────────────────────────────────────────────────────────────
grant select on public.organizations to authenticated;

create policy "Staff can read organizations"
  on public.organizations for select
  to authenticated
  using (public.is_staff());

-- ────────────────────────────────────────────────────────────
-- pilot_campaigns: read for staff; limited read for authenticated
-- ────────────────────────────────────────────────────────────
grant select on public.pilot_campaigns to authenticated;
grant select on public.pilot_campaigns to anon;

create policy "Anyone can read active campaigns"
  on public.pilot_campaigns for select
  to anon, authenticated
  using (is_active = true);

-- ────────────────────────────────────────────────────────────
-- users: staff can read; users can read own record
-- ────────────────────────────────────────────────────────────
grant select on public.users to authenticated;

create policy "Users can read own record"
  on public.users for select
  to authenticated
  using (id = auth.uid());

create policy "Staff can read all users"
  on public.users for select
  to authenticated
  using (public.is_staff());

-- ────────────────────────────────────────────────────────────
-- role_assignments: staff can read; users can read own
-- ────────────────────────────────────────────────────────────
grant select on public.role_assignments to authenticated;

create policy "Users can read own roles"
  on public.role_assignments for select
  to authenticated
  using (user_id = auth.uid());

create policy "Admin can read all roles"
  on public.role_assignments for select
  to authenticated
  using (public.has_role('school_admin') or public.has_role('privacy_admin_owner'));

-- ────────────────────────────────────────────────────────────
-- sponsors: sponsor can read own; staff can read
-- ────────────────────────────────────────────────────────────
grant select on public.sponsors to authenticated;

create policy "Sponsors can read own record"
  on public.sponsors for select
  to authenticated
  using (auth_user_id = auth.uid());

create policy "Staff can read sponsors"
  on public.sponsors for select
  to authenticated
  using (public.is_staff());

-- ────────────────────────────────────────────────────────────
-- referral_links: sponsor can read own; staff can read; anon can validate slug
-- ────────────────────────────────────────────────────────────
grant select on public.referral_links to authenticated;
grant select on public.referral_links to anon;

-- Anon can check if a slug is valid (for landing page)
-- but only sees slug + is_active + campaign_id (enforced by server projection)
create policy "Anyone can validate active referral slugs"
  on public.referral_links for select
  to anon, authenticated
  using (is_active = true and (expires_at is null or expires_at > now()));

create policy "Sponsors can read own referral links"
  on public.referral_links for select
  to authenticated
  using (
    sponsor_id in (
      select id from public.sponsors where auth_user_id = auth.uid()
    )
  );

create policy "Staff can read all referral links"
  on public.referral_links for select
  to authenticated
  using (public.is_staff());

-- ────────────────────────────────────────────────────────────
-- recipient_cases: recipient owns; staff can read (not sponsor!)
-- Sponsors see ONLY privacy-safe status via server projection
-- ────────────────────────────────────────────────────────────
grant select on public.recipient_cases to authenticated;

create policy "Recipients can read own case"
  on public.recipient_cases for select
  to authenticated
  using (auth_user_id = auth.uid());

create policy "Staff can read cases"
  on public.recipient_cases for select
  to authenticated
  using (public.is_staff());

-- NO policy for sponsors to read recipient_cases directly
-- Sponsors get privacy-safe status through a server-side API

-- ────────────────────────────────────────────────────────────
-- recipient_profiles: MOST RESTRICTED TABLE
-- Only the recipient and authorized staff can access
-- Sponsors CANNOT read this. Payers CANNOT read this.
-- ────────────────────────────────────────────────────────────
grant select on public.recipient_profiles to authenticated;

create policy "Recipients can read own profile"
  on public.recipient_profiles for select
  to authenticated
  using (
    case_id in (
      select id from public.recipient_cases where auth_user_id = auth.uid()
    )
  );

-- Only specific staff roles can read profiles — not all staff
create policy "Authorized staff can read profiles"
  on public.recipient_profiles for select
  to authenticated
  using (
    public.has_role('school_admin')
    or public.has_role('prc_liaison')
    or public.has_role('privacy_admin_owner')
    or public.has_role('support_agent')
  );

-- NO policy for sponsors. NO policy for payers.
-- This is the core privacy boundary.

-- ────────────────────────────────────────────────────────────
-- relationships: case owner and staff
-- ────────────────────────────────────────────────────────────
grant select on public.relationships to authenticated;

create policy "Case owner can read relationships"
  on public.relationships for select
  to authenticated
  using (public.owns_case(case_id));

create policy "Staff can read relationships"
  on public.relationships for select
  to authenticated
  using (public.is_staff());

-- ────────────────────────────────────────────────────────────
-- consent_records: case owner and staff
-- ────────────────────────────────────────────────────────────
grant select on public.consent_records to authenticated;

create policy "Case owner can read own consent"
  on public.consent_records for select
  to authenticated
  using (public.owns_case(case_id));

create policy "Staff can read consent records"
  on public.consent_records for select
  to authenticated
  using (public.is_staff());

-- ────────────────────────────────────────────────────────────
-- content_versions: approved+published content is public
-- Draft/pending content is staff-only
-- ────────────────────────────────────────────────────────────
grant select on public.content_versions to authenticated;
grant select on public.content_versions to anon;

create policy "Anyone can read published approved content"
  on public.content_versions for select
  to anon, authenticated
  using (
    is_published = true
    and approval_status = 'approved'
    and (expiry_date is null or expiry_date > current_date)
  );

create policy "Staff can read all content versions"
  on public.content_versions for select
  to authenticated
  using (public.is_staff());

-- ────────────────────────────────────────────────────────────
-- application_submissions: case owner and staff
-- ────────────────────────────────────────────────────────────
grant select on public.application_submissions to authenticated;

create policy "Case owner can read own submissions"
  on public.application_submissions for select
  to authenticated
  using (public.owns_case(case_id));

create policy "Staff can read submissions"
  on public.application_submissions for select
  to authenticated
  using (public.is_staff());

-- ────────────────────────────────────────────────────────────
-- payment_intents: case owner, payer-sponsor, and staff
-- ────────────────────────────────────────────────────────────
grant select on public.payment_intents to authenticated;

create policy "Case owner can read payment intents"
  on public.payment_intents for select
  to authenticated
  using (public.owns_case(case_id));

-- Sponsors can see payment status for cases they referred
-- but NOT recipient personal data (that's on recipient_profiles)
create policy "Sponsors can read payment for referred cases"
  on public.payment_intents for select
  to authenticated
  using (public.is_case_sponsor(case_id));

create policy "Staff can read payment intents"
  on public.payment_intents for select
  to authenticated
  using (public.is_staff());

-- ────────────────────────────────────────────────────────────
-- payment_evidence: staff only (plus case owner)
-- ────────────────────────────────────────────────────────────
grant select on public.payment_evidence to authenticated;

create policy "Staff can read payment evidence"
  on public.payment_evidence for select
  to authenticated
  using (
    public.has_role('finance_export')
    or public.has_role('school_admin')
    or public.has_role('prc_liaison')
    or public.has_role('privacy_admin_owner')
  );

-- ────────────────────────────────────────────────────────────
-- prc_export_batches: export/PRC staff only
-- ────────────────────────────────────────────────────────────
grant select on public.prc_export_batches to authenticated;

create policy "Export staff can read batches"
  on public.prc_export_batches for select
  to authenticated
  using (
    public.has_role('finance_export')
    or public.has_role('school_admin')
    or public.has_role('prc_liaison')
    or public.has_role('privacy_admin_owner')
  );

-- ────────────────────────────────────────────────────────────
-- prc_export_items: export/PRC staff only
-- ────────────────────────────────────────────────────────────
grant select on public.prc_export_items to authenticated;

create policy "Export staff can read items"
  on public.prc_export_items for select
  to authenticated
  using (
    public.has_role('finance_export')
    or public.has_role('school_admin')
    or public.has_role('prc_liaison')
    or public.has_role('privacy_admin_owner')
  );

-- ────────────────────────────────────────────────────────────
-- membership_status_events: case owner and staff
-- ────────────────────────────────────────────────────────────
grant select on public.membership_status_events to authenticated;

create policy "Case owner can read membership events"
  on public.membership_status_events for select
  to authenticated
  using (public.owns_case(case_id));

create policy "Staff can read membership events"
  on public.membership_status_events for select
  to authenticated
  using (public.is_staff());

-- ────────────────────────────────────────────────────────────
-- support_cases: submitter and assigned staff
-- ────────────────────────────────────────────────────────────
grant select on public.support_cases to authenticated;

create policy "Staff can read support cases"
  on public.support_cases for select
  to authenticated
  using (
    public.has_role('support_agent')
    or public.has_role('school_admin')
    or public.has_role('privacy_admin_owner')
  );

create policy "Users can read own support cases"
  on public.support_cases for select
  to authenticated
  using (submitted_by_user_id = auth.uid());

-- ────────────────────────────────────────────────────────────
-- notification_events: case owner and staff
-- ────────────────────────────────────────────────────────────
grant select on public.notification_events to authenticated;

create policy "Staff can read notifications"
  on public.notification_events for select
  to authenticated
  using (public.is_staff());

-- ────────────────────────────────────────────────────────────
-- audit_events: privacy admin and school admin only
-- ────────────────────────────────────────────────────────────
grant select on public.audit_events to authenticated;

create policy "Admin can read audit events"
  on public.audit_events for select
  to authenticated
  using (
    public.has_role('privacy_admin_owner')
    or public.has_role('school_admin')
  );

-- ────────────────────────────────────────────────────────────
-- jobs: system/admin only (server-side via service role)
-- No client-side access
-- ────────────────────────────────────────────────────────────
-- No grants to anon or authenticated
-- Jobs are managed exclusively via service role (server-side)

-- ────────────────────────────────────────────────────────────
-- aggregate_metrics: staff can read; public summary possible
-- ────────────────────────────────────────────────────────────
grant select on public.aggregate_metrics to authenticated;

create policy "Staff can read metrics"
  on public.aggregate_metrics for select
  to authenticated
  using (public.is_staff());

-- ============================================================
-- INSERT policies (server actions use service role for most writes,
-- but some inserts are allowed from authenticated users)
-- ============================================================

-- Recipients can insert their own consent records (via server action validated)
grant insert on public.consent_records to authenticated;
create policy "Recipients can insert consent"
  on public.consent_records for insert
  to authenticated
  with check (public.owns_case(case_id));

-- Recipients can insert support cases
grant insert on public.support_cases to authenticated;
create policy "Authenticated users can create support cases"
  on public.support_cases for insert
  to authenticated
  with check (true);

-- All operational writes ultimately pass through Route Handlers. The temporary
-- grants above document the intended row predicates; the final BFF revocation
-- below ensures a browser cannot bypass API validation with the public key.

-- The application uses a backend-for-frontend boundary. Browser clients do not
-- query operational tables directly; Route Handlers authenticate, authorize,
-- project minimal DTOs, then use the server-only service role. Revoking the
-- earlier table grants closes column-enumeration and accidental direct-access
-- gaps while keeping the policies documented and testable.
revoke all on all tables in schema public from anon, authenticated;

-- RLS helper functions are invoked by policies only for authenticated users.
revoke all on function public.has_role(public.staff_role) from public, anon;
revoke all on function public.is_staff() from public, anon;
revoke all on function public.owns_case(uuid) from public, anon;
revoke all on function public.is_case_sponsor(uuid) from public, anon;
grant execute on function public.has_role(public.staff_role) to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.owns_case(uuid) to authenticated;
grant execute on function public.is_case_sponsor(uuid) to authenticated;
