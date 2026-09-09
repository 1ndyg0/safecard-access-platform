# Release gates and blockers

## Passed in this workspace

- Required commit ancestry verified from `3642ea2ac3ada6a1f09b934d5f2be7454f0c5806`.
- ESLint (warnings only), TypeScript, Vitest (17 tests), and Next production build pass locally.
- Playwright smoke/accessibility: 20/20 passed across Chromium, Firefox, WebKit, Mobile Chrome, and Mobile Safari.
- Vercel preview build completed successfully and is READY.

## Blocked or awaiting approval

- Supabase `db diff` cannot run because Docker Desktop is unavailable.
- Linked Supabase project has remote migrations `202609050001` and `202609050002` absent from this checkout. `supabase db push --include-all` stopped safely; no migration was applied. Do not repair history without reviewing those migrations and receiving database-password/owner direction.
- Private `payment-proofs` bucket and migration 00010 are not claimed as deployed.
- The supplied QR/account details require written PRC/owner verification before payment handoff activation. The UI remains controlled-pilot gated.
- The Vercel preview is protected by Deployment Protection, so unauthenticated browser smoke against its public URL is blocked. An authenticated CLI HEAD check returned HTTP 200. Production was not promoted.

## Explicit boundaries

- No SMS OTP, paid GCash/payment-provider API, settlement, or external notification integration was introduced.
- Payment verification never changes membership to active; only a separate recorded PRC confirmation can do that.
