-- SafeCard Access Platform — Synthetic seed data
-- For development and preview environments ONLY
-- NEVER use real personal data in seed files

-- Synthetic Auth identities are inserted first because public.users has a
-- strict foreign key to auth.users. The password is development-only.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_anonymous
) values
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000101', 'authenticated', 'authenticated', 'aira@sample-academy.test', extensions.crypt('TestOnly!ChangeMe123', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"synthetic":true}', now(), now(), false),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000102', 'authenticated', 'authenticated', 'elena@redcross.test', extensions.crypt('TestOnly!ChangeMe123', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"synthetic":true}', now(), now(), false),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000103', 'authenticated', 'authenticated', 'support@sample-academy.test', extensions.crypt('TestOnly!ChangeMe123', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"synthetic":true}', now(), now(), false),
  ('00000000-0000-0000-0000-000000000000', '00000000-0000-0000-0000-000000000104', 'authenticated', 'authenticated', 'privacy@sample-academy.test', extensions.crypt('TestOnly!ChangeMe123', extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{"synthetic":true}', now(), now(), false);

insert into auth.identities (
  provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
) values
  ('aira@sample-academy.test', '00000000-0000-0000-0000-000000000101', '{"sub":"00000000-0000-0000-0000-000000000101","email":"aira@sample-academy.test","email_verified":true}', 'email', now(), now(), now()),
  ('elena@redcross.test', '00000000-0000-0000-0000-000000000102', '{"sub":"00000000-0000-0000-0000-000000000102","email":"elena@redcross.test","email_verified":true}', 'email', now(), now(), now()),
  ('support@sample-academy.test', '00000000-0000-0000-0000-000000000103', '{"sub":"00000000-0000-0000-0000-000000000103","email":"support@sample-academy.test","email_verified":true}', 'email', now(), now(), now()),
  ('privacy@sample-academy.test', '00000000-0000-0000-0000-000000000104', '{"sub":"00000000-0000-0000-0000-000000000104","email":"privacy@sample-academy.test","email_verified":true}', 'email', now(), now(), now());

-- ============================================================
-- Organizations
-- ============================================================
insert into public.organizations (id, name, slug, org_type) values
  ('00000000-0000-0000-0000-000000000001', 'Philippine Red Cross', 'prc', 'prc'),
  ('00000000-0000-0000-0000-000000000002', 'Sample Academy Manila', 'sample-academy', 'school');

-- ============================================================
-- Pilot Campaign
-- ============================================================
insert into public.pilot_campaigns (
  id, organization_id, name, slug,
  start_date, end_date, max_applications, max_sponsors,
  approved_fields, approved_payment_routes, stop_conditions, is_active, membership_fee
) values (
  '00000000-0000-0000-0000-000000000010',
  '00000000-0000-0000-0000-000000000002',
  'Safe Card Pilot 2026',
  'pilot-2026',
  '2026-09-01',
  '2026-12-31',
  50,
  30,
  '["first_name","middle_name","last_name","date_of_birth","sex","civil_status","address_line1","address_line2","city","province","zip_code","mobile_number","email"]',
  '[{"type":"gcash","details":{"merchant_name":"PHILIPPINE RED CROSS"},"is_active":true},{"type":"bank_transfer","details":{"account_name":"PHILIPPINE RED CROSS"},"is_active":true},{"type":"manual_prc","details":{"instructions":"Visit nearest PRC chapter"},"is_active":true}]',
  '[{"type":"max_applications","threshold":50,"description":"Pause intake when 50 applications reached"},{"type":"privacy_incident","threshold":1,"description":"Stop immediately on any privacy incident"}]',
  true,
  1200
);

-- ============================================================
-- Staff users (synthetic — matches Supabase Auth test users)
-- ============================================================
-- Note: In a real setup, these IDs come from Supabase Auth.
-- For seeding, we use deterministic UUIDs.

insert into public.users (id, email, full_name, is_active, mfa_enabled) values
  ('00000000-0000-0000-0000-000000000101', 'aira@sample-academy.test', 'Aira Mendoza', true, true),
  ('00000000-0000-0000-0000-000000000102', 'elena@redcross.test', 'Elena Cruz', true, true),
  ('00000000-0000-0000-0000-000000000103', 'support@sample-academy.test', 'Support Agent', true, false),
  ('00000000-0000-0000-0000-000000000104', 'privacy@sample-academy.test', 'Privacy Admin', true, true);

-- ============================================================
-- Role assignments
-- ============================================================
insert into public.role_assignments (user_id, role, organization_id, campaign_id, granted_by) values
  ('00000000-0000-0000-0000-000000000101', 'school_admin', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000010', null),
  ('00000000-0000-0000-0000-000000000101', 'finance_export', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000010', null),
  ('00000000-0000-0000-0000-000000000101', 'content_approver', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000010', null),
  ('00000000-0000-0000-0000-000000000102', 'prc_liaison', '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000010', null),
  ('00000000-0000-0000-0000-000000000103', 'support_agent', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000010', null),
  ('00000000-0000-0000-0000-000000000104', 'privacy_admin_owner', '00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000010', null);

-- ============================================================
-- Sample content versions (bilingual)
-- ============================================================
insert into public.content_versions (
  content_type, locale, version, created_by, title, body, summary,
  approval_status, approved_by, approved_at, source, source_last_updated, review_date,
  affected_surfaces, is_published, published_at, published_by
) values
  -- Benefits (Tagalog)
  ('benefit', 'tl', 1, '00000000-0000-0000-0000-000000000102', 'Mga Benepisyo ng Safe Card',
   'Ang PRC Safe Card ay nagbibigay ng:\n\n• Accidental Death Benefit: ₱50,000\n• Accidental Burial Benefit: ₱10,000\n• Fire/Typhoon/Flood Assistance: ₱5,000\n• Free blood from PRC Blood Services\n• Free ambulance service (Hotline 143)\n\nTaunang bayad: ₱1,200',
   'Mga pangunahing benepisyo ng PRC Safe Card membership',
   'approved', '00000000-0000-0000-0000-000000000102', now(), 'PRC Safe Card Brochure 2026', '2026-08-15', '2027-02-15',
   '["landing_page","benefit_card","consent_form"]', true, now(), '00000000-0000-0000-0000-000000000101'),

  -- Benefits (English)
  ('benefit', 'en', 1, '00000000-0000-0000-0000-000000000102', 'Safe Card Benefits',
   'The PRC Safe Card provides:\n\n• Accidental Death Benefit: ₱50,000\n• Accidental Burial Benefit: ₱10,000\n• Fire/Typhoon/Flood Assistance: ₱5,000\n• Free blood from PRC Blood Services\n• Free ambulance service (Hotline 143)\n\nAnnual fee: ₱1,200',
   'Key benefits of PRC Safe Card membership',
   'approved', '00000000-0000-0000-0000-000000000102', now(), 'PRC Safe Card Brochure 2026', '2026-08-15', '2027-02-15',
   '["landing_page","benefit_card","consent_form"]', true, now(), '00000000-0000-0000-0000-000000000101'),

  -- Exclusions (Tagalog)
  ('exclusion', 'tl', 1, '00000000-0000-0000-0000-000000000102', 'Mga Hindi Kasama',
   'Hindi sakop ng Safe Card:\n\n• Natural na pagkamatay (sakit)\n• Sariling pagkasira (suicide)\n• Pagkamatay habang lasing o nasa droga\n• Aksidente habang gumagawa ng krimen\n• Pre-existing na kondisyon\n\nMahalaga: Hindi ito health insurance. Hindi ito nagbabayad ng ospital o gamot.',
   'Mga exclusion at limitasyon ng Safe Card',
   'approved', '00000000-0000-0000-0000-000000000102', now(), 'PRC Safe Card Brochure 2026', '2026-08-15', '2027-02-15',
   '["landing_page","benefit_card","consent_form"]', true, now(), '00000000-0000-0000-0000-000000000101'),

  -- Privacy notice (Tagalog)
  ('privacy_notice', 'tl', 1, '00000000-0000-0000-0000-000000000102', 'Paunawa sa Privacy',
   'Ang iyong personal na impormasyon ay:\n\n• Kokolektahin lamang para sa PRC Safe Card application\n• Ipapadala sa Philippine Red Cross para sa opisyal na pagproseso\n• Hindi ibabahagi sa sponsor o nagbayad nang walang pahintulot mo\n• Maaari mong bawiin ang pahintulot anumang oras\n• Maaari mong hilingin na itama o burahin ang iyong datos',
   'Paano namin pinoprotektahan ang iyong impormasyon',
   'approved', '00000000-0000-0000-0000-000000000102', now(), 'SafeCard Privacy Assessment', '2026-09-01', '2027-03-01',
   '["consent_form","privacy_page"]', true, now(), '00000000-0000-0000-0000-000000000101'),

  -- Consent text (Tagalog)
  ('consent_text', 'tl', 1, '00000000-0000-0000-0000-000000000102', 'Pahintulot sa Aplikasyon',
   'Sa pag-click ng "Sumasang-ayon ako":\n\n• Naiintindihan ko ang mga benepisyo at limitasyon ng Safe Card\n• Pumapayag ako na ibigay ang aking impormasyon para sa PRC Safe Card application\n• Naiintindihan ko na ang aking datos ay ipapadala sa PRC\n• Alam ko na maaari akong tumanggi o bawiin ang pahintulot kahit kailan\n• Ang pagbayad ay hindi nangangahulugang aktibo na ang membership — kailangan pa ng PRC confirmation',
   'Teksto ng pahintulot para sa aplikasyon',
   'approved', '00000000-0000-0000-0000-000000000102', now(), 'SafeCard Consent Framework', '2026-09-01', '2027-03-01',
   '["consent_form"]', true, now(), '00000000-0000-0000-0000-000000000101'),

  -- Claims education (Tagalog)
  ('claims_education', 'tl', 1, '00000000-0000-0000-0000-000000000102', 'Paano Mag-claim',
   'Kung may aksidente:\n\n1. Tumawag sa Hotline 143 para sa ambulansya\n2. I-report sa PRC sa loob ng 30 araw\n3. Isumite ang mga kailangan na dokumento sa loob ng 60 araw\n4. Ang PRC ang magde-desisyon sa claim\n\nMahalaga: Ang SafeCard platform ay hindi nagpo-proseso ng claim. Ang PRC lamang ang may kapangyarihan.',
   'Gabay sa pag-claim — emergency at proseso',
   'approved', '00000000-0000-0000-0000-000000000102', now(), 'PRC Claims Process Guide', '2026-08-15', '2027-02-15',
   '["claims_guide","membership_card"]', true, now(), '00000000-0000-0000-0000-000000000101'),

  -- Sponsor briefing (English)
  ('sponsor_briefing', 'en', 1, '00000000-0000-0000-0000-000000000102', 'Sponsor Briefing',
   'As a sponsor, you:\n\n• Share information about the Safe Card program\n• Invite a known household helper respectfully\n• Pay through official PRC channels\n• See only high-level status (not personal details)\n\nRemember:\n• The helper decides freely — no pressure\n• Payment does not equal activation\n• You cannot see their personal information\n• PRC confirms membership, not the platform',
   '60-second briefing for student sponsors',
   'approved', '00000000-0000-0000-0000-000000000102', now(), 'SafeCard Sponsor Guide', '2026-09-01', '2027-03-01',
   '["sponsor_page","landing_page"]', true, now(), '00000000-0000-0000-0000-000000000101');

-- ============================================================
-- Sample sponsor (Bea persona — synthetic)
-- ============================================================
insert into public.sponsors (
  id, campaign_id, display_name, is_minor, guardian_name, guardian_approved
) values (
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000010',
  'Bea N.',
  true,
  'Paolo N.',
  true
);

-- ============================================================
-- Sample referral link
-- ============================================================
insert into public.referral_links (
  id, sponsor_id, campaign_id, slug, is_active, activated_at, expires_at
) values (
  '00000000-0000-0000-0000-000000000301',
  '00000000-0000-0000-0000-000000000201',
  '00000000-0000-0000-0000-000000000010',
  'bea26a',
  true,
  now(),
  '2026-12-31T23:59:59Z'
);
