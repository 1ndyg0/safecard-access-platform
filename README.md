# SafeCard Access Platform

SafeCard is a mobile-first, bilingual production MVP for Philippine Red Cross Safe Card applications. Applicants learn, decide privately, consent, enter details, choose one of four approved manual PRC bank-transfer routes, upload an image of payment proof, review, and submit for a reference. Staff verify payment separately from application review; only PRC confirmation can activate membership. See [the production runbook](docs/production-mvp-runbook.md) for the current hosted-service status and release procedure.

## Production MVP boundaries

- Production requires live data mode, operational Supabase, an active campaign, approved bilingual consent/privacy content, approved bank-transfer routes and the confirmed PHP 1,200 fee. A service outage is reported as unavailable; it is never represented as successful synthetic enrollment.
- Consent is captured before a recipient profile can be saved.
- Recipient, sponsor, guardian, and payer relationships are separate. Sponsors receive aggregate stage counts, never recipient profiles or application references.
- The browser has no direct table access. Route Handlers authenticate and authorize each request, project minimal response DTOs, and use a server-only service-role client.
- Manual PRC bank transfer and image proof are the official MVP route. No payment gateway or automated verification is required.
- A verified payment makes a case eligible for PRC export; it never activates membership.
- Exports require a campaign-scoped role plus an actual AAL2 session. Export rows are immutable snapshots with a deterministic checksum and spreadsheet-formula protection.
- Small campaign cohorts are suppressed in aggregate metrics.

## Local setup

Requirements: Node.js 24+, npm, Supabase CLI, and a Docker-compatible local container runtime for Supabase.

```bash
cp .env.example .env.local
npm install
npx supabase start
npx supabase db reset
npm run dev
```

Generate independent secrets for `AUDIT_HASH_SALT`, `RATE_LIMIT_HASH_SALT`, and `CRON_SECRET`. Do not reuse a Supabase key. The checked-in seed is synthetic and its test credentials must never be used outside a local/preview environment.

## Verification

```bash
npm run test
npm run lint
npx tsc --noEmit
npm run build
npx supabase db lint --local --level warning
```

The database lint/reset checks require the local Supabase stack to be running. A successful Next.js build does not validate SQL migrations or prove external delivery, PRC receipt, or any production launch gate.

## Backend map

- `src/app/api/intake`: case decision, consent-gated profile, comprehension evidence, idempotent submission, and recipient status.
- `src/app/api/sponsors` and `src/app/api/referrals`: sponsor-owned invitations and privacy-safe aggregate progress.
- `src/app/api/payment`: official handoff, payer declaration, campaign-scoped staff verification, and minimized status views.
- `src/app/api/content`: versioned bilingual source, PRC approval, publishing, rollback, and material-change consent expiry.
- `src/app/api/export`: MFA-gated immutable PRC packages, verified download checksum, per-record acknowledgment, correction, and PRC-only activation.
- `src/app/api/support` and `src/app/api/notifications`: categorized support/privacy requests and consented in-app events. No SMS provider is claimed in R1.
- `supabase/migrations`: enums, relational model, immutable logs/exports, state-supporting constraints, RLS documentation, BFF grants, durable jobs, rate limiting, and metrics.

## Product routes

- Public education: `/`, `/benefits`, `/privacy`, `/help`
- Consent-first application: `/apply` (legacy step URLs redirect here so they cannot bypass the gated flow)
- Member access: `/member`, `/member/card`, `/member/status`
- Ambassador access: `/ambassador/login`, `/ambassador`, `/ambassador/share`, `/r/[slug]`
- Staff access: `/admin/login`, `/admin`, `/admin/submissions`, `/admin/submissions/[id]`, `/admin/export`

Member access deliberately uses application reference plus registered mobile number without SMS OTP. Successful matching creates a signed, HTTP-only, 30-minute session; no bearer token or personal data is stored in browser storage. Staff and ambassador access uses Supabase email/password. Cost-bearing SMS, email delivery, payment providers, and direct PRC integrations are parked.

See [`docs/production-mvp-runbook.md`](docs/production-mvp-runbook.md) for the release state, operational checks, and recovery procedure. Older R1 documents describe historical gates and may not describe the current production MVP.

## Deployment

The repository contains the production MVP changes, but the deployed site must be verified separately. Setting flags is not proof that the database, payment owner details, and staff workflow work. Follow the production runbook and obtain the project owner's confirmation immediately before production deployment or database/access changes.
