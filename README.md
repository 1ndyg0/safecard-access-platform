# SafeCard Access Platform

A consent-first Next.js prototype derived from the project vision, personas, journey map, and backlog. It includes a student sponsor dashboard and a mobile recipient flow for education, comprehension, consent, and synthetic intake.

## Local setup

1. Install dependencies with `npm install`.
2. Copy `.env.example` to `.env.local`.
3. Run `npm run dev`.

The default `NEXT_PUBLIC_DATA_MODE=demo` stores synthetic demo activity in the browser. No credentials are required.

## Supabase setup

1. Create a Supabase project in the Singapore region.
2. Apply `supabase/migrations/202609050001_initial_pilot.sql` in the SQL editor or CLI.
3. Enable anonymous sign-ins in Supabase Authentication.
4. Set the public project URL and anon key in `.env.local` and Vercel.
5. Change `NEXT_PUBLIC_DATA_MODE` to `supabase`.

The schema stores invitation state only. Do not add or collect real applicant information until the project's PRC approval, privacy, safeguarding, data-flow, and retention gates are complete.

## Vercel

The project is connected to the private GitHub repository `1ndyg0/safecard-access-platform` and the Vercel project `safecard-access-platform` in the SC team. Pushes to `main` trigger production deployments automatically.

Production: https://safecard-access-platform.vercel.app

The framework is detected as Next.js. Keep the three environment variables above configured in Preview and Production when adding additional environments.

## Scope boundary

This is a school-project prototype, not an official Philippine Red Cross product. It does not process payments, register members, issue membership IDs, decide claims, or promise benefit eligibility.
