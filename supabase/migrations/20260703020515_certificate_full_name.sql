-- Move certificates to canonical full_name while keeping split-name columns
-- temporarily nullable for staged rollout compatibility.

begin;

alter table public.certificates
  add column if not exists full_name text;

update public.certificates
set full_name = nullif(
  btrim(
    concat_ws(
      ' ',
      nullif(btrim(coalesce(first_name, '')), ''),
      nullif(btrim(coalesce(last_name, '')), '')
    )
  ),
  ''
)
where full_name is null
   or btrim(full_name) = '';

do $$
begin
  if exists (
    select 1
    from public.certificates
    where full_name is null
       or btrim(full_name) = ''
  ) then
    raise exception 'certificate full_name backfill failed: blank certificate recipient names remain';
  end if;
end $$;

alter table public.certificates
  alter column full_name set not null,
  alter column first_name drop not null,
  alter column last_name drop not null;

create or replace function public.normalize_certificate_name_fields()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  normalized_full_name text;
  split_position integer;
begin
  normalized_full_name := nullif(btrim(coalesce(new.full_name, '')), '');

  if normalized_full_name is null then
    normalized_full_name := nullif(
      btrim(
        concat_ws(
          ' ',
          nullif(btrim(coalesce(new.first_name, '')), ''),
          nullif(btrim(coalesce(new.last_name, '')), '')
        )
      ),
      ''
    );
  end if;

  if normalized_full_name is null then
    raise exception 'full_name is required';
  end if;

  new.full_name := normalized_full_name;

  if nullif(btrim(coalesce(new.first_name, '')), '') is null then
    split_position := position(' ' in normalized_full_name);
    new.first_name := case
      when split_position > 0 then left(normalized_full_name, split_position - 1)
      else normalized_full_name
    end;
  else
    new.first_name := btrim(new.first_name);
  end if;

  if nullif(btrim(coalesce(new.last_name, '')), '') is null then
    split_position := position(' ' in normalized_full_name);
    new.last_name := case
      when split_position > 0 then nullif(btrim(substr(normalized_full_name, split_position + 1)), '')
      else null
    end;
  else
    new.last_name := btrim(new.last_name);
  end if;

  return new;
end;
$$;

drop trigger if exists certificates_normalize_name_fields on public.certificates;
create trigger certificates_normalize_name_fields
before insert or update on public.certificates
for each row
execute function public.normalize_certificate_name_fields();

alter table public.certificates_import_staging
  add column if not exists full_name_raw text;

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

grant select on table public.public_certificates to anon, authenticated;

select pg_notify('pgrst', 'reload schema');

commit;

