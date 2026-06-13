-- Expose public certificate verification data without leaking import/source IDs.
-- The base table keeps RLS enabled; public roles receive only column-level
-- access required by the security-invoker view.

begin;

create or replace view public.public_certificates
with (security_invoker = true)
as
select
  certificate_id,
  first_name,
  last_name,
  details,
  exam_or_event,
  exam_or_event_name,
  issue_date,
  asset_url
from public.certificates;

revoke all on table public.certificates from anon;
revoke all on table public.certificates from authenticated;

grant select (
  certificate_id,
  first_name,
  last_name,
  details,
  exam_or_event,
  exam_or_event_name,
  issue_date,
  asset_url
) on table public.certificates to anon, authenticated;

grant select on public.public_certificates to anon, authenticated;

select pg_notify('pgrst', 'reload schema');

commit;
