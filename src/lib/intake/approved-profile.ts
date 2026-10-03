import type { SupabaseClient } from '@supabase/supabase-js';

export const APPLICATION_PROFILE_FIELDS = [
  'first_name', 'middle_name', 'last_name', 'date_of_birth', 'sex',
  'civil_status', 'address_line1', 'address_line2', 'city', 'province',
  'zip_code', 'mobile_number', 'email',
] as const;

export function assertApprovedProfileFields(
  approvedFields: unknown,
  profile: Record<string, unknown>,
): void {
  if (!Array.isArray(approvedFields) || approvedFields.length === 0
    || approvedFields.some((field) => typeof field !== 'string')) {
    throw new Error('Cannot save applicant details: approved application fields are not configured');
  }
  const allowed = new Set(approvedFields);
  const known = new Set<string>(APPLICATION_PROFILE_FIELDS);
  if (Object.keys(profile).some((field) => !known.has(field) || !allowed.has(field))) {
    throw new Error('Cannot save applicant details: a submitted field is not approved for this application');
  }
}

export async function requireApprovedProfileFields(
  admin: SupabaseClient,
  campaignId: string,
  profile: Record<string, unknown>,
): Promise<void> {
  const { data, error } = await admin.from('pilot_campaigns')
    .select('approved_fields').eq('id', campaignId).single();
  if (error || !data) {
    throw new Error('Cannot save applicant details: approved application fields could not be verified');
  }
  assertApprovedProfileFields(data.approved_fields, profile);
}
