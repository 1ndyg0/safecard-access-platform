# Controlled production pilot runbook

This runbook moves the existing safe-mode deployment into a limited real-data pilot. It does not authorize activation by itself. Use the reviewed commit, record the resulting identifiers, and keep the campaign inactive until every check below is complete.

## Fixed production boundary

- Application: `https://safecard-access-platform.vercel.app`
- Supabase project: `ajyhlkzbocjeepglkhrl`
- Private receipt bucket: `payment-proofs`
- Official QR object: `official/gcash-qr.webp`
- Annual fee: PHP 1,200
- Confirmed BPI account: `002963000782B`
- Direct payment processing, SMS, email, push, and direct PRC API integration remain parked.

Production currently has canonical migrations `00001` through `00020`. Migration `00021_payment_receipt_pdf_and_declaration_details.sql` must be applied from the exact release commit before enabling live intake. It adds payer-reported date and amount fields and permits PDF receipt evidence. Run the repository migration command only after reviewing the linked project, then confirm the remote history and run linked database lint. Never run `supabase/seed.sql` against production.

## Required production environment

Set all values in the Vercel Production scope. Preview and Development must use isolated data and their own secrets.

```text
APP_ENVIRONMENT=production
NEXT_PUBLIC_DATA_MODE=live
LAUNCH_GATES_COMPLETE=true
ENABLE_OFFICIAL_PAYMENT_HANDOFF=true
NEXT_PUBLIC_SUPABASE_URL=https://ajyhlkzbocjeepglkhrl.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<production publishable key>
NEXT_PUBLIC_APP_URL=https://safecard-access-platform.vercel.app
SUPABASE_SERVICE_ROLE_KEY=<production server-only key>
PAYMENT_PROOFS_BUCKET=payment-proofs
APPROVED_CAMPAIGN_ID=<reviewed production campaign UUID>
APPROVED_CONTENT_VERSION=<reviewed bilingual content version>
AUDIT_HASH_SALT=<independent secret, at least 32 characters>
RATE_LIMIT_HASH_SALT=<independent secret, at least 32 characters>
MEMBER_SESSION_SECRET=<independent secret, at least 32 characters>
CRON_SECRET=<independent secret, at least 32 characters>
```

Production fails closed if a required value is absent or invalid, the pinned campaign is inactive, the pinned content is incomplete, or the official GCash QR cannot be signed. It does not switch to synthetic data after a production configuration failure.

## First administrator and governed pilot records

Review `config/controlled-pilot.example.json` and the canonical storyboard in `src/lib/benefit-storyboards.ts` before use. Together they supply temporary governed English and Filipino privacy, consent, and benefit content, the approved field list, payment route types, the fee, the BPI account number, a 50-application cap, and explicit stop conditions. They are marked as controlled-pilot content rather than final PRC policy.

Use a named administrator mailbox. The bootstrap sends a Supabase invitation and never creates or stores a password in the repository.

```bash
APP_ENVIRONMENT=production \
CONFIRM_CONTROLLED_PILOT_BOOTSTRAP=YES \
NEXT_PUBLIC_SUPABASE_URL=https://ajyhlkzbocjeepglkhrl.supabase.co \
NEXT_PUBLIC_APP_URL=https://safecard-access-platform.vercel.app \
SUPABASE_SERVICE_ROLE_KEY='<server-only key>' \
BOOTSTRAP_ADMIN_EMAIL='<named administrator email>' \
BOOTSTRAP_ADMIN_NAME='<administrator full name>' \
npm run bootstrap:pilot
```

The command is repeatable. It upserts the organization, an inactive campaign, the four bilingual consent/privacy records, the canonical governed benefit storyboard, the local user profile, and one organization-scoped `privacy_admin_owner` assignment. It prints the campaign ID needed for `APPROVED_CAMPAIGN_ID`. The invited administrator follows the email link to `/admin/setup`, creates a private password of at least 12 characters directly through Supabase Auth, and then provisions the remaining named staff through the user-management console. SafeCard never generates or logs that password.

Use the smallest campaign-scoped role that supports each duty:

| Pilot duty | Role |
|---|---|
| Accountable administrator and user management | `privacy_admin_owner` |
| Application review | `school_admin` |
| Payment review | `finance_export` |
| Read-only contact support | `support_agent` |
| PRC handoff and acknowledgement | `prc_liaison` |
| Content-only work | `content_approver` |

Require an actual AAL2 session for export-capable staff. Confirm login and logout events appear in the audit timeline. Review every role with a separate test account before admitting applicants.

## Activation check

Before activating the campaign:

1. Confirm migration `00021` is applied and linked database lint returns no errors.
2. Confirm the private bucket accepts JPEG, PNG, WebP, and PDF up to 10 MiB; unsigned object access must fail.
3. Confirm a signed URL for `official/gcash-qr.webp` returns the expected asset.
4. Review the pinned campaign, approved fields, PHP 1,200 fee, payment routes, stop conditions, and bilingual content in the admin console.
5. Provision and test the required campaign roles, including one administrator, one application reviewer, one payment reviewer, one support/read-only user, and one PRC liaison.
6. Run one isolated real applicant journey with explicit consent: resume, submit, open payment, report date/amount/reference, upload an image or PDF receipt, review evidence, verify payment, and inspect member status. Use an authorized pilot participant; do not create fake production applicants.
7. Confirm payment verification does not activate membership. Confirm only a PRC acceptance with official evidence changes membership to `active_confirmed` and exposes the electronic card.
8. Check Vercel and Supabase logs for errors and confirm no secrets, receipt URLs, or unnecessary personal fields appear.

Activate the campaign only after those checks pass. Keep external notifications disabled; users receive status through the member portal until a provider and consented delivery workflow are separately approved.

## Stop and rollback

Stop intake by setting the campaign inactive, then redeploy with `LAUNCH_GATES_COMPLETE=false`, `ENABLE_OFFICIAL_PAYMENT_HANDOFF=false`, and `NEXT_PUBLIC_DATA_MODE=synthetic`. Production will show the safe-mode experience and refuse real-data API requests. Roll application code back to the last verified schema-compatible deployment. Preserve receipt evidence, audit events, submissions, and migration history; use a reviewed forward database correction when production writes exist.

The owner waived the recoverable-backup gate for this MVP. GitHub issue [#7](https://github.com/1ndyg0/safecard-access-platform/issues/7) makes a production backup strategy a stop condition for R2 and for destructive migrations. This waiver does not permit resets, destructive migrations, or synthetic seeds in production.
