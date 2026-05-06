alter table public.advisor_profiles
  add column if not exists advisor_jnuits_id text,
  add column if not exists former_title text,
  add column if not exists tenure_display text,
  add column if not exists date_confidence text not null default 'verified',
  add column if not exists status_note text,
  add column if not exists jnu_profile_url text;

alter table public.advisor_profiles
  drop constraint if exists advisor_profiles_advisor_jnuits_id_format_check,
  add constraint advisor_profiles_advisor_jnuits_id_format_check
    check (
      advisor_jnuits_id is null
      or (
        advisor_jnuits_id = upper(advisor_jnuits_id)
        and advisor_jnuits_id ~ '^JNUITS-(CA|MOD|RA)[0-9]{4}$'
      )
    ),
  drop constraint if exists advisor_profiles_advisor_id_type_check,
  add constraint advisor_profiles_advisor_id_type_check
    check (
      advisor_jnuits_id is null
      or (
        (advisor_type = 'main_advisor' and advisor_jnuits_id ~ '^JNUITS-CA[0-9]{4}$')
        or (advisor_type = 'moderator_mentor' and advisor_jnuits_id ~ '^JNUITS-MOD[0-9]{4}$')
        or (advisor_type = 'honorable_advisor' and advisor_jnuits_id ~ '^JNUITS-RA[0-9]{4}$')
      )
    ),
  drop constraint if exists advisor_profiles_date_confidence_check,
  add constraint advisor_profiles_date_confidence_check
    check (date_confidence = any (array['verified', 'estimated']));

alter table public.advisor_profiles
  drop constraint if exists advisor_profiles_advisor_jnuits_id_key;
drop index if exists public.advisor_profiles_advisor_jnuits_id_key;
alter table public.advisor_profiles
  add constraint advisor_profiles_advisor_jnuits_id_key unique (advisor_jnuits_id);

create index if not exists advisor_profiles_type_current_idx
  on public.advisor_profiles (advisor_type, is_current, is_public, sort_order, full_name);

create index if not exists advisor_profiles_public_history_idx
  on public.advisor_profiles (is_public, advisor_type, left_on desc, joined_on desc)
  where is_public = true;

create sequence if not exists public.advisor_ca_id_seq;
create sequence if not exists public.advisor_mod_id_seq;
create sequence if not exists public.advisor_ra_id_seq;

create or replace function public.assign_advisor_jnuits_id()
returns trigger
language plpgsql
as $$
declare
  next_num bigint;
  prefix text;
  sequence_name text;
begin
  if new.advisor_type = 'main_advisor' then
    prefix := 'CA';
    sequence_name := 'public.advisor_ca_id_seq';
  elsif new.advisor_type = 'moderator_mentor' then
    prefix := 'MOD';
    sequence_name := 'public.advisor_mod_id_seq';
  else
    prefix := 'RA';
    sequence_name := 'public.advisor_ra_id_seq';
  end if;

  if new.advisor_jnuits_id is null or btrim(new.advisor_jnuits_id) = '' then
    execute format('select nextval(%L)', sequence_name) into next_num;
    new.advisor_jnuits_id := 'JNUITS-' || prefix || lpad(next_num::text, 4, '0');
  else
    new.advisor_jnuits_id := upper(btrim(new.advisor_jnuits_id));
  end if;

  if new.left_on is not null then
    new.is_current := false;
  end if;

  return new;
end;
$$;

revoke all on function public.assign_advisor_jnuits_id() from public;

drop trigger if exists advisor_profiles_assign_advisor_jnuits_id on public.advisor_profiles;
create trigger advisor_profiles_assign_advisor_jnuits_id
before insert or update of advisor_jnuits_id, advisor_type, left_on
on public.advisor_profiles
for each row
execute function public.assign_advisor_jnuits_id();

update public.advisor_profiles
set advisor_jnuits_id = 'JNUITS-CA0001'
where advisor_jnuits_id is null
  and advisor_type = 'main_advisor'
  and lower(full_name) like '%mijanur%';

update public.advisor_profiles
set advisor_jnuits_id = 'JNUITS-CA0002'
where advisor_jnuits_id is null
  and advisor_type = 'main_advisor'
  and lower(full_name) like '%kamaluddin%';

update public.advisor_profiles
set advisor_jnuits_id = 'JNUITS-CA0003'
where advisor_jnuits_id is null
  and advisor_type = 'main_advisor'
  and lower(full_name) like '%imdadul%';

update public.advisor_profiles
set advisor_jnuits_id = 'JNUITS-CA0004'
where advisor_jnuits_id is null
  and advisor_type = 'main_advisor'
  and lower(full_name) like '%sadeka%';

update public.advisor_profiles
set advisor_jnuits_id = 'JNUITS-CA0005'
where advisor_jnuits_id is null
  and advisor_type = 'main_advisor'
  and lower(full_name) like '%rezaul%';

update public.advisor_profiles
set advisor_jnuits_id = 'JNUITS-CA0006'
where advisor_jnuits_id is null
  and advisor_type = 'main_advisor'
  and lower(full_name) like '%rais%';

update public.advisor_profiles
set advisor_jnuits_id = 'JNUITS-MOD0001'
where advisor_jnuits_id is null
  and advisor_type = 'moderator_mentor'
  and lower(full_name) like '%uzzal%';

update public.advisor_profiles
set advisor_jnuits_id = 'JNUITS-MOD0002'
where advisor_jnuits_id is null
  and advisor_type = 'moderator_mentor'
  and lower(full_name) like '%layek%';

insert into public.advisor_profiles (
  advisor_jnuits_id,
  advisor_type,
  full_name,
  title,
  designation,
  department,
  email,
  phone,
  joined_on,
  left_on,
  is_current,
  is_public,
  sort_order,
  former_title,
  tenure_display,
  date_confidence,
  status_note,
  jnu_profile_url,
  bio
)
values
  ('JNUITS-CA0001', 'main_advisor', 'Mijanur Rahman', 'Professor Dr.', 'Vice Chancellor, Jagannath University', null, null, null, date '2013-03-20', date '2021-03-19', false, true, 110, 'Former Chief Advisor / Main Advisor', 'March 20, 2013 - March 19, 2021', 'verified', 'Served two consecutive four-year terms as Vice Chancellor.', null, 'Chief Advisor by virtue of serving as Vice Chancellor of Jagannath University.'),
  ('JNUITS-CA0002', 'main_advisor', 'Kamaluddin Ahmed', 'Professor Dr.', 'Acting Vice Chancellor, Jagannath University', null, null, null, date '2021-03-20', date '2021-05-31', false, true, 120, 'Former Acting Chief Advisor / Main Advisor', 'March 20, 2021 - May 31, 2021', 'verified', 'Served as Acting Vice Chancellor while holding the University Treasurer office.', null, 'Acting Chief Advisor by virtue of serving as Acting Vice Chancellor of Jagannath University.'),
  ('JNUITS-CA0003', 'main_advisor', 'Md. Imdadul Hoque', 'Professor Dr.', 'Vice Chancellor, Jagannath University', null, null, null, date '2021-06-01', date '2023-11-11', false, true, 130, 'Former Chief Advisor / Main Advisor', 'June 1, 2021 - November 11, 2023', 'verified', 'Passed away while in office due to health complications.', null, 'Chief Advisor by virtue of serving as Vice Chancellor of Jagannath University.'),
  ('JNUITS-CA0004', 'main_advisor', 'Sadeka Halim', 'Professor Dr.', 'Vice Chancellor, Jagannath University', null, null, null, date '2023-11-30', date '2024-08-11', false, true, 140, 'Former Chief Advisor / Main Advisor', 'November 30, 2023 - August 11, 2024', 'verified', 'Resigned following the 2024 Bangladesh quota reform movement.', null, 'Chief Advisor by virtue of serving as Vice Chancellor of Jagannath University.'),
  ('JNUITS-CA0005', 'main_advisor', 'Md. Rezaul Karim', 'Professor Dr.', 'Vice Chancellor, Jagannath University', null, null, null, date '2024-09-18', date '2026-03-16', false, true, 150, 'Former Chief Advisor / Main Advisor', 'September 18, 2024 - March 16, 2026', 'verified', 'Appointed after the 2024 political transition and relieved of duties in early 2026.', null, 'Chief Advisor by virtue of serving as Vice Chancellor of Jagannath University.'),
  ('JNUITS-CA0006', 'main_advisor', 'Md. Rais Uddin', 'Professor Dr.', 'Vice Chancellor, Jagannath University', 'Department of Islamic Studies', null, null, date '2026-03-16', null, true, true, 10, null, 'March 16, 2026 - Present', 'verified', 'Current Vice Chancellor; previously a professor in the Department of Islamic Studies.', null, 'Current Chief Advisor by virtue of serving as Vice Chancellor of Jagannath University.'),
  ('JNUITS-MOD0001', 'moderator_mentor', 'Uzzal Kumar Acharjee', 'Dr.', 'Professor', 'Department of Computer Science & Engineering', 'uzzal@cse.jnu.ac.bd', '01625099037', date '2015-11-11', date '2025-07-07', false, true, 210, 'Former Moderator / Mentor', '2015 - 2025', 'estimated', 'First known Moderator / Mentor of JnU IT Society.', 'https://profile.jnu.ac.bd/portal/show/10155', 'Professor, Department of Computer Science & Engineering, Jagannath University.'),
  ('JNUITS-MOD0002', 'moderator_mentor', 'Md. Abu Layek', 'Dr.', 'Professor', 'Department of Computer Science & Engineering', 'layek@cse.jnu.ac.bd', '01841465733', date '2025-07-07', null, true, true, 20, null, '2025 - Present', 'estimated', 'Current Moderator / Mentor of JnU IT Society.', 'https://profile.jnu.ac.bd/portal/show/10160', 'Professor, Department of Computer Science & Engineering, Jagannath University.')
on conflict (advisor_jnuits_id) do update
set
  advisor_type = excluded.advisor_type,
  full_name = excluded.full_name,
  title = excluded.title,
  designation = excluded.designation,
  department = excluded.department,
  email = excluded.email,
  phone = excluded.phone,
  joined_on = excluded.joined_on,
  left_on = excluded.left_on,
  is_current = excluded.is_current,
  is_public = excluded.is_public,
  sort_order = excluded.sort_order,
  former_title = excluded.former_title,
  tenure_display = excluded.tenure_display,
  date_confidence = excluded.date_confidence,
  status_note = excluded.status_note,
  jnu_profile_url = excluded.jnu_profile_url,
  bio = excluded.bio,
  updated_at = timezone('utc', now());

with typed_missing as (
  select
    id,
    advisor_type,
    row_number() over (partition by advisor_type order by sort_order, created_at, id) as ordinal
  from public.advisor_profiles
  where advisor_jnuits_id is null
),
typed_offsets as (
  select
    advisor_type,
    coalesce(max((substring(advisor_jnuits_id from '(?:CA|MOD|RA)([0-9]{4})$'))::integer), 0) as max_number
  from public.advisor_profiles
  where advisor_jnuits_id is not null
  group by advisor_type
)
update public.advisor_profiles as advisors
set advisor_jnuits_id =
  case typed_missing.advisor_type
    when 'main_advisor' then 'JNUITS-CA' || lpad((coalesce(typed_offsets.max_number, 0) + typed_missing.ordinal)::text, 4, '0')
    when 'moderator_mentor' then 'JNUITS-MOD' || lpad((coalesce(typed_offsets.max_number, 0) + typed_missing.ordinal)::text, 4, '0')
    else 'JNUITS-RA' || lpad((coalesce(typed_offsets.max_number, 0) + typed_missing.ordinal)::text, 4, '0')
  end
from typed_missing
left join typed_offsets
  on typed_offsets.advisor_type = typed_missing.advisor_type
where advisors.id = typed_missing.id;

update public.advisor_profiles
set
  is_current = false,
  former_title = coalesce(former_title, 'Former Chief Advisor / Main Advisor'),
  tenure_display = coalesce(
    tenure_display,
    case
      when joined_on is not null and left_on is not null then to_char(joined_on, 'Mon DD, YYYY') || ' - ' || to_char(left_on, 'Mon DD, YYYY')
      when joined_on is not null then to_char(joined_on, 'Mon DD, YYYY') || ' - Former'
      else 'Former'
    end
  )
where advisor_type = 'main_advisor'
  and advisor_jnuits_id <> 'JNUITS-CA0006'
  and is_current = true;

update public.advisor_profiles
set
  is_current = false,
  former_title = coalesce(former_title, 'Former Moderator / Mentor'),
  tenure_display = coalesce(
    tenure_display,
    case
      when joined_on is not null and left_on is not null then to_char(joined_on, 'Mon DD, YYYY') || ' - ' || to_char(left_on, 'Mon DD, YYYY')
      when joined_on is not null then to_char(joined_on, 'Mon DD, YYYY') || ' - Former'
      else 'Former'
    end
  )
where advisor_type = 'moderator_mentor'
  and advisor_jnuits_id <> 'JNUITS-MOD0002'
  and is_current = true;

create unique index if not exists advisor_profiles_one_public_current_chief_idx
  on public.advisor_profiles (advisor_type)
  where advisor_type = 'main_advisor'
    and is_public = true
    and is_current = true;

create unique index if not exists advisor_profiles_one_public_current_moderator_idx
  on public.advisor_profiles (advisor_type)
  where advisor_type = 'moderator_mentor'
    and is_public = true
    and is_current = true;

select setval(
  'public.advisor_ca_id_seq',
  greatest(
    1,
    coalesce((
      select max((substring(advisor_jnuits_id from 'CA([0-9]{4})$'))::integer)
      from public.advisor_profiles
      where advisor_jnuits_id ~ '^JNUITS-CA[0-9]{4}$'
    ), 0)
  ),
  true
);

select setval(
  'public.advisor_mod_id_seq',
  greatest(
    1,
    coalesce((
      select max((substring(advisor_jnuits_id from 'MOD([0-9]{4})$'))::integer)
      from public.advisor_profiles
      where advisor_jnuits_id ~ '^JNUITS-MOD[0-9]{4}$'
    ), 0)
  ),
  true
);

select setval(
  'public.advisor_ra_id_seq',
  greatest(
    1,
    coalesce((
      select max((substring(advisor_jnuits_id from 'RA([0-9]{4})$'))::integer)
      from public.advisor_profiles
      where advisor_jnuits_id ~ '^JNUITS-RA[0-9]{4}$'
    ), 0)
  ),
  true
);

do $$
begin
  if not exists (
    select 1
    from public.advisor_profiles
    where advisor_jnuits_id = 'JNUITS-CA0006'
      and advisor_type = 'main_advisor'
      and is_current = true
      and is_public = true
  ) then
    raise exception 'Current Chief Advisor seed JNUITS-CA0006 is missing or not current/public.';
  end if;

  if not exists (
    select 1
    from public.advisor_profiles
    where advisor_jnuits_id = 'JNUITS-MOD0002'
      and advisor_type = 'moderator_mentor'
      and is_current = true
      and is_public = true
  ) then
    raise exception 'Current Moderator/Mentor seed JNUITS-MOD0002 is missing or not current/public.';
  end if;

  if (
    select count(*)
    from public.advisor_profiles
    where advisor_jnuits_id ~ '^JNUITS-CA[0-9]{4}$'
  ) < 6 then
    raise exception 'Expected at least six Chief Advisor identity records.';
  end if;

  if (
    select count(*)
    from public.advisor_profiles
    where advisor_jnuits_id ~ '^JNUITS-MOD[0-9]{4}$'
  ) < 2 then
    raise exception 'Expected at least two Moderator/Mentor identity records.';
  end if;
end
$$;
