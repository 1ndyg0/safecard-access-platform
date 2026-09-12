# SafeCard R1 implementation status

Assessment date: 12 September 2026. “Implemented” means the capability exists in this candidate. Production activation still requires exact-commit verification and the operational steps in the [controlled pilot runbook](controlled-production-pilot.md).

## Implemented in the candidate

| Capability | Current behavior |
|---|---|
| Strict production mode | Production requires live mode, completed launch gates, payment handoff, validated secrets, and pinned campaign/content identifiers. Invalid production configuration returns an explicit unavailable response and never falls back to synthetic data. |
| Consent-first application | The decision and comprehension flow precedes consent and profile collection. A case ID resumes the server-backed draft in the same browser without storing PII in browser storage. |
| Application and payment separation | Submission has a visible payment step. The annual PHP 1,200 payment stays pending until an authorized reviewer verifies it. Payment never activates membership. |
| Manual official payment routes | The private GCash QR and confirmed bank routes are exposed only for the pinned active campaign. BPI is exactly `002963000782B`. |
| Receipt evidence | JPEG, PNG, WebP, and constrained PDF evidence up to 10 MiB is signature-validated server-side. Images are decoded and re-encoded to remove metadata; private objects use non-enumerable paths and short-lived reviewer URLs. Replacements preserve immutable versions. |
| Payment declaration | Payer-reported payment date, exact amount, transaction reference, and declaration are atomically recorded with idempotency checks. |
| Staff authentication and roles | Supabase Auth, inactive-user checks, organization/campaign-scoped roles, first-administrator invitation bootstrap, user management, and login/logout audit events are present. |
| Staff review | Dashboard, queue filters, pagination, case detail, correction flow, payment evidence preview, verification, conflict protection, and audit history are present. Search only queries fields allowed by the reviewer’s effective role. |
| Member experience | A signed 30-minute member session exposes status and the next action. The electronic card and local QR appear only after recorded PRC acceptance. |
| Content governance | Versioned bilingual content can be created, approved, published, rolled back, and pinned for the pilot. Material changes can expire existing consent. |
| PRC handoff | MFA-gated immutable exports, checksums, acknowledgements, corrections, and PRC-only activation are implemented. |
| Privacy and operational controls | RLS/grants, append-only audit protection, rate limiting, minimized DTOs, shared-device clearing, stop conditions, and privacy-safe aggregate metrics are implemented. |

## Intentionally parked

- SMS, email, and push delivery; the member portal is the status channel.
- Direct GCash/payment-provider APIs and webhook settlement.
- Direct PRC membership or claims APIs.
- Production export transfer until PRC approves the schema, recipients, secure channel, retention, and acknowledgement procedure.
- Cross-device draft recovery without an approved re-identification method.

## External activation work

Production already has the canonical schema through migration `00020`, the private official QR, and safe-mode deployment. Before live intake, apply and verify migration `00021`, run the reviewed bootstrap with a named administrator, review the temporary governed bilingual consent/privacy content and benefit storyboard, provision least-privilege staff roles, activate the pinned campaign, set the strict live environment, and complete one authorized end-to-end smoke test.

The MVP backup gate is waived by the owner and recorded in GitHub issue [#7](https://github.com/1ndyg0/safecard-access-platform/issues/7). Backup implementation remains a mandatory R2 and pre-destructive-migration stop condition. Independent security, accessibility, bilingual content, and operational UAT findings must be recorded rather than inferred from automated tests.
