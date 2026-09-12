# SafeCard R1 release gates

The authoritative integration branch is `codex/safecard-r1-integration`, reviewed from `36585cc4554859165455e1ef764761e094915e1f`. Historical smoke-only results and existing Vercel deployments do not verify this release.

## Current release boundary

**BLOCKED — NOT SAFE TO DEPLOY.** Use the exact-commit results in [draft PR #6](https://github.com/1ndyg0/safecard-access-platform/pull/6). Do not promote from a successful build or from an earlier commit's tests.

- GitHub Actions runs the full public browser and performance suites and a disposable PostgreSQL/Supabase stack for migration, SQL lint, admin E2E, and admin performance checks. All release runs explicitly use zero retries.
- The shared Supabase project `ajyhlkzbocjeepglkhrl` contains legacy migrations `202609050001` and `202609050002`. Their sponsorship schema is not equivalent to repository migrations 00001–00017. No history repair, hosted migration, seed, or reset was performed.
- No approved isolated hosted staging target has been identified. The existing project remains excluded from synthetic fixture resets. Obtain the target identifier and approved account access before configuring a Preview.
- Migrations 00014–00016 contain repairs to previously unapplied functions. Migration 00018 closes direct Data API access and protects submission and evidence snapshots. Migration 00019 makes payment declarations idempotent without rewinding payment or membership state. Apply the full history to an empty isolated target; migration success in CI is not a hosted rollout.
- The official QR asset and PRC payment details still need owner verification. Do not fabricate a QR or activate payment handoff.
- A Preview using the approved staging database must pass post-deployment Playwright and log review. External invitation-email delivery requires a controlled mailbox test; it is not yet verified.

## Production authorization

Keep `NEXT_PUBLIC_DATA_MODE=synthetic`, `LAUNCH_GATES_COMPLETE=false`, and `ENABLE_OFFICIAL_PAYMENT_HANDOFF=false`. SMS and phone MFA remain disabled; sensitive export requires authenticator AAL2.

Production requires explicit approval of the exact SHA, payment details and QR, campaign routes, real-data mode, handoff, production database and domain, redirects, staff administrators, and retention/privacy settings. A current recoverable backup and reviewed migration history are mandatory before that rollout.

Payment declaration, payment verification, application approval, and PRC export must never activate membership. Only an accepted PRC response with recorded confirmation evidence may do so.

## Recovery

Leave gates disabled when verification fails. For a future approved rollout, preserve the database backup and deployment identifiers before changes. Roll back application code to the last verified compatible Vercel deployment; restore a database backup only under an approved recovery procedure. Do not delete evidence/audit history, reverse immutable records, run synthetic seeds on shared data, or use migration-history repair to hide a schema mismatch. Prefer a reviewed forward correction when new database writes exist.
