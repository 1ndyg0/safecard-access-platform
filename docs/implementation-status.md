# SafeCard R1 implementation status

Assessment date: 12 September 2026. “Implemented” means the capability exists in this candidate. Production activation still requires exact-commit verification and the operational steps in the [controlled pilot runbook](controlled-production-pilot.md).

## Implemented in the candidate

| Capability | Current behavior |
|---|---|
| Strict production mode | Production requires live mode, completed launch gates, payment handoff, validated secrets, and pinned campaign/content identifiers. Invalid production configuration returns an explicit unavailable response and never falls back to synthetic data. |
| Consent-first application | The decision and comprehension flow precedes consent and profile collection. A case ID resumes the server-backed draft in the same browser without storing PII in browser storage. |
| Application and payment separation | Submission has a visible payment step. The annual PHP 1,200 payment stays pending until the approving administrator verifies the proof as part of the approval. |
| Manual official payment routes | The private GCash QR and confirmed bank routes are exposed only for the pinned active campaign. BPI is exactly `002963000782B`. |
| Receipt evidence | JPEG, PNG, WebP, and constrained PDF evidence up to 10 MiB is signature-validated server-side. Images are decoded and re-encoded to remove metadata; private objects use non-enumerable paths and short-lived reviewer URLs. Replacements preserve immutable versions. |
| Payment declaration | Payer-reported payment date, exact amount, transaction reference, and declaration are atomically recorded with idempotency checks. |
| Staff authentication and roles | Supabase Auth, inactive-user checks, organization/campaign-scoped roles, first-administrator bootstrap, and login/logout audit events are present. There is no in-app staff or role management; roles are provisioned by the bootstrap script or SQL. |
| Staff review | Overview with three counts (awaiting review, approved, rejected). Applications list of complete applications only (search by name, mobile or reference; status control; dates under More). A slide-over shows the applicant and the proof of payment; the administrator approves (which also verifies the payment) or rejects with a reason the applicant reads. The database view `admin_applications_view` is the single definition of a complete application. |
| Member experience | A signed 30-minute member session exposes status and the next action. The approved electronic card and local QR appear once an administrator has approved the application and verified the payment proof. |
| Content governance | Versioned bilingual content can be created, approved, published, rolled back, and pinned for the pilot. Material changes can expire existing consent. |
| Removed | Ambassador, sponsor and referral links; PRC export, handoff and acceptance; the `prc_liaison` and `finance_export` roles; the separate payment-verification screen; the MFA enrolment page. Migration `00022` drops their tables and functions. |
| Removed (admin console) | Staff & roles, PRC export and Security pages; the analytics dashboard (conversion, review aging, throughput, suppression tables) and its SQL; the standalone case page with workflow states, payment intents/evidence and audit history; the resubmission/correction and replacement-proof requests from the administrator. Migration `00023` drops the unused views and functions and adds `admin_applications_view`, `rejection_reason`, `reviewed_by` and `reviewed_at`. |
| Seasonal campaign (Christmas 2026) | A gift band, `/gift`, `/gift/card` (client-only card maker), a gift welcome on `/apply?gift=1` and light decoration, all hidden until a head script marks the page in season (15 Nov 2026 to 1 Jan 2027, Philippine time). `NEXT_PUBLIC_SEASONAL_CAMPAIGN=off` stops it everywhere. It adds no route, table or stored data, and never decorates the payment step. Removal steps are in `docs/christmas-mode.md`. |
| Privacy and operational controls | RLS/grants, append-only audit protection, rate limiting, minimized DTOs, shared-device clearing, stop conditions, and privacy-safe aggregate metrics are implemented. |

## Intentionally parked

- SMS, email, and push delivery; the member portal is the status channel.
- Direct GCash/payment-provider APIs and webhook settlement.
- Direct PRC membership or claims APIs.
- Cross-device draft recovery without an approved re-identification method.

## External activation work

Production already has the canonical schema through migration `00020`, the private official QR, and safe-mode deployment. Before live intake, apply and verify migration `00021`, run the reviewed bootstrap with a named administrator, review the temporary governed bilingual consent/privacy content and benefit storyboard, provision least-privilege staff roles, activate the pinned campaign, set the strict live environment, and complete one authorized end-to-end smoke test.

The MVP backup gate is waived by the owner and recorded in GitHub issue [#7](https://github.com/1ndyg0/safecard-access-platform/issues/7). Backup implementation remains a mandatory R2 and pre-destructive-migration stop condition. Independent security, accessibility, bilingual content, and operational UAT findings must be recorded rather than inferred from automated tests.
