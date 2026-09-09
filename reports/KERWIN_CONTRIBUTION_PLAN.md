# Kerwin Contribution Plan

**Baseline:** 9 September 2026  
**Assignee:** Kerwin Arlan  
**Focus:** Backend + Admin Dashboard Operations & Customer Member Enhancements  

---

## Assigned Work Breakdown

### P0 — BLOCKING / SECURITY
- Maintain 100% server-side authorization checks across all new and updated admin UI components and route handlers.
- Ensure all admin state changes write audit trail entries via `writeAuditEvent()`.

---

### P1 — CORE ASSIGNED WORK (ADMIN DASHBOARD OPERATIONAL CONTROLS)

#### Task 1.1: Interactive Payment Verification in Case Detail
- **Why:** Staff need an interactive interface to verify payments against official statements instead of manual SQL updates.
- **Backlog Source:** Backlog Item #5 / `POST /api/payment/verify`
- **Current State:** API endpoint exists (`/api/payment/verify`); `CaseDetail.tsx` displays read-only payment state.
- **Files:** `src/components/admin/CaseDetail.tsx`
- **Dependencies:** `POST /api/payment/verify`
- **Definition of Done:** Staff can enter an official reference number, select verification source (`manual_prc_reconciliation` / `prc_confirmation`), click "Verify Payment", and see instant UI update and audit log.

#### Task 1.2: Case State Transition & Data Correction Controls
- **Why:** Staff need to transition cases (e.g., mark `correction_needed`, `ready_for_review`, or `withdrawn`).
- **Backlog Source:** Backlog Item #6 / State Machines
- **Current State:** Backend state machine rules exist (`src/lib/state-machines/index.ts`); no UI buttons exist.
- **Files:** `src/components/admin/CaseDetail.tsx`, new API route `/api/admin/cases/[id]/state` (if needed) or updated case detail route.
- **Definition of Done:** Staff with appropriate role can select valid state transitions and record notes.

#### Task 1.3: Submissions Queue Search & Pagination
- **Why:** Staff managing large campaigns need to search cases by reference number, name, or phone number and page through results.
- **Backlog Source:** Backlog Item #7
- **Current State:** `SubmissionsTable.tsx` only filters by state; `GET /api/admin/cases` supports `search`, `page`, and `limit`.
- **Files:** `src/components/admin/SubmissionsTable.tsx`, `src/app/api/admin/cases/route.ts`
- **Definition of Done:** Submissions queue provides a search input box and pagination controls (`Previous` / `Next`).

#### Task 1.4: Admin Staff User & Role Management UI
- **Why:** Admins (`school_admin`, `privacy_admin_owner`) need a dedicated UI to view staff users, assign roles, and revoke roles.
- **Backlog Source:** Backlog Item #8
- **Current State:** APIs `/api/admin/roles/list`, `/assign`, `/revoke`, `/users` exist; no UI page exists under `/admin`.
- **Files:** `src/app/admin/users/page.tsx`, `src/components/admin/UserRoleManagement.tsx`, `src/components/admin/AdminShell.tsx` (add navigation link)
- **Definition of Done:** Dedicated `/admin/users` page displays staff list, active roles, role assignment modal/form, and revocation form with reason logging.

---

### P2 — FEATURE COMPLETION (EXPORT & CUSTOMER ENHANCEMENTS)

#### Task 2.1: Dual-Control PRC Export Handoff Management UI
- **Why:** Export-capable staff (`finance_export`, `prc_liaison`) need a UI to trigger batch exports, download checksummed CSVs, and mark acknowledgments.
- **Backlog Source:** Backlog Item #9
- **Current State:** Backend APIs `/api/export/*` complete; `/admin/export/page.tsx` is static text.
- **Files:** `src/app/admin/export/page.tsx`, `src/components/admin/ExportConsole.tsx`
- **Definition of Done:** Staff with `finance_export` role can preview ready cases, generate batch (`POST /api/export/batch`), download CSV (`GET /api/export/download`), and acknowledge receipt (`POST /api/export/acknowledge`).

#### Task 2.2: Customer Payment Resume & Instruction View in Member Status
- **Why:** Members with `payment_pending` or `official_handoff_opened` need a way to re-view payment account details and submit payment reference numbers post-registration.
- **Backlog Source:** Backlog Item #10
- **Current State:** `/member/status` displays static status text.
- **Files:** `src/app/member/status/page.tsx`
- **Definition of Done:** `/member/status` provides an interactive "Complete / View Payment Handoff" action panel when payment is pending.

---

### P3 — QUALITY OF LIFE & PR PREPARATION
- Add comprehensive test coverage for new payment verification and role management workflows.
- Create project-local skill `skills/safecard-platform/SKILL.md`.
- Generate PR guide and readiness reports.
