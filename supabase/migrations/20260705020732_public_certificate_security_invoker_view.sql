begin;

-- Keep public certificate verification on a curated projection without using a
-- SECURITY DEFINER view. The base table grants remain column-scoped so source
-- document identifiers are not exposed to public API roles.
drop view if exists public.public_certificates;

create view public.public_certificates
with (security_invoker = true)
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

grant select (
  certificate_id,
  full_name,
  details,
  exam_or_event,
  exam_or_event_name,
  issue_date,
  asset_url
) on table public.certificates to anon, authenticated;

drop policy if exists "certificates public safe read" on public.certificates;
create policy "certificates public safe read"
  on public.certificates
  for select
  to anon, authenticated
  using (true);

grant select on table public.public_certificates to anon, authenticated;

select pg_notify('pgrst', 'reload schema');

commit;
