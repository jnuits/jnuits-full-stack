-- Preserve Dr. Uzzal Kumar Acharjee's former Moderator/Mentor history while
-- adding his current Honorable Advisor identity for the public advisor board.
-- This is intentionally a separate advisor profile because advisor_type is a
-- profile-level current role, not a role-history table.

do $$
declare
  existing_profile_id uuid;
  next_advisor_id text := 'JNUITS-RA0002';
begin
  select id
  into existing_profile_id
  from public.advisor_profiles
  where advisor_type = 'honorable_advisor'
    and lower(full_name) like '%uzzal kumar acharjee%'
  order by sort_order asc
  limit 1;

  if existing_profile_id is null then
    if exists (
      select 1
      from public.advisor_profiles
      where advisor_jnuits_id = next_advisor_id
        and lower(full_name) not like '%uzzal kumar acharjee%'
    ) then
      select 'JNUITS-RA' ||
        lpad(
          (
            coalesce(max((substring(advisor_jnuits_id from 'RA([0-9]{4})$'))::integer), 0) + 1
          )::text,
          4,
          '0'
        )
      into next_advisor_id
      from public.advisor_profiles
      where advisor_jnuits_id ~ '^JNUITS-RA[0-9]{4}$';
    end if;

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
    values (
      next_advisor_id,
      'honorable_advisor',
      'Uzzal Kumar Acharjee',
      'Dr.',
      'Professor',
      'Department of Computer Science & Engineering',
      'uzzal@cse.jnu.ac.bd',
      '01625099037',
      date '2025-07-07',
      null,
      true,
      true,
      35,
      null,
      '2025 - Present',
      'estimated',
      'Former Moderator / Mentor; currently serving as Honorable Advisor.',
      'https://profile.jnu.ac.bd/portal/show/10155',
      'Professor, Department of Computer Science & Engineering, Jagannath University.'
    );
  else
    update public.advisor_profiles
    set
      advisor_type = 'honorable_advisor',
      title = 'Dr.',
      designation = 'Professor',
      department = 'Department of Computer Science & Engineering',
      email = 'uzzal@cse.jnu.ac.bd',
      phone = '01625099037',
      joined_on = coalesce(joined_on, date '2025-07-07'),
      left_on = null,
      is_current = true,
      is_public = true,
      sort_order = least(sort_order, 35),
      former_title = null,
      tenure_display = coalesce(tenure_display, '2025 - Present'),
      date_confidence = 'estimated',
      status_note = 'Former Moderator / Mentor; currently serving as Honorable Advisor.',
      jnu_profile_url = 'https://profile.jnu.ac.bd/portal/show/10155',
      bio = coalesce(
        nullif(bio, ''),
        'Professor, Department of Computer Science & Engineering, Jagannath University.'
      )
    where id = existing_profile_id;
  end if;
end
$$;

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
