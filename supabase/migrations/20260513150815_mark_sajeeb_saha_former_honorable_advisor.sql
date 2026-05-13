-- Dr. Sajeeb Saha (JNUITS-RA0001) has left the current Honorable Advisor
-- panel. Keep the advisor identity public, but render it through the former
-- advisor history instead of the current advisor board.

insert into public.advisor_profiles (
  advisor_jnuits_id,
  advisor_type,
  full_name,
  is_current,
  is_public,
  former_title,
  status_note
)
values (
  'JNUITS-RA0001',
  'honorable_advisor',
  'Dr. Sajeeb Saha',
  false,
  true,
  'Former Honorable Advisor',
  null
)
on conflict (advisor_jnuits_id) do update
set
  advisor_type = 'honorable_advisor',
  is_current = false,
  is_public = true,
  former_title = coalesce(
    nullif(public.advisor_profiles.former_title, ''),
    'Former Honorable Advisor'
  ),
  tenure_display = case
    when public.advisor_profiles.tenure_display ilike '%present%' then null
    else public.advisor_profiles.tenure_display
  end,
  status_note = case
    when public.advisor_profiles.status_note is null
      or btrim(public.advisor_profiles.status_note) = ''
      or lower(public.advisor_profiles.status_note) like '%migrated%'
      or lower(public.advisor_profiles.status_note) like '%legacy advisory roster%'
      or lower(public.advisor_profiles.status_note) like '%legacy roster%'
      or lower(public.advisor_profiles.status_note) like '%advisory roster%'
    then null
    else public.advisor_profiles.status_note
  end,
  updated_at = timezone('utc', now());
