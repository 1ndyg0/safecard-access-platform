# Security & Privacy Review

**Baseline:** 9 September 2026  
**Auditor:** Kerwin Arlan  
**Repository:** `1ndyg0/safecard-access-platform`  

---

## Executive Summary
SafeCard handles highly sensitive Personal Identifiable Information (PII) including recipient names, birth dates, mobile numbers, physical addresses, emergency contacts, and payment reference numbers. The platform architecture employs strict security and privacy boundaries by default.

---

## Detailed Security Audit Findings

### 1. Service Role Key Protection
- **Status:** **PASS (LOW RISK)**
- **Audit:** `SUPABASE_SERVICE_ROLE_KEY` is referenced strictly within server-side modules (`src/lib/db/client.ts`). No `NEXT_PUBLIC_` prefix is present. Browser bundles use `NEXT_PUBLIC_SUPABASE_ANON_KEY` or BFF route handlers exclusively.

### 2. PII Exposure & Role Boundaries
- **Status:** **PASS (MEDIUM RISK - Requires Vigilance)**
- **Audit:** Recipient PII (`recipient_profiles`) is logically separated from case metadata (`recipient_cases`). 
  - `GET /api/admin/cases` (list endpoint) returns case states, campaign IDs, and application references only.
  - `GET /api/admin/cases/[id]` (detail endpoint) requires explicit role checks (`privacy_admin_owner`, `school_admin`, `prc_liaison`).
  - Sponsors and Ambassadors access aggregate counts only (`/api/sponsors/status`, `/api/metrics/funnel`) and cannot query recipient PII.

### 3. Member Authentication Boundary
- **Status:** **PASS (INFORMATIONAL)**
- **Audit:** Member portal uses passwordless authentication matching Application Reference + Mobile Number. Upon verification, the server issues a signed, HTTP-only, 30-minute session cookie (`safecard_member_session`). No bearer tokens or PII are written to `localStorage` or `sessionStorage`.

### 4. Admin API Authorization
- **Status:** **PASS (INFORMATIONAL)**
- **Audit:** Every `/api/admin/*` handler calls `requireStaffAuth()` and `requireAnyRole()` before executing queries. Access control is enforced on the server.

### 5. Database Row-Level Security (RLS)
- **Status:** **PASS (INFORMATIONAL)**
- **Audit:** All 18 tables have RLS enabled in `00008_rls_policies.sql`. Direct anon/public table queries are blocked or restricted to non-sensitive rows.

### 6. Synthetic Data Mode Safeguard
- **Status:** **PASS (INFORMATIONAL)**
- **Audit:** `src/lib/safety/data-mode.ts` validates that when `LAUNCH_GATES_COMPLETE !== 'true'`, requests must conform to synthetic testing constraints and reserve demo markers.

### 7. Audit Logging & Export Integrity
- **Status:** **PASS (INFORMATIONAL)**
- **Audit:** Admin state changes and export operations call `writeAuditEvent()`, storing actor ID, action, SHA-256 payload hash, and IP address in `audit_events`. Export CSV batches generate SHA-256 checksums and spreadsheet formula protection (`'`).

---

## Security Findings Matrix

| Finding ID | Domain | Severity | Description | Remediation |
|---|---|---|---|---|
| SEC-01 | Environment | LOW | Example bank account numbers in `.env.example` look realistic. | Ensure safe test/dummy values are used in development; never commit production credentials. |
| SEC-02 | Auth | LOW | Member session cookie duration (30 mins) requires re-authentication on long tasks. | Expected design choice for shared device security. |
| SEC-03 | Export | LOW | PRC Export UI should enforce AAL2 MFA check explicitly before batch generation. | Enforce AAL2 MFA verification check on export button trigger in UI. |
