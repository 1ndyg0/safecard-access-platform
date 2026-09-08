/**
 * SafeCard Access Platform — Database types
 *
 * Hand-written types matching the Supabase schema.
 * Replace with generated types from `supabase gen types typescript`
 * once connected to a live Supabase project.
 */

// ============================================================
// Enums (mirror SQL types)
// ============================================================

export type StaffRole =
  | 'school_admin'
  | 'prc_liaison'
  | 'support_agent'
  | 'finance_export'
  | 'content_approver'
  | 'privacy_admin_owner';

export type ConsentState =
  | 'not_started'
  | 'reviewing'
  | 'agreed'
  | 'withdrawn'
  | 'expired_due_to_content_change';

export type ApplicationState =
  | 'draft'
  | 'ready_for_review'
  | 'submitted'
  | 'correction_needed'
  | 'resubmitted'
  | 'withdrawn';

export type PaymentState =
  | 'not_started'
  | 'official_handoff_opened'
  | 'payer_marked_paid'
  | 'verification_pending'
  | 'verified_by_official_source'
  | 'failed_or_cancelled'
  | 'refunded_or_reversed';

export type PrcHandoffState =
  | 'not_ready'
  | 'ready_for_export'
  | 'exported'
  | 'acknowledged'
  | 'correction_requested'
  | 'accepted'
  | 'rejected';

export type MembershipState =
  | 'not_active'
  | 'pending_prc_confirmation'
  | 'active_confirmed'
  | 'declined'
  | 'expired'
  | 'renewed';

export type SupportState =
  | 'open'
  | 'waiting_on_recipient'
  | 'waiting_on_school'
  | 'waiting_on_prc'
  | 'resolved'
  | 'closed_no_response';

export type SupportCategory =
  | 'general_question'
  | 'trouble_applying'
  | 'payment_handoff_issue'
  | 'correction_request'
  | 'consent_withdrawal'
  | 'privacy_request'
  | 'emergency_claims_education'
  | 'prc_handoff_issue';

export type ContentType =
  | 'benefit'
  | 'exclusion'
  | 'eligibility'
  | 'privacy_notice'
  | 'consent_text'
  | 'support_text'
  | 'claims_education'
  | 'faq'
  | 'sponsor_briefing'
  | 'invitation_script';

export type ContentApprovalStatus =
  | 'draft'
  | 'pending_review'
  | 'approved'
  | 'expired'
  | 'withdrawn';

export type AuditEventType =
  | 'role_change'
  | 'content_approval'
  | 'content_publish'
  | 'content_rollback'
  | 'application_submit'
  | 'consent_granted'
  | 'consent_withdrawn'
  | 'export_created'
  | 'export_downloaded'
  | 'prc_acknowledgment'
  | 'membership_status_change'
  | 'staff_login'
  | 'staff_access'
  | 'permission_denied'
  | 'security_event'
  | 'data_correction'
  | 'data_deletion'
  | 'referral_created'
  | 'referral_revoked'
  | 'payment_status_change'
  | 'support_case_change'
  | 'campaign_created'
  | 'campaign_updated'
  | 'user_created'
  | 'session_cleared'
  | 'comprehension_check'
  | 'notification_sent';

export type JobStatus =
  | 'pending'
  | 'running'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type RelationshipType =
  | 'sponsor'
  | 'payer'
  | 'guardian'
  | 'assisted_entry_helper';

export type NotificationChannel = 'sms' | 'email' | 'in_app';
export type NotificationStatus = 'pending' | 'sent' | 'delivered' | 'failed' | 'opted_out';

// ============================================================
// Table row types
// ============================================================

export interface Organization {
  id: string;
  name: string;
  slug: string;
  org_type: 'prc' | 'school' | 'partner';
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PilotCampaign {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  start_date: string;
  end_date: string | null;
  max_applications: number;
  max_sponsors: number;
  membership_fee: number;
  approved_fields: string[];
  approved_payment_routes: PaymentRouteConfig[];
  stop_conditions: StopCondition[];
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PaymentRouteConfig {
  type: 'gcash' | 'manual_prc' | 'bank_transfer';
  details: Record<string, unknown>;
  is_active: boolean;
}

export interface StopCondition {
  type: string;
  threshold: number;
  description: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  mfa_enabled: boolean;
  last_login_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface RoleAssignment {
  id: string;
  user_id: string;
  role: StaffRole;
  organization_id: string | null;
  campaign_id: string | null;
  granted_by: string | null;
  granted_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
  is_active: boolean;
  reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Sponsor {
  id: string;
  campaign_id: string;
  auth_user_id: string | null;
  display_name: string;
  is_minor: boolean;
  guardian_name: string | null;
  guardian_contact: string | null;
  guardian_approved: boolean;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ReferralLink {
  id: string;
  sponsor_id: string;
  campaign_id: string;
  slug: string;
  qr_metadata: Record<string, unknown>;
  is_active: boolean;
  activated_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  revoked_by: string | null;
  revocation_reason: string | null;
  total_visits: number;
  total_starts: number;
  idempotency_key: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface RecipientCase {
  id: string;
  campaign_id: string;
  referral_link_id: string | null;
  application_ref: string | null;
  auth_user_id: string | null;
  decision: 'accept';
  decision_at: string;
  consent_state: ConsentState;
  application_state: ApplicationState;
  payment_state: PaymentState;
  prc_handoff_state: PrcHandoffState;
  membership_state: MembershipState;
  consent_content_version_id: string | null;
  privacy_notice_version_id: string | null;
  comprehension_score: number | null;
  comprehension_passed: boolean | null;
  comprehension_checked_at: string | null;
  is_active: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface RecipientProfile {
  id: string;
  case_id: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  sex: 'male' | 'female' | null;
  civil_status: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  province: string | null;
  zip_code: string | null;
  mobile_number: string | null;
  email: string | null;
  fields_completed: boolean;
  created_at: string;
  updated_at: string;
}

export interface Relationship {
  id: string;
  case_id: string;
  relationship_type: RelationshipType;
  sponsor_id: string | null;
  user_id: string | null;
  external_name: string | null;
  is_active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConsentRecord {
  id: string;
  case_id: string;
  consent_type: 'membership_application' | 'data_processing' | 'notification_opt_in';
  consent_content_version_id: string;
  privacy_notice_version_id: string;
  locale: 'en' | 'tl' | 'ceb';
  state: ConsentState;
  agreed_at: string | null;
  ip_hash: string | null;
  user_agent_hash: string | null;
  withdrawn_at: string | null;
  withdrawal_reason: string | null;
  withdrawal_requested_by: string | null;
  expired_at: string | null;
  expired_reason: string | null;
  idempotency_key: string | null;
  request_hash: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ContentVersion {
  id: string;
  content_type: ContentType;
  locale: 'en' | 'tl' | 'ceb';
  version: number;
  created_by: string;
  title: string;
  body: string;
  summary: string | null;
  approval_status: ContentApprovalStatus;
  approved_by: string | null;
  approved_at: string | null;
  source: string | null;
  source_last_updated: string | null;
  review_date: string | null;
  expiry_date: string | null;
  is_published: boolean;
  published_at: string | null;
  published_by: string | null;
  unpublished_at: string | null;
  affected_surfaces: string[];
  supersedes_id: string | null;
  change_summary: string | null;
  is_material_change: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ApplicationSubmission {
  id: string;
  case_id: string;
  application_ref: string;
  submitted_data: Record<string, unknown>;
  consent_record_id: string;
  content_versions_seen: string[];
  privacy_notice_version_id: string;
  comprehension_score: number | null;
  comprehension_passed: boolean | null;
  submitted_at: string;
  submitted_by: 'recipient' | 'assisted_entry';
  assisted_by_name: string | null;
  original_submission_id: string | null;
  correction_reason: string | null;
  idempotency_key: string;
  request_hash: string;
  is_current: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PaymentIntent {
  id: string;
  case_id: string;
  campaign_id: string;
  payer_type: 'sponsor' | 'guardian' | 'other';
  payer_name: string | null;
  payer_sponsor_id: string | null;
  expected_amount: number;
  currency: string;
  payment_route: string;
  payment_reference: string | null;
  state: PaymentState;
  handoff_opened_at: string | null;
  payer_marked_paid_at: string | null;
  verification_started_at: string | null;
  verified_at: string | null;
  failed_at: string | null;
  refunded_at: string | null;
  verified_by: string | null;
  verification_source: string | null;
  verification_evidence: Record<string, unknown> | null;
  gcash_transaction_id: string | null;
  gcash_reference_number: string | null;
  gcash_callback_payload: Record<string, unknown> | null;
  idempotency_key: string;
  request_hash: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface PrcExportBatch {
  id: string;
  campaign_id: string;
  batch_ref: string;
  created_by: string;
  creation_reason: string;
  reauth_method: 'password' | 'mfa' | 'session_refresh';
  reauth_at: string;
  record_count: number;
  column_order: string[];
  checksum: string;
  format: 'csv' | 'json';
  transfer_method: string | null;
  transferred_at: string | null;
  transfer_evidence: string | null;
  prc_received_at: string | null;
  prc_received_by: string | null;
  prc_acknowledgment: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface PrcExportItem {
  id: string;
  batch_id: string;
  case_id: string;
  submission_id: string;
  export_order: number;
  prc_status: 'pending' | 'acknowledged' | 'correction_requested' | 'accepted' | 'rejected';
  prc_responded_at: string | null;
  prc_response_by: string | null;
  prc_notes: string | null;
  correction_reason: string | null;
  correction_fields: Record<string, unknown> | null;
  original_values: Record<string, unknown> | null;
  corrected_values: Record<string, unknown> | null;
  prc_membership_id: string | null;
  prc_effective_date: string | null;
  prc_expiry_date: string | null;
  prc_source_timestamp: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface MembershipStatusEvent {
  id: string;
  case_id: string;
  previous_state: MembershipState | null;
  new_state: MembershipState;
  changed_by: string;
  change_source: string;
  prc_export_item_id: string | null;
  prc_membership_id: string | null;
  prc_effective_date: string | null;
  prc_expiry_date: string | null;
  reason: string | null;
  evidence: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface SupportCase {
  id: string;
  case_id: string | null;
  campaign_id: string | null;
  category: SupportCategory;
  state: SupportState;
  subject: string;
  description: string;
  submitted_by_type: 'recipient' | 'sponsor' | 'guardian' | 'staff' | 'system';
  submitted_by_user_id: string | null;
  contact_method: string | null;
  assigned_to: string | null;
  assigned_at: string | null;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_summary: string | null;
  escalated_to: string | null;
  is_privacy_request: boolean;
  privacy_request_type: string | null;
  idempotency_key: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AuditEvent {
  id: string;
  event_type: AuditEventType;
  actor_id: string | null;
  actor_type: 'user' | 'system' | 'anonymous';
  actor_ip_hash: string | null;
  target_type: string | null;
  target_id: string | null;
  case_id: string | null;
  campaign_id: string | null;
  action: string;
  details: Record<string, unknown>;
  severity: 'info' | 'warning' | 'error' | 'critical';
  created_at: string;
}

export interface Job {
  id: string;
  job_type: string;
  status: JobStatus;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error: string | null;
  scheduled_for: string;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  next_retry_at: string | null;
  locked_by: string | null;
  locked_at: string | null;
  lock_expires_at: string | null;
  campaign_id: string | null;
  case_id: string | null;
  idempotency_key: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AggregateMetric {
  id: string;
  campaign_id: string;
  metric_date: string;
  metric_type: string;
  count_value: number | null;
  rate_value: number | null;
  json_value: Record<string, unknown> | null;
  cohort_size: number;
  is_suppressed: boolean;
  suppression_threshold: number;
  metadata: Record<string, unknown>;
  created_at: string;
}
