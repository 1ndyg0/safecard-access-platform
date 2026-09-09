# Product Backlog Crosswalk

**Baseline:** 9 September 2026  
**Source Evidence:** `docs/implementation-status.md`, `backend.txt`, `README.md`, repository source code, and database schema (`supabase/migrations/`).  
*Note on External Links:* Artifact links cited in `backend.txt` (`https://claude.ai/code/artifact/...`) are categorized as **EXTERNAL SOURCE — NOT YET VERIFIED** directly from the web, but their corresponding text prompts and requirements in `backend.txt` and `implementation-status.md` are cross-referenced below.

---

## Backlog Items & Crosswalk

### 1. Mobile-First Bilingual Public Education & Intake
- **Priority:** P1
- **User / Role:** Recipient (Household helper / Applicant)
- **Expected Behavior:** Multi-step responsive wizard (`/apply`) explaining benefits, eligibility, capturing consent, personal profile, payment choice, and generating reference number (`SC-2026-XXXXXXXX`).
- **Current Implementation:** Full responsive landing and `/apply` wizard implemented (`ApplicationWizard.tsx`).
- **Status:** DONE
- **Files / Evidence:** `src/app/apply/page.tsx`, `src/components/application/ApplicationWizard.tsx`, `src/app/api/intake/*`
- **Dependencies:** Zod validation schemas, `recipient_cases`, `recipient_profiles`.
- **Recommended Owner:** INDY (Already complete)

---

### 2. Passwordless Member Access & E-Card Portal
- **Priority:** P1
- **User / Role:** Member (Recipient)
- **Expected Behavior:** Login using Application Reference + Mobile Number (`/member`). Access status timeline (`/member/status`). Render electronic SafeCard and QR code (`/member/card`) ONLY when membership state is `active_confirmed`.
- **Current Implementation:** Fully implemented passwordless login with 30-min HTTP-only signed session cookie. Status timeline and conditional e-card rendering functional.
- **Status:** DONE
- **Files / Evidence:** `src/app/member/page.tsx`, `src/app/member/status/page.tsx`, `src/app/member/card/page.tsx`, `src/app/api/member/*`, `src/lib/auth/member-session.ts`
- **Dependencies:** `safecard_member_session` cookie, `recipient_cases`, `recipient_profiles`.
- **Recommended Owner:** INDY (Already complete)

---

### 3. Ambassador Workspace & Referral Tracking
- **Priority:** P1
- **User / Role:** Ambassador (Student volunteer)
- **Expected Behavior:** Email/password login (`/ambassador/login`), generate owned referral link/QR (`/ambassador/share`), view privacy-safe aggregate stats (starts/completions) without recipient PII.
- **Current Implementation:** Ambassador login, referral creation (`/api/referrals/create`), slug routing (`/r/[slug]`), and aggregate dashboard implemented.
- **Status:** DONE
- **Files / Evidence:** `src/app/ambassador/*`, `src/components/AmbassadorDashboard.tsx`, `src/app/api/referrals/*`
- **Dependencies:** Supabase Auth, `referral_links`, `sponsors`.
- **Recommended Owner:** INDY (Already complete)

---

### 4. Admin Submissions Queue & Case Detail (Read-Only)
- **Priority:** P0
- **User / Role:** Staff / Admin (`school_admin`, `prc_liaison`, `support_agent`)
- **Expected Behavior:** View case list filtered by campaign and state. View detailed case view showing metadata, minimum necessary PII, and payment evidence.
- **Current Implementation:** `SubmissionsTable.tsx` and `CaseDetail.tsx` render submission queue and detailed view.
- **Status:** DONE (Read-Only)
- **Files / Evidence:** `src/app/admin/submissions/page.tsx`, `src/components/admin/SubmissionsTable.tsx`, `src/components/admin/CaseDetail.tsx`, `/api/admin/cases/*`
- **Dependencies:** Staff Auth, `role_assignments`, `recipient_cases`, `recipient_profiles`.
- **Recommended Owner:** INDY (Read-only foundation complete)

---

### 5. Admin Payment Verification & Reconciliation Controls
- **Priority:** P0
- **User / Role:** Staff (`school_admin`, `finance_export`, `prc_liaison`)
- **Expected Behavior:** Interactive UI in Case Detail to review payment evidence, enter official reconciliation reference, and execute payment verification (`POST /api/payment/verify`), updating `payment_state` to `verified_by_official_source` and `prc_handoff_state` to `ready_for_export`.
- **Current Implementation:** Backend API endpoint `/api/payment/verify` is fully implemented and tested. Case Detail UI is missing verification buttons and forms.
- **Status:** PARTIAL (Backend API exists; UI controls missing)
- **Files / Evidence:** `src/app/api/payment/verify/route.ts`, `src/lib/payment/index.ts`, `src/components/admin/CaseDetail.tsx`
- **Dependencies:** Staff Auth, `payment_intents`, `payment_evidence`.
- **Recommended Owner:** KERWIN (Assigned contribution)

---

### 6. Admin Case Status & Data Correction Controls
- **Priority:** P1
- **User / Role:** Staff (`school_admin`, `support_agent`, `privacy_admin_owner`)
- **Expected Behavior:** Interactive UI to transition case state (e.g. mark `correction_needed`, `ready_for_review`, or `withdrawn`), add internal staff notes, and record audit events.
- **Current Implementation:** Backend state machine helpers exist (`src/lib/state-machines/index.ts`), but no UI controls exist in `CaseDetail.tsx`.
- **Status:** PARTIAL (Backend state machine ready; UI controls missing)
- **Files / Evidence:** `src/lib/state-machines/index.ts`, `src/components/admin/CaseDetail.tsx`
- **Dependencies:** Staff Auth, `audit_events`, `recipient_cases`.
- **Recommended Owner:** KERWIN (Assigned contribution)

---

### 7. Admin Queue Search & Pagination
- **Priority:** P1
- **User / Role:** Staff / Admin
- **Expected Behavior:** Search submission queue by application reference, recipient name, or mobile number; navigate multi-page queue.
- **Current Implementation:** `SubmissionsTable.tsx` only filters by state; no text search or pagination controls.
- **Status:** MISSING
- **Files / Evidence:** `src/components/admin/SubmissionsTable.tsx`, `src/app/api/admin/cases/route.ts`
- **Dependencies:** Query parameters on `/api/admin/cases`.
- **Recommended Owner:** KERWIN (Assigned contribution)

---

### 8. Staff User & Role Management Dashboard
- **Priority:** P1
- **User / Role:** Privacy Admin Owner / School Admin (`privacy_admin_owner`, `school_admin`)
- **Expected Behavior:** View list of staff users and role assignments, assign new roles (`POST /api/admin/roles/assign`), and revoke roles (`POST /api/admin/roles/revoke`).
- **Current Implementation:** Backend APIs `/api/admin/roles/list`, `/assign`, `/revoke`, and `/api/admin/users` exist. No UI page or component exists under `/admin`.
- **Status:** PARTIAL (Backend API complete; UI page missing)
- **Files / Evidence:** `src/app/api/admin/roles/*`, `src/app/api/admin/users/route.ts`
- **Dependencies:** Staff Auth, `role_assignments`, `users`.
- **Recommended Owner:** KERWIN (Assigned contribution)

---

### 9. Dual-Control PRC Export Handoff Management UI
- **Priority:** P2
- **User / Role:** Export Staff (`finance_export`, `prc_liaison`)
- **Expected Behavior:** Create immutable export batch (`POST /api/export/batch`), preview batch summary/count, download checksummed CSV (`GET /api/export/download`), acknowledge transfer (`POST /api/export/acknowledge`).
- **Current Implementation:** Backend APIs and database tables (`prc_export_batches`, `prc_export_items`) are fully implemented. Frontend `/admin/export/page.tsx` is currently a static warning page.
- **Status:** PARTIAL (Backend complete; UI trigger missing)
- **Files / Evidence:** `src/app/api/export/*`, `src/lib/export/index.ts`, `src/app/admin/export/page.tsx`
- **Dependencies:** Staff Auth, AAL2 MFA requirement, `prc_export_batches`.
- **Recommended Owner:** KERWIN (Assigned contribution)

---

### 10. Customer Payment Resume / Instruction View
- **Priority:** P2
- **User / Role:** Recipient / Member
- **Expected Behavior:** After submitting an application, if payment is pending (`payment_pending` / `official_handoff_opened`), allow member to re-view payment QR / bank transfer instructions and mark payment as submitted from `/member/status`.
- **Current Implementation:** Payment handoff occurs during `/apply/payment`. Post-registration, `/member/status` displays status text but no re-trigger for payment instructions.
- **Status:** PARTIAL
- **Files / Evidence:** `src/app/member/status/page.tsx`, `src/app/api/payment/mark-paid/route.ts`
- **Dependencies:** Member session, `payment_intents`.
- **Recommended Owner:** KERWIN (Shared / Enhancement)
