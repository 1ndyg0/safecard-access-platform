# Implementation prompts and API contracts — replacement record

Source: https://claude.ai/code/artifact/1c1fbfe0-6b17-44ca-bee5-9acfaaf1592f

Access limitation: source artifact was not readable. Contracts below are derived only from the supplied release brief and current repository code.

## Contract decisions

- All protected routes require server-side Supabase session and campaign-scoped role checks; service-role access never enters browser bundles.
- Payment creation is idempotent and requires submitted application plus approved route. Mark-paid records payer declaration; verification transitions to `verified_by_official_source` only after staff action.
- `POST /api/payment/evidence/upload` accepts JPEG/PNG/WebP only, validates actual signature, dimensions, size (10 MB maximum), checksum, ownership, and non-enumerable case-scoped object path.
- `GET /api/payment/evidence/:id` returns a short-lived signed URL only to authorized staff. Replacement requests preserve prior versions.
- `POST /api/payment/verify` can verify evidence but cannot activate membership. Only PRC confirmation can produce `active_confirmed`.
- Admin case list supports exact application-reference search, independent state filters, server pagination, and age-oriented sorting.

## Required manual gates

Migration validation against a clean/preview database, private bucket verification, owner/PRC payment-detail confirmation, retention approval, and production environment configuration remain release gates.

## Change history

- 2026-09-08: Added proof upload/review contracts and QA/authorization requirements.
