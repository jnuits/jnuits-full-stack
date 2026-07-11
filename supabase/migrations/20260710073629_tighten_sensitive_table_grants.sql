begin;

-- These tables are accessed exclusively through authenticated server routes and
-- server actions that use the service-role client. Keep their RLS policies as
-- defense in depth, but remove Data API table privileges from browser roles.
-- Public directory/member reads are intentionally out of scope here.
revoke all privileges on table public.admin_invitations from anon, authenticated;
revoke all privileges on table public.admin_profiles from anon, authenticated;
revoke all privileges on table public.audit_events from anon, authenticated;
revoke all privileges on table public.event_registrations from anon, authenticated;
revoke all privileges on table public.member_invitations from anon, authenticated;
revoke all privileges on table public.profile_update_requests from anon, authenticated;
revoke all privileges on table public.rbac_user_claim_versions from anon, authenticated;
revoke all privileges on table public.rbac_user_platform_roles from anon, authenticated;
revoke all privileges on table public.security_events from anon, authenticated;

notify pgrst, 'reload schema';

commit;