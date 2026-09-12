# SafeCard requirements traceability

This is the implementation-facing matrix for the release slice. Test IDs are stable names in `tests/e2e/smoke.spec.ts` and the `*.test.ts` unit files. Live-authenticated API tests remain a manual gate until isolated Supabase fixtures are provisioned.

| Requirement / acceptance criterion | Implementation | Automated coverage | Result / remaining gate |
|---|---|---|---|
| Benefit headers are keyboard-operable, one mobile panel at a time, bilingual, and disclose illustrative boundaries | `BenefitStoryboard.tsx`, `benefit-storyboards.ts` | `benefit storyboard supports keyboard expansion and closure`; `public pages have no serious or critical axe violations` | Passed across Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari |
| Payment values render from one typed server-controlled source | `payment/config.ts`, `ManualPaymentPanel.tsx` | `payment/config.test.ts` (4 tests) | Passed exact value assertions; owner/PRC verification still required |
| Receipts accept only real JPEG/PNG/WebP signatures, max 10 MB, with checksum and case-scoped path | `payment/evidence-validation.ts`, `payment/evidence.ts`, migration 00010 | `payment/evidence.test.ts` (4 tests) | Passed pure validation tests; remote migration and storage policy verification blocked by remote history/password |
| Payment verification cannot activate membership | `payment/index.ts`, `/api/payment/verify` | state-machine tests + API contract review | Passed code review; authenticated integration fixture remains |
| Admin login is email/password, not SMS OTP | `PortalLogin.tsx`, `/admin/login` | `admin login is a dedicated email/password surface` | Passed across all five browsers |
| Public routes have mobile-safe layout and no horizontal overflow | tokenized responsive CSS | `landing page is reachable without horizontal overflow` | Passed across all five browsers |
| Serious/critical accessibility violations fail the gate | axe-core Playwright integration | `public pages have no serious or critical axe violations` | 5 browser projects × 4 tests passed (20/20) |

## Required order for future work

1. Update backlog acceptance criteria.
2. Add or update a reproducing test.
3. Implement the change.
4. Run lint, typecheck, unit, build, Playwright smoke, and affected regression tests.
5. Run the full browser suite before release.
6. Update this matrix and `docs/implementation-status.md`.
7. Commit only after gates pass.
