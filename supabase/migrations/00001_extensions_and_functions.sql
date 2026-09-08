-- SafeCard Access Platform
-- Migration 00001: Extensions and shared utility functions
-- Purpose: Enable required Postgres extensions and create reusable functions

-- ============================================================
-- Extensions
-- ============================================================
create extension if not exists "uuid-ossp" with schema extensions;
create extension if not exists "pgcrypto" with schema extensions;
create extension if not exists "citext"   with schema extensions;

-- ============================================================
-- Custom types used across tables
-- ============================================================

-- Staff role slugs (least-privilege model)
create type public.staff_role as enum (
  'school_admin',
  'prc_liaison',
  'support_agent',
  'finance_export',
  'content_approver',
  'privacy_admin_owner'
);

-- Consent state machine
create type public.consent_state as enum (
  'not_started',
  'reviewing',
  'agreed',
  'withdrawn',
  'expired_due_to_content_change'
);

-- Application state machine
create type public.application_state as enum (
  'draft',
  'ready_for_review',
  'submitted',
  'correction_needed',
  'resubmitted',
  'withdrawn'
);

-- Payment state machine
create type public.payment_state as enum (
  'not_started',
  'official_handoff_opened',
  'payer_marked_paid',
  'verification_pending',
  'verified_by_official_source',
  'failed_or_cancelled',
  'refunded_or_reversed'
);

-- PRC handoff state machine
create type public.prc_handoff_state as enum (
  'not_ready',
  'ready_for_export',
  'exported',
  'acknowledged',
  'correction_requested',
  'accepted',
  'rejected'
);

-- Membership state machine
create type public.membership_state as enum (
  'not_active',
  'pending_prc_confirmation',
  'active_confirmed',
  'declined',
  'expired',
  'renewed'
);

-- Support state machine
create type public.support_state as enum (
  'open',
  'waiting_on_recipient',
  'waiting_on_school',
  'waiting_on_prc',
  'resolved',
  'closed_no_response'
);

-- Support case categories
create type public.support_category as enum (
  'general_question',
  'trouble_applying',
  'payment_handoff_issue',
  'correction_request',
  'consent_withdrawal',
  'privacy_request',
  'emergency_claims_education',
  'prc_handoff_issue'
);

-- Content types for the versioned registry
create type public.content_type as enum (
  'benefit',
  'exclusion',
  'eligibility',
  'privacy_notice',
  'consent_text',
  'support_text',
  'claims_education',
  'faq',
  'sponsor_briefing',
  'invitation_script'
);

-- Content approval status
create type public.content_approval_status as enum (
  'draft',
  'pending_review',
  'approved',
  'expired',
  'withdrawn'
);

-- Audit event categories
create type public.audit_event_type as enum (
  'role_change',
  'content_approval',
  'content_publish',
  'content_rollback',
  'application_submit',
  'consent_granted',
  'consent_withdrawn',
  'export_created',
  'export_downloaded',
  'prc_acknowledgment',
  'membership_status_change',
  'staff_login',
  'staff_access',
  'permission_denied',
  'security_event',
  'data_correction',
  'data_deletion',
  'referral_created',
  'referral_revoked',
  'payment_status_change',
  'support_case_change',
  'campaign_created',
  'campaign_updated',
  'user_created',
  'session_cleared',
  'comprehension_check',
  'notification_sent'
);

-- Job status
create type public.job_status as enum (
  'pending',
  'running',
  'completed',
  'failed',
  'cancelled'
);

-- Relationship types between people in a case
create type public.relationship_type as enum (
  'sponsor',
  'payer',
  'guardian',
  'assisted_entry_helper'
);

-- Notification channel
create type public.notification_channel as enum (
  'sms',
  'email',
  'in_app'
);

-- Notification status
create type public.notification_status as enum (
  'pending',
  'sent',
  'delivered',
  'failed',
  'opted_out'
);

-- ============================================================
-- Utility functions
-- ============================================================

-- Generate an internal application reference: SC-YYYY-XXXXXXXX
create or replace function public.generate_application_ref()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  ref text;
  yr  text := to_char(now(), 'YYYY');
  hex text;
begin
  hex := encode(extensions.gen_random_bytes(4), 'hex');
  ref := 'SC-' || yr || '-' || upper(hex);
  return ref;
end;
$$;

-- Immutable timestamp for created_at defaults
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Prevent mutation of immutable audit rows
create or replace function public.prevent_audit_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Audit records are immutable and cannot be modified or deleted';
end;
$$;

revoke all on function public.generate_application_ref() from public, anon, authenticated;
grant execute on function public.generate_application_ref() to service_role;
