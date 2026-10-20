# Administrator console

The administrator only works with **complete applications**: details submitted
and proof of payment uploaded. Applications still in progress never reach the
console. The only decisions are **approve** (which also verifies the payment)
and **reject** (with a reason the applicant reads).

## Screens

| Route | What it does |
| --- | --- |
| `/admin` | Three counts (awaiting review, approved, rejected), the total received, and a link into the list. |
| `/admin/applications` | One search box (name, mobile number or application reference), a status control (Awaiting review / Approved / Rejected / All) and, under **More**, a received-date range and "Oldest first". Columns: Applicant, Application ref, Mobile, Received, Payment proof, Status, and a **Review** button. `/admin/submissions` redirects here. |
| Review slide-over | Opens from **Review**. Shows the applicant (name, date of birth, sex, mobile, email, address), the reference, the submitted date and the proof of payment with amount, payment date, reference number and route. **Approve** asks for a confirmation. **Reject** needs a reason of 10 to 500 characters and a confirmation. The reason is shown afterwards in the panel and to the applicant on their status page. |

What each role sees follows `src/lib/admin/field-policy.ts`: a role that may not
read a field neither receives it nor can search on it.

## What "complete" means (one definition, in SQL)

`public.admin_applications_view` returns an application when the case is active,
its application state is `submitted` or `resubmitted`, and its payment has moved
past the applicant still paying (anything except `not_started`,
`official_handoff_opened`, `payer_marked_paid`). Its `status` is `approved` or
`rejected` from the review decision, otherwise `awaiting_review`. The list, the
detail, the reject route and the dashboard counts all read this view, so no route
filters for completeness itself. The applicant can cancel an unfinished
application through `POST /api/intake/cancel` (added with the public apply changes, not part of this console).

## API

| Route | Purpose |
| --- | --- |
| `GET /api/admin/overview` | Counts from `admin_application_counts()`; campaigns; the signed-in user. |
| `GET /api/admin/cases` | The list (`status`, `search`, `from`, `to`, `sort=newest|oldest`, `page`, `limit`). |
| `GET /api/admin/cases/[id]` | One complete application for the slide-over; logs which fields were opened. |
| `POST /api/admin/cases/[id]/approve-with-payment` | Approve and verify the payment proof the administrator looked at, in one action. |
| `POST /api/admin/cases/[id]/reject` | Reject with a reason. Refused with 409 if the application is no longer awaiting review. |
| `GET /api/payment/evidence/[id]` | Short-lived signed URL for the proof of payment; every view is audited. |

## Migration `00023_simplify_admin_review.sql`

Forward-only and re-runnable. It adds `recipient_cases.rejection_reason`,
`reviewed_by`, `reviewed_at` (kept in step with the append-only
`application_review_decisions` ledger by a trigger, and backfilled from it),
`admin_applications_view`, `admin_application_counts()` and a partial queue
index. It stops new "request resubmission" decisions (a `NOT VALID` check, so
history is not rewritten) and drops what the console no longer uses:
`admin_case_queue_view`, `application_review_context`, `admin_dashboard_counts`,
`admin_campaign_analytics`, `admin_safe_count`, `admin_safe_rate`,
`admin_suppression_threshold`, `assign_staff_role_atomic`,
`revoke_staff_role_atomic`, `provision_invited_staff_atomic`,
`request_payment_evidence_reupload_atomic` and `users.mfa_enabled`.

It never touches `audit_events`, `application_submissions`,
`payment_evidence_versions`, `membership_status_events` or
`application_review_decisions` rows, and never edits an immutability trigger.
Enum labels are kept (PostgreSQL cannot drop them in place and history may use
them), as in `00022`.

### Applying it (the owner runs this; nothing here runs against production)

1. Back up: Supabase dashboard, Database, Backups (or `pg_dump`).
2. Apply earlier migrations first, in order: `00021`, `00022` (from the
   ambassador/PRC removal PR), then `00023`. Try all three on a Supabase branch
   database or a restored copy first.
3. Apply with `supabase db push` (linked project) or paste each file into the
   SQL editor, one at a time.
4. Check:
   ```sql
   select status, count(*) from public.admin_applications_view group by 1;
   select public.admin_application_counts('<campaign id>');
   select count(*) from public.recipient_cases where rejection_reason is not null;
   ```
5. Deploy the application only after the migration is applied: the new
   screens read `admin_applications_view`. The previous release reads
   `admin_case_queue_view`, which `00023` drops, so run the migration and the
   deploy back to back.
6. Rollback: restore the backup. `00023` is not reversible in place.

## Not removed on purpose

- Member-side correction (`/member/correction`, `submit_member_correction_atomic`):
  cases already in `correction_needed` can still use it. No new correction
  requests can be created by the administrator.
- `GET /api/admin/analytics/storyboard` and `storyboard_analytics()`: public
  benefit-storyboard analytics, not the console analytics.
- `/api/admin/campaigns`: unused by the console, left for the pilot bootstrap.
- `role_assignments`, `has_role`, `is_staff`: authentication and permissions use them.
