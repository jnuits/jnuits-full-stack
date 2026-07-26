-- Forward-only migration. UNAPPLIED until explicit approval.
-- Repairs publish_form_version PL/pgSQL name ambiguity and reasserts
-- post-migration privileges without destructive DML.

begin;

-- Deliberate reassertion. These statements duplicate 20260723233000 and are
-- idempotent; they restore the intended privilege state if it was altered
-- manually in production after that migration ran, and they keep this file
-- self-contained for review.
alter table public.form_upload_sessions enable row level security;
revoke all on table public.form_upload_sessions from public, anon, authenticated;
grant select, insert, update, delete on table public.form_upload_sessions to service_role;

revoke all on function public.consume_form_upload_session(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.consume_form_upload_session(uuid, uuid, uuid, text)
  to service_role;

-- Trigger functions do not require callers to hold EXECUTE. PostgreSQL checks
-- that privilege at CREATE TRIGGER time, not when the trigger fires, so
-- removing direct execution prevents bypass while preserving the existing
-- BEFORE INSERT trigger.
revoke all on function public.bind_membership_application_cycle()
  from public, anon, authenticated;

create or replace function public.publish_form_version(
  p_form_definition_id uuid,
  p_form_version_id uuid,
  p_actor_user_id uuid
)
returns table (form_definition_id uuid, form_version_id uuid)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  definition public.form_definitions%rowtype;
  version public.form_versions%rowtype;
  linked_event public.events%rowtype;
begin
  select definition_row.*
  into definition
  from public.form_definitions as definition_row
  where definition_row.id = p_form_definition_id
  for update;

  if not found or definition.lifecycle = 'archived' then
    raise exception 'Form definition is unavailable.' using errcode = '22023';
  end if;

  select version_row.*
  into version
  from public.form_versions as version_row
  where version_row.id = p_form_version_id
    and version_row.form_definition_id = definition.id
  for update;

  if not found or version.lifecycle <> 'draft' then
    raise exception 'Only a draft form version can be published.' using errcode = '22023';
  end if;

  if definition.kind = 'event_registration' then
    if definition.linked_event_id is null then
      raise exception 'Link this form to an event before publishing.' using errcode = '22023';
    end if;

    select event_row.*
    into linked_event
    from public.events as event_row
    where event_row.id = definition.linked_event_id
    for update;

    if not found then
      raise exception 'The linked event no longer exists.' using errcode = '22023';
    end if;

    if linked_event.registration_mode <> 'internal' then
      raise exception 'The linked event must use internal registration.' using errcode = '22023';
    end if;

    if linked_event.status = 'archived' then
      raise exception 'Archived events cannot accept a published registration form.' using errcode = '22023';
    end if;
  end if;

  update public.form_versions as published_version
  set lifecycle = 'retired'
  where published_version.form_definition_id = definition.id
    and published_version.lifecycle = 'published';

  update public.form_versions as selected_version
  set lifecycle = 'published',
      published_at = now(),
      published_by_user_id = p_actor_user_id
  where selected_version.id = version.id;

  update public.form_definitions as selected_definition
  set lifecycle = 'published',
      current_published_version_id = version.id,
      application_behavior = version.application_behavior,
      published_at = now(),
      published_by_user_id = p_actor_user_id
  where selected_definition.id = definition.id;

  if definition.kind = 'event_registration' then
    update public.events as selected_event
    set registration_form_version_id = version.id
    where selected_event.id = linked_event.id;
  end if;

  return query select definition.id, version.id;
end;
$function$;

revoke all on function public.publish_form_version(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.publish_form_version(uuid, uuid, uuid)
  to service_role;

commit;
