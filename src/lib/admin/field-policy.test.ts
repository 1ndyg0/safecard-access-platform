import { describe, expect, it } from 'vitest';
import {
  CASE_ACCESS_POLICY_BY_ROLE,
  profileSelectClause,
  resolveCaseAccessPolicy,
} from './field-policy';

const SENSITIVE_PROFILE_FIELDS = [
  'date_of_birth',
  'sex',
  'address_line1',
  'address_line2',
  'city',
  'province',
  'zip_code',
] as const;

describe('role-scoped case access', () => {
  it('gives administrator reviewers payment access with identity fields only', () => {
    for (const role of ['privacy_admin_owner', 'school_admin'] as const) {
      const policy = resolveCaseAccessPolicy([role]);
      expect(policy?.canReviewApplication).toBe(true);
      expect(policy?.canViewPayments).toBe(true);
      expect(policy?.canActOnPayments).toBe(true);
    }
    // A school administrator sees who the applicant is, not where they live.
    const school = resolveCaseAccessPolicy(['school_admin']);
    for (const field of SENSITIVE_PROFILE_FIELDS.filter((f) => f !== 'date_of_birth' && f !== 'sex')) {
      expect(school?.profileFields).not.toContain(field);
    }
  });

  it('limits support agents to callback details and no payment access', () => {
    const policy = resolveCaseAccessPolicy(['support_agent']);
    expect(policy?.canViewPayments).toBe(false);
    expect(policy?.canActOnPayments).toBe(false);
    expect(policy?.profileFields).toContain('mobile_number');
    expect(policy?.profileFields).not.toContain('date_of_birth');
    expect(policy?.profileFields).not.toContain('address_line1');
  });

  it('never grants payment actions to support or content roles', () => {
    for (const role of ['support_agent', 'content_approver'] as const) {
      expect(CASE_ACCESS_POLICY_BY_ROLE[role].canActOnPayments).toBe(false);
      expect(CASE_ACCESS_POLICY_BY_ROLE[role].canViewPayments).toBe(false);
    }
  });

  it('has no policy for the retired PRC liaison and finance roles', () => {
    expect(Object.keys(CASE_ACCESS_POLICY_BY_ROLE).sort()).toEqual([
      'content_approver',
      'privacy_admin_owner',
      'school_admin',
      'support_agent',
    ]);
  });

  it('returns no policy for a content approver, who has no case business', () => {
    expect(resolveCaseAccessPolicy(['content_approver'])).toBeNull();
  });

  it('returns no policy when the user holds no staff role', () => {
    expect(resolveCaseAccessPolicy([])).toBeNull();
  });

  it('unions the policies of multiple roles', () => {
    const policy = resolveCaseAccessPolicy(['support_agent', 'school_admin']);
    expect(policy?.canActOnPayments).toBe(true);
    expect(policy?.profileFields).toContain('mobile_number');
    // The union is still narrower than the full profile.
    expect(policy?.profileFields).not.toContain('address_line1');
  });

  it('builds an explicit select clause and never a wildcard', () => {
    const policy = resolveCaseAccessPolicy(['support_agent']);
    const clause = profileSelectClause(policy!);
    expect(clause).toBe('first_name,last_name,mobile_number,email,fields_completed,updated_at');
    expect(clause).not.toContain('*');
  });

  it('signals "do not query the profile table" when no field is readable', () => {
    const policy = resolveCaseAccessPolicy(['support_agent']);
    expect(profileSelectClause({ ...policy!, profileFields: [] })).toBeNull();
  });
});
