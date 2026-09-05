-- Ensure the authenticated browser role can use the RLS-protected sponsor table.
grant usage on schema public to authenticated;
grant select, insert on table public.sponsorships to authenticated;
