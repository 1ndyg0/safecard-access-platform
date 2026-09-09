# Application review and corrections E2E

These specs drive the real protected routes against a real database.
They do not intercept `/api/member/**` or `/api/admin/**`.

For this module a mocked route proves nothing about the properties that
matter:

- **Session scoping.** That a member can only reach their own case is a
  property of the signed cookie plus the query. A stub returns whatever
  it was told to.
- **Version preservation.** That a correction creates a new submission
  and keeps the old one is a database behaviour, enforced by a partial
  unique index on `is_current`.
- **Duplicate refusal.** The second identical correction is rejected by
  a unique constraint, not by application code.
- **Consent revalidation.** Whether a materially changed consent version
  blocks a resubmission depends on real `content_versions` rows.

## Running

Requires a disposable database. The seed refuses any other target.

```bash
npx supabase start
npx supabase db reset          # applies migrations, including 00012
npm run build
npm run test:e2e:install       # once, downloads Chromium
E2E_SUPABASE_URL=http://127.0.0.1:54321 \
E2E_SERVICE_ROLE_KEY=<local service role key> \
npm run test:e2e
```

`npm run test:performance` runs the member-journey budget suite.

## Safety

`ajyhlkzbocjeepglkhrl` — the project named in `.codex/config.toml`, which
this application is configured against — is on a hard denylist in
`fixtures/seed.ts`. `E2E_ALLOW_REMOTE` does not override it. The seed
truncates every table it lists, with no prompt.
