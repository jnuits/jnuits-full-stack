-- Event operations: capacity-safe waitlist state and staff promotion.
-- Local migration only. Do not apply to a live project without approval.

begin;

alter table public.events
  add column if not exists waitlist_enabled boolean not null default true;

alter table public.event_registrations
  add column if not exists registration_status text not null default 'confirmed',
  add column if not exists waitlisted_at timestamptz,
  add column if not exists promoted_at timestamptz,
  add column if not exists promoted_by_user_id uuid references auth.users(id) on delete set null;

alter table public.event_registrations
  drop constraint if exists event_registrations_registration_status_check,
  add constraint event_registrations_registration_status_check
    check (registration_status in ('confirmed', 'waitlisted', 'cancelled'));

update public.event_registrations
set registration_status = case
  when cancelled_at is not null then 'cancelled'
  else 'confirmed'
end
where registration_status is null
   or (cancelled_at is not null and registration_status <> 'cancelled');

create index if not exists event_registrations_confirmed_capacity_idx
  on public.event_registrations (event_id, created_at)
  where registration_status = 'confirmed' and cancelled_at is null;

create index if not exists event_registrations_waitlist_queue_idx
  on public.event_registrations (event_id, waitlisted_at, created_at)
  where registration_status = 'waitlisted' and cancelled_at is null;

create or replace function public.register_for_event_atomic(
  p_event_id uuid,
  p_legacy_event_post_id uuid,
  p_member_id uuid,
  p_registrant_name text,
  p_registrant_email text,
  p_registrant_phone text
)
returns table(result_status text, registration_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
  v_existing public.event_registrations%rowtype;
  v_inserted public.event_registrations%rowtype;
  v_confirmed_count integer := 0;
  v_email text := lower(trim(coalesce(p_registrant_email, '')));
  v_name text := trim(coalesce(p_registrant_name, ''));
  v_now timestamptz := clock_timestamp();
  v_status text := 'confirmed';
begin
  if p_event_id is null or v_email = '' or v_name = '' then
    return query select 'invalid'::text, null::text;
    return;
  end if;

  select *
  into v_event
  from public.events
  where id = p_event_id
  for update;

  if not found or v_event.status <> 'published' then
    return query select 'not_found'::text, null::text;
    return;
  end if;

  if v_event.registration_mode <> 'internal'
    or not v_event.registration_open
    or (v_event.registration_closes_at is not null and v_event.registration_closes_at <= v_now)
    or (v_event.ends_at is not null and v_event.ends_at < v_now)
  then
    return query select 'closed'::text, null::text;
    return;
  end if;

  select *
  into v_existing
  from public.event_registrations
  where event_id = p_event_id
    and lower(registrant_email::text) = v_email
    and cancelled_at is null
    and registration_status <> 'cancelled'
  limit 1;

  if found then
    return query select 'duplicate'::text, v_existing.registration_code;
    return;
  end if;

  if v_event.capacity is not null then
    select count(*)::integer
    into v_confirmed_count
    from public.event_registrations
    where event_id = p_event_id
      and cancelled_at is null
      and registration_status = 'confirmed';

    if v_confirmed_count >= v_event.capacity then
      if not v_event.waitlist_enabled then
        return query select 'full'::text, null::text;
        return;
      end if;

      v_status := 'waitlisted';
    end if;
  end if;

  insert into public.event_registrations (
    event_id,
    event_post_id,
    member_id,
    registrant_email,
    registrant_name,
    registrant_phone,
    registration_status,
    waitlisted_at
  )
  values (
    p_event_id,
    coalesce(p_legacy_event_post_id, v_event.legacy_content_post_id),
    p_member_id,
    v_email,
    v_name,
    nullif(trim(coalesce(p_registrant_phone, '')), ''),
    v_status,
    case when v_status = 'waitlisted' then v_now else null end
  )
  returning *
  into v_inserted;

  return query select v_status, v_inserted.registration_code;
end;
$$;

create or replace function public.promote_event_waitlist_registration(
  p_event_id uuid,
  p_registration_id uuid,
  p_actor_user_id uuid
)
returns table(result_status text, registration_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
  v_registration public.event_registrations%rowtype;
  v_confirmed_count integer := 0;
  v_now timestamptz := clock_timestamp();
begin
  select *
  into v_event
  from public.events
  where id = p_event_id
  for update;

  if not found then
    return query select 'not_found'::text, null::text;
    return;
  end if;

  select *
  into v_registration
  from public.event_registrations
  where id = p_registration_id
    and event_id = p_event_id
  for update;

  if not found
    or v_registration.cancelled_at is not null
    or v_registration.registration_status <> 'waitlisted'
  then
    return query select 'not_waitlisted'::text, null::text;
    return;
  end if;

  if v_event.capacity is not null then
    select count(*)::integer
    into v_confirmed_count
    from public.event_registrations
    where event_id = p_event_id
      and cancelled_at is null
      and registration_status = 'confirmed';

    if v_confirmed_count >= v_event.capacity then
      return query select 'full'::text, null::text;
      return;
    end if;
  end if;

  update public.event_registrations
  set
    promoted_at = v_now,
    promoted_by_user_id = p_actor_user_id,
    registration_status = 'confirmed'
  where id = p_registration_id;

  return query select 'promoted'::text, v_registration.registration_code;
end;
$$;

-- Existing event cards use this aggregate for capacity and remaining spots.
-- A waitlist entry is not a confirmed seat and must not reduce availability.
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
      and registration.registration_status = 'confirmed'
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
      and registration.registration_status = 'confirmed'
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

revoke all on function public.register_for_event_atomic(uuid, uuid, uuid, text, text, text) from public;
revoke all on function public.register_for_event_atomic(uuid, uuid, uuid, text, text, text) from anon;
revoke all on function public.register_for_event_atomic(uuid, uuid, uuid, text, text, text) from authenticated;
grant execute on function public.register_for_event_atomic(uuid, uuid, uuid, text, text, text) to service_role;

revoke all on function public.promote_event_waitlist_registration(uuid, uuid, uuid) from public;
revoke all on function public.promote_event_waitlist_registration(uuid, uuid, uuid) from anon;
revoke all on function public.promote_event_waitlist_registration(uuid, uuid, uuid) from authenticated;
grant execute on function public.promote_event_waitlist_registration(uuid, uuid, uuid) to service_role;

revoke all on function public.get_event_registration_counts(uuid[]) from public;
revoke all on function public.get_event_registration_counts(uuid[]) from anon;
revoke all on function public.get_event_registration_counts(uuid[]) from authenticated;
grant execute on function public.get_event_registration_counts(uuid[]) to service_role;

commit;
