# SafeCard production MVP runbook

Updated 3 October 2026. This describes the intended production flow and the
observed release blockers. It is not a claim that the current Vercel deployment
already runs these changes.

## Current hosted state

The public Vercel site still runs `main` at `56e209f` as last verified. Production
Supabase `ajyhlkzbocjeepglkhrl` was resumed with owner approval and is healthy.
Its migration history reaches `00020` plus the two legacy timestamp versions;
`00021`, `00022` and `00023` have not been applied. The required organization,
campaign, approved bilingual notices and named staff roles remain absent.
The work in this branch has **not** been deployed, and no hosted
applicant/payment/admin transaction has passed. The historical 500 responses
do not establish current failures: the 3 October Vercel last-hour log window
contained no request logs, while Supabase's last-day counts showed no 4xx/5xx
entries with very little application traffic.
Keep the production URL available while repairing the underlying service. Do
not represent an unavailable application as a successful demo enrollment.

## Applicant and staff workflow

Indy confirmed that SafeCard is his personal project, coached by Vibe Coders PH.
No legal operating organization or approved PRC operating agreement is currently
in place. Use a SafeCard internal organization namespace rather than claiming
PRC operates this application. The bank details were confirmed by the project
owner; PRC must still approve the operating relationship, data fields, notices,
retention, guardian and payment policies before real intake can open.

Applicant: education → four answered and correctly understood questions →
private accept/decline → approved consent and privacy notice → validated profile
(ages 3–85 by completed birthday) → selection of an approved PRC bank account →
transfer outside SafeCard → JPEG, PNG or WebP receipt image (up to 10 MiB) and
payer declaration → review and final declaration → idempotent submission →
application reference, with payment verification pending. A draft case ID exists
before final submission solely to associate consent, profile, payment and proof.

Staff: individual sign-in → campaign-scoped case list → private proof preview →
approve payment or reject it with a reason and permit replacement → application
review → PRC handoff. Each action is audited. Payment verification does not
approve the application or activate membership. PRC confirmation remains its
own recorded step. Automated bank verification is not part of the MVP.

Invited staff set their own password and authenticator at `/admin/account`.
The page verifies active staff access. MFA assurance comes from the actual
Supabase session; a profile's `mfa_enabled` field cannot satisfy an AAL2 gate.
Disabled staff profiles are refused even if a role assignment remains active.
Configure Supabase's invite email link before sending invitations as:
`{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=invite`.
For recovery use the same path with `type=recovery`. Approve the exact production
Site URL, redirect allowlist, email sender and templates before changing hosted
Auth settings. `/auth/confirm` accepts only invitation/recovery token hashes and
redirects to the local account page; request-supplied destinations are ignored.
The pattern follows [Supabase's email template guidance](https://supabase.com/docs/guides/auth/auth-email-templates).

## Facts to confirm with the payment and program owners

The current repository says PHP 1,200 annual fee and age 3–85, consistent with
the supplied program overview. The owner then confirmed manual PRC bank transfer,
the Philippine Red Cross account name, and four exact account numbers in the
latest project instruction. The public payment QR has been removed. Confirm the
replacement and incorrect-payment rules against an approved source; do not
invent them. The program overview's benefit/exclusion wording and its
"one year from registration" term need a current PRC-approved version before
definitive public benefit or activation wording is expanded.

## Predeployment read-only checks

1. In Vercel, identify the exact production deployment SHA and environment
   variable scope. Inspect logs for `/api/pilot/config`, content, referrals,
   intake and payment failures. Do not paste secrets into chat.
2. In Supabase, inspect project status, database health and logs, remote
   migration history, active campaign and approved routes/content, Auth users,
   campaign roles, private `payment-proofs` bucket, RLS and current backups.
   Verify whether the old `00021` shared-password migration ran; the older
   pilot branch contains a different `00021` and must not be merged wholesale.
3. Record a recoverable backup and restore procedure. Inspect the difference
   between the remote schema and this branch. The local `00021` is now a
   harmless placeholder for fresh environments; it does not reverse any
   earlier remote migration or delete committed Git history.
4. On a disposable database and storage target, apply migrations in order,
   run SQL lint and the production applicant/admin browser workflow. The
   current machine has no Docker runtime, so this stage has not run locally.

The disposable database CI job for `43cb65d` passed 147 workflow/security tests
and 9 admin performance tests, including migration `00023`. Its public check
failed one WebKit accordion test; the new test synchronizes with the actual
expansion animation. Later commits add field-approval enforcement, notice display,
staff account setup and regression coverage, so their complete CI must pass too.
CI has not verified production account/email delivery or a full backup restore.

The 29 September private PostgreSQL backup has a readable catalog and schema.
It excludes Storage file bytes, and a full restore has not been tested. Refresh
the snapshot immediately before an authorized migration and verify its catalog;
do not describe catalog inspection as a successful recovery test.

## Release and rollback

After the exact SHA, payment details, database history and backup are reviewed,
obtain the owner's immediate confirmation before **each** production database
migration, access change, secret rotation, or Vercel deployment. Apply only a
reviewed forward migration (`00022` is proposed for the draft-payment contract
and actual comprehension answers); never run both divergent `00021` bodies.
Provision named staff through invitations and grant only required roles. Do not
use a shared password or log in with the previously published credential.

Deploy a reviewed SHA with production data mode and official manual bank transfer
enabled, then check `/api/pilot/config` says live and bank transfer available.
Run a controlled, authorized end-to-end applicant transaction and staff proof
review using an approved non-real payment fixture or owner-approved small
transaction. Verify private proof access, duplicate-click behavior, application
reference, pending state, rejection/replacement, audit events and separation of
payment, application and PRC activation. Inspect Vercel and Supabase logs.

If deployment fails, revert Vercel to the last compatible deployment while
preserving real submissions and proof history. Database migrations are additive;
prefer a reviewed forward correction once data has been written. Use a backup
restore only under an owner-approved recovery procedure, with a record of any
post-backup writes that would be lost. Do not erase evidence/audit history or
rewrite remote migration history to conceal a mismatch.
