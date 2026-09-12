-- ============================================================
-- 00018_pilot_accounts.sql
-- Creates pilot ambassador and admin accounts for:
--   ivvuriarte@gmail.com  (display_name: Ian Vince)
--   tigparagas@gmail.com  (display_name: Indy)
--
-- IMPORTANT: These are pilot credentials — not production accounts.
-- Password is intentionally set and must be changed before go-live.
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Deterministic IDs
-- ─────────────────────────────────────────────────────────────
-- Auth user IDs
-- ivvuriarte@gmail.com  → 00000000-0000-0000-0000-000000001001
-- tigparagas@gmail.com  → 00000000-0000-0000-0000-000000001002

-- Sponsor IDs
-- Ian Vince sponsor     → 00000000-0000-0000-0000-000000002001
-- Indy sponsor          → 00000000-0000-0000-0000-000000002002

-- ─────────────────────────────────────────────────────────────
-- 1. Auth users
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- Ian Vince
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = '00000000-0000-0000-0000-000000001001') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, is_anonymous
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      '00000000-0000-0000-0000-000000001001',
      'authenticated',
      'authenticated',
      'ivvuriarte@gmail.com',
      extensions.crypt('Password123', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"display_name":"Ian Vince"}',
      now(),
      now(),
      false
    );
  END IF;

  -- Indy
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = '00000000-0000-0000-0000-000000001002') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, is_anonymous
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      '00000000-0000-0000-0000-000000001002',
      'authenticated',
      'authenticated',
      'tigparagas@gmail.com',
      extensions.crypt('Password123', extensions.gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"display_name":"Indy"}',
      now(),
      now(),
      false
    );
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 2. Auth identities (email provider)
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  -- Ian Vince identity
  IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = '00000000-0000-0000-0000-000000001001') THEN
    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      'ivvuriarte@gmail.com',
      '00000000-0000-0000-0000-000000001001',
      '{"sub":"00000000-0000-0000-0000-000000001001","email":"ivvuriarte@gmail.com","email_verified":true}',
      'email',
      now(),
      now(),
      now()
    );
  END IF;

  -- Indy identity
  IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = '00000000-0000-0000-0000-000000001002') THEN
    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      'tigparagas@gmail.com',
      '00000000-0000-0000-0000-000000001002',
      '{"sub":"00000000-0000-0000-0000-000000001002","email":"tigparagas@gmail.com","email_verified":true}',
      'email',
      now(),
      now(),
      now()
    );
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 3. public.users (staff directory — used by requireStaffAuth)
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.users (id, email, full_name, is_active, mfa_enabled)
VALUES
  ('00000000-0000-0000-0000-000000001001', 'ivvuriarte@gmail.com',  'Ian Vince', true, false),
  ('00000000-0000-0000-0000-000000001002', 'tigparagas@gmail.com',  'Indy',      true, false)
ON CONFLICT (id) DO UPDATE SET
  email      = EXCLUDED.email,
  full_name  = EXCLUDED.full_name,
  is_active  = EXCLUDED.is_active;

-- ─────────────────────────────────────────────────────────────
-- 4. Role assignments — all 6 roles (super admin)
-- school_admin / support_agent / finance_export / content_approver
-- / privacy_admin_owner → org: Sample Academy Manila (000...002)
-- prc_liaison → org: Philippine Red Cross (000...001)
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.role_assignments (user_id, role, organization_id, campaign_id, granted_by)
VALUES
  -- Ian Vince
  ('00000000-0000-0000-0000-000000001001', 'school_admin',        '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000010', NULL),
  ('00000000-0000-0000-0000-000000001001', 'prc_liaison',         '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', NULL),
  ('00000000-0000-0000-0000-000000001001', 'support_agent',       '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000010', NULL),
  ('00000000-0000-0000-0000-000000001001', 'finance_export',      '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000010', NULL),
  ('00000000-0000-0000-0000-000000001001', 'content_approver',    '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000010', NULL),
  ('00000000-0000-0000-0000-000000001001', 'privacy_admin_owner', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000010', NULL),
  -- Indy
  ('00000000-0000-0000-0000-000000001002', 'school_admin',        '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000010', NULL),
  ('00000000-0000-0000-0000-000000001002', 'prc_liaison',         '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', NULL),
  ('00000000-0000-0000-0000-000000001002', 'support_agent',       '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000010', NULL),
  ('00000000-0000-0000-0000-000000001002', 'finance_export',      '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000010', NULL),
  ('00000000-0000-0000-0000-000000001002', 'content_approver',    '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000010', NULL),
  ('00000000-0000-0000-0000-000000001002', 'privacy_admin_owner', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000010', NULL)
ON CONFLICT DO NOTHING;

-- ─────────────────────────────────────────────────────────────
-- 5. Sponsors (ambassador accounts)
-- Requires a sponsors row with auth_user_id pointing to the
-- Supabase auth user so /api/sponsors/me can resolve them.
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.sponsors (
  id, campaign_id, display_name, auth_user_id, is_minor, guardian_name, guardian_approved
)
VALUES
  (
    '00000000-0000-0000-0000-000000002001',
    '00000000-0000-0000-0000-000000000010',
    'Ian Vince',
    '00000000-0000-0000-0000-000000001001',
    false,
    NULL,
    true
  ),
  (
    '00000000-0000-0000-0000-000000002002',
    '00000000-0000-0000-0000-000000000010',
    'Indy',
    '00000000-0000-0000-0000-000000001002',
    false,
    NULL,
    true
  )
ON CONFLICT (id) DO UPDATE SET
  display_name  = EXCLUDED.display_name,
  auth_user_id  = EXCLUDED.auth_user_id,
  campaign_id   = EXCLUDED.campaign_id;
