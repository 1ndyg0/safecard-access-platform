# Operations console E2E

These specs drive the real Next.js server and the real Route Handlers
against a real PostgreSQL database. They deliberately do **not**
intercept `/api/admin/**`.

The reason is specific to this module. Its risk lives in three places
that a mocked route cannot reach:

- **Campaign scoping.** Whether a case from another campaign returns 403
  is decided by a server query, not by a component.
- **Enum typing.** The five workflow states are distinct PostgreSQL enum
  types. Comparing a value against the wrong column raises
  `invalid input value for enum` at execution time. A stub returns
  whatever it was told to return and proves nothing.
- **Suppression.** Small-cohort suppression, including the complement
  rule, runs inside `admin_campaign_analytics`. The 4-versus-5 boundary
  is only meaningful against real rows.

## Running

Requires a disposable database. The seed refuses any other target.

```bash
npx supabase start
npx supabase db reset          # applies migrations, including 00011
npm run build
npm run test:e2e:install       # once, downloads Chromium
E2E_SUPABASE_URL=http://127.0.0.1:54321 \
E2E_SERVICE_ROLE_KEY=<local service role key> \
npm run test:e2e
```

`npm run test:performance` runs the scale suite, which seeds several
hundred cases and asserts that dashboard and analytics responses stay
constant-size — the observable signature of aggregating in SQL rather
than in the application server.

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
