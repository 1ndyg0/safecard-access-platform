# Staff access and migration safety

The former pilot account script contained a shared password and direct writes to
Supabase Auth tables. It has been retired. Do not run a historical copy or use
any password recorded in Git history.

1. Identify the production Supabase project in the dashboard and verify its
   migration history against this checkout. The `00021` version differs from
   the older pilot branch; resolve that divergence explicitly before applying
   new migrations. Never rename an already applied migration to conceal it.
2. Confirm a restorable database backup and record its timestamp. Do not apply
   `00022_production_mvp_draft_payment.sql` until the backup and version history
   are reviewed.
3. In Supabase Auth, inspect any accounts created by the retired script. Revoke
   sessions and reset or remove those accounts as appropriate. Invite each staff
   member individually. Require their own password and MFA according to the
   organization's access policy.
4. Assign only the campaign roles each person needs. Confirm the matching
   `public.users` entry is active and role assignments have the right campaign
   and organization. Test staff sign-in with a non-owner account.
5. Record the migration and access changes in the release log, including who
   approved them. Production migration, access, and credential changes require
   the project owner's confirmation immediately before execution.

The retired script remains represented by a harmless `00021` placeholder in
fresh environments. That source change does not undo any remote execution of
the old script or remove its contents from Git history.
