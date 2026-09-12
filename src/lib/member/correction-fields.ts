/**
 * The fields an applicant may correct.
 *
 * Deliberately a fixed list rather than "whatever the profile table
 * holds": a correction form must not become a way to write columns the
 * intake flow never collected.
 *
 * Kept free of `server-only` so the form, the copy tests and the server
 * all read the same list rather than three drifting copies.
 */
export const CORRECTABLE_FIELDS = [
  'first_name',
  'middle_name',
  'last_name',
  'date_of_birth',
  'sex',
  'civil_status',
  'address_line1',
  'address_line2',
  'city',
  'province',
  'zip_code',
  'mobile_number',
  'email',
] as const;

export type CorrectableField = (typeof CORRECTABLE_FIELDS)[number];

export const CORRECTABLE_SELECT = CORRECTABLE_FIELDS.join(',');
