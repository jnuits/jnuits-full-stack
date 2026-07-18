-- Local migration only. Do not apply to any Supabase project without explicit
-- approval, pre-production migration parity, and RLS/advisor verification.

begin;

alter table public.form_submissions
  add column if not exists event_registration_id uuid
    references public.event_registrations(id) on delete restrict;

create unique index if not exists form_submissions_event_registration_unique_idx
  on public.form_submissions (event_registration_id)
  where event_registration_id is not null;

create index if not exists form_submissions_event_registration_created_idx
  on public.form_submissions (event_registration_id, created_at desc)
  where event_registration_id is not null;

create or replace function public.register_for_event_with_form_atomic(
  p_event_id uuid,
  p_legacy_event_post_id uuid,
  p_member_id uuid,
  p_registrant_name text,
  p_registrant_email text,
  p_registrant_phone text,
  p_form_definition_id uuid,
  p_form_version_id uuid,
  p_answers jsonb
)
returns table(result_status text, registration_code text)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_definition public.form_definitions%rowtype;
  v_event public.events%rowtype;
  v_existing public.event_registrations%rowtype;
  v_inserted public.event_registrations%rowtype;
  v_confirmed_count integer := 0;
  v_email text := lower(trim(coalesce(p_registrant_email, '')));
  v_name text := trim(coalesce(p_registrant_name, ''));
  v_now timestamptz := clock_timestamp();
  v_status text := 'confirmed';
begin
  if p_event_id is null
    or p_form_definition_id is null
    or p_form_version_id is null
    or coalesce(jsonb_typeof(p_answers), '') <> 'object'
    or v_email = ''
    or v_name = '' then
    return query select 'invalid'::text, null::text;
    return;
  end if;

  -- Lock form definition before its linked event. This matches publish flow and
  -- keeps a publish from changing the linked version mid-registration.
  select *
  into v_definition
  from public.form_definitions
  where id = p_form_definition_id
    and kind = 'event_registration'
    and lifecycle = 'published'
    and linked_event_id = p_event_id
    and current_published_version_id = p_form_version_id
  for key share;

  if not found then
    return query select 'invalid'::text, null::text;
    return;
  end if;

  perform 1
  from public.form_versions
  where id = p_form_version_id
    and form_definition_id = v_definition.id
    and lifecycle = 'published'
  for key share;

  if not found then
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

  if v_event.registration_form_version_id is distinct from p_form_version_id
    or v_event.registration_mode <> 'internal'
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

  insert into public.form_submissions (
    event_registration_id,
    form_definition_id,
    form_version_id,
    submitter_email,
    answers,
    source_metadata,
    confirmation_status,
    review_status
  )
  values (
    v_inserted.id,
    p_form_definition_id,
    p_form_version_id,
    v_email,
    p_answers,
    jsonb_build_object('event_id', p_event_id, 'source', 'event_registration'),
    'not_required',
    'unreviewed'
  );

  return query select v_status, v_inserted.registration_code;
end;
$function$;

revoke all on function public.register_for_event_with_form_atomic(
  uuid, uuid, uuid, text, text, text, uuid, uuid, jsonb
) from public;
revoke all on function public.register_for_event_with_form_atomic(
  uuid, uuid, uuid, text, text, text, uuid, uuid, jsonb
) from anon;
revoke all on function public.register_for_event_with_form_atomic(
  uuid, uuid, uuid, text, text, text, uuid, uuid, jsonb
) from authenticated;
grant execute on function public.register_for_event_with_form_atomic(
  uuid, uuid, uuid, text, text, text, uuid, uuid, jsonb
) to service_role;

commit;
