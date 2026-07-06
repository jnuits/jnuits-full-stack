begin;

-- Narrow first pass for tables now confirmed to be server-owned or safe-read-only.
-- Do not touch mixed portal/member/RBAC tables in this migration.

-- Public certificate reads should expose only the safe public certificate fields.
-- Keep column-level SELECT on the base table so security-invoker safe views and
-- the temporary app fallback can still work without exposing internal columns.
revoke all privileges on table public.certificates from anon;
revoke all privileges on table public.certificates from authenticated;
grant select (
  certificate_id,
  full_name,
  details,
  exam_or_event,
  exam_or_event_name,
  issue_date,
  asset_url
) on table public.certificates to anon;
grant select (
  certificate_id,
  full_name,
  details,
  exam_or_event,
  exam_or_event_name,
  issue_date,
  asset_url
) on table public.certificates to authenticated;

grant select on table public.public_certificates to anon;
grant select on table public.public_certificates to authenticated;

-- Certificate import metadata/staging is admin-only and service-role-owned.
revoke all privileges on table public.certificate_import_batches from anon;
revoke all privileges on table public.certificate_import_batches from authenticated;
revoke all privileges on table public.certificates_import_staging from anon;
revoke all privileges on table public.certificates_import_staging from authenticated;

-- Security settings are readable by authorized signed-in admins through RLS,
-- but writes now go through server actions using the service-role client.
revoke all privileges on table public.security_settings from anon;
revoke insert, update, delete, truncate, references, trigger on table public.security_settings from authenticated;
grant select on table public.security_settings to authenticated;

-- Rate-limit state is only for server-side RPC/service-role paths.
revoke all privileges on table public.security_rate_limits from anon;
revoke all privileges on table public.security_rate_limits from authenticated;

grant all privileges on table public.certificates to service_role;
grant all privileges on table public.certificate_import_batches to service_role;
grant all privileges on table public.certificates_import_staging to service_role;
grant all privileges on table public.security_settings to service_role;
grant all privileges on table public.security_rate_limits to service_role;

notify pgrst, 'reload schema';

commit;