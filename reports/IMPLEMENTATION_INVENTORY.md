# Implementation Inventory

**Baseline:** 9 September 2026  
**Auditor:** Kerwin Arlan  
**Repository:** `1ndyg0/safecard-access-platform`  

---

## 1. ADMIN DASHBOARD & STAFF OPERATIONS

| Feature | Backend API | Frontend Component / Page | Status | Details / Notes |
|---|---|---|---|---|
| **Admin Login** | Supabase Auth | `src/app/admin/login/page.tsx`, `PortalLogin.tsx` | **Built & Verified** | Email + Password login using Supabase Auth. Redirects to `/admin`. |
| **Session Handling** | `src/lib/auth/session.ts` | Server-side `requireStaffAuth()` | **Built & Verified** | Validates Supabase JWT cookie server-side. Returns `userId` and `email`. |
| **Role Verification** | `src/lib/auth/permissions.ts` | Server-side `requireAnyRole()` | **Built & Verified** | Checks `role_assignments` table for campaign/org active roles. |
| **Dashboard Shell** | `src/app/api/admin/overview` | `src/components/admin/AdminShell.tsx`, `AdminDashboard.tsx` | **Built & Verified** | Displays user name, active roles, campaign overview, total cases, submitted count, and active count. |
| **Submissions Queue** | `GET /api/admin/cases` | `src/components/admin/SubmissionsTable.tsx` | **Built & Verified** | Lists cases for assigned campaign. Allows state filtering. Missing text search & pagination. |
| **Case Detail View** | `GET /api/admin/cases/[id]` | `src/components/admin/CaseDetail.tsx` | **Built & Verified** | Displays 5 state machine states, recipient profile (minimum PII), and payment evidence. Read-only. |
| **Payment Verification** | `POST /api/payment/verify` | **None** | **API Built / UI Missing** | API verifies payment intent and updates state to `verified_by_official_source`. UI controls missing in `CaseDetail.tsx`. |
| **Case State Transitions** | `src/lib/state-machines/index.ts` | **None** | **API Built / UI Missing** | Backend transition validation exists. No UI button to transition case states or request correction. |
| **Staff Role Management** | `POST /api/admin/roles/assign`, `revoke`, `list` | **None** | **API Built / UI Missing** | Role assignment and revocation APIs with audit logging exist. No UI page under `/admin/roles` or `/admin/users`. |
| **PRC Export Management** | `POST /api/export/batch`, `download`, `acknowledge` | `src/app/admin/export/page.tsx` | **API Built / UI Missing** | Full batching, checksum, download, and acknowledgment backend. UI page is currently a static warning notice. |
| **Audit Log Trail** | `src/lib/audit/index.ts` | **None (Internal API only)** | **Built & Verified** | `writeAuditEvent()` logs events to `audit_events` table (SHA-256 hash payload, IP tracking). |

---

## 2. CUSTOMER / APPLICANT & MEMBER PORTAL

| Feature | Backend API | Frontend Component / Page | Status | Details / Notes |
|---|---|---|---|---|
| **Public Education** | `GET /api/content/public` | `/`, `/benefits`, `/privacy`, `/help` | **Built & Verified** | Responsive, bilingual landing pages explaining SafeCard benefits and privacy boundaries. |
| **Consent & Intake Form** | `POST /api/intake/*` | `src/app/apply/page.tsx`, `ApplicationWizard.tsx` | **Built & Verified** | Multi-step wizard capturing voluntary consent, personal profile, and payment selection. Generates `SC-2026-XXXXXXXX`. |
| **Member Login** | `POST /api/member/auth` | `src/app/member/page.tsx` | **Built & Verified** | Passwordless login matching application reference + mobile number. Sets 30-min HTTP-only signed session cookie. |
| **Member Status Tracker** | `GET /api/member/status` | `src/app/member/status/page.tsx` | **Built & Verified** | 4-step visual progress tracker (`Application` → `Payment` → `PRC Handoff` → `Membership`). |
| **Electronic SafeCard & QR** | `GET /api/member/card` | `src/app/member/card/page.tsx` | **Built & Verified** | Renders digital SafeCard and local QR code ONLY if `membership_state === 'active_confirmed'`. Otherwise shows pending notice. |
| **Member Logout** | `POST /api/member/logout` | `src/app/member/card/page.tsx` | **Built & Verified** | Clears `safecard_member_session` cookie. |

---

## 3. AMBASSADOR WORKSPACE

| Feature | Backend API | Frontend Component / Page | Status | Details / Notes |
|---|---|---|---|---|
| **Ambassador Auth** | Supabase Auth | `src/app/ambassador/login/page.tsx` | **Built & Verified** | Email + Password login for student volunteers. |
| **Referral Link Creation** | `POST /api/referrals/create` | `src/app/ambassador/share/page.tsx` | **Built & Verified** | Generates unique referral link (`/r/[slug]`) and downloadable local QR code. |
| **Privacy-Safe Stats** | `GET /api/sponsors/status` | `src/components/AmbassadorDashboard.tsx` | **Built & Verified** | Shows aggregate counts (starts, completions) without recipient PII. |

---

## 4. BACKEND & INFRASTRUCTURE

| Component | Status | Implementation Details |
|---|---|---|
| **Database Schema** | **Built & Verified** | 18 tables across 9 SQL migrations with Foreign Keys and CHECK constraints. |
| **Row-Level Security (RLS)** | **Built & Verified** | `00008_rls_policies.sql` enables RLS on all 18 tables with restrictive policies. |
| **BFF Route Handlers** | **Built & Verified** | Direct browser-to-table access disabled. All queries execute server-side via `getSupabaseAdminClient()`. |
| **State Machine Governance** | **Built & Verified** | Enforced in `src/lib/state-machines/index.ts`. Invalid transitions rejected with clear error codes. |
| **Rate Limiting** | **Built & Verified** | Sliding-window bucket in `src/lib/api/rate-limit.ts` using SHA-256 IP hashes. |
| **Synthetic Data Safeguard** | **Built & Verified** | `src/lib/safety/data-mode.ts` blocks real PII submission when `LAUNCH_GATES_COMPLETE !== 'true'`. |
