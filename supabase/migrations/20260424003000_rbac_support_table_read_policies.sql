-- Make RBAC support-table reads explicit so RLS is intentional and auditable.

alter table public.rbac_permissions enable row level security;
alter table public.rbac_role_permissions enable row level security;
alter table public.rbac_user_claim_versions enable row level security;

drop policy if exists "rbac permissions admin read" on public.rbac_permissions;
drop policy if exists "rbac role permissions admin read" on public.rbac_role_permissions;
drop policy if exists "rbac claim versions self read" on public.rbac_user_claim_versions;
drop policy if exists "rbac claim versions super admin read" on public.rbac_user_claim_versions;

create policy "rbac permissions admin read"
on public.rbac_permissions
for select
to authenticated
using (public.current_admin_role() in ('super_admin', 'admin'));

create policy "rbac role permissions admin read"
on public.rbac_role_permissions
for select
to authenticated
using (public.current_admin_role() in ('super_admin', 'admin'));

create policy "rbac claim versions self read"
on public.rbac_user_claim_versions
for select
to authenticated
using (user_id = auth.uid());

create policy "rbac claim versions super admin read"
on public.rbac_user_claim_versions
for select
to authenticated
using (public.current_admin_role() = 'super_admin');
