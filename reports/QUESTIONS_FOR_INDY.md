# Questions for Indy

**Baseline:** 9 September 2026  
**Author:** Kerwin Arlan  

The following open questions cannot be resolved purely from repo code or existing backlog evidence. They are presented here for Indy's review prior to production deployment:

1. **Target Supabase Environment:**  
   Is there a shared staging/preview Supabase project instance deployed, or should migrations continue to be run and tested against the local Supabase CLI stack during PR review?

2. **AAL2 Authenticator Requirement for Export:**  
   The backend export handler (`/api/export/batch`) checks for MFA/AAL2 level. Is authenticator TOTP enrollment enabled in the staging Supabase Auth project for `finance_export` staff users?

3. **PRC CSV Field Column Mapping:**  
   Has PRC provided written sign-off on the final column headers for `prc_membership_v1` CSV export, or is the current 12-column schema in `src/lib/export/index.ts` accepted for pilot UAT?

4. **Production Payment Channel Configuration:**  
   When `ENABLE_OFFICIAL_PAYMENT_HANDOFF` is enabled, will PRC official GCash QR and bank deposit details be populated via Vercel environment variables or seeded into the database?

5. **Customer Dashboard / Account Auth Scope:**  
   The current member portal (`/member`) uses Application Reference + Mobile Number without password/SMS OTP for pilot safety. Is this passwordless model approved as the long-term member portal design, or is email/password customer account login required for R2?
