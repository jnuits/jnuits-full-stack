-- Phase 1: RBAC table policies that hide super_admin from lower roles

alter table public.rbac_platform_roles enable row level security;
alter table public.rbac_user_platform_roles enable row level security;

drop policy if exists "rbac roles authenticated read" on public.rbac_platform_roles;
drop policy if exists "rbac roles super admin read" on public.rbac_platform_roles;
drop policy if exists "rbac roles own assigned read" on public.rbac_platform_roles;
drop policy if exists "rbac roles admin visible read" on public.rbac_platform_roles;
drop policy if exists "rbac roles super admin insert" on public.rbac_platform_roles;
drop policy if exists "rbac roles super admin update" on public.rbac_platform_roles;
drop policy if exists "rbac roles super admin delete" on public.rbac_platform_roles;

create policy "rbac roles super admin read"
on public.rbac_platform_roles
for select
to authenticated
using (public.is_super_admin());

create policy "rbac roles own assigned read"
on public.rbac_platform_roles
for select
to authenticated
using (
  exists (
    select 1
    from public.rbac_user_platform_roles as grants
    where grants.user_id = auth.uid()
      and grants.revoked_at is null
      and grants.role_id = rbac_platform_roles.id
  )
);

create policy "rbac roles admin visible read"
on public.rbac_platform_roles
for select
to authenticated
using (
  public.has_permission('admin.roles.read')
  and is_hidden = false
);

create policy "rbac roles super admin insert"
on public.rbac_platform_roles
for insert
to authenticated
with check (public.is_super_admin());

create policy "rbac roles super admin update"
on public.rbac_platform_roles
for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "rbac roles super admin delete"
on public.rbac_platform_roles
for delete
to authenticated
using (public.is_super_admin());

drop policy if exists "rbac user roles own or operator read" on public.rbac_user_platform_roles;
drop policy if exists "rbac user roles operator write" on public.rbac_user_platform_roles;
drop policy if exists "rbac user roles operator insert" on public.rbac_user_platform_roles;
drop policy if exists "rbac user roles operator update" on public.rbac_user_platform_roles;
drop policy if exists "rbac user roles operator delete" on public.rbac_user_platform_roles;
drop policy if exists "rbac user roles super admin read" on public.rbac_user_platform_roles;
drop policy if exists "rbac user roles self read" on public.rbac_user_platform_roles;
drop policy if exists "rbac user roles admin visible read" on public.rbac_user_platform_roles;
drop policy if exists "rbac user roles super admin insert" on public.rbac_user_platform_roles;
drop policy if exists "rbac user roles super admin update" on public.rbac_user_platform_roles;
drop policy if exists "rbac user roles super admin delete" on public.rbac_user_platform_roles;
drop policy if exists "rbac user roles admin portal insert" on public.rbac_user_platform_roles;
drop policy if exists "rbac user roles admin portal update" on public.rbac_user_platform_roles;
drop policy if exists "rbac user roles admin portal delete" on public.rbac_user_platform_roles;

create policy "rbac user roles super admin read"
on public.rbac_user_platform_roles
for select
to authenticated
using (public.is_super_admin());

create policy "rbac user roles self read"
on public.rbac_user_platform_roles
for select
to authenticated
using (user_id = auth.uid());

create policy "rbac user roles admin visible read"
on public.rbac_user_platform_roles
for select
to authenticated
using (
  public.has_permission('admin.roles.read')
  and exists (
    select 1
    from public.rbac_platform_roles as roles
    where roles.id = rbac_user_platform_roles.role_id
      and roles.is_hidden = false
  )
);

create policy "rbac user roles super admin insert"
on public.rbac_user_platform_roles
for insert
to authenticated
with check (public.is_super_admin());

create policy "rbac user roles super admin update"
on public.rbac_user_platform_roles
for update
to authenticated
using (public.is_super_admin())
with check (public.is_super_admin());

create policy "rbac user roles super admin delete"
on public.rbac_user_platform_roles
for delete
to authenticated
using (public.is_super_admin());

create policy "rbac user roles admin portal insert"
on public.rbac_user_platform_roles
for insert
to authenticated
with check (
  public.has_permission('admin.roles.manage_portal')
  and exists (
    select 1
    from public.rbac_platform_roles as roles
    where roles.id = rbac_user_platform_roles.role_id
      and roles.scope = 'portal'
      and roles.is_hidden = false
      and roles.is_assignable = true
  )
);

create policy "rbac user roles admin portal update"
on public.rbac_user_platform_roles
for update
to authenticated
using (
  public.has_permission('admin.roles.manage_portal')
  and exists (
    select 1
    from public.rbac_platform_roles as roles
    where roles.id = rbac_user_platform_roles.role_id
      and roles.scope = 'portal'
      and roles.is_hidden = false
  )
)
with check (
  public.has_permission('admin.roles.manage_portal')
  and exists (
    select 1
    from public.rbac_platform_roles as roles
    where roles.id = rbac_user_platform_roles.role_id
      and roles.scope = 'portal'
      and roles.is_hidden = false
      and roles.is_assignable = true
  )
);

create policy "rbac user roles admin portal delete"
on public.rbac_user_platform_roles
for delete
to authenticated
using (
  public.has_permission('admin.roles.manage_portal')
  and exists (
    select 1
    from public.rbac_platform_roles as roles
    where roles.id = rbac_user_platform_roles.role_id
      and roles.scope = 'portal'
      and roles.is_hidden = false
  )
);
