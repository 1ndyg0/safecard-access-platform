import 'server-only';

import { z } from 'zod';

export const dataModeSchema = z.enum(['synthetic', 'live']);
export type DataMode = z.infer<typeof dataModeSchema>;

export class LaunchGateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LaunchGateError';
  }
}

export type RuntimeEnvironment = 'development' | 'test' | 'preview' | 'production';

function runtimeEnvironment(): RuntimeEnvironment {
  const explicit = process.env.APP_ENVIRONMENT;
  if (explicit === 'development' || explicit === 'test' || explicit === 'preview' || explicit === 'production') {
    return explicit;
  }
  if (process.env.VERCEL_ENV === 'production') return 'production';
  if (process.env.VERCEL_ENV === 'preview') return 'preview';
  if (process.env.NODE_ENV === 'test') return 'test';
  return 'development';
}

function requireLiveConfiguration(): void {
  const required = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    'NEXT_PUBLIC_APP_URL',
    'SUPABASE_SERVICE_ROLE_KEY',
    'PAYMENT_PROOFS_BUCKET',
    'APPROVED_CAMPAIGN_ID',
    'APPROVED_CONTENT_VERSION',
    'AUDIT_HASH_SALT',
    'RATE_LIMIT_HASH_SALT',
    'MEMBER_SESSION_SECRET',
    'CRON_SECRET',
  ] as const;
  const missing = required.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    throw new LaunchGateError(`Live configuration is incomplete: ${missing.join(', ')}.`);
  }
  if (!/^https:\/\/.+\.supabase\.co$/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')) {
    throw new LaunchGateError('NEXT_PUBLIC_SUPABASE_URL must be an HTTPS Supabase project URL.');
  }
  if (!/^https:\/\//.test(process.env.NEXT_PUBLIC_APP_URL ?? '')) {
    throw new LaunchGateError('NEXT_PUBLIC_APP_URL must use HTTPS in live mode.');
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(process.env.APPROVED_CAMPAIGN_ID ?? '')) {
    throw new LaunchGateError('APPROVED_CAMPAIGN_ID must identify the reviewed production campaign.');
  }
  if (!/^\d+$/.test(process.env.APPROVED_CONTENT_VERSION ?? '') || Number(process.env.APPROVED_CONTENT_VERSION) < 1) {
    throw new LaunchGateError('APPROVED_CONTENT_VERSION must be a positive integer.');
  }
  for (const name of ['AUDIT_HASH_SALT', 'RATE_LIMIT_HASH_SALT', 'MEMBER_SESSION_SECRET', 'CRON_SECRET'] as const) {
    if ((process.env[name]?.length ?? 0) < 32) {
      throw new LaunchGateError(`Live configuration requires ${name} to contain at least 32 characters.`);
    }
  }
  if (process.env.ENABLE_OFFICIAL_PAYMENT_HANDOFF !== 'true') {
    throw new LaunchGateError('Live configuration requires the approved payment handoff to be enabled.');
  }
}

export function assertDataModeAllowed(mode: DataMode): void {
  const configured = resolveDataMode();
  if (mode !== configured) {
    throw new LaunchGateError(
      `The request data mode does not match the deployment data mode (${configured}).`,
    );
  }
}

export function assertSyntheticProfile(
  profile: Record<string, unknown>,
  partial = false,
): void {
  const name = `${String(profile.first_name ?? '')} ${String(profile.last_name ?? '')}`;
  const email = String(profile.email ?? '');
  const mobile = String(profile.mobile_number ?? '');

  const hasName = 'first_name' in profile || 'last_name' in profile;
  const hasEmail = 'email' in profile;
  const hasMobile = 'mobile_number' in profile;
  const textualLocationFields = ['address_line1', 'address_line2', 'city', 'province'] as const;
  const locationValues = textualLocationFields
    .filter((field) => field in profile && profile[field])
    .map((field) => String(profile[field]));
  const locationsMarked = locationValues.every((value) => /\b(test|synthetic|demo)\b/i.test(value));
  const dobIsSynthetic = !('date_of_birth' in profile)
    || profile.date_of_birth === undefined
    || profile.date_of_birth === '2000-01-01';
  const zipIsSynthetic = !('zip_code' in profile)
    || profile.zip_code === undefined
    || profile.zip_code === '0000';
  const markedName = (!hasName && partial) || /\b(test|synthetic|demo)\b/i.test(name);
  const markedEmail = (!hasEmail && partial) || !email || /@(?:example\.com|example\.invalid|test\.invalid)$/i.test(email);
  const markedMobile = (!hasMobile && partial) || /^(?:09000000000|09999999999|\+639000000000)$/.test(mobile);

  if (!markedName || !markedEmail || !markedMobile || !locationsMarked || !dobIsSynthetic || !zipIsSynthetic) {
    throw new LaunchGateError(
      'Synthetic mode requires visibly marked names/locations and the approved synthetic DOB, ZIP, email, and mobile values.',
    );
  }
}

export function assertProfileDataAllowed(
  mode: DataMode,
  profile: Record<string, unknown>,
  partial = false,
): void {
  assertDataModeAllowed(mode);
  if (mode === 'synthetic') assertSyntheticProfile(profile, partial);
}

export function assertSyntheticText(mode: DataMode, value: string | undefined): void {
  assertDataModeAllowed(mode);
  if (mode === 'synthetic' && value) {
    const visiblySynthetic = /^(?:\[?TEST\]?|SYNTHETIC|DEMO)(?:[- _][A-Z0-9 .,:;!?]{0,160})?$/i.test(value);
    const resemblesContact = /@|(?:\+?63|0)9\d{9}/.test(value);
    if (!visiblySynthetic || resemblesContact) {
      throw new LaunchGateError('Synthetic text must be a short, visibly marked TEST/SYNTHETIC value without contact data.');
    }
  }
}

export function assertSponsorDataAllowed(
  mode: DataMode,
  input: { displayName: string; guardianName?: string; guardianContact?: string },
): void {
  assertDataModeAllowed(mode);
  if (mode !== 'synthetic') return;
  const namesMarked = /\b(test|synthetic|demo)\b/i.test(
    `${input.displayName} ${input.guardianName ?? ''}`,
  );
  const contact = input.guardianContact ?? '';
  const contactIsSynthetic = !contact
    || /@(?:example\.com|example\.invalid|test\.invalid)$/i.test(contact)
    || /^(?:09000000000|09999999999|\+639000000000)$/.test(contact);
  if (!namesMarked || !contactIsSynthetic) {
    throw new LaunchGateError(
      'Synthetic sponsor data requires a TEST/SYNTHETIC name and a reserved contact value.',
    );
  }
}

/**
 * Derive the active data mode on the server.
 *
 * Existing intake routes carry `data_mode` so the server can reject a
 * client from a differently configured deployment. The environment is
 * authoritative: production requires a complete live configuration and
 * fails closed, while development/test may select the isolated synthetic
 * regime explicitly or by its safe default.
 */
export function resolveDataMode(): DataMode {
  const environment = runtimeEnvironment();
  const configured = process.env.NEXT_PUBLIC_DATA_MODE;
  if (configured !== undefined && configured !== 'synthetic' && configured !== 'live') {
    throw new LaunchGateError('NEXT_PUBLIC_DATA_MODE must be either synthetic or live.');
  }
  if (environment === 'production') {
    if (configured !== 'live' || process.env.LAUNCH_GATES_COMPLETE !== 'true') {
      throw new LaunchGateError('Production requires NEXT_PUBLIC_DATA_MODE=live and LAUNCH_GATES_COMPLETE=true.');
    }
    requireLiveConfiguration();
    return 'live';
  }
  if (configured === 'live') {
    if (process.env.LAUNCH_GATES_COMPLETE !== 'true') {
      throw new LaunchGateError('Live data collection is disabled until all launch gates are complete.');
    }
    requireLiveConfiguration();
    return 'live';
  }
  return 'synthetic';
}
