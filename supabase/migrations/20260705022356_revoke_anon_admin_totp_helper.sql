begin;

-- The admin MFA enforcement setting is only needed after an authenticated admin
-- session exists. Anonymous callers should not execute a SECURITY DEFINER
-- function in the exposed public schema.
revoke execute on function public.is_admin_totp_enforced() from anon;
grant execute on function public.is_admin_totp_enforced() to authenticated, service_role;

select pg_notify('pgrst', 'reload schema');

commit;
