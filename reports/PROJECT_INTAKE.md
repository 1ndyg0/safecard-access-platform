# SafeCard Access Platform — Project Intake Report

**Assessment Baseline:** 9 September 2026  
**Repository:** `1ndyg0/safecard-access-platform`  
**Current Branch:** `feat/admin-backend` (derived from `origin/main`)  

---

## 1. Product Purpose
SafeCard is a mobile-first, bilingual intake and education platform for the Philippine Red Cross (PRC) Safe Card pilot. It serves as an intake and education layer—it is **not** the system of record. PRC retains full authority over membership activation and claims decisions. Application submission, payment verification, PRC handoff, and membership activation are distinct, explicit states.

---

## 2. Current Stack
- **Framework:** Next.js 15 App Router (`next: 15.2.1`, React 19)
- **Database & Auth:** Supabase PostgreSQL with Row-Level Security (RLS) & Supabase Auth
- **Type System & Validation:** TypeScript strict mode, Zod schemas (`src/lib/validation/schemas.ts`)
- **Testing & Quality:** Vitest (unit testing), ESLint 9, Next.js typecheck (`tsc --noEmit`)
- **Deployment Target:** Vercel (Edge/Serverless functions)

---

## 3. Current Architecture
- **BFF Pattern:** Route Handlers authenticate and authorize every request server-side. The browser never connects directly to Supabase tables using client keys.
- **Service Role Control:** Server-side handlers use `getSupabaseAdminClient()` for database operations, strictly gated behind `requireStaffAuth()`, `requireAnyRole()`, or `requireMemberSession()`.
- **5 Orthogonal State Machines per Case:**
  1. `consent_state`: `not_started` | `reviewing` | `agreed` | `withdrawn` | `expired_due_to_content_change`
  2. `application_state`: `draft` | `ready_for_review` | `submitted` | `correction_needed` | `resubmitted` | `withdrawn`
  3. `payment_state`: `not_started` | `official_handoff_opened` | `payer_marked_paid` | `verification_pending` | `verified_by_official_source` | `failed_or_cancelled` | `refunded_or_reversed`
  4. `prc_handoff_state`: `not_ready` | `ready_for_export` | `exported` | `acknowledged` | `correction_requested` | `accepted` | `rejected`
  5. `membership_state`: `not_active` | `pending_prc_confirmation` | `active_confirmed` | `declined` | `expired` | `renewed`

---

## 4. Current Data Model
18 tables defined across 9 SQL migrations (`supabase/migrations/`):
- **Core & Admin:** `organizations`, `pilot_campaigns`, `users`, `role_assignments`
- **Referrals & Recipients:** `sponsors`, `referral_links`, `recipient_cases`, `recipient_profiles`, `relationships`
- **Consent & Content:** `content_versions`, `consent_records`
- **Application & Payments:** `application_submissions`, `payment_intents`, `payment_evidence`
- **PRC Handoff & Membership:** `prc_export_batches`, `prc_export_items`, `membership_status_events`
- **Operations & Audit:** `support_cases`, `notification_events`, `audit_events`, `jobs`, `aggregate_metrics`, `rate_limit_buckets`

---

## 5. Current Auth Model
- **Staff / Admin / Ambassadors:** Supabase Auth (email + password). Session validated via `requireStaffAuth()`. Role checks via `role_assignments` table in `requireAnyRole()`.
- **Applicants / Members:** Passwordless/No-OTP authentication using Application Reference (e.g. `SC-2026-XXXXXXXX`) + Registered Mobile Number (`/api/member/auth`). Issues an HTTP-only, 30-minute signed cookie (`safecard_member_session`).
- **Sponsors:** Auth via Supabase Auth; can only access aggregate campaign/funnel metrics. Cannot read recipient PII.

---

## 6. Current Admin Implementation
- **UI Pages:**
  - `/admin`: Dashboard homepage (`AdminDashboard.tsx`) — Overview metrics (`/api/admin/overview`).
  - `/admin/submissions`: Submission queue (`SubmissionsTable.tsx`) — Case list with state filtering (`/api/admin/cases`).
  - `/admin/submissions/[id]`: Case detail (`CaseDetail.tsx`) — Views case metadata, minimum necessary PII, and payment evidence.
  - `/admin/export`: Export placeholder (`ExportPage.tsx`) — Highlights backend export security controls.
- **Backend APIs:**
  - `/api/admin/overview`: Campaign overview, active assignments, and case metrics.
  - `/api/admin/cases` & `/api/admin/cases/[id]`: Submission queue listing and detail retrieval.
  - `/api/admin/roles/assign`, `/list`, `/revoke`: Staff role administration endpoints.
  - `/api/admin/users`: User management endpoints.
  - `/api/payment/verify` & `/mark-paid`: Payment reconciliation endpoints.
  - `/api/export/batch`, `/download`, `/acknowledge`: PRC export batching and transfer endpoints.

---

## 7. Current Customer Implementation
- **Public Intake:** `/apply` step-by-step wizard capturing consent, profile, and payment choice.
- **Member Login:** `/member` — Authenticates with reference number + mobile number.
- **Member Status:** `/member/status` — 4-step state machine status tracker.
- **Member E-Card:** `/member/card` — Renders digital SafeCard and local QR code only if `membership_state === 'active_confirmed'`.

---

## 8. Current Test Coverage
- `npm run test` executes Vitest across 3 test files:
  - `src/lib/auth/member-session.test.ts`
  - `src/lib/member/status.test.ts`
  - `src/lib/core-contracts.test.ts`
- All 10 tests pass.
- TypeScript (`npx tsc --noEmit`) and ESLint (`npm run lint`) pass cleanly.

---

## 9. Current Deployment State
- Local setup ready (`npm install`, Supabase CLI migrations).
- Synthetic data protection enabled by default (`LAUNCH_GATES_COMPLETE=false`).

---

## 10. Major Gaps Identified
1. **Admin Dashboard Interactive Operations:**
   - Case detail view (`CaseDetail.tsx`) is purely read-only; lacks action buttons for verifying payments (`/api/payment/verify`), marking corrections needed, or updating case status.
   - Queue view (`SubmissionsTable.tsx`) lacks search (by Ref/mobile/name) and pagination controls.
   - Admin navigation lacks UI pages for User & Role Management (`/admin/users`, `/admin/roles`).
   - Export UI (`/admin/export`) is a static warning page; lacks batch creation and download controls.
2. **Customer Post-Registration Actions:**
   - Member portal (`/member/status`) shows current states but lacks action triggers for re-opening payment handoff instructions or resubmitting corrections if requested.

---

## 11. Key Risks
- **Over-Exposing PII:** Ensuring staff role checks strictly protect `recipient_profiles`.
- **Unauthorized Status Transitions:** Inconsistent state updates without audit logging.
- **Accidental Real Data Submission:** Ensuring `data_mode: "synthetic"` gate remains enforced during development.

---

## 12. Strategic Recommendations
- Implement interactive staff controls in `CaseDetail.tsx` (Payment Verification, State Transitions) integrated with existing API routes.
- Build Admin User & Role Management UI pages.
- Enhance Admin Submissions Table with search and pagination.
- Enhance Member Status view with clear payment handoff resume capabilities.
