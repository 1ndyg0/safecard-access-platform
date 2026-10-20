# SafeCard R1 release gates

Status date: 12 September 2026.

## Current deployment

The stable deployment is [https://safecard-access-platform.vercel.app](https://safecard-access-platform.vercel.app), built from `main` merge commit `dea0e065f13dfa0c220c4357584e25ababbeba79`. It is verified in safe synthetic mode with launch and payment handoff disabled.

Production Supabase project `ajyhlkzbocjeepglkhrl` contains canonical migrations `00001` through `00020` plus preserved legacy history records. The official GCash QR is private at `payment-proofs/official/gcash-qr.webp`, and the confirmed BPI account number is `002963000782B`. GitHub issue [#7](https://github.com/1ndyg0/safecard-access-platform/issues/7) records the owner-approved MVP backup waiver and mandatory R2 backup work.

## Controlled-pilot candidate

The candidate on `codex/safecard-controlled-pilot` adds strict fail-closed production configuration, resumable server-backed applications, PDF receipt validation, payer-reported date and amount, authorized field search, login/logout auditing, and a controlled bootstrap path. It also adds migration `00021`, which is not part of the current production deployment until the candidate is reviewed, tested, merged, and applied.

Live activation remains blocked until the production campaign, pinned bilingual content, and real named staff assignments are created and reviewed. Follow [the controlled production pilot runbook](controlled-production-pilot.md). A build or preview alone is not approval to enable real data.

Payment declaration, payment verification, application approval, and PRC export cannot activate membership. Only an accepted PRC response with recorded confirmation evidence can produce `active_confirmed`.

## Verification and recovery

The exact candidate commit must pass unit/contract tests, TypeScript, ESLint, production build, public Playwright and performance suites, and disposable-database admin suites. Tests that create or reset fixtures must never target the production project.

On any failure, make the campaign inactive and restore the three safe settings: `NEXT_PUBLIC_DATA_MODE=synthetic`, `LAUNCH_GATES_COMPLETE=false`, and `ENABLE_OFFICIAL_PAYMENT_HANDOFF=false`. Preserve production evidence and audit history and use reviewed forward corrections for database changes.
