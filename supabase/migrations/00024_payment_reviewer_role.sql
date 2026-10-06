-- Forward-only addition. Does not grant, revoke or copy any staff assignment.
-- Commit this enum extension before any record uses the new value.
-- Payment review is distinct from finance_export (PRC export).
alter type public.staff_role add value if not exists 'payment_reviewer';
-- No authenticated table/Storage grants are broadened. The reviewer uses the
-- existing audited, campaign-scoped server API and service-role-only RPCs.
