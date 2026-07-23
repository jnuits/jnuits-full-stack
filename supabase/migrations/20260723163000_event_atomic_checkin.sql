-- Local-only until explicit migration approval. Make manual and scanner check-in
-- idempotent, event-scoped, and transactionally audited.

begin;

create or replace function public.check_in_event_registration(
  p_event_id uuid,
  p_registration_code text,
  p_actor_user_id uuid
)
returns table (
  result_status text,
  registration_id uuid,
  checked_in_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_registration public.event_registrations%rowtype;
  v_checked_in_at timestamptz := clock_timestamp();
  v_code text := upper(trim(coalesce(p_registration_code, '')));
begin
  if p_event_id is null or p_actor_user_id is null or v_code !~ '^[A-Z0-9]{4,20}$' then
    return query select 'invalid'::text, null::uuid, null::timestamptz;
    return;
  end if;

  select *
  into v_registration
  from public.event_registrations
  where event_id = p_event_id
    and registration_code = v_code
  for update;

  if not found then
    return query select 'not_found'::text, null::uuid, null::timestamptz;
    return;
  end if;

  if v_registration.cancelled_at is not null
    or v_registration.registration_status = 'cancelled'
  then
    return query select 'cancelled'::text, v_registration.id, null::timestamptz;
    return;
  end if;

  if v_registration.registration_status = 'waitlisted' then
    return query select 'waitlisted'::text, v_registration.id, null::timestamptz;
    return;
  end if;

  if v_registration.checked_in_at is not null then
    return query select 'already_checked_in'::text, v_registration.id,
      v_registration.checked_in_at;
    return;
  end if;

  update public.event_registrations
  set checked_in_at = v_checked_in_at
  where id = v_registration.id;

  insert into public.audit_events (
    action,
    actor_user_id,
    entity_id,
    entity_type,
    metadata
  )
  values (
    'event.registration_checked_in',
    p_actor_user_id,
    v_registration.id,
    'event_registration',
    jsonb_build_object('event_id', p_event_id, 'registration_code', v_code)
  );

  return query select 'checked_in'::text, v_registration.id, v_checked_in_at;
end;
$function$;

revoke all on function public.check_in_event_registration(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.check_in_event_registration(uuid, text, uuid)
  to service_role;

commit;
