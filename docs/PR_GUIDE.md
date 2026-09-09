# Pull Request Review Guide for Indy

**Author:** Kerwin Arlan  
**Topic:** Admin Operations Console, Staff Role Management, Export Console, and Member Payment Resume  
**Branch:** `feat/admin-backend` → `main`  

---

## What Changed & Why

### 1. Interactive Admin Payment Verification & Case Detail
- **Problem:** `CaseDetail.tsx` previously showed read-only payment state without interactive verification controls.
- **Solution:** Added a payment reconciliation panel allowing authorized staff (`school_admin`, `finance_export`, `prc_liaison`) to enter official settlement references, select verification sources, and execute `POST /api/payment/verify` directly.

### 2. Admin Queue Search & Pagination
- **Problem:** Queue view (`SubmissionsTable.tsx`) lacked text search and pagination for large campaign batches.
- **Solution:** Updated `GET /api/admin/cases` and `SubmissionsTable.tsx` to support `search` (matching `application_ref`), state filters, and pagination controls.

### 3. Staff User & Role Management Dashboard
- **Problem:** Role management API routes existed (`/api/admin/roles/*`, `/api/admin/users`), but lacked a frontend UI page.
- **Solution:** Created `/admin/users` page for listing staff accounts, viewing active roles, assigning new roles (`POST /api/admin/roles/assign`), and logging role changes to audit trail.

### 4. Dual-Control PRC Export Management Console
- **Problem:** `/admin/export/page.tsx` was a static warning placeholder.
- **Solution:** Upgraded `/admin/export/page.tsx` into an interactive console to create immutable export batches (`POST /api/export/batch`), view SHA-256 checksums, download CSV packages (`GET /api/export/download`), and record PRC receipt acknowledgments (`POST /api/export/acknowledge`).

### 5. Member Payment Resume Flow
- **Problem:** Members with `payment_pending` or `official_handoff_opened` state had no interactive way to submit transaction reference numbers post-registration.
- **Solution:** Added an interactive "Submit Payment Reference Number" panel in `/member/status` calling `POST /api/payment/mark-paid`.

---

## How to Test

1. **Install Dependencies & Start Local Stack:**
   ```bash
   npm install
   npx supabase start
   npx supabase db reset
   npm run dev
   ```

2. **Run Verification Commands:**
   ```bash
   npm run test
   npx tsc --noEmit
   npm run lint
   ```

3. **Verify Admin Dashboard:**
   - Log in at `/admin/login`.
   - Navigate to `/admin/submissions` — test searching by reference (e.g. `SC-2026`).
   - Open a case detail at `/admin/submissions/[id]` — test payment verification form.
   - Navigate to `/admin/users` — select a staff account and assign a role.
   - Navigate to `/admin/export` — create an export batch, view checksum, and test download.

4. **Verify Member Portal:**
   - Sign in at `/member` with an active application reference + mobile number.
   - On `/member/status`, click "Submit Payment Reference Number", enter a GCash reference, and submit.
