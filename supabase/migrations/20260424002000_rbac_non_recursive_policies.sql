-- Replace recursive RBAC RLS policies with JWT-gated catalog visibility.
-- Server actions still use public.has_permission() for DB-backed authorization.

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
using (public.current_admin_role() = 'super_admin');

create policy "rbac roles admin visible read"
on public.rbac_platform_roles
for select
to authenticated
using (
  public.current_admin_role() = 'admin'
  and is_hidden = false
);

create policy "rbac roles super admin insert"
on public.rbac_platform_roles
for insert
to authenticated
with check (public.current_admin_role() = 'super_admin');

create policy "rbac roles super admin update"
on public.rbac_platform_roles
for update
to authenticated
using (public.current_admin_role() = 'super_admin')
with check (public.current_admin_role() = 'super_admin');

create policy "rbac roles super admin delete"
on public.rbac_platform_roles
for delete
to authenticated
using (public.current_admin_role() = 'super_admin');

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
using (public.current_admin_role() = 'super_admin');

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
  public.current_admin_role() = 'admin'
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
with check (public.current_admin_role() = 'super_admin');

create policy "rbac user roles super admin update"
on public.rbac_user_platform_roles
for update
to authenticated
using (public.current_admin_role() = 'super_admin')
with check (public.current_admin_role() = 'super_admin');

create policy "rbac user roles super admin delete"
on public.rbac_user_platform_roles
for delete
to authenticated
using (public.current_admin_role() = 'super_admin');

create policy "rbac user roles admin portal insert"
on public.rbac_user_platform_roles
for insert
to authenticated
with check (
  public.current_admin_role() = 'admin'
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
  public.current_admin_role() = 'admin'
  and exists (
    select 1
    from public.rbac_platform_roles as roles
    where roles.id = rbac_user_platform_roles.role_id
      and roles.scope = 'portal'
      and roles.is_hidden = false
  )
)
with check (
  public.current_admin_role() = 'admin'
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
  public.current_admin_role() = 'admin'
  and exists (
    select 1
    from public.rbac_platform_roles as roles
    where roles.id = rbac_user_platform_roles.role_id
      and roles.scope = 'portal'
      and roles.is_hidden = false
  )
);
