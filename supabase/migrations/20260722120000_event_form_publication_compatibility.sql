-- Local-only until explicit migration approval. Keep event form publication
-- compatibility checks inside the same transaction that changes lifecycle state.

begin;

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
  event public.events%rowtype;
begin
  select * into definition
  from public.form_definitions
  where id = p_form_definition_id
  for update;

  if not found or definition.lifecycle = 'archived' then
    raise exception 'Form definition is unavailable.' using errcode = '22023';
  end if;

  select * into version
  from public.form_versions
  where id = p_form_version_id
    and form_definition_id = definition.id
  for update;

  if not found or version.lifecycle <> 'draft' then
    raise exception 'Only a draft form version can be published.' using errcode = '22023';
  end if;

  if definition.kind = 'event_registration' then
    if definition.linked_event_id is null then
      raise exception 'Link this form to an event before publishing.' using errcode = '22023';
    end if;

    select * into event
    from public.events
    where id = definition.linked_event_id
    for update;

    if not found then
      raise exception 'The linked event no longer exists.' using errcode = '22023';
    end if;

    if event.registration_mode <> 'internal' then
      raise exception 'The linked event must use internal registration.' using errcode = '22023';
    end if;

    if event.status = 'archived' then
      raise exception 'Archived events cannot accept a published registration form.' using errcode = '22023';
    end if;
  end if;

  update public.form_versions
  set lifecycle = 'retired'
  where form_definition_id = definition.id
    and lifecycle = 'published';

  update public.form_versions
  set lifecycle = 'published',
      published_at = now(),
      published_by_user_id = p_actor_user_id
  where id = version.id;

  update public.form_definitions
  set lifecycle = 'published',
      current_published_version_id = version.id,
      application_behavior = version.application_behavior,
      published_at = now(),
      published_by_user_id = p_actor_user_id
  where id = definition.id;

  if definition.kind = 'event_registration' then
    update public.events
    set registration_form_version_id = version.id
    where id = event.id;
  end if;

  return query select definition.id, version.id;
end;
$function$;

revoke all on function public.publish_form_version(uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.publish_form_version(uuid, uuid, uuid)
  to service_role;

commit;
