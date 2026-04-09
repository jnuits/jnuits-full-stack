insert into public.rbac_platform_roles (code, title, is_system)
values ('super_admin', 'Super Administrator', true)
on conflict (code) do update
  set title = excluded.title,
      is_system = excluded.is_system;

create or replace function public.has_platform_role(role_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.rbac_user_platform_roles user_roles
    join public.rbac_platform_roles roles
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
              'content_editor',
              'committee_author'
            ]
          )
        )
      )
  );
$$;

insert into public.rbac_user_platform_roles (user_id, role_id, note)
select
  auth_user.id,
  role.id,
  'Bootstrap promotion to super_admin'
from auth.users as auth_user
join public.rbac_platform_roles as role
  on role.code = 'super_admin'
where lower(auth_user.email) = 'jnuitsbd@gmail.com'
  and not exists (
    select 1
    from public.rbac_user_platform_roles grants
    where grants.user_id = auth_user.id
      and grants.role_id = role.id
      and grants.revoked_at is null
  );
