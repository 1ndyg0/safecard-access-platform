# SafeCard production MVP runbook

Updated 29 September 2026. This describes the intended production flow and the
observed release blockers. It is not a claim that the current Vercel deployment
already runs these changes.

## Current hosted state

The public Vercel site still runs `main` at `56e209f` as last verified. Its
`/api/pilot/config` returned synthetic mode, launch gates off and payment
unavailable. The linked production and staging Supabase projects appeared
`INACTIVE` in the CLI, and production migration-history login failed. Public
content/referral API requests returned 500. The work in this branch has **not**
been deployed, and no hosted applicant/payment/admin transaction has passed.
Keep the production URL available while repairing the underlying service. Do
not represent an unavailable application as a successful demo enrollment.

## Applicant and staff workflow

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
