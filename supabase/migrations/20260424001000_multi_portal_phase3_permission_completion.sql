-- Complete elevated portal permission mappings for Phase 3.

with role_permission_seed (role_code, permission_code) as (
  values
    ('executive', 'portal.tickets.manage_member'),
    ('executive', 'portal.community.moderate'),
    ('alumni_ambassador', 'portal.tickets.manage_alumni'),
    ('alumni_ambassador', 'portal.community.moderate')
)
insert into public.rbac_role_permissions (role_id, permission_code)
select roles.id, role_permission_seed.permission_code
from role_permission_seed
join public.rbac_platform_roles as roles
  on roles.code = role_permission_seed.role_code
on conflict (role_id, permission_code) do nothing;
