/**
 * Role-scoped field projection for staff case access
 *
 * The operations console shows the minimum profile a role needs to do
 * its job and nothing else. This is enforced by projecting columns in
 * the database query, not by hiding fields in the browser: a field that
 * is never selected cannot leak through a response body, a cached
 * payload or a devtools inspection.
 *
 * Two consequences worth stating plainly:
 *   - A finance reviewer verifying a payment does not receive an
 *     address, a date of birth or a guardian relationship.
 *   - A support agent receives the contact details needed to call
 *     someone back and nothing that would let them profile a recipient.
 *
 * There is no select('*') anywhere in the admin case path.
 */

import type { StaffRole } from '@/types/database';

/**
 * Profile columns, grouped by the reason a role would need them.
 * Every column named here exists on public.recipient_profiles.
 */
const IDENTITY_FIELDS = [
  'first_name',
  'middle_name',
  'last_name',
  'date_of_birth',
  'sex',
] as const;

const CONTACT_FIELDS = ['mobile_number', 'email'] as const;

const ADDRESS_FIELDS = [
  'address_line1',
  'address_line2',
  'city',
  'province',
  'zip_code',
] as const;

const PROGRESS_FIELDS = ['fields_completed', 'updated_at'] as const;

export type ProfileField =
  | (typeof IDENTITY_FIELDS)[number]
  | (typeof CONTACT_FIELDS)[number]
  | (typeof ADDRESS_FIELDS)[number]
  | (typeof PROGRESS_FIELDS)[number];

export interface CaseAccessPolicy {
  /** Profile columns this role may read. Empty means no profile at all. */
  profileFields: readonly ProfileField[];
  /** May read payment intents and evidence. */
  canViewPayments: boolean;
  /** May verify a payment or request replacement evidence. */
  canActOnPayments: boolean;
  /** May read the case audit timeline. */
  canViewAudit: boolean;
  /** May see application review controls. */
  canReviewApplication: boolean;
}

/**
 * What each staff role may see on a case.
 *
 * privacy_admin_owner is the accountable role and is the only one with
 * the full profile; it is also the most heavily audited.
 */
const POLICY: Record<StaffRole, CaseAccessPolicy> = {
  privacy_admin_owner: {
    profileFields: [
      ...IDENTITY_FIELDS,
      ...CONTACT_FIELDS,
      ...ADDRESS_FIELDS,
      ...PROGRESS_FIELDS,
    ],
    canViewPayments: true,
    canActOnPayments: false,
    canViewAudit: true,
    canReviewApplication: true,
  },

  // Reviews applications against school policy: needs to know who the
  // applicant is and whether the form is complete, not where they live.
  school_admin: {
    profileFields: [...IDENTITY_FIELDS, ...PROGRESS_FIELDS],
    canViewPayments: false,
    canActOnPayments: false,
    canViewAudit: true,
    canReviewApplication: true,
  },

  // Owns official handoff and confirmation. Needs the identity that PRC
  // will match against, and the handoff trail.
  prc_liaison: {
    profileFields: [...IDENTITY_FIELDS, ...PROGRESS_FIELDS],
    canViewPayments: true,
    canActOnPayments: false,
    canViewAudit: true,
    canReviewApplication: false,
  },

  // Calls people back. Needs a name and a contact method; nothing else.
  support_agent: {
    profileFields: ['first_name', 'last_name', ...CONTACT_FIELDS, ...PROGRESS_FIELDS],
    canViewPayments: false,
    canActOnPayments: false,
    canViewAudit: false,
    canReviewApplication: false,
  },

  // Verifies money against evidence. Needs the name on the receipt to
  // match it, and no other profile field whatsoever.
  finance_export: {
    profileFields: ['first_name', 'last_name'],
    canViewPayments: true,
    canActOnPayments: true,
    canViewAudit: true,
    canReviewApplication: false,
  },

  // Approves published content. Has no business on an individual case.
  content_approver: {
    profileFields: [],
    canViewPayments: false,
    canActOnPayments: false,
    canViewAudit: false,
    canReviewApplication: false,
  },
};

/**
 * Combine the policies of every role a user holds.
 *
 * A user with two roles gets the union of both, which is the same
 * access they would have by switching between two console sessions.
 * Returns null when the user holds no role that may open a case.
 */
export function resolveCaseAccessPolicy(roles: StaffRole[]): CaseAccessPolicy | null {
  const applicable = roles.filter((role) => role in POLICY);
  if (applicable.length === 0) return null;

  const fields = new Set<ProfileField>();
  let canViewPayments = false;
  let canActOnPayments = false;
  let canViewAudit = false;
  let canReviewApplication = false;

  for (const role of applicable) {
    const policy = POLICY[role];
    policy.profileFields.forEach((field) => fields.add(field));
    canViewPayments ||= policy.canViewPayments;
    canActOnPayments ||= policy.canActOnPayments;
    canViewAudit ||= policy.canViewAudit;
    canReviewApplication ||= policy.canReviewApplication;
  }

  const hasAnyCaseAccess =
    fields.size > 0 || canViewPayments || canViewAudit || canReviewApplication;
  if (!hasAnyCaseAccess) return null;

  return {
    profileFields: [...fields],
    canViewPayments,
    canActOnPayments,
    canViewAudit,
    canReviewApplication,
  };
}

/**
 * Build the explicit column list for a profile query.
 * Returns null when the role may not read any profile field, which the
 * caller must treat as "do not query the profile table at all".
 */
export function profileSelectClause(policy: CaseAccessPolicy): string | null {
  if (policy.profileFields.length === 0) return null;
  return policy.profileFields.join(',');
}

export const CASE_ACCESS_POLICY_BY_ROLE: Readonly<Record<StaffRole, CaseAccessPolicy>> =
  POLICY;
