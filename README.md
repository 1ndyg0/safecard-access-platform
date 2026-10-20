# SafeCard Access Platform

SafeCard is a mobile-first, bilingual intake and education layer for the Philippine Red Cross Safe Card pilot. The only approval step is the administrator approving an application; that single action also verifies the applicant's payment proof. Consent, application, payment and review remain separate, explicit states.

## R1 safety boundary

- Production accepts real personal data only when strict live configuration is complete: `NEXT_PUBLIC_DATA_MODE=live`, `LAUNCH_GATES_COMPLETE=true`, payment handoff enabled, all server secrets present, and reviewed campaign/content IDs pinned. A production configuration error fails closed and never falls back to synthetic data.
- Consent is captured before a recipient profile can be saved.
- Only the administrators who review an application can see the applicant's profile and payment proof, and only through role-scoped, audited projections.
- The browser has no direct table access. Route Handlers authenticate and authorize each request, project minimal response DTOs, and use a server-only service-role client.
- Direct GCash API/webhook processing is not part of R1. The payment module records an official external handoff, payer-reported date/amount/reference, private image or constrained-PDF evidence, and the administrator's verification when approving the application.
- Approving an application (`/api/admin/cases/[id]/approve-with-payment`) verifies the payment proof the reviewer looked at in the same confirmed action. There is no separate payment-verification screen, PRC export or PRC acceptance step.
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

Generate independent secrets for `AUDIT_HASH_SALT`, `RATE_LIMIT_HASH_SALT`, `MEMBER_SESSION_SECRET`, and `CRON_SECRET`. Do not reuse a Supabase key. The checked-in seed is synthetic and its test credentials must never be used outside a local/preview environment.

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
- `src/app/api/payment`: official handoff, payer declaration, evidence upload, audited signed-URL viewing of the proof, and minimized status views.
- `src/app/api/content`: versioned bilingual source, PRC approval, publishing, rollback, and material-change consent expiry.
- `src/app/api/support` and `src/app/api/notifications`: categorized support/privacy requests and consented in-app events. No SMS provider is claimed in R1.
- `supabase/migrations`: enums, relational model, immutable logs, state-supporting constraints, RLS documentation, BFF grants, durable jobs, rate limiting, and metrics.

## Product routes

- Public education: `/`, `/benefits`, `/privacy`, `/help`
- Consent-first application: `/apply` (legacy step URLs redirect here so they cannot bypass the gated flow)
- Member access: `/member`, `/member/card`, `/member/status`
- Administrator access: `/admin/login`, `/admin` (three counts and a link in), `/admin/applications` (complete applications only; **Review** opens a slide-over to approve or reject). See [`docs/admin-console.md`](docs/admin-console.md).

Member access deliberately uses application reference plus registered mobile number without SMS OTP. Successful matching creates a signed, HTTP-only, 30-minute session; no bearer token or personal data is stored in browser storage. Staff access uses Supabase email/password. Cost-bearing SMS, email delivery, payment providers, and direct PRC integrations are parked.

See [`docs/implementation-status.md`](docs/implementation-status.md) for current coverage and [`docs/controlled-production-pilot.md`](docs/controlled-production-pilot.md) for the reviewed bootstrap, activation, test, and rollback sequence.

## Deployment gates

Keep the campaign inactive and `LAUNCH_GATES_COMPLETE=false` until the controlled-pilot checks have documented approval. Configuration is an enforcement switch, not evidence that approval or UAT occurred. The owner-approved MVP backup waiver is recorded in GitHub issue #7; backup remains mandatory before R2 or a destructive migration.
