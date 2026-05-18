-- Remove the non-JnUITS "Main Advisor" wording from public-facing advisor labels.
-- The internal advisor_type value remains "main_advisor" for compatibility.

update public.advisor_profiles
set
  former_title = case
    when former_title = 'Former Acting Chief Advisor / Main Advisor' then 'Acting Chief Advisor'
    when former_title = 'Former Chief Advisor / Main Advisor' then 'Chief Advisor'
    else replace(former_title, ' / Main Advisor', '')
  end,
  updated_at = timezone('utc', now())
where former_title ilike '%Main Advisor%';

update public.committee_roles
set
  title = 'Chief Advisor',
  aliases = array_remove(coalesce(aliases, array[]::text[]), 'Main Advisor'),
  updated_at = timezone('utc', now())
where code = 'chief-advisor'
   or title ilike '%Main Advisor%';
