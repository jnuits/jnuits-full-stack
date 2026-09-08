-- Compute member-directory counters and filter facets in one indexed database
-- query. The web tier previously issued one count request per department,
-- multiplying latency and database load as the department catalogue grew.

begin;

create or replace function public.get_member_directory_facets(
  p_can_view_members_only boolean,
  p_search text,
  p_letter text,
  p_department text,
  p_type text
)
returns table (
  facet_group text,
  facet_key text,
  item_count bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  with eligible as (
    select
      m.department_code,
      m.full_name,
      m.jnuits_id,
      m.member_type
    from public.members m
    where m.lifecycle_status in ('current', 'alumni')
      and m.portal_access_status = 'active'
      and m.jnuits_id not ilike 'JNUITS-ADMIN-%'
      and (
        m.professional_visibility = 'public'
        or (
          p_can_view_members_only
          and (
            m.professional_visibility = 'members-only'
            or m.professional_visibility is null
          )
        )
      )
  ), text_filtered as (
    select *
    from eligible e
    where (
        coalesce(p_letter, '') = ''
        or e.full_name ilike p_letter || '%'
      )
      and (
        coalesce(p_search, '') = ''
        or e.full_name ilike '%' || p_search || '%'
        or e.jnuits_id ilike '%' || p_search || '%'
      )
  )
  select 'counter', 'all', count(*) from eligible
  union all
  select 'counter', 'current', count(*)
    from eligible where member_type = 'current'
  union all
  select 'counter', 'alumni', count(*)
    from eligible where member_type = 'alumni'
  union all
  select 'type', 'all', count(*)
    from text_filtered
    where coalesce(p_department, '') = ''
       or department_code = p_department
  union all
  select 'type', 'current', count(*)
    from text_filtered
    where (coalesce(p_department, '') = '' or department_code = p_department)
      and member_type = 'current'
  union all
  select 'type', 'alumni', count(*)
    from text_filtered
    where (coalesce(p_department, '') = '' or department_code = p_department)
      and member_type = 'alumni'
  union all
  select 'department', department_code, count(*)
    from text_filtered
    where department_code is not null
      and (coalesce(p_type, 'all') = 'all' or member_type = p_type)
    group by department_code;
$$;

revoke execute on function public.get_member_directory_facets(
  boolean, text, text, text, text
) from public, anon, authenticated;

grant execute on function public.get_member_directory_facets(
  boolean, text, text, text, text
) to service_role;

notify pgrst, 'reload schema';

commit;
