# SafeCard Access Platform — API Contract Specification

**Baseline:** 9 September 2026  
**Base URL:** `/api`  
**Authentication:**
- Staff Endpoints: Supabase JWT (`requireStaffAuth()`) + Role Checks (`requireAnyRole()`)
- Member Endpoints: HTTP-only signed cookie `safecard_member_session` (`requireMemberSession()`)
- Public Endpoints: Rate-limited public route handlers

---

## Error Response Format
All route handlers return a consistent JSON error shape on failure:
```json
{
  "error": "Human-readable error message.",
  "details": {} // Optional field validation errors
}
```

---

## Endpoint Contracts

### 1. Payment Verification (Staff)
`POST /api/payment/verify`
- **Auth:** Staff (`school_admin`, `finance_export`, `prc_liaison`)
- **Request Body:**
```json
{
  "payment_intent_id": "UUID",
  "verification_source": "manual_prc_reconciliation" | "prc_confirmation",
  "evidence": {
    "official_reference": "STRING (Optional)"
  }
}
```
- **Response (200 OK):**
```json
{
  "verified": true,
  "message": "Payment verified. Membership remains inactive until PRC confirms."
}
```

---

### 2. Admin Submissions List (Staff)
`GET /api/admin/cases?campaign_id=UUID&state=STRING&search=STRING&page=NUMBER&limit=NUMBER`
- **Auth:** Staff (`privacy_admin_owner`, `school_admin`, `prc_liaison`, `support_agent`, `finance_export`)
- **Query Parameters:**
  - `campaign_id` (Required): UUID
  - `state` (Optional): Filter state across all state machines
  - `search` (Optional): Matches `application_ref`
  - `page` (Optional, Default `1`): Integer >= 1
  - `limit` (Optional, Default `25`): Integer 1-100
- **Response (200 OK):**
```json
{
  "cases": [
    {
      "id": "UUID",
      "application_ref": "SC-2026-XXXXXXXX",
      "consent_state": "agreed",
      "application_state": "submitted",
      "payment_state": "verified_by_official_source",
      "prc_handoff_state": "ready_for_export",
      "membership_state": "pending_prc_confirmation",
      "created_at": "ISO-8601"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 25,
    "total": 1,
    "totalPages": 1
  }
}
```

---

### 3. Assign Staff Role (Admin)
`POST /api/admin/roles/assign`
- **Auth:** Staff (`privacy_admin_owner`, `school_admin`)
- **Request Body:**
```json
{
  "user_id": "UUID",
  "role": "school_admin" | "prc_liaison" | "support_agent" | "finance_export" | "content_approver" | "privacy_admin_owner",
  "campaign_id": "UUID (Optional)",
  "organization_id": "UUID (Optional)",
  "reason": "STRING (Optional)"
}
```
- **Response (201 Created):**
```json
{
  "roleAssignmentId": "UUID",
  "status": "assigned",
  "message": "Role support_agent assigned successfully"
}
```

---

### 4. Create PRC Export Batch (Export Staff)
`POST /api/export/batch`
- **Auth:** Staff (`finance_export`, `school_admin`, `prc_liaison`)
- **Request Body:**
```json
{
  "campaign_id": "UUID",
  "creation_reason": "STRING",
  "format": "prc_membership_v1"
}
```
- **Response (201 Created):**
```json
{
  "batchId": "UUID",
  "batchRef": "PRC-BATCH-2026-0909-001",
  "recordCount": 12,
  "checksum": "SHA-256 HASH",
  "format": "prc_membership_v1"
}
```

---

### 5. Mark Payment Paid (Member)
`POST /api/payment/mark-paid`
- **Auth:** Authenticated Member Session (`safecard_member_session` cookie)
- **Request Body:**
```json
{
  "reference_number": "STRING"
}
```
- **Response (200 OK):**
```json
{
  "success": true,
  "message": "Payment reference recorded. Awaiting official verification."
}
```
