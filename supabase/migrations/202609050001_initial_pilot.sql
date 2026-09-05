-- SafeCard MVP schema. Synthetic data only until governance and privacy gates pass.
create extension if not exists pgcrypto;

create type public.sponsorship_status as enum ('invited', 'informed', 'consented', 'submitted', 'completed');

create table public.sponsorships (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  invite_code text not null unique check (char_length(invite_code) between 10 and 64),
  sponsor_alias text not null check (char_length(sponsor_alias) between 1 and 40),
  status public.sponsorship_status not null default 'invited',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sponsorships enable row level security;

create policy "Sponsors manage only their own invitations"
on public.sponsorships for all
to authenticated
using (owner_id = auth.uid())
with check (owner_id = auth.uid());

create or replace function public.get_invitation(p_invite_code text)
returns table (id uuid, invite_code text, sponsor_alias text, status public.sponsorship_status, created_at timestamptz, updated_at timestamptz)
language sql security definer set search_path = ''
as $$
  select s.id, s.invite_code, s.sponsor_alias, s.status, s.created_at, s.updated_at
  from public.sponsorships s
  where s.invite_code = upper(p_invite_code)
  limit 1;
$$;

create or replace function public.advance_invitation(p_invite_code text, p_status public.sponsorship_status)
returns void
language plpgsql security definer set search_path = ''
as $$
declare current_status public.sponsorship_status;
begin
  select status into current_status from public.sponsorships where invite_code = upper(p_invite_code) for update;
  if current_status is null then raise exception 'Invitation not found'; end if;
  if current_status = 'completed' then raise exception 'Completed cases are immutable'; end if;
  if p_status = 'completed' then
    raise exception 'Only an authorized PRC reconciliation process may complete a case';
  end if;
  if array_position(array['invited','informed','consented','submitted']::public.sponsorship_status[], p_status)
     > array_position(array['invited','informed','consented','submitted']::public.sponsorship_status[], current_status) + 1
     or array_position(array['invited','informed','consented','submitted']::public.sponsorship_status[], p_status)
     < array_position(array['invited','informed','consented','submitted']::public.sponsorship_status[], current_status)
  then raise exception 'Invalid status transition'; end if;
  update public.sponsorships set status = p_status, updated_at = now() where invite_code = upper(p_invite_code);
end;
$$;

revoke all on function public.get_invitation(text) from public;
revoke all on function public.advance_invitation(text, public.sponsorship_status) from public;
grant execute on function public.get_invitation(text) to anon, authenticated;
grant execute on function public.advance_invitation(text, public.sponsorship_status) to anon, authenticated;
