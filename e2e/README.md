# Operations console E2E

These specs drive the real Next.js server and the real Route Handlers
against a real PostgreSQL database. They deliberately do **not**
intercept `/api/admin/**`.

The reason is specific to this module. Its risk lives in three places
that a mocked route cannot reach:

- **Campaign scoping.** Whether a case from another campaign returns 403
  is decided by a server query, not by a component.
- **What counts as complete.** Which applications the administrator may
  see (details submitted and proof of payment uploaded) is decided by the
  SQL view `admin_applications_view`. Drafts, applications without a
  proof of payment, and the retired correction workflow must never
  appear, and only real rows can show that.
- **The decision.** Approve verifies the payment and reject stores its
  reason through atomic database functions and an append-only ledger; a
  stub cannot prove either.

## Running

Requires a disposable database. The seed refuses any other target.

```bash
npx supabase start
npx supabase db reset          # applies migrations, including 00023
npm run build
npm run test:e2e:install       # once, downloads Chromium
E2E_SUPABASE_URL=http://127.0.0.1:54321 \
E2E_SERVICE_ROLE_KEY=<local service role key> \
npm run test:e2e
```

`npm run test:performance:admin` runs the scale suite, which seeds several
hundred complete applications and asserts that the dashboard response stays
constant-size and the list returns one page — the observable signature of
aggregating in SQL rather than in the application server.

Specs: `applications.spec.ts` (list, search, status, dashboard),
`review-panel.spec.ts` (the slide-over and the approve/reject routes),
`accessibility.spec.ts`, `database-security.spec.ts`.

## Against a hosted branch database

Set `E2E_ALLOW_REMOTE=1` alongside `E2E_SUPABASE_URL`. Only ever point
this at a Supabase **branch** database. The seed truncates every table
listed in `fixtures/seed.ts` before it inserts, and there is no
confirmation prompt.

`ajyhlkzbocjeepglkhrl` — the project named in `.codex/config.toml`, which
this application is actually configured against — is on a hard denylist
in `fixtures/seed.ts`. `E2E_ALLOW_REMOTE` does not override it. If the
app is ever repointed at a different project, update
`NEVER_SEED_PROJECT_REFS`; a unit test fails until you do.
