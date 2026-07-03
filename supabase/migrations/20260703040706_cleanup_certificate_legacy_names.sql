-- Finalize the certificate recipient-name migration.
-- Canonical recipient identity is public.certificates.full_name only.

begin;

update public.certificates
set full_name = nullif(btrim(coalesce(full_name, '')), '')
where full_name is not null;

do $$
begin
  if exists (
    select 1
    from public.certificates
    where full_name is null
       or btrim(full_name) = ''
  ) then
    raise exception 'certificate full_name cleanup blocked: blank certificate recipient names remain';
  end if;
end $$;

drop trigger if exists certificates_normalize_name_fields on public.certificates;
drop function if exists public.normalize_certificate_name_fields();

drop view if exists public.public_certificates;

alter table public.certificates
  alter column full_name set not null,
  drop column if exists first_name,
  drop column if exists last_name;

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

grant select on table public.public_certificates to anon, authenticated;

select pg_notify('pgrst', 'reload schema');

commit;
