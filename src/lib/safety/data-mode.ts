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

export function assertDataModeAllowed(mode: DataMode): void {
  if (mode === 'live' && process.env.LAUNCH_GATES_COMPLETE !== 'true') {
    throw new LaunchGateError(
      'Live data collection is disabled until all launch gates are complete.',
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
