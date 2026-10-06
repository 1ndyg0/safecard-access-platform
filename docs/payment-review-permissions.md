# Payment review and PRC export permissions

Prepared 6 October 2026. Production assignments require separate approval.

`payment_reviewer` is the campaign-scoped role for matching an applicant name to private transfer proof, approving proof or recording a reason for replacement. It sees first/last name and the payment information needed for that task, not birth date, sex, address or contact information. It does not approve applications, confirm PRC membership or activate membership.

`finance_export` is the separately assignable PRC export permission. It does not authorize private proof access, payment approval or replacement. PRC export still requires a genuine MFA session and the existing batch eligibility checks. Existing school/PRC/owner responsibilities retain their documented application-review and handoff permissions; they do not imply payment decision permission.

Someone doing both jobs needs two explicitly approved scoped assignments. The migration adds the enum value only; it does not copy grants, automatically grant payment review to existing exporters, or revoke existing role rows. Review existing users before deploying the changed role semantics. Production was reported to have no staff rows; confirm this again before execution. If a legitimate existing user does both jobs, obtain approval for the additional payment role and preserve their export assignment.

The private Data API grants remain revoked by migrations 00018/00020. Payment reviewers use the audited server API, campaign-role resolution and service-role-only payment RPCs. No browser or authenticated database role receives new table/Storage/RPC grants. A hidden navigation link is convenience only: export console, batch, download and staff configuration requests enforce server authorization independently.

Deployment/migration plan: apply the harmless 00021 tombstone, 00022 draft-payment migration, 00023 nullable quotas and new forward migration 00024 (staff_role enum addition), after schema recheck, fresh private backup and approval. Do not modify already-applied migrations. No individual invitation or access assignment is final until the operator supplies a name, email, responsibility and scope.
