import { describe, expect, it } from 'vitest';
import { recipientProfileSchema } from './schemas';

const base = {
  first_name: 'Test',
  last_name: 'Applicant',
  date_of_birth: '1997-06-07',
  sex: 'female' as const,
  address_line1: 'Matina',
  city: 'Davao City',
  province: 'Davao del Sur',
  zip_code: '8000',
  mobile_number: '09123456789',
};

describe('recipientProfileSchema optional email', () => {
  it('accepts a blank email as absent', () => {
    const parsed = recipientProfileSchema.safeParse({ ...base, email: '' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.email).toBeUndefined();
  });

  it('accepts a missing email', () => {
    expect(recipientProfileSchema.safeParse(base).success).toBe(true);
  });

  it('still rejects a malformed email', () => {
    expect(recipientProfileSchema.safeParse({ ...base, email: 'not-an-email' }).success).toBe(false);
  });
});
