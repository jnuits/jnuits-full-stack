begin;

-- Public certificate verification must read through public.public_certificates only.
-- Admin certificate management uses service-role server paths.
drop policy if exists "certificates are publicly readable" on public.certificates;

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
