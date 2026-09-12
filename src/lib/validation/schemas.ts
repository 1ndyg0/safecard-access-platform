/**
 * SafeCard validation schemas (Zod)
 *
 * Every input to a server action or API route is validated here.
 * Field-level validation messages are in plain language for
 * low-literacy / non-English users (Filipino translations added alongside).
 */

import { z } from 'zod';
import { dataModeSchema } from '@/lib/safety/data-mode';

// ============================================================
// Shared primitives
// ============================================================

export const uuidSchema = z.string().uuid('Invalid ID format');

export const idempotencyKeySchema = z
  .string()
  .min(16, 'Idempotency key must be at least 16 characters')
  .max(128, 'Idempotency key must be at most 128 characters');

export const localeSchema = z.enum(['en', 'tl', 'ceb']);

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ============================================================
// Referral link
// ============================================================

export const createReferralLinkSchema = z.object({
  sponsor_id: uuidSchema,
  campaign_id: uuidSchema,
  expires_at: z.string().datetime().optional(),
  idempotency_key: idempotencyKeySchema,
});

export const validateReferralSlugSchema = z.object({
  slug: z
    .string()
    .min(4, 'Referral code is too short')
    .max(32, 'Referral code is too long')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid referral code format'),
});

// ============================================================
// Sponsor
// ============================================================

export const createSponsorSchema = z.object({
  campaign_id: uuidSchema,
  display_name: z
    .string()
    .min(2, 'Name must be at least 2 characters')
    .max(100, 'Name must be at most 100 characters'),
  is_minor: z.boolean(),
  guardian_name: z.string().max(100).optional(),
  guardian_contact: z.string().max(100).optional(),
  data_mode: dataModeSchema,
}).superRefine((value, context) => {
  if (value.is_minor && (!value.guardian_name || !value.guardian_contact)) {
    context.addIssue({
      code: 'custom',
      path: ['guardian_name'],
      message: 'Guardian name and contact are required for a minor sponsor',
    });
  }
});

// ============================================================
// Recipient application (approved fields only)
// ============================================================

export const recipientProfileSchema = z.object({
  first_name: z
    .string()
    .min(1, 'First name is required / Kailangan ang pangalan')
    .max(100),
  middle_name: z.string().max(100).optional(),
  last_name: z
    .string()
    .min(1, 'Last name is required / Kailangan ang apelyido')
    .max(100),
  date_of_birth: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format')
    .refine((val) => {
      const dob = new Date(val);
      const now = new Date();
      const age = now.getFullYear() - dob.getFullYear();
      return age >= 3 && age <= 85;
    }, 'Age must be between 3 and 85 years / Edad ay dapat 3 hanggang 85 taon'),
  sex: z.enum(['male', 'female']),
  civil_status: z
    .string()
    .max(30)
    .optional(),
  address_line1: z
    .string()
    .min(1, 'Address is required / Kailangan ang address')
    .max(200),
  address_line2: z.string().max(200).optional(),
  city: z
    .string()
    .min(1, 'City is required / Kailangan ang lungsod')
    .max(100),
  province: z
    .string()
    .min(1, 'Province is required / Kailangan ang probinsya')
    .max(100),
  zip_code: z
    .string()
    .regex(/^\d{4}$/, 'ZIP code must be 4 digits / ZIP code ay dapat 4 na numero'),
  mobile_number: z
    .string()
    .regex(
      /^(09|\+639)\d{9}$/,
      'Mobile number format: 09XXXXXXXXX / Format ng numero: 09XXXXXXXXX'
    ),
  email: z.string().email('Invalid email format').optional(),
});

// ============================================================
// Consent
// ============================================================

export const grantConsentSchema = z.object({
  case_id: uuidSchema,
  consent_type: z.enum([
    'membership_application',
    'data_processing',
    'notification_opt_in',
  ]),
  consent_content_version_id: uuidSchema,
  privacy_notice_version_id: uuidSchema,
  locale: localeSchema,
  idempotency_key: idempotencyKeySchema,
});

export const withdrawConsentSchema = z.object({
  case_id: uuidSchema,
  consent_record_id: uuidSchema,
  reason: z
    .string()
    .min(1, 'Please provide a reason for withdrawal')
    .max(500),
  requested_by: z.enum(['recipient', 'guardian']),
});

// ============================================================
// Application submission
// ============================================================

export const submitApplicationSchema = z.object({
  case_id: uuidSchema,
  consent_record_id: uuidSchema,
  content_versions_seen: z.array(uuidSchema).min(1),
  privacy_notice_version_id: uuidSchema,
  profile_data: recipientProfileSchema,
  submitted_by: z.enum(['recipient', 'assisted_entry']),
  assisted_by_name: z.string().max(100).optional(),
  idempotency_key: idempotencyKeySchema,
  data_mode: dataModeSchema,
});

// ============================================================
// Payment handoff
// ============================================================

export const createPaymentIntentSchema = z.object({
  case_id: uuidSchema,
  campaign_id: uuidSchema,
  payer_type: z.enum(['sponsor', 'guardian', 'other']),
  payer_name: z.string().max(100).optional(),
  payer_sponsor_id: uuidSchema.optional(),
  expected_amount: z.number().positive(),
  payment_route: z.string().min(1).max(50),
  idempotency_key: idempotencyKeySchema,
  data_mode: dataModeSchema,
});

export const markPaymentPaidSchema = z.object({
  payment_intent_id: uuidSchema,
  payment_reference: z
    .string()
    .min(1, 'Payment reference is required')
    .max(100),
  payer_declaration: z.string().trim().min(10).max(500),
  data_mode: dataModeSchema,
});

// ============================================================
// PRC export
// ============================================================

export const createExportBatchSchema = z.strictObject({
  campaign_id: uuidSchema,
  creation_reason: z
    .string()
    .min(10, 'Please provide a detailed reason for this export')
    .max(500),
  case_ids: z.array(uuidSchema).min(1).max(100),
  format: z.enum(['csv', 'json']).default('csv'),
});

export const acknowledgePrcItemSchema = z.strictObject({
  export_item_id: uuidSchema,
  prc_status: z.enum([
    'acknowledged',
    'correction_requested',
    'accepted',
    'rejected',
  ]),
  prc_notes: z.string().trim().max(1000).optional(),
  correction_reason: z.string().trim().min(10).max(500).optional(),
  correction_fields: z.record(z.string(), z.unknown()).optional(),
  prc_membership_id: z.string().max(50).optional(),
  prc_effective_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  prc_expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).superRefine((value, context) => {
  if (value.prc_status === 'accepted' && (!value.prc_membership_id || !value.prc_effective_date)) {
    context.addIssue({
      code: 'custom',
      path: ['prc_membership_id'],
      message: 'Accepted records require a PRC membership ID and effective date',
    });
  }
  if (value.prc_status === 'correction_requested' && !value.correction_reason) {
    context.addIssue({
      code: 'custom',
      path: ['correction_reason'],
      message: 'A correction reason is required',
    });
  }
});

// ============================================================
// Support case
// ============================================================

export const createSupportCaseSchema = z.object({
  case_id: uuidSchema.optional(),
  campaign_id: uuidSchema.optional(),
  category: z.enum([
    'general_question',
    'trouble_applying',
    'payment_handoff_issue',
    'correction_request',
    'consent_withdrawal',
    'privacy_request',
    'emergency_claims_education',
    'prc_handoff_issue',
  ]),
  subject: z
    .string()
    .min(5, 'Subject is too short')
    .max(200),
  description: z
    .string()
    .min(10, 'Please provide more details')
    .max(2000),
  contact_method: z.string().max(100).optional(),
  is_privacy_request: z.boolean().default(false),
  privacy_request_type: z
    .enum([
      'consent_withdrawal',
      'data_correction',
      'access_request',
      'deletion_request',
      'incident_report',
    ])
    .optional(),
  idempotency_key: idempotencyKeySchema.optional(),
  data_mode: dataModeSchema,
});

// ============================================================
// Content version (staff/admin)
// ============================================================

export const createContentVersionSchema = z.object({
  content_type: z.enum([
    'benefit', 'exclusion', 'eligibility', 'privacy_notice',
    'consent_text', 'support_text', 'claims_education', 'faq',
    'sponsor_briefing', 'invitation_script',
  ]),
  locale: localeSchema,
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(50000),
  summary: z.string().max(500).optional(),
  source: z.string().max(500).optional(),
  source_last_updated: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  review_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  expiry_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  affected_surfaces: z.array(z.string()).default([]),
  supersedes_id: uuidSchema.optional(),
  change_summary: z.string().max(1000).optional(),
  is_material_change: z.boolean().default(false),
});

export const approveContentSchema = z.object({
  content_version_id: uuidSchema,
});

export const publishContentSchema = z.object({
  content_version_id: uuidSchema,
});

// ============================================================
// Role assignment (admin)
// ============================================================

export const assignRoleSchema = z.strictObject({
  user_id: uuidSchema,
  role: z.enum([
    'school_admin',
    'prc_liaison',
    'support_agent',
    'finance_export',
    'content_approver',
    'privacy_admin_owner',
  ]),
  organization_id: uuidSchema.optional(),
  campaign_id: uuidSchema.optional(),
  reason: z.string().trim().min(10, 'A clear audit reason is required').max(500),
}).refine((value) => Boolean(value.organization_id) !== Boolean(value.campaign_id), {
  message: 'Exactly one of organization_id or campaign_id is required',
  path: ['organization_id'],
});

export const revokeRoleSchema = z.strictObject({
  role_assignment_id: uuidSchema,
  reason: z.string().trim().min(10, 'A clear audit reason is required').max(500),
});
