import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ACCESS_SOURCE = readFileSync(
  join(process.cwd(), 'src/lib/admin/access.ts'),
  'utf8',
);
const USER_MANAGEMENT_SOURCE = readFileSync(
  join(process.cwd(), 'src/components/admin/UserManagement.tsx'),
  'utf8',
);
const VALIDATION_SOURCE = readFileSync(
  join(process.cwd(), 'src/lib/validation/schemas.ts'),
  'utf8',
);
const ASSIGN_ROUTE = readFileSync(
  join(process.cwd(), 'src/app/api/admin/roles/assign/route.ts'),
  'utf8',
);
const REVOKE_ROUTE = readFileSync(
  join(process.cwd(), 'src/app/api/admin/roles/revoke/route.ts'),
  'utf8',
);
const ROLE_MIGRATION = readFileSync(
  join(process.cwd(), 'supabase/migrations/00017_atomic_staff_roles.sql'),
  'utf8',
);

describe('campaign-scoped staff roles', () => {
  it('requires exactly one role-assignment scope', () => {
    expect(VALIDATION_SOURCE).toContain(
      'Boolean(value.organization_id) !== Boolean(value.campaign_id)',
    );
    expect(VALIDATION_SOURCE).toContain(
      'Exactly one of organization_id or campaign_id is required',
    );
  });

  it('does not expand a campaign assignment into organization-wide access', () => {
    expect(ACCESS_SOURCE).toContain('.filter((assignment) => !assignment.campaign_id)');
    expect(ACCESS_SOURCE).toContain('!assignment.campaign_id');
    expect(ACCESS_SOURCE).toContain('rolesByCampaign');
  });

  it('sends campaign role assignments with campaign scope only', () => {
    const assignmentPayload = USER_MANAGEMENT_SOURCE.slice(
      USER_MANAGEMENT_SOURCE.indexOf('function assignRole'),
      USER_MANAGEMENT_SOURCE.indexOf('async function revoke'),
    );
    expect(assignmentPayload).toContain('campaign_id: campaignId');
    expect(assignmentPayload).not.toContain('organization_id:');
  });

  it('commits each role change and its audit event atomically', () => {
    expect(ASSIGN_ROUTE).toContain("'assign_staff_role_atomic'");
    expect(REVOKE_ROUTE).toContain("'revoke_staff_role_atomic'");
    expect(ROLE_MIGRATION).toContain('insert into public.role_assignments');
    expect(ROLE_MIGRATION).toContain('update public.role_assignments');
    expect(ROLE_MIGRATION.match(/insert into public\.audit_events/g)).toHaveLength(3);
    expect(ROLE_MIGRATION).toContain('The last privacy administrator cannot be revoked');
    expect(ROLE_MIGRATION).toContain('provision_invited_staff_atomic');
    expect(ROLE_MIGRATION).toContain('from public, anon, authenticated');
    expect(ROLE_MIGRATION).toContain('to service_role');
  });
});
