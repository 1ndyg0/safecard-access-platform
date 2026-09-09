# Expanded MVP and Main Features — replacement record

Source: https://claude.ai/code/artifact/3f666821-cb7b-405c-9b3a-a4bd939ad556

Access limitation: source artifact was not readable in this environment. This is a requirements replacement, not a claim that the artifact was edited.

## Extracted requirements

- Consent precedes profile collection; application, payment, PRC handoff, and membership activation remain separate state machines.
- Mobile-first bilingual information experience with benefit storyboards, exclusions, Hotline 143, and illustrative disclaimers.
- Manual GCash/bank transfer instructions for PHP 1,200/year; payment is external and proof is reconciled by authorized staff.
- Private proof storage, validation, checksum, signed review URLs, replacement history, audit events, and no membership activation from payment.
- Staff email/password admin workspace with least-privilege queue, case review, correction/reupload decisions, audit visibility, and aggregate analytics.

## Approved implementation changes

- Added `BenefitStoryboard`, centralized payment configuration, proof upload/review routes, private Storage migration, admin queue filters, and implementation-status coverage.
- Kept official payment handoff gated by launch and owner-verification approvals.

## Change history

- 2026-09-08: Created replacement record and linked implementation evidence.
