begin;

-- Reduce direct PostgREST RPC exposure for privileged SECURITY DEFINER helpers.
-- These helpers are not referenced by live RLS policies and current app code calls
-- them through server-only service-role paths. Authenticated users should not be
-- able to execute them directly via /rest/v1/rpc/*.
revoke execute on function public.allocate_membership_id(text) from authenticated;
revoke execute on function public.commit_bulk_membership_operation(uuid) from authenticated;
revoke execute on function public.preview_bulk_membership_operation(uuid) from authenticated;
revoke execute on function public.set_member_lifecycle_status(uuid, text, text, text) from authenticated;

-- Legacy role helper: live policies have moved to has_permission(...), and app
-- runtime code does not call this RPC directly.
revoke execute on function public.has_platform_role(text) from authenticated;

grant execute on function public.allocate_membership_id(text) to service_role;
grant execute on function public.commit_bulk_membership_operation(uuid) to service_role;
grant execute on function public.preview_bulk_membership_operation(uuid) to service_role;
grant execute on function public.set_member_lifecycle_status(uuid, text, text, text) to service_role;
grant execute on function public.has_platform_role(text) to service_role;

select pg_notify('pgrst', 'reload schema');

commit;