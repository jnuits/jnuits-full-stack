begin;

-- The public verification surface is a curated projection. Keep the raw table
-- inaccessible to public roles, while exposing only safe certificate fields.
drop view if exists public.public_certificates;

create view public.public_certificates
as
select
  certificate_id,
  full_name,
  details,
  exam_or_event,
  exam_or_event_name,
  issue_date,
  asset_url
from public.certificates;

revoke all on table public.certificates from anon;
revoke all on table public.certificates from authenticated;
revoke select (
  certificate_id,
  full_name,
  details,
  exam_or_event,
  exam_or_event_name,
  issue_date,
  asset_url
) on table public.certificates from anon, authenticated;

grant select on table public.public_certificates to anon, authenticated;

select pg_notify('pgrst', 'reload schema');

commit;
