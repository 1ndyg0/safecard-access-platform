import { describe, expect, it } from 'vitest';
import { APPLICATION_PROFILE_FIELDS, assertApprovedProfileFields } from './approved-profile';

describe('campaign-approved applicant data', () => {
  it('accepts only known fields explicitly approved by the campaign', () => {
    expect(() => assertApprovedProfileFields(APPLICATION_PROFILE_FIELDS, {
      first_name: 'Test', last_name: 'Applicant',
    })).not.toThrow();
    expect(() => assertApprovedProfileFields(['first_name'], {
      first_name: 'Test', email: 'test@example.com',
    })).toThrow('not approved');
    expect(() => assertApprovedProfileFields(['first_name', 'fields_completed'], {
      first_name: 'Test', fields_completed: true,
    })).toThrow('not approved');
  });

  it('refuses missing or malformed approval configuration', () => {
    for (const fields of [null, [], {}, ['first_name', 1]]) {
      expect(() => assertApprovedProfileFields(fields, { first_name: 'Test' }))
        .toThrow('not configured');
    }
  });
});
