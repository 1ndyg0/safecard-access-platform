# Product backlog — replacement record

Source: https://claude.ai/code/artifact/5dce09ce-25b1-4e0c-b1d0-e175c46986bc

Access limitation: Claude artifact unavailable; this record preserves the requested scope and traceability without inventing the original artifact text.

## Release stories and status

| Story | Status | Evidence |
|---|---|---|
| Benefit accordion, Filipino/English scenarios, Hotline 143, disclaimers | Implemented and verified | `src/components/BenefitStoryboard.tsx`, Playwright smoke |
| Manual GCash/bank instructions and exact account configuration | Implemented but awaiting approval | `src/lib/payment/config.ts`, `docs/product/payment-provenance.md` |
| Private receipt upload, signature/MIME/size validation, SHA-256, signed URL | Partial | `src/lib/payment/evidence-validation.ts`, API routes, migration 00010 |
| Reviewer verification, replacement request, immutable evidence versions | Partial | admin case detail and payment review routes |
| Admin authentication, queue, search/filter/sort/pagination, aggregate cards | Partial | `src/app/api/admin/*`, `src/components/admin/*` |
| Playwright, axe, unit gates, CI | Implemented and verified | `playwright.config.ts`, `tests/e2e`, `.github/workflows/ci.yml` |
| SMS OTP, direct GCash API, external SMS/email, direct PRC API | Parked | No provider or paid integration introduced |

Definition of done for each story includes consent/state-boundary checks, server-side authorization, no PII in analytics, keyboard accessibility, tests, audit evidence, and documentation update. Any story blocked by owner/privacy/PRC approval is explicitly marked rather than silently enabled.

## Change history

- 2026-09-08: Added payment evidence, admin review, storyboard, accessibility, security, and QA stories to the replacement register.
