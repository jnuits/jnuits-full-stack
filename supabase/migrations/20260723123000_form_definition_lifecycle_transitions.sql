-- Local-only until explicit migration approval. Expand the form-definition
-- lifecycle without mutating or deleting published version snapshots.

begin;

alter table public.form_definitions
  drop constraint if exists form_definitions_lifecycle_check;

alter table public.form_definitions
  add constraint form_definitions_lifecycle_check
  check (lifecycle in ('draft', 'published', 'closed', 'archived'));

create or replace function public.transition_form_definition_lifecycle(
  p_form_definition_id uuid,
  p_target_lifecycle text,
  p_actor_user_id uuid
)
returns table (
  form_definition_id uuid,
  lifecycle text,
  current_published_version_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  definition public.form_definitions%rowtype;
  next_lifecycle text;
begin
  if p_actor_user_id is null then
    raise exception 'An authenticated form operator is required.' using errcode = '22023';
  end if;

  if p_target_lifecycle not in ('published', 'closed', 'archived') then
    raise exception 'Unsupported form lifecycle transition.' using errcode = '22023';
  end if;

  select * into definition
  from public.form_definitions
  where id = p_form_definition_id
  for update;

  if not found then
    raise exception 'Form definition is unavailable.' using errcode = 'P0002';
  end if;

  if definition.lifecycle = 'archived' then
    raise exception 'Archived forms cannot change lifecycle.' using errcode = '22023';
  end if;

  if p_target_lifecycle = 'closed' then
    if definition.lifecycle <> 'published' then
      raise exception 'Only a published form can be closed.' using errcode = '22023';
    end if;
    next_lifecycle := 'closed';
  elsif p_target_lifecycle = 'published' then
    if definition.lifecycle <> 'closed' or definition.current_published_version_id is null then
      raise exception 'Only a closed form with a published version can be reopened.' using errcode = '22023';
    end if;
    next_lifecycle := 'published';
  else
    next_lifecycle := 'archived';
  end if;

  update public.form_definitions
  set lifecycle = next_lifecycle,
      updated_at = now()
  where id = definition.id;

  if definition.kind = 'event_registration' and definition.linked_event_id is not null then
    if next_lifecycle = 'published' then
      update public.events
      set registration_form_version_id = definition.current_published_version_id
      where id = definition.linked_event_id;
    else
      update public.events
      set registration_form_version_id = null
      where id = definition.linked_event_id
        and registration_form_version_id = definition.current_published_version_id;
    end if;
  end if;

  insert into public.audit_events (
    action,
    actor_user_id,
    entity_id,
    entity_type,
    metadata
  )
  values (
    'forms.lifecycle_' || next_lifecycle,
    p_actor_user_id,
    definition.id,
    'form_definition',
    jsonb_build_object(
      'from', definition.lifecycle,
      'to', next_lifecycle,
      'publishedVersionId', definition.current_published_version_id
    )
  );

  return query
  select definition.id, next_lifecycle, definition.current_published_version_id;
end;
$function$;

revoke all on function public.transition_form_definition_lifecycle(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.transition_form_definition_lifecycle(uuid, text, uuid)
  to service_role;

commit;
