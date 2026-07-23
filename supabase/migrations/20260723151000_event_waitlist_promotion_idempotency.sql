-- Local-only until explicit migration approval. Make waitlist promotion
-- transactionally audited and safe to retry without consuming another seat.

begin;

create or replace function public.promote_event_waitlist_registration(
  p_event_id uuid,
  p_registration_id uuid,
  p_actor_user_id uuid
)
returns table(result_status text, registration_code text)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_event public.events%rowtype;
  v_registration public.event_registrations%rowtype;
  v_confirmed_count integer := 0;
  v_now timestamptz := clock_timestamp();
begin
  if p_event_id is null or p_registration_id is null or p_actor_user_id is null then
    return query select 'invalid'::text, null::text;
    return;
  end if;

  -- Registration and promotion take the same event row lock as public intake,
  -- serializing capacity decisions for this event.
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

  if not found then
    return query select 'not_found'::text, null::text;
    return;
  end if;

  -- A successful retry is idempotent. It returns the original opaque code and
  -- does not write another audit event or alter capacity.
  if v_registration.registration_status = 'confirmed'
    and v_registration.cancelled_at is null
    and v_registration.promoted_at is not null
  then
    return query select 'promoted'::text, v_registration.registration_code;
    return;
  end if;

  if v_registration.cancelled_at is not null
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
  set promoted_at = v_now,
      promoted_by_user_id = p_actor_user_id,
      registration_status = 'confirmed'
  where id = p_registration_id;

  insert into public.audit_events (
    action,
    actor_user_id,
    entity_id,
    entity_type,
    metadata
  )
  values (
    'event.waitlist_promoted',
    p_actor_user_id,
    p_registration_id,
    'event_registration',
    jsonb_build_object(
      'event_id', p_event_id,
      'registration_code', v_registration.registration_code
    )
  );

  return query select 'promoted'::text, v_registration.registration_code;
end;
$function$;

revoke all on function public.promote_event_waitlist_registration(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.promote_event_waitlist_registration(uuid, uuid, uuid)
  to service_role;

commit;
