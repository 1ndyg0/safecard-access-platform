# SafeCard R1 implementation status

Assessment baseline: 8 September 2026. This register maps the supplied vision, backlog, journey, personas, implementation prompts, and wireframe/design-system references to the repository. “Implemented” means code exists and passes the repository gates; it does not mean PRC, privacy, security, or production approval has been obtained.

## Implemented

| Capability | Evidence in this build |
|---|---|
| Mobile-first bilingual public education | Refined responsive landing, Filipino/English preference, provisional benefits guide, process boundaries, help and privacy routes |
| Referral attribution | Sponsor-owned links, stable slugs, `/r/[slug]` handoff, validation, visits/starts aggregates, revocation and audit backend |
| Recipient autonomy | Learn, comprehension check, private accept/ask/decline, consent before profile, decline without a case or PII |
| Safe synthetic default | Public mode defaults to synthetic; reserved demo values are locked; live PII APIs are blocked until launch gates are explicitly enabled |
| Consent and intake backend | Version-bound consent, approved-field profile validation, idempotent submission, separate state machines and audit events |
| Shared-device protection | No PII in local/session storage, explicit clear-device action, HTTP-only member cookie with 30-minute expiry |
| Member access without SMS OTP | Reference plus registered mobile match, rate limiting, signed cookie, protected status and PRC-confirmed electronic card endpoints |
| Electronic SafeCard boundary | Card and locally generated QR appear only after `active_confirmed` plus recorded PRC membership evidence |
| Ambassador workspace | Email/password login, owned referral creation, downloadable local QR, privacy-safe aggregate progress |
| Staff access and RBAC | Email/password login, role-scoped overview, queue filters, protected case detail, minimal profile and payment views |
| Payment boundary | Application and payment remain separate; typed manual GCash/bank configuration is centralized and gated; no direct payment processor or membership activation from payment |
| PRC handoff/export backend | Eligibility controls, immutable batches/items, checksum protection, acknowledgement/correction states, role and AAL2 gate |
| Content governance backend | Versioning, review/approval/publish/rollback, material-change handling and consent expiry |
| Operational foundations | RLS/grants, append-only audit controls, durable jobs, support cases, in-app notifications, rate limiting and privacy-safe metrics |

## Partially implemented

| Capability | What exists | Remaining work |
|---|---|---|
| Filipino localization | Core landing copy and journey framing are bilingual | Complete professional translation and language QA for every form, validation message, admin page, and policy text |
| Draft resume | Server model and case continuity exist; current browser session retains the case ID | Add an approved re-identification/recovery method for a different device without adding SMS cost or weakening privacy |
| Admin review operations | Queue, exact-reference search, independent filters, sorting, pagination, case detail, correction request, payment verification and evidence replacement controls exist | Complete role-by-role UAT, audit-history presentation, bulk selection, and user/role management |
| Export experience | Secure batch, download and acknowledgement APIs exist | UI intentionally stops at the approval boundary; add schema preview, dual confirmation, approved recipients, and download controls after PRC transfer procedure approval |
| Notifications | Consent-aware in-app event backend exists | Add inbox UI; external SMS/email/push remains parked |
| Offline use | Static public routes and the loaded card can remain in browser cache | A formally tested service-worker/offline card package is not implemented |
| Automated quality | Unit tests, TypeScript, ESLint, production build gate, Playwright/axe smoke suite, browser matrix, and CI workflow exist | Add authenticated synthetic API/E2E fixtures, full upload abuse/security regression, performance budgets, and operational restore drill |

## Newly covered requirements (2026-09-08)

| Requirement | Status | Evidence / remaining gate |
|---|---|---|
| Clickable Filipino/English benefit storyboard with keyboard semantics, scenarios, disclaimers, Hotline 143, and analytics hooks | Implemented and verified | `src/components/BenefitStoryboard.tsx`, `src/lib/benefit-storyboards.ts`, Playwright smoke; professional content approval remains required |
| Manual GCash and bank routes with exact approved values and individual copy actions | Implemented but awaiting approval | `src/lib/payment/config.ts`, `ManualPaymentPanel`; owner/PRC verification and private QR upload remain required |
| Private receipt evidence validation, checksum, non-enumerable path, metadata, replacement state, signed review URL | Partial | `00010_payment_proof_storage_and_review.sql`, evidence routes; remote migration/bucket validation and retention approval remain blocked |
| Staff payment verification cannot activate membership | Implemented and verified | `verifyPayment` updates payment only; membership requires separate PRC confirmation path |
| Admin aggregate dashboard, queue search/filter/sort/pagination, correction and evidence review controls | Partial | `src/components/admin/*`, admin API routes; authenticated UAT and audit history display remain |
| Playwright browser/accessibility smoke and CI required scripts | Implemented and verified | `playwright.config.ts`, `tests/e2e/smoke.spec.ts`, `.github/workflows/ci.yml`; browser downloads and live backend fixtures are environment gates |
| Source artifact access and document traceability | Implemented and verified | `docs/product/source-artifact-access.md` and seven replacement records; original Claude artifacts remain inaccessible |

## Parked by cost or external dependency

- SMS OTP and SMS notifications. Member login does not ask for an OTP.
- Email delivery and push notifications.
- Direct GCash/payment-provider API, webhook settlement and provider-hosted QR.
- Direct PRC API, membership lookup, eligibility decision and claims processing.
- Production export transfer until PRC approves the schema, named recipients, channel, retention and acknowledgement procedure.
- Advanced analytics, native mobile application and non-pilot scale features.

## Missing approvals and launch evidence

The following are blockers to live personal data and payment—not coding omissions that can be inferred or fabricated:

1. Written PRC approval of exact benefits, limits, exclusions, eligibility, fee, activation, claim instructions, branding, application fields and bilingual source text.
2. Signed data-sharing/privacy basis, final privacy notice, retention/deletion schedule, data-subject request process and breach procedure.
3. Approved payment routes, official account details, reconciliation owner, refund/reversal process and payer/recipient responsibility rules.
4. Approved PRC export schema, secure transfer channel, recipient list, acknowledgement SLA and correction procedure.
5. Named operational owners for support, privacy, security, finance, campaign stop conditions and incident escalation.
6. Staff/ambassador provisioning, authenticator enrollment for export-capable roles, training and least-privilege review.
7. Independent security review, accessibility audit, bilingual content review, representative UAT, backup/restore evidence, monitoring and production readiness sign-off.

`LAUNCH_GATES_COMPLETE=true` must be set only after those approvals are documented. `ENABLE_OFFICIAL_PAYMENT_HANDOFF=true` additionally requires valid `PRC_PAYMENT_ROUTES_JSON`. The application displays its active mode so synthetic testing cannot be mistaken for live enrollment.
