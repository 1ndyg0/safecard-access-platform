# Row-Level Security (RLS) Matrix

**Baseline:** 9 September 2026  
**Source:** `supabase/migrations/00008_rls_policies.sql`  

---

## Access Control Matrix

| Table Name | ANON | AUTHENTICATED APPLICANT / MEMBER | AMBASSADOR | OPERATOR / STAFF (`support_agent`, `school_admin`) | ADMIN / EXPORT (`finance_export`, `prc_liaison`) | SUPER_ADMIN / PRIVACY_ADMIN_OWNER | SERVICE ROLE (`getSupabaseAdminClient()`) |
|---|---|---|---|---|---|---|---|
| `organizations` | NONE | NONE | NONE | SELECT | SELECT | ALL | ALL |
| `pilot_campaigns` | SELECT (Active only) | SELECT (Active only) | SELECT (Active only) | SELECT | SELECT | ALL | ALL |
| `users` | NONE | SELECT (Self) | SELECT (Self) | SELECT (Self/Campaign) | SELECT (Self/Campaign) | ALL | ALL |
| `role_assignments` | NONE | NONE | NONE | SELECT (Self) | SELECT (Self) | ALL | ALL |
| `sponsors` | NONE | NONE | SELECT (Self) | SELECT | SELECT | ALL | ALL |
| `referral_links` | SELECT (Validate slug) | SELECT (Validate slug) | ALL (Own links) | SELECT | SELECT | ALL | ALL |
| `recipient_cases` | INSERT (Draft) | SELECT (Own case), UPDATE (Draft) | NONE | SELECT (Campaign) | SELECT (Campaign) | ALL | ALL |
| `recipient_profiles` | NONE | SELECT (Own profile) | NONE | NONE (Blocked) | SELECT (PII authorized roles) | ALL | ALL |
| `relationships` | NONE | SELECT (Own case) | NONE | SELECT | SELECT | ALL | ALL |
| `content_versions` | SELECT (Published) | SELECT (Published) | SELECT (Published) | SELECT | SELECT | ALL | ALL |
| `consent_records` | INSERT (Intake) | SELECT (Own consent) | NONE | SELECT | SELECT | ALL | ALL |
| `application_submissions` | INSERT (Draft) | SELECT (Own) | NONE | SELECT | SELECT | ALL | ALL |
| `payment_intents` | INSERT (Intake) | SELECT (Own) | NONE | SELECT | SELECT | ALL | ALL |
| `payment_evidence` | INSERT (Intake) | SELECT (Own) | NONE | SELECT, UPDATE | SELECT, UPDATE | ALL | ALL |
| `prc_export_batches` | NONE | NONE | NONE | NONE | SELECT, INSERT | ALL | ALL |
| `prc_export_items` | NONE | NONE | NONE | NONE | SELECT, INSERT | ALL | ALL |
| `membership_status_events` | NONE | SELECT (Own active) | NONE | SELECT | SELECT | ALL | ALL |
| `support_cases` | INSERT (Gated) | SELECT (Own) | NONE | SELECT, UPDATE | SELECT, UPDATE | ALL | ALL |
| `audit_events` | NONE | NONE | NONE | NONE | SELECT | ALL | ALL |

---

## Key RLS Protection Policies Enforced

1. **Strict Service-Role Isolation (BFF Pattern):** Route handlers in Next.js execute using the Supabase Service Role client (`getSupabaseAdminClient()`), which bypasses direct RLS policies. Handlers explicitly enforce application-level authentication (`requireStaffAuth()`, `requireMemberSession()`) and authorization (`requireAnyRole()`).
2. **Sponsor Privacy Boundary:** `is_case_sponsor()` function ensures sponsors can access aggregate campaign funnel metrics, but `recipient_profiles` queries are hard-blocked by RLS.
3. **Public Non-Enumeration:** Anonymous callers (`ANON`) cannot list or iterate through `recipient_cases`, `recipient_profiles`, or `application_submissions`.
4. **Member Self-Isolation:** Members can only query their own `recipient_cases` and `recipient_profiles` matching their authenticated `auth_user_id` or session token.
5. **PRC Export Security Gate:** Export batches and export items can only be read or created by staff possessing the `finance_export` or `prc_liaison` role with active AAL2 MFA verification.
