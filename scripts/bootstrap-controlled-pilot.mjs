import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { benefitStoryboards } from '../src/lib/benefit-storyboards.ts';

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

if (process.env.APP_ENVIRONMENT !== 'production') throw new Error('APP_ENVIRONMENT=production is required.');
if (process.env.CONFIRM_CONTROLLED_PILOT_BOOTSTRAP !== 'YES') throw new Error('Set CONFIRM_CONTROLLED_PILOT_BOOTSTRAP=YES after reviewing the controlled pilot configuration.');

const url = required('NEXT_PUBLIC_SUPABASE_URL');
const serviceRoleKey = required('SUPABASE_SERVICE_ROLE_KEY');
const email = required('BOOTSTRAP_ADMIN_EMAIL').toLowerCase();
const fullName = required('BOOTSTRAP_ADMIN_NAME');
const configPath = process.env.CONTROLLED_PILOT_CONFIG_PATH ?? 'config/controlled-pilot.example.json';
const config = JSON.parse(await readFile(configPath, 'utf8'));
const admin = createClient(url, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });

if (!Array.isArray(config.content) || !config.content.some((item) => item.locale === 'tl' && item.content_type === 'privacy_notice') || !config.content.some((item) => item.locale === 'en' && item.content_type === 'privacy_notice') || !config.content.some((item) => item.locale === 'tl' && item.content_type === 'consent_text') || !config.content.some((item) => item.locale === 'en' && item.content_type === 'consent_text')) {
  throw new Error('The configuration must include English and Filipino privacy_notice and consent_text records.');
}
if (Number(config.campaign?.membership_fee) !== 1200) throw new Error('The controlled pilot fee must be PHP 1,200.');
if (!config.campaign?.approved_payment_routes?.some((route) => route.type === 'gcash' && route.is_active) || !config.campaign?.approved_payment_routes?.some((route) => route.type === 'bank_transfer' && route.is_active)) {
  throw new Error('The controlled pilot must explicitly approve GCash and bank transfer routes.');
}
const bankRoute = config.campaign.approved_payment_routes.find((route) => route.type === 'bank_transfer' && route.is_active);
if (bankRoute?.details?.bpi_account_number !== '002963000782B') {
  throw new Error('The controlled pilot must use the confirmed BPI account number 002963000782B.');
}

let authUser;
const { data: users, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (usersError) throw usersError;
authUser = users.users.find((user) => user.email?.toLowerCase() === email);
if (!authUser) {
  const appUrl = required('NEXT_PUBLIC_APP_URL');
  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, { redirectTo: `${appUrl.replace(/\/$/, '')}/auth/callback?next=/admin/setup`, data: { full_name: fullName } });
  if (error || !data.user) throw error ?? new Error('Supabase did not return the invited administrator.');
  authUser = data.user;
}

const { error: userError } = await admin.from('users').upsert({ id: authUser.id, email, full_name: fullName, is_active: true, metadata: { provisioned_by: 'controlled-pilot-bootstrap' } }, { onConflict: 'id' });
if (userError) throw userError;

const { data: organization, error: organizationError } = await admin.from('organizations').upsert({ ...config.organization, is_active: true, metadata: { controlled_pilot: true } }, { onConflict: 'slug' }).select('id').single();
if (organizationError || !organization) throw organizationError ?? new Error('Organization was not created.');

const campaignPayload = { ...config.campaign, organization_id: organization.id, is_active: false, metadata: { controlled_pilot: true, content_status: 'temporary-governed-pilot' } };
const { data: campaign, error: campaignError } = await admin.from('pilot_campaigns').upsert(campaignPayload, { onConflict: 'slug' }).select('id').single();
if (campaignError || !campaign) throw campaignError ?? new Error('Campaign was not created.');

for (const item of config.content) {
  const payload = { ...item, created_by: authUser.id, approval_status: 'approved', approved_by: authUser.id, approved_at: new Date().toISOString(), is_published: true, published_at: new Date().toISOString(), published_by: authUser.id, review_date: config.campaign.end_date, affected_surfaces: ['public_application', 'privacy', 'admin_review', 'member_status'], metadata: { controlled_pilot: true, final_prc_policy: false } };
  const { error } = await admin.from('content_versions').upsert(payload, { onConflict: 'content_type,locale,version' });
  if (error) throw error;
}

const benefitPayload = {
  content_type: 'benefit', locale: 'en', version: 1,
  created_by: authUser.id, title: 'SafeCard benefit storyboard — Controlled Pilot',
  body: JSON.stringify({ cards: benefitStoryboards }),
  summary: 'Bilingual temporary governed benefit scenarios for the controlled pilot.',
  approval_status: 'approved', approved_by: authUser.id, approved_at: new Date().toISOString(),
  is_published: true, published_at: new Date().toISOString(), published_by: authUser.id,
  source: 'SafeCard controlled pilot governance — owner-authorized, not final PRC policy',
  review_date: config.campaign.end_date,
  affected_surfaces: ['landing_page', 'benefits', 'public_application', 'admin_review', 'member_status'],
  metadata: { controlled_pilot: true, final_prc_policy: false },
};
const { error: benefitError } = await admin.from('content_versions').upsert(benefitPayload, { onConflict: 'content_type,locale,version' });
if (benefitError) throw benefitError;

const { data: existingRole, error: roleLookupError } = await admin.from('role_assignments').select('id').eq('user_id', authUser.id).eq('role', 'privacy_admin_owner').eq('organization_id', organization.id).is('campaign_id', null).eq('is_active', true).maybeSingle();
if (roleLookupError) throw roleLookupError;
if (!existingRole) {
  const { error } = await admin.from('role_assignments').insert({ user_id: authUser.id, role: 'privacy_admin_owner', organization_id: organization.id, campaign_id: null, granted_by: authUser.id, reason: 'Initial administrator bootstrap for the controlled pilot' });
  if (error) throw error;
}

console.log(JSON.stringify({ administrator: email, administratorUserId: authUser.id, organizationId: organization.id, campaignId: campaign.id, campaignActive: false, next: 'Review the records in the admin console, provision required campaign roles, then activate the campaign explicitly.' }, null, 2));
