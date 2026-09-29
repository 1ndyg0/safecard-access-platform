-- Reserved migration version. The previous version embedded shared staff
-- credentials and directly modified Supabase Auth tables. It must not be run
-- on a new environment. Provision named staff through Supabase Auth invites,
-- then grant only the required campaign roles through an audited admin flow.
-- If this version was already applied remotely, inspect the affected users
-- and rotate or revoke access through the Auth dashboard before launch.
select 1;
