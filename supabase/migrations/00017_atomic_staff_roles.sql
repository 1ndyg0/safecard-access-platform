-- SafeCard Access Platform
-- Migration 00017: transactional, scope-aware staff role changes

create or replace function public.assign_staff_role_atomic(
  p_actor_id uuid,
  p_user_id uuid,
  p_role public.staff_role,
  p_organization_id uuid,
  p_campaign_id uuid,
  p_reason text
)
returns table(role_assignment_id uuid, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_organization_id uuid;
  v_assignment_id uuid;
  v_actor_is_admin boolean;
  v_actor_is_privacy_admin boolean;
begin
  if (p_organization_id is null) = (p_campaign_id is null) then
    raise exception 'Exactly one role scope is required';
  end if;
  if p_reason is null or length(pg_catalog.btrim(p_reason)) < 10 then
    raise exception 'A clear audit reason is required';
  end if;

  if p_campaign_id is not null then
    select organization_id into v_organization_id
    from public.pilot_campaigns where id = p_campaign_id;
    if not found then raise exception 'Campaign not found'; end if;
  else
    select id into v_organization_id
    from public.organizations where id = p_organization_id;
    if not found then raise exception 'Organization not found'; end if;
  end if;

  select exists (
    select 1 from public.role_assignments ra
    where ra.user_id = p_actor_id
      and ra.role in ('privacy_admin_owner', 'school_admin')
      and ra.is_active and ra.revoked_at is null
      and (
        (p_campaign_id is not null and (
          ra.campaign_id = p_campaign_id
          or (ra.campaign_id is null and ra.organization_id = v_organization_id)
        ))
        or (p_campaign_id is null and ra.campaign_id is null
          and ra.organization_id = v_organization_id)
      )
  ), exists (
    select 1 from public.role_assignments ra
    where ra.user_id = p_actor_id
      and ra.role = 'privacy_admin_owner'
      and ra.is_active and ra.revoked_at is null
      and (
        (p_campaign_id is not null and (
          ra.campaign_id = p_campaign_id
          or (ra.campaign_id is null and ra.organization_id = v_organization_id)
        ))
        or (p_campaign_id is null and ra.campaign_id is null
          and ra.organization_id = v_organization_id)
      )
  ) into v_actor_is_admin, v_actor_is_privacy_admin;

  if not v_actor_is_admin then raise exception 'Administrator role required for this scope'; end if;
  if p_role in ('privacy_admin_owner', 'school_admin', 'prc_liaison')
     and not v_actor_is_privacy_admin then
    raise exception 'Privacy administrator role required for privileged role changes';
  end if;
  if not exists (select 1 from public.users where id = p_user_id and is_active) then
    raise exception 'Target staff user is not active';
  end if;

  select id into v_assignment_id
  from public.role_assignments
  where user_id = p_user_id and role = p_role
    and is_active and revoked_at is null
    and campaign_id is not distinct from p_campaign_id
    and organization_id is not distinct from p_organization_id
  for update;
  if found then
    return query select v_assignment_id, 'already_assigned'::text;
    return;
  end if;

  v_assignment_id := extensions.uuid_generate_v4();
  insert into public.role_assignments (
    id, user_id, role, organization_id, campaign_id, granted_by, reason
  ) values (
    v_assignment_id, p_user_id, p_role, p_organization_id, p_campaign_id,
    p_actor_id, pg_catalog.btrim(p_reason)
  );

  insert into public.audit_events (
    event_type, actor_id, actor_type, target_type, target_id,
    campaign_id, action, details
  ) values (
    'role_change', p_actor_id, 'user', 'role_assignment', v_assignment_id,
    p_campaign_id, 'Assigned staff role ' || p_role::text,
    pg_catalog.jsonb_build_object(
      'role', p_role,
      'target_user_id', p_user_id,
      'campaign_id', p_campaign_id,
      'organization_id', p_organization_id,
      'reason', pg_catalog.btrim(p_reason)
    )
  );

  return query select v_assignment_id, 'assigned'::text;
end;
$$;

create or replace function public.revoke_staff_role_atomic(
  p_actor_id uuid,
  p_role_assignment_id uuid,
  p_reason text
)
returns table(role_assignment_id uuid, status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_assignment public.role_assignments%rowtype;
  v_organization_id uuid;
  v_actor_is_admin boolean;
  v_actor_is_privacy_admin boolean;
  v_owner_count integer;
begin
  if p_reason is null or length(pg_catalog.btrim(p_reason)) < 10 then
    raise exception 'A clear audit reason is required';
  end if;

  select * into v_assignment
  from public.role_assignments
  where id = p_role_assignment_id and is_active and revoked_at is null
  for update;
  if not found then raise exception 'Active role assignment not found'; end if;
  if v_assignment.user_id = p_actor_id then
    raise exception 'Administrators cannot revoke their own active role';
  end if;

  if v_assignment.campaign_id is not null then
    select organization_id into v_organization_id
    from public.pilot_campaigns where id = v_assignment.campaign_id;
  else
    v_organization_id := v_assignment.organization_id;
  end if;

  select exists (
    select 1 from public.role_assignments ra
    where ra.user_id = p_actor_id
      and ra.role in ('privacy_admin_owner', 'school_admin')
      and ra.is_active and ra.revoked_at is null
      and (
        (v_assignment.campaign_id is not null and (
          ra.campaign_id = v_assignment.campaign_id
          or (ra.campaign_id is null and ra.organization_id = v_organization_id)
        ))
        or (v_assignment.campaign_id is null and ra.campaign_id is null
          and ra.organization_id = v_organization_id)
      )
  ), exists (
    select 1 from public.role_assignments ra
    where ra.user_id = p_actor_id
      and ra.role = 'privacy_admin_owner'
      and ra.is_active and ra.revoked_at is null
      and (
        (v_assignment.campaign_id is not null and (
          ra.campaign_id = v_assignment.campaign_id
          or (ra.campaign_id is null and ra.organization_id = v_organization_id)
        ))
        or (v_assignment.campaign_id is null and ra.campaign_id is null
          and ra.organization_id = v_organization_id)
      )
  ) into v_actor_is_admin, v_actor_is_privacy_admin;

  if not v_actor_is_admin then raise exception 'Administrator role required for this scope'; end if;
  if v_assignment.role in ('privacy_admin_owner', 'school_admin', 'prc_liaison')
     and not v_actor_is_privacy_admin then
    raise exception 'Privacy administrator role required for privileged role changes';
  end if;

  if v_assignment.role = 'privacy_admin_owner' then
    if v_assignment.campaign_id is not null then
      select count(*)::integer into v_owner_count
      from public.role_assignments ra
      where ra.role = 'privacy_admin_owner' and ra.is_active and ra.revoked_at is null
        and (
          ra.campaign_id = v_assignment.campaign_id
          or (ra.campaign_id is null and ra.organization_id = v_organization_id)
        );
    else
      select count(*)::integer into v_owner_count
      from public.role_assignments ra
      where ra.role = 'privacy_admin_owner' and ra.is_active and ra.revoked_at is null
        and ra.campaign_id is null and ra.organization_id = v_organization_id;
    end if;
    if v_owner_count <= 1 then raise exception 'The last privacy administrator cannot be revoked'; end if;
  end if;

  update public.role_assignments
  set is_active = false,
      revoked_at = pg_catalog.now(),
      revoked_by = p_actor_id,
      reason = pg_catalog.btrim(p_reason)
  where id = p_role_assignment_id;

  insert into public.audit_events (
    event_type, actor_id, actor_type, target_type, target_id,
    campaign_id, action, details, severity
  ) values (
    'role_change', p_actor_id, 'user', 'role_assignment', p_role_assignment_id,
    v_assignment.campaign_id, 'Revoked staff role ' || v_assignment.role::text,
    pg_catalog.jsonb_build_object(
      'role', v_assignment.role,
      'target_user_id', v_assignment.user_id,
      'campaign_id', v_assignment.campaign_id,
      'organization_id', v_assignment.organization_id,
      'reason', pg_catalog.btrim(p_reason)
    ),
    'warning'
  );

  return query select p_role_assignment_id, 'revoked'::text;
end;
$$;

create or replace function public.provision_invited_staff_atomic(
  p_actor_id uuid,
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_campaign_id uuid,
  p_role public.staff_role,
  p_reason text
)
returns table(user_id uuid, role_assignment_id uuid)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role_assignment_id uuid;
begin
  if p_email is null or p_full_name is null then
    raise exception 'Invited user identity is required';
  end if;

  insert into public.users (id, email, full_name)
  values (p_user_id, pg_catalog.btrim(p_email), pg_catalog.btrim(p_full_name));

  select assigned.role_assignment_id into v_role_assignment_id
  from public.assign_staff_role_atomic(
    p_actor_id,
    p_user_id,
    p_role,
    null,
    p_campaign_id,
    p_reason
  ) assigned;

  insert into public.audit_events (
    event_type, actor_id, actor_type, target_type, target_id,
    campaign_id, action, details
  ) values (
    'user_created', p_actor_id, 'user', 'user', p_user_id,
    p_campaign_id, 'Invited staff user',
    pg_catalog.jsonb_build_object(
      'campaign_id', p_campaign_id,
      'initial_role', p_role,
      'role_assignment_id', v_role_assignment_id
    )
  );

  return query select p_user_id, v_role_assignment_id;
end;
$$;

revoke all on function public.assign_staff_role_atomic(uuid, uuid, public.staff_role, uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.revoke_staff_role_atomic(uuid, uuid, text)
  from public, anon, authenticated;
revoke all on function public.provision_invited_staff_atomic(uuid, uuid, text, text, uuid, public.staff_role, text)
  from public, anon, authenticated;
grant execute on function public.assign_staff_role_atomic(uuid, uuid, public.staff_role, uuid, uuid, text)
  to service_role;
grant execute on function public.revoke_staff_role_atomic(uuid, uuid, text)
  to service_role;
grant execute on function public.provision_invited_staff_atomic(uuid, uuid, text, text, uuid, public.staff_role, text)
  to service_role;
