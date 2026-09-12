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
  it('gives finance reviewers payment access without unrelated profile fields', () => {
    const policy = resolveCaseAccessPolicy(['finance_export']);
    expect(policy).not.toBeNull();
    expect(policy?.canViewPayments).toBe(true);
    expect(policy?.canActOnPayments).toBe(true);

    for (const field of SENSITIVE_PROFILE_FIELDS) {
      expect(policy?.profileFields).not.toContain(field);
    }
    // Only enough to match a name against a receipt.
    expect(policy?.profileFields).toEqual(['first_name', 'last_name']);
  });

  it('limits support agents to callback details and no payment access', () => {
    const policy = resolveCaseAccessPolicy(['support_agent']);
    expect(policy?.canViewPayments).toBe(false);
    expect(policy?.canActOnPayments).toBe(false);
    expect(policy?.profileFields).toContain('mobile_number');
    expect(policy?.profileFields).not.toContain('date_of_birth');
    expect(policy?.profileFields).not.toContain('address_line1');
  });

  it('does not let a school admin reach payment evidence', () => {
    const policy = resolveCaseAccessPolicy(['school_admin']);
    expect(policy?.canReviewApplication).toBe(true);
    expect(policy?.canViewPayments).toBe(false);
    expect(policy?.canActOnPayments).toBe(false);
  });

  it('never grants payment actions to a role other than finance', () => {
    for (const [role, policy] of Object.entries(CASE_ACCESS_POLICY_BY_ROLE)) {
      if (role === 'finance_export') continue;
      expect(policy.canActOnPayments).toBe(false);
    }
  });

  it('returns no policy for a content approver, who has no case business', () => {
    expect(resolveCaseAccessPolicy(['content_approver'])).toBeNull();
  });

  it('returns no policy when the user holds no staff role', () => {
    expect(resolveCaseAccessPolicy([])).toBeNull();
  });

  it('unions the policies of multiple roles', () => {
    const policy = resolveCaseAccessPolicy(['support_agent', 'finance_export']);
    expect(policy?.canActOnPayments).toBe(true);
    expect(policy?.profileFields).toContain('mobile_number');
    // The union is still narrower than the full profile.
    expect(policy?.profileFields).not.toContain('address_line1');
  });

  it('builds an explicit select clause and never a wildcard', () => {
    const policy = resolveCaseAccessPolicy(['finance_export']);
    const clause = profileSelectClause(policy!);
    expect(clause).toBe('first_name,last_name');
    expect(clause).not.toContain('*');
  });

  it('signals "do not query the profile table" when no field is readable', () => {
    const policy = resolveCaseAccessPolicy(['prc_liaison']);
    expect(profileSelectClause({ ...policy!, profileFields: [] })).toBeNull();
  });
});
