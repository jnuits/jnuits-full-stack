begin;

set local lock_timeout = '5s';

-- Keep the existing slug-valued department primary key. This reviewed catalog
-- adds a human-facing code and official name without rewriting foreign keys.
create temporary table pg_temp.member_intake_department_catalog (
  department_code text primary key,
  short_code text not null,
  official_name text not null
) on commit drop;

insert into pg_temp.member_intake_department_catalog (
  department_code,
  short_code,
  official_name
)
values
  -- catalog-map:start
  ('accounting-information-system', 'AIS', 'Accounting & Information Systems'),
  ('anthropology', 'ANT', 'Anthropology'),
  ('bangla', 'BAN', 'Bangla'),
  ('biochemistry-molecular-biology', 'BIO', 'Biochemistry & Molecular Biology'),
  ('botany', 'BOT', 'Botany'),
  ('chemistry', 'CHE', 'Chemistry'),
  ('computer-science-engineering', 'CSE', 'Computer Science & Engineering'),
  ('economics', 'ECO', 'Economics'),
  ('english', 'ENG', 'English'),
  ('film-television', 'FTV', 'Film & Television'),
  ('finance', 'FIN', 'Finance'),
  ('fine-arts', 'FA', 'Fine Arts'),
  ('genetic-engineering-biotechnology', 'GEN', 'Genetic Engineering & Biotechnology'),
  ('geography-environment', 'GEO', 'Geography & Environment'),
  ('history', 'HIS', 'History'),
  ('institute-of-education-and-research', 'IER', 'Institute of Education & Research'),
  ('institute-of-modern-languages', 'IML', 'Institute of Modern Languages'),
  ('islamic-history-culture', 'IHC', 'Islamic History & Culture'),
  ('islamic-studies', 'IS', 'Islamic Studies'),
  ('land-management-law', 'LAN', 'Land Management & Law'),
  ('law', 'LAW', 'Law'),
  ('management-studies', 'MGT', 'Management Studies'),
  ('marketing', 'MKT', 'Marketing'),
  ('mass-communication-journalism', 'MCJ', 'Mass Communication & Journalism'),
  ('mathematics', 'MAT', 'Mathematics'),
  ('microbiology', 'MIC', 'Microbiology'),
  ('music', 'MUS', 'Music'),
  ('pharmacy', 'PHA', 'Pharmacy'),
  ('philosophy', 'PHI', 'Philosophy'),
  ('physics', 'PHY', 'Physics'),
  ('political-science', 'POS', 'Political Science'),
  ('psychology', 'PSY', 'Psychology'),
  ('public-administration', 'PAD', 'Public Administration'),
  ('social-work', 'SW', 'Social Work'),
  ('sociology', 'SOC', 'Sociology'),
  ('statistics', 'STA', 'Statistics'),
  ('theatre', 'THE', 'Theatre'),
  ('zoology', 'ZOO', 'Zoology');
  -- catalog-map:end

do $catalog_preflight$
declare
  duplicate_codes text;
  missing_codes text;
  reviewed_row_count integer;
begin
  select count(*)
  into reviewed_row_count
  from pg_temp.member_intake_department_catalog;

  if reviewed_row_count <> 38 then
    raise exception
      'The reviewed member intake department catalog must contain exactly 38 rows; found %.',
      reviewed_row_count;
  end if;

  select string_agg(departments.code, ', ' order by departments.code)
  into missing_codes
  from public.departments as departments
  left join pg_temp.member_intake_department_catalog as catalog
    on catalog.department_code = departments.code
  where departments.is_active
    and catalog.department_code is null;

  if missing_codes is not null then
    raise exception
      'Active departments are missing reviewed short codes: %.',
      missing_codes;
  end if;

  select string_agg(duplicates.normalized_short_code, ', ' order by duplicates.normalized_short_code)
  into duplicate_codes
  from (
    select lower(catalog.short_code) as normalized_short_code
    from pg_temp.member_intake_department_catalog as catalog
    group by lower(catalog.short_code)
    having count(*) > 1
  ) as duplicates;

  if duplicate_codes is not null then
    raise exception
      'The reviewed department catalog contains duplicate short codes: %.',
      duplicate_codes;
  end if;
end
$catalog_preflight$;

alter table public.departments
  add column if not exists short_code text;

update public.departments as departments
set short_code = catalog.short_code
from pg_temp.member_intake_department_catalog as catalog
where catalog.department_code = departments.code
  and departments.short_code is distinct from catalog.short_code;

do $short_code_preflight$
declare
  unmapped_codes text;
begin
  select string_agg(departments.code, ', ' order by departments.code)
  into unmapped_codes
  from public.departments as departments
  where departments.short_code is null;

  if unmapped_codes is not null then
    raise exception
      'Departments are missing reviewed short codes and cannot be made mandatory: %.',
      unmapped_codes;
  end if;
end
$short_code_preflight$;

alter table public.departments
  drop constraint if exists departments_short_code_format_check,
  add constraint departments_short_code_format_check check (
    short_code = upper(short_code)
    and short_code ~ '^[A-Z][A-Z0-9]{1,9}$'
  ),
  alter column short_code set not null;

create unique index if not exists departments_short_code_ci_unique
  on public.departments (lower(short_code));

create table public.department_aliases (
  department_code text not null references public.departments(code) on delete cascade,
  alias text not null,
  normalized_alias text generated always as (
    lower(regexp_replace(btrim(alias), '[[:space:]]+', ' ', 'g'))
  ) stored,
  alias_kind text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint department_aliases_alias_not_blank_check check (btrim(alias) <> ''),
  constraint department_aliases_alias_kind_check check (
    alias_kind = any (array['short_code', 'full_name', 'legacy_slug', 'historical'])
  ),
  constraint department_aliases_normalized_alias_key primary key (normalized_alias)
);

create index department_aliases_department_active_idx
  on public.department_aliases (department_code, is_active, normalized_alias);

create trigger department_aliases_set_updated_at
before update on public.department_aliases
for each row execute function public.set_current_timestamp_updated_at();

create temporary table pg_temp.member_intake_department_alias_candidates (
  department_code text not null,
  alias text not null,
  alias_kind text not null,
  kind_priority integer not null
) on commit drop;

insert into pg_temp.member_intake_department_alias_candidates (
  department_code,
  alias,
  alias_kind,
  kind_priority
)
select catalog.department_code, catalog.short_code, 'short_code', 10
from pg_temp.member_intake_department_catalog as catalog
union all
select catalog.department_code, catalog.official_name, 'full_name', 20
from pg_temp.member_intake_department_catalog as catalog
union all
select catalog.department_code, catalog.department_code, 'legacy_slug', 30
from pg_temp.member_intake_department_catalog as catalog
union all
select departments.code, departments.name, 'historical', 40
from public.departments as departments
join pg_temp.member_intake_department_catalog as catalog
  on catalog.department_code = departments.code
where lower(regexp_replace(btrim(departments.name), '[[:space:]]+', ' ', 'g'))
  <> lower(regexp_replace(btrim(catalog.official_name), '[[:space:]]+', ' ', 'g'))
union all
select aliases.department_code, aliases.alias, 'historical', 50
from (
  values
    ('accounting-information-system', 'Accounting and Information Systems'),
    ('accounting-information-system', 'Accounting and Information System'),
    ('biochemistry-molecular-biology', 'Biochemistry and Molecular Biology'),
    ('computer-science-engineering', 'Computer Science and Engineering'),
    ('film-television', 'Film and Television'),
    ('genetic-engineering-biotechnology', 'Genetic Engineering and Biotechnology'),
    ('genetic-engineering-biotechnology', 'GEB'),
    ('geography-environment', 'Geography and Environment'),
    ('institute-of-education-and-research', 'Institute of Education and Research'),
    ('islamic-history-culture', 'Islamic History and Culture'),
    ('land-management-law', 'Land Management and Law'),
    ('mass-communication-journalism', 'Mass Communication and Journalism'),
    ('public-administration', 'PAd')
) as aliases(department_code, alias);

do $alias_preflight$
declare
  ambiguous_aliases text;
begin
  select string_agg(conflicts.normalized_alias, ', ' order by conflicts.normalized_alias)
  into ambiguous_aliases
  from (
    select lower(regexp_replace(btrim(candidates.alias), '[[:space:]]+', ' ', 'g'))
      as normalized_alias
    from pg_temp.member_intake_department_alias_candidates as candidates
    group by lower(regexp_replace(btrim(candidates.alias), '[[:space:]]+', ' ', 'g'))
    having count(distinct candidates.department_code) > 1
  ) as conflicts;

  if ambiguous_aliases is not null then
    raise exception
      'One normalized alias maps to multiple departments: %.',
      ambiguous_aliases;
  end if;
end
$alias_preflight$;

insert into public.department_aliases (
  department_code,
  alias,
  alias_kind
)
select distinct on (
  lower(regexp_replace(btrim(candidates.alias), '[[:space:]]+', ' ', 'g'))
)
  candidates.department_code,
  candidates.alias,
  candidates.alias_kind
from pg_temp.member_intake_department_alias_candidates as candidates
order by
  lower(regexp_replace(btrim(candidates.alias), '[[:space:]]+', ' ', 'g')),
  candidates.kind_priority,
  candidates.alias
on conflict (normalized_alias) do update
set department_code = excluded.department_code,
    alias = excluded.alias,
    alias_kind = excluded.alias_kind,
    is_active = true,
    updated_at = timezone('utc', now());

alter table public.members
  add column if not exists joined_on date;

do $batch_preflight$
declare
  invalid_batch_count bigint;
  invalid_batch_values text;
begin
  select
    count(*),
    string_agg(distinct members.batch_no::text, ', ' order by members.batch_no::text)
  into invalid_batch_count, invalid_batch_values
  from public.members as members
  where members.batch_no is not null
    and members.batch_no not between 1 and 99;

  if invalid_batch_count > 0 then
    raise exception
      'Members contain batch numbers outside 1 through 99: % row(s), values [%].',
      invalid_batch_count,
      invalid_batch_values;
  end if;
end
$batch_preflight$;

alter table public.members
  drop constraint if exists members_batch_no_check,
  add constraint members_batch_no_check check (
    batch_no is null
    or batch_no between 1 and 99
  );

alter table public.bulk_operations
  drop constraint if exists bulk_operations_source_kind_check,
  add constraint bulk_operations_source_kind_check check (
    source_kind is null
    or source_kind = any (array['manual', 'csv', 'xlsx', 'pasted_tsv', 'google_sheet'])
  );

alter table public.department_aliases enable row level security;

create policy "department aliases operator read"
on public.department_aliases
for select
to authenticated
using (
  (select public.has_permission('admin.membership.manage'))
  or (select public.has_permission('admin.committee.manage'))
);

create policy "department aliases operator insert"
on public.department_aliases
for insert
to authenticated
with check (
  (select public.has_permission('admin.membership.manage'))
  or (select public.has_permission('admin.committee.manage'))
);

create policy "department aliases operator update"
on public.department_aliases
for update
to authenticated
using (
  (select public.has_permission('admin.membership.manage'))
  or (select public.has_permission('admin.committee.manage'))
)
with check (
  (select public.has_permission('admin.membership.manage'))
  or (select public.has_permission('admin.committee.manage'))
);

create policy "department aliases operator delete"
on public.department_aliases
for delete
to authenticated
using (
  (select public.has_permission('admin.membership.manage'))
  or (select public.has_permission('admin.committee.manage'))
);

revoke all privileges on table public.department_aliases from public, anon, authenticated;
grant select, insert, update, delete on table public.department_aliases to authenticated;
grant all privileges on table public.department_aliases to service_role;

notify pgrst, 'reload schema';

commit;
