-- ============================================================
-- SafeCard Pilot 2026 — Pilot Account Setup
-- Run this in the Supabase SQL Editor for the SafeCard project.
--
-- Creates:
--   • Auth login accounts for Ian Vince and Indy (password: Password123)
--   • All 6 staff roles for both accounts
--   • Ambassador (sponsor) rows for the Safe Card Pilot 2026 campaign
--
-- ⚠️  These are pilot credentials — passwords must be changed after first login.
-- ⚠️  Run this ONCE. All statements are idempotent (safe to re-run).
-- ============================================================

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
  IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = '00000000-0000-0000-0000-000000001001') THEN
    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      'ivvuriarte@gmail.com',
      '00000000-0000-0000-0000-000000001001',
      '{"sub":"00000000-0000-0000-0000-000000001001","email":"ivvuriarte@gmail.com","email_verified":true}',
      'email',
      now(), now(), now()
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM auth.identities WHERE user_id = '00000000-0000-0000-0000-000000001002') THEN
    INSERT INTO auth.identities (
      provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) VALUES (
      'tigparagas@gmail.com',
      '00000000-0000-0000-0000-000000001002',
      '{"sub":"00000000-0000-0000-0000-000000001002","email":"tigparagas@gmail.com","email_verified":true}',
      'email',
      now(), now(), now()
    );
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 3. public.users (staff directory)
-- ─────────────────────────────────────────────────────────────
INSERT INTO public.users (id, email, full_name, is_active, mfa_enabled)
VALUES
  ('00000000-0000-0000-0000-000000001001', 'ivvuriarte@gmail.com', 'Ian Vince', true, false),
  ('00000000-0000-0000-0000-000000001002', 'tigparagas@gmail.com', 'Indy',      true, false)
ON CONFLICT (id) DO UPDATE SET
  email     = EXCLUDED.email,
  full_name = EXCLUDED.full_name,
  is_active = EXCLUDED.is_active;

-- ─────────────────────────────────────────────────────────────
-- 4. Role assignments — all 6 roles for both accounts
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.organizations WHERE id = '00000000-0000-0000-0000-000000000001')
     AND EXISTS (SELECT 1 FROM public.organizations WHERE id = '00000000-0000-0000-0000-000000000002')
     AND EXISTS (SELECT 1 FROM public.pilot_campaigns WHERE id = '00000000-0000-0000-0000-000000000010')
  THEN
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
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- 5. Ambassador / sponsor rows
-- ─────────────────────────────────────────────────────────────
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.pilot_campaigns WHERE id = '00000000-0000-0000-0000-000000000010') THEN
    INSERT INTO public.sponsors (
      id, campaign_id, display_name, auth_user_id, is_minor, guardian_name, guardian_approved
    )
    VALUES
      (
        '00000000-0000-0000-0000-000000002001',
        '00000000-0000-0000-0000-000000000010',
        'Ian Vince',
        '00000000-0000-0000-0000-000000001001',
        false, NULL, true
      ),
      (
        '00000000-0000-0000-0000-000000002002',
        '00000000-0000-0000-0000-000000000010',
        'Indy',
        '00000000-0000-0000-0000-000000001002',
        false, NULL, true
      )
    ON CONFLICT (id) DO UPDATE SET
      display_name = EXCLUDED.display_name,
      auth_user_id = EXCLUDED.auth_user_id,
      campaign_id  = EXCLUDED.campaign_id;
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────
-- Done. Verify with:
--   SELECT id, email FROM auth.users WHERE email IN ('ivvuriarte@gmail.com','tigparagas@gmail.com');
--   SELECT user_id, role FROM public.role_assignments WHERE user_id IN ('00000000-0000-0000-0000-000000001001','00000000-0000-0000-0000-000000001002');
-- ─────────────────────────────────────────────────────────────
