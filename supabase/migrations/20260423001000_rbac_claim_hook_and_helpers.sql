-- Phase 1: RBAC helper functions and Supabase custom access token hook

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
          and role_code = any (
            array[
              'super_admin',
              'admin',
              'moderator',
              'content_admin',
              'content_editor',
              'committee_author'
            ]
          )
        )
        or (
          roles.code = 'admin'
          and role_code = any (
            array[
              'admin',
              'moderator'
            ]
          )
        )
        or (
          roles.code = 'content_admin'
          and role_code = any (
            array[
              'content_admin',
              'content_editor',
              'committee_author'
            ]
          )
        )
      )
  );
$$;

grant execute on function public.has_platform_role(text) to anon, authenticated;

create or replace function public.current_admin_role()
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(auth.jwt() ->> 'jnuits_admin_role', '');
$$;

create or replace function public.current_portal_role()
returns text
language sql
stable
set search_path = ''
as $$
  select nullif(auth.jwt() ->> 'jnuits_portal_role', '');
$$;

create or replace function public.is_super_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.rbac_user_platform_roles as grants
    join public.rbac_platform_roles as roles
      on roles.id = grants.role_id
    where grants.user_id = auth.uid()
      and grants.revoked_at is null
      and roles.code = 'super_admin'
  );
$$;

create or replace function public.has_permission(requested_permission text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    return false;
  end if;

  if public.is_super_admin() then
    return true;
  end if;

  return exists(
    select 1
    from public.rbac_user_platform_roles as grants
    join public.rbac_role_permissions as role_permissions
      on role_permissions.role_id = grants.role_id
    where grants.user_id = auth.uid()
      and grants.revoked_at is null
      and role_permissions.permission_code = requested_permission
  );
end;
$$;

grant execute on function public.current_admin_role() to authenticated;
grant execute on function public.current_portal_role() to authenticated;
grant execute on function public.is_super_admin() to authenticated;
grant execute on function public.has_permission(text) to authenticated;

create or replace function public.jnuits_custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  claims jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  user_uuid uuid;
  admin_role text;
  portal_role text;
  member_id uuid;
  portals text[];
begin
  user_uuid := nullif(event ->> 'user_id', '')::uuid;

  if user_uuid is null then
    return jsonb_build_object('claims', claims);
  end if;

  with active_roles as (
    select roles.scope, roles.code
    from public.rbac_user_platform_roles as grants
    join public.rbac_platform_roles as roles
      on roles.id = grants.role_id
    where grants.user_id = user_uuid
      and grants.revoked_at is null
  ),
  reduced_roles as (
    select
      max(code) filter (where scope = 'admin') as admin_role,
      max(code) filter (where scope = 'portal') as portal_role
    from active_roles
  )
  select
    reduced_roles.admin_role,
    reduced_roles.portal_role,
    members.id
  into
    admin_role,
    portal_role,
    member_id
  from reduced_roles
  left join public.members
    on members.user_id = user_uuid;

  portals := array_remove(
    array[
      case when admin_role is not null then 'admin' end,
      case when portal_role is not null then 'portal' end
    ],
    null
  );

  claims := jsonb_set(
    claims,
    '{jnuits_admin_role}',
    coalesce(to_jsonb(admin_role), 'null'::jsonb),
    true
  );
  claims := jsonb_set(
    claims,
    '{jnuits_portal_role}',
    coalesce(to_jsonb(portal_role), 'null'::jsonb),
    true
  );
  claims := jsonb_set(
    claims,
    '{jnuits_portals}',
    to_jsonb(coalesce(portals, array[]::text[])),
    true
  );
  claims := jsonb_set(
    claims,
    '{jnuits_member_id}',
    coalesce(to_jsonb(member_id::text), 'null'::jsonb),
    true
  );

  return jsonb_build_object('claims', claims);
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.jnuits_custom_access_token_hook(jsonb) to supabase_auth_admin;
revoke execute on function public.jnuits_custom_access_token_hook(jsonb) from anon, authenticated, public;
