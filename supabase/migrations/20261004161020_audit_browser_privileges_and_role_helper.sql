-- F3/F9: backward-compatible security hardening. Existing SELECT/DML grants
-- and row policies stay intact; new project objects need explicit browser ACLs.
begin;

revoke truncate, references, trigger, maintain on all tables in schema public
  from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres
  revoke all on tables from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from public, anon, authenticated;
alter default privileges for role postgres
  revoke all on sequences from public, anon, authenticated;
-- Per-schema REVOKE cannot negate global PUBLIC's implicit function EXECUTE.
alter default privileges for role postgres
  revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

create or replace function public.is_super_admin_user(target_user_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $helper$
begin
  -- current_user is the definer here. The actual invoker role is preserved in
  -- the role setting by PostgREST; user-editable JWT metadata is never trusted.
  if current_setting('role', true) is distinct from 'service_role'
    and not public.has_permission('admin.admin_profiles.manage') then
    return false;
  end if;
  return exists (
    select 1 from public.rbac_user_platform_roles as grants
    join public.rbac_platform_roles as roles on roles.id = grants.role_id
    where grants.user_id = target_user_id
      and grants.revoked_at is null
      and roles.scope = 'admin'
      and roles.code = 'super_admin'
  );
end
$helper$;
revoke all on function public.is_super_admin_user(uuid) from public, anon;
grant execute on function public.is_super_admin_user(uuid) to authenticated, service_role;

-- Do not ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin here: hosted
-- postgres cannot act for that platform owner. The supported owner/provider
-- action and separate verification are documented in the release runbook.
commit;
