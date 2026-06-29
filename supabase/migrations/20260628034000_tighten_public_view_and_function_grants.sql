-- Follow-up hardening after the June 2026 production migration catch-up.
-- Keep public read surfaces explicit and remove inherited PUBLIC execute from
-- privileged helper functions.

begin;

-- Public-safe views should expose SELECT only. Views do not need DML grants.
revoke all privileges on table public.gallery_album_cards from public, anon, authenticated;
grant select on table public.gallery_album_cards to anon, authenticated;

revoke all privileges on table public.public_certificates from public, anon, authenticated;
grant select on table public.public_certificates to anon, authenticated;

-- These policies were created without an explicit TO clause. Make them
-- authenticated-only before tightening has_permission() execute grants.
drop policy if exists "profile update request own or membership admin read"
on public.profile_update_requests;

create policy "profile update request own or membership admin read"
on public.profile_update_requests
for select
to authenticated
using (
  public.has_permission('admin.membership.manage')
  or exists (
    select 1
    from public.members
    where members.id = profile_update_requests.member_id
      and members.user_id = (select auth.uid())
  )
);

drop policy if exists "profile update request membership admin update"
on public.profile_update_requests;

create policy "profile update request membership admin update"
on public.profile_update_requests
for update
to authenticated
using (public.has_permission('admin.membership.manage'))
with check (public.has_permission('admin.membership.manage'));

-- Internal trigger/helper functions are not direct client APIs.
revoke all on function public.bump_claim_version_from_member_link() from public, anon, authenticated;
revoke all on function public.bump_claim_version_from_role_assignment() from public, anon, authenticated;
revoke all on function public.bump_user_claim_version(uuid) from public, anon, authenticated;
revoke all on function public.handle_new_auth_user() from public, anon, authenticated;
revoke all on function public.log_auth_user_security_event() from public, anon, authenticated;
revoke all on function public.log_member_identity_security_event() from public, anon, authenticated;
revoke all on function public.log_mfa_factor_security_event() from public, anon, authenticated;
revoke all on function public.log_rbac_assignment_security_event() from public, anon, authenticated;
revoke all on function public.log_security_settings_security_event() from public, anon, authenticated;
revoke all on function public.rls_auto_enable() from public, anon, authenticated;
revoke all on function public.sync_user_platform_role_scope() from public, anon, authenticated;

-- RLS helpers are needed by authenticated policies and service-role paths only.
revoke all on function public.can_access_mentorship_relationship(uuid) from public, anon;
grant execute on function public.can_access_mentorship_relationship(uuid) to authenticated, service_role;

revoke all on function public.can_access_support_ticket(uuid) from public, anon;
grant execute on function public.can_access_support_ticket(uuid) to authenticated, service_role;

revoke all on function public.can_manage_support_ticket(uuid) from public, anon;
grant execute on function public.can_manage_support_ticket(uuid) to authenticated, service_role;

revoke all on function public.current_member_id() from public, anon;
grant execute on function public.current_member_id() to authenticated, service_role;

revoke all on function public.current_member_type() from public, anon;
grant execute on function public.current_member_type() to authenticated, service_role;

revoke all on function public.has_permission(text) from public, anon;
grant execute on function public.has_permission(text) to authenticated, service_role;

revoke all on function public.has_platform_role(text) from public, anon;
grant execute on function public.has_platform_role(text) to authenticated, service_role;

revoke all on function public.is_super_admin() from public, anon;
grant execute on function public.is_super_admin() to authenticated, service_role;

-- This helper is intentionally callable before an admin reaches aal2; remove
-- inherited PUBLIC execute and keep explicit reviewed role grants.
revoke all on function public.is_admin_totp_enforced() from public;
grant execute on function public.is_admin_totp_enforced() to anon, authenticated, service_role;

select pg_notify('pgrst', 'reload schema');

commit;
