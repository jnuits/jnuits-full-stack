-- Server-only aggregate for event lists and details. This avoids returning
-- registration rows (and their PII) merely to calculate capacity state.

begin;

grant usage on schema public to service_role;
grant select on table public.events to service_role;
grant select on table public.event_registrations to service_role;

create or replace function public.get_event_registration_counts(
  p_event_ids uuid[]
)
returns table (
  event_id uuid,
  registration_count integer
)
language sql
stable
security invoker
set search_path = ''
as $$
  with selected_events as (
    select event.id, event.legacy_content_post_id
    from public.events as event
    join (
      select distinct unnest(
        coalesce(p_event_ids, array[]::uuid[])
      ) as id
    ) as requested
      on requested.id = event.id
  ),
  registration_counts as (
    select
      registration.event_id,
      count(*)::integer as registration_count
    from public.event_registrations as registration
    join selected_events as event
      on event.id = registration.event_id
    where registration.cancelled_at is null
    group by registration.event_id

    union all

    select
      event.id as event_id,
      count(*)::integer as registration_count
    from public.event_registrations as registration
    join selected_events as event
      on event.legacy_content_post_id = registration.event_post_id
    where registration.event_id is null
      and registration.cancelled_at is null
    group by event.id
  )
  select
    event.id as event_id,
    coalesce(sum(counts.registration_count), 0)::integer as registration_count
  from selected_events as event
  left join registration_counts as counts
    on counts.event_id = event.id
  group by event.id;
$$;

revoke all on function public.get_event_registration_counts(uuid[]) from public;
revoke all on function public.get_event_registration_counts(uuid[]) from anon;
revoke all on function public.get_event_registration_counts(uuid[]) from authenticated;
grant execute on function public.get_event_registration_counts(uuid[]) to service_role;

notify pgrst, 'reload schema';

commit;
