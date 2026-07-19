begin;

create or replace function public.update_form_draft_version(
  p_form_definition_id uuid,
  p_form_version_id uuid,
  p_field_schema jsonb,
  p_application_behavior jsonb,
  p_actor_user_id uuid
)
returns table (form_version_id uuid)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  definition public.form_definitions%rowtype;
  version public.form_versions%rowtype;
  updated_version_id uuid;
begin
  if p_actor_user_id is null then
    raise exception 'An actor is required to update a form draft.' using errcode = '22023';
  end if;

  select * into definition
  from public.form_definitions
  where id = p_form_definition_id
  for update;

  if not found or definition.lifecycle = 'archived' then
    raise exception 'Form definition is unavailable.' using errcode = '22023';
  end if;

  if jsonb_typeof(p_application_behavior) <> 'object'
    or jsonb_typeof(p_field_schema) <> 'object' then
    raise exception 'Invalid form configuration.' using errcode = '22023';
  end if;

  select * into version
  from public.form_versions
  where id = p_form_version_id
    and form_definition_id = definition.id
  for update;

  if not found or version.lifecycle <> 'draft' then
    raise exception 'Only a draft form version can be updated.' using errcode = '22023';
  end if;

  update public.form_versions
  set field_schema = p_field_schema,
      application_behavior = p_application_behavior
  where id = version.id
  returning id into updated_version_id;

  return query select updated_version_id;
end;
$function$;

revoke all on function public.update_form_draft_version(uuid, uuid, jsonb, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.update_form_draft_version(uuid, uuid, jsonb, jsonb, uuid) to service_role;

commit;