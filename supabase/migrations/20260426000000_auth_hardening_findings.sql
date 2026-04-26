-- Auth hardening pass for the multi-portal RBAC cutover.
-- Keeps members as the canonical identity surface and removes legacy role checks
-- from the core profile/member request tables.

-- Remove legacy-role compatibility from the old helper while keeping a narrow
-- canonical bridge for older policies that still call has_platform_role().
create or replace function public.has_platform_role(role_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.rbac_user_platform_roles as user_roles
    join public.rbac_platform_roles as roles
      on roles.id = user_roles.role_id
    where user_roles.user_id = auth.uid()
      and user_roles.revoked_at is null
      and (
        roles.code = role_code
        or (
          roles.code = 'super_admin'
          and role_code = any (array['super_admin', 'admin', 'content_admin'])
        )
      )
  );
$$;

grant execute on function public.has_platform_role(text) to anon, authenticated;

-- Production posture: MFA enforcement is on unless explicitly disabled later by a super admin.
insert into public.security_settings (id, admin_totp_enforced)
values (true, true)
on conflict (id) do update
set
  admin_totp_enforced = true,
  updated_at = timezone('utc', now());

-- Only super admins may disable TOTP enforcement. Other security admins may
-- keep or restore enforcement, but not weaken it.
drop policy if exists "security settings writable by security admins" on public.security_settings;
create policy "security settings writable by security admins"
on public.security_settings
for update
to authenticated
using (public.has_permission('admin.security.write'))
with check (
  public.has_permission('admin.security.write')
  and (
    admin_totp_enforced = true
    or public.current_admin_role() = 'super_admin'
  )
);

-- members: replace legacy has_platform_role checks with canonical permissions.
drop policy if exists "members owner or operator select" on public.members;
drop policy if exists "members operator insert" on public.members;
drop policy if exists "members operator update" on public.members;

create policy "members owner or membership admin select"
on public.members
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.has_permission('admin.membership.manage')
);

create policy "members membership admin insert"
on public.members
for insert
to authenticated
with check (public.has_permission('admin.membership.manage'));

create policy "members membership admin update"
on public.members
for update
to authenticated
using (public.has_permission('admin.membership.manage'))
with check (public.has_permission('admin.membership.manage'));

-- profile_update_requests: keep member self-service, but move operator access
-- to canonical membership permissions.
drop policy if exists "profile update request own read" on public.profile_update_requests;
drop policy if exists "profile update request own insert" on public.profile_update_requests;
drop policy if exists "profile update request operator update" on public.profile_update_requests;

create policy "profile update request own or membership admin read"
on public.profile_update_requests
for select
to authenticated
using (
  exists (
    select 1
    from public.members
    where members.id = profile_update_requests.member_id
      and members.user_id = (select auth.uid())
  )
  or public.has_permission('admin.membership.manage')
);

create policy "profile update request own insert"
on public.profile_update_requests
for insert
to authenticated
with check (
  exists (
    select 1
    from public.members
    where members.id = profile_update_requests.member_id
      and members.user_id = (select auth.uid())
  )
);

create policy "profile update request membership admin update"
on public.profile_update_requests
for update
to authenticated
using (public.has_permission('admin.membership.manage'))
with check (public.has_permission('admin.membership.manage'));

-- profiles is a legacy mirror. Keep it readable by the owning user for
-- rollback diagnostics, but stop direct mutations and stop mirroring new users.
drop policy if exists "profiles self select" on public.profiles;
drop policy if exists "profiles self insert" on public.profiles;
drop policy if exists "profiles self update" on public.profiles;

create policy "profiles legacy self read"
on public.profiles
for select
to authenticated
using (id = (select auth.uid()));

revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- public.members is the canonical identity table. This legacy hook remains
  -- installed for rollback compatibility, but intentionally stops writing the
  -- deprecated public.profiles mirror.
  return new;
end;
$$;

create or replace function public.finalize_member_invitation_claim(
  target_user_id uuid,
  target_email text,
  target_member_id uuid,
  target_invitation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  member_record public.members%rowtype;
  invitation_record public.member_invitations%rowtype;
  role_id uuid;
  role_code text;
  now_value timestamptz := timezone('utc', now());
  newly_claimed boolean := false;
begin
  if target_user_id is null or target_email is null or target_member_id is null or target_invitation_id is null then
    raise exception 'Missing claim finalization input.';
  end if;

  select *
    into member_record
  from public.members
  where id = target_member_id
  for update;

  if not found then
    raise exception 'Member profile was not found.';
  end if;

  if member_record.user_id is not null and member_record.user_id <> target_user_id then
    raise exception 'This member profile is already claimed.';
  end if;

  select *
    into invitation_record
  from public.member_invitations
  where id = target_invitation_id
    and member_id = target_member_id
  for update;

  if not found then
    raise exception 'Invitation was not found.';
  end if;

  if not invitation_record.is_active or invitation_record.revoked_at is not null then
    raise exception 'This invitation is no longer active.';
  end if;

  if invitation_record.used_count >= invitation_record.max_uses
    and member_record.user_id is distinct from target_user_id
  then
    raise exception 'This invitation has already been used.';
  end if;

  if invitation_record.expires_at < now_value then
    raise exception 'This invitation has expired.';
  end if;

  if member_record.user_id is null then
    newly_claimed := true;

    update public.members
    set
      email = target_email,
      user_id = target_user_id,
      is_profile_claimed = true,
      profile_claimed_at = now_value,
      updated_at = now_value
    where id = target_member_id;

    update public.member_invitations
    set
      used_count = used_count + 1,
      last_used_at = now_value,
      updated_at = now_value
    where id = target_invitation_id;
  else
    update public.members
    set
      email = target_email,
      is_profile_claimed = true,
      updated_at = now_value
    where id = target_member_id;
  end if;

  role_code := case
    when member_record.member_type = 'alumni' then 'alumni'
    else 'member'
  end;

  select id
    into role_id
  from public.rbac_platform_roles
  where code = role_code
    and scope = 'portal'
  limit 1;

  if role_id is null then
    raise exception 'Portal role % is not configured.', role_code;
  end if;

  insert into public.rbac_user_platform_roles (
    user_id,
    role_id,
    note
  )
  select target_user_id, role_id, 'Granted after verified member invitation claim.'
  where not exists (
    select 1
    from public.rbac_user_platform_roles as grants
    where grants.user_id = target_user_id
      and grants.scope = 'portal'
      and grants.revoked_at is null
  );

  insert into public.security_events (
    actor_user_id,
    target_user_id,
    event_type,
    severity,
    payload
  )
  values (
    target_user_id,
    target_user_id,
    case when newly_claimed then 'member.profile_claim_finalized' else 'member.profile_claim_refreshed' end,
    'info',
    jsonb_build_object(
      'member_id', target_member_id,
      'invitation_id', target_invitation_id,
      'role_code', role_code
    )
  );

  return jsonb_build_object(
    'member_id', target_member_id,
    'newly_claimed', newly_claimed,
    'role_code', role_code
  );
end;
$$;

revoke all on function public.finalize_member_invitation_claim(uuid, text, uuid, uuid) from public;
grant execute on function public.finalize_member_invitation_claim(uuid, text, uuid, uuid) to service_role;

-- Safe app-layer fallback for freshly issued sessions whose JWT does not yet
-- contain the custom hook claims. This returns only the caller's compact RBAC
-- snapshot, not role catalog rows or assignments.
create or replace function public.current_rbac_claims_snapshot()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with active_roles as (
    select roles.scope, roles.code
    from public.rbac_user_platform_roles as grants
    join public.rbac_platform_roles as roles
      on roles.id = grants.role_id
    where grants.user_id = auth.uid()
      and grants.revoked_at is null
  ),
  reduced_roles as (
    select
      max(code) filter (where scope = 'admin') as admin_role,
      max(code) filter (where scope = 'portal') as portal_role
    from active_roles
  ),
  member_row as (
    select members.id
    from public.members
    where members.user_id = auth.uid()
    limit 1
  )
  select jsonb_build_object(
    'jnuits_admin_role', reduced_roles.admin_role,
    'jnuits_portal_role', reduced_roles.portal_role,
    'jnuits_portals', array_remove(array[
      case when reduced_roles.admin_role is not null then 'admin' end,
      case when reduced_roles.portal_role is not null then 'portal' end
    ], null),
    'jnuits_member_id', (select member_row.id::text from member_row),
    'jnuits_role_version', coalesce((
      select versions.version
      from public.rbac_user_claim_versions as versions
      where versions.user_id = auth.uid()
      limit 1
    ), 1)
  )
  from reduced_roles;
$$;

revoke all on function public.current_rbac_claims_snapshot() from public;
grant execute on function public.current_rbac_claims_snapshot() to authenticated;

-- Security telemetry helpers. Triggers use SECURITY DEFINER so they can write
-- telemetry regardless of end-user RLS, while avoiding secrets in payloads.
create or replace function public.log_rbac_assignment_security_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user uuid := coalesce(new.user_id, old.user_id);
  role_code text;
  event_name text;
begin
  select roles.code
    into role_code
  from public.rbac_platform_roles as roles
  where roles.id = coalesce(new.role_id, old.role_id);

  if tg_op = 'INSERT' then
    event_name := 'rbac.role_assignment_granted';
  elsif tg_op = 'DELETE' then
    event_name := 'rbac.role_assignment_deleted';
  elsif old.revoked_at is null and new.revoked_at is not null then
    event_name := 'rbac.role_assignment_revoked';
  else
    event_name := 'rbac.role_assignment_updated';
  end if;

  insert into public.security_events (
    actor_user_id,
    target_user_id,
    event_type,
    severity,
    payload
  )
  values (
    coalesce(new.granted_by, old.granted_by),
    target_user,
    event_name,
    case when role_code = 'super_admin' then 'critical' else 'info' end,
    jsonb_build_object(
      'role_code', role_code,
      'scope', coalesce(new.scope, old.scope),
      'assignment_id', coalesce(new.id, old.id)
    )
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists rbac_user_platform_roles_security_event on public.rbac_user_platform_roles;
create trigger rbac_user_platform_roles_security_event
after insert or update or delete
on public.rbac_user_platform_roles
for each row
execute function public.log_rbac_assignment_security_event();

create or replace function public.log_security_settings_security_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.admin_totp_enforced is distinct from new.admin_totp_enforced then
    insert into public.security_events (
      actor_user_id,
      target_user_id,
      event_type,
      severity,
      payload
    )
    values (
      new.updated_by_user_id,
      new.updated_by_user_id,
      'admin.security.admin_totp_enforcement_changed',
      case when new.admin_totp_enforced then 'info' else 'critical' end,
      jsonb_build_object(
        'previous', old.admin_totp_enforced,
        'current', new.admin_totp_enforced
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists security_settings_security_event on public.security_settings;
create trigger security_settings_security_event
after update on public.security_settings
for each row
execute function public.log_security_settings_security_event();

create or replace function public.log_auth_user_security_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.encrypted_password is distinct from new.encrypted_password then
    insert into public.security_events (
      target_user_id,
      event_type,
      severity,
      payload
    )
    values (
      new.id,
      'auth.password_changed',
      'warning',
      '{}'::jsonb
    );
  end if;

  if old.email is distinct from new.email then
    insert into public.security_events (
      target_user_id,
      event_type,
      severity,
      payload
    )
    values (
      new.id,
      'auth.email_changed',
      'warning',
      jsonb_build_object(
        'old_email', old.email,
        'new_email', new.email
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists auth_users_security_event on auth.users;
create trigger auth_users_security_event
after update of encrypted_password, email on auth.users
for each row
execute function public.log_auth_user_security_event();

create or replace function public.log_mfa_factor_security_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user uuid := coalesce(new.user_id, old.user_id);
begin
  if tg_op = 'INSERT' and new.status::text = 'verified' then
    insert into public.security_events (
      target_user_id,
      event_type,
      severity,
      payload
    )
    values (
      target_user,
      'auth.mfa.factor_enrolled',
      'warning',
      jsonb_build_object(
        'factor_id', new.id,
        'factor_type', new.factor_type::text,
        'friendly_name', new.friendly_name
      )
    );
  elsif tg_op = 'UPDATE'
    and old.status::text is distinct from new.status::text
    and new.status::text = 'verified'
  then
    insert into public.security_events (
      target_user_id,
      event_type,
      severity,
      payload
    )
    values (
      target_user,
      'auth.mfa.factor_enrolled',
      'warning',
      jsonb_build_object(
        'factor_id', new.id,
        'factor_type', new.factor_type::text,
        'friendly_name', new.friendly_name
      )
    );
  elsif tg_op = 'DELETE' and old.status::text = 'verified' then
    insert into public.security_events (
      target_user_id,
      event_type,
      severity,
      payload
    )
    values (
      target_user,
      'auth.mfa.factor_removed',
      'critical',
      jsonb_build_object(
        'factor_id', old.id,
        'factor_type', old.factor_type::text,
        'friendly_name', old.friendly_name
      )
    );
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists auth_mfa_factors_security_event on auth.mfa_factors;
create trigger auth_mfa_factors_security_event
after insert or update or delete on auth.mfa_factors
for each row
execute function public.log_mfa_factor_security_event();

create or replace function public.log_member_identity_security_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.user_id is distinct from new.user_id then
    insert into public.security_events (
      actor_user_id,
      target_user_id,
      event_type,
      severity,
      payload
    )
    values (
      new.user_id,
      new.user_id,
      'member.auth_user_link_changed',
      'warning',
      jsonb_build_object(
        'member_id', new.id,
        'previous_user_id', old.user_id,
        'current_user_id', new.user_id
      )
    );
  end if;

  if old.email is distinct from new.email then
    insert into public.security_events (
      actor_user_id,
      target_user_id,
      event_type,
      severity,
      payload
    )
    values (
      new.user_id,
      new.user_id,
      'member.email_changed',
      'warning',
      jsonb_build_object(
        'member_id', new.id,
        'old_email', old.email,
        'new_email', new.email
      )
    );
  end if;

  if old.jnuits_id is distinct from new.jnuits_id then
    insert into public.security_events (
      actor_user_id,
      target_user_id,
      event_type,
      severity,
      payload
    )
    values (
      new.user_id,
      new.user_id,
      'member.jnuits_id_changed',
      'critical',
      jsonb_build_object(
        'member_id', new.id,
        'old_jnuits_id', old.jnuits_id,
        'new_jnuits_id', new.jnuits_id
      )
    );
  end if;

  return new;
end;
$$;

drop trigger if exists members_identity_security_event on public.members;
create trigger members_identity_security_event
after update of email, jnuits_id, user_id on public.members
for each row
execute function public.log_member_identity_security_event();
