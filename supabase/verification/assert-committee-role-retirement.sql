-- Run against the disposable replay database, never against a hosted project.
-- Negative writes below roll back; they prove retired roles cannot reappear.
begin;

do $test$
declare
  retired_constraint text;
  candidate record;
  assistant_before jsonb;
begin
  if exists (
    select 1 from public.committee_roles
    where regexp_replace(lower(code), '[^a-z0-9]', '', 'g') = 'jointsecretary'
      or regexp_replace(lower(title), '[^a-z0-9]', '', 'g') = 'jointsecretary'
  ) then
    raise exception 'Retired Joint Secretary role remains in the catalog.';
  end if;

  if exists (
    select 1 from public.committee_roles r
    cross join lateral unnest(r.aliases) as a(alias)
    where regexp_replace(lower(a.alias), '[^a-z0-9]', '', 'g') = 'jointsecretary'
  ) then
    raise exception 'Retired Joint Secretary alias remains in the catalog.';
  end if;

  select to_jsonb(r) into assistant_before
  from public.committee_roles r where r.code = 'assistant-general-secretary';
  if assistant_before is null then
    raise exception 'Valid Assistant General Secretary role was removed.';
  end if;

  for candidate in
    select * from (values
      ('joint-secretary', 'Retired role fixture', array[]::text[]),
      ('Joint_Secretary', 'Retired role fixture', array[]::text[]),
      ('retirement-title-fixture', ' Joint Secretary ', array[]::text[]),
      ('retirement-alias-fixture', 'Other fixture', array['Joint Secretary']::text[]),
      ('retirement-alias-fixture', 'Other fixture', array[' joint-secretary ']::text[])
    ) as candidates(code, title, aliases)
  loop
    begin
      insert into public.committee_roles (code, title, aliases)
      values (candidate.code, candidate.title, candidate.aliases);
      raise exception 'Retired role code/title/alias was accepted.';
    exception when check_violation then
      get stacked diagnostics retired_constraint = constraint_name;
      if retired_constraint <> 'committee_roles_retired_joint_secretary_check' then
        raise exception 'Unexpected check rejected fixture: %', retired_constraint;
      end if;
    end;
  end loop;

  -- Other configured roles remain extensible; there is no role allowlist.
  insert into public.committee_roles (code, title, aliases)
  values ('role-retirement-valid-fixture', 'Community Lead', array['Community Coordinator']);

  if (select to_jsonb(r) from public.committee_roles r
      where r.code = 'assistant-general-secretary') is distinct from assistant_before then
    raise exception 'Valid Assistant General Secretary settings changed during verification.';
  end if;
end
$test$;

rollback;
select 'COMMITTEE ROLE RETIREMENT ASSERTIONS COMPLETE' as result;
