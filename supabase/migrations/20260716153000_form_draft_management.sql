-- Local migration only. Do not apply to any Supabase project without explicit
-- approval, pre-production migration parity, and RLS/advisor verification.

begin;

alter table public.form_versions
  add column if not exists application_behavior jsonb not null default '{}'::jsonb
  check (jsonb_typeof(application_behavior) = 'object');

update public.form_versions as version
set application_behavior = definition.application_behavior
from public.form_definitions as definition
where definition.id = version.form_definition_id
  and version.application_behavior = '{}'::jsonb;

create or replace function public.prevent_published_form_version_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if old.lifecycle = 'published' and (
    new.form_definition_id is distinct from old.form_definition_id
    or new.version_number is distinct from old.version_number
    or new.field_schema is distinct from old.field_schema
    or new.validation_snapshot is distinct from old.validation_snapshot
    or new.payment_configuration is distinct from old.payment_configuration
    or new.application_behavior is distinct from old.application_behavior
  ) then
    raise exception 'Published form versions are immutable.';
  end if;

  if old.lifecycle = 'published' and new.lifecycle = 'draft' then
    raise exception 'A published form version cannot return to draft.';
  end if;

  return new;
end;
$function$;

create or replace function public.create_form_definition_draft(
  p_kind text,
  p_slug text,
  p_title text,
  p_description text,
  p_linked_event_id uuid,
  p_application_behavior jsonb,
  p_field_schema jsonb,
  p_actor_user_id uuid
)
returns table (
  form_definition_id uuid,
  form_version_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  definition_id uuid;
  version_id uuid;
begin
  if p_kind not in ('event_registration', 'membership_application', 'alumni_onboarding') then
    raise exception 'Unsupported form kind.' using errcode = '22023';
  end if;

  if p_actor_user_id is null then
    raise exception 'A form owner is required.' using errcode = '22023';
  end if;

  if p_kind <> 'event_registration' and p_linked_event_id is not null then
    raise exception 'Only event registration forms can link to an event.' using errcode = '22023';
  end if;

  if jsonb_typeof(p_application_behavior) <> 'object'
    or jsonb_typeof(p_field_schema) <> 'object' then
    raise exception 'Invalid form configuration.' using errcode = '22023';
  end if;

  insert into public.form_definitions (
    kind,
    slug,
    title,
    description,
    owner_user_id,
    linked_event_id,
    application_behavior
  )
  values (
    p_kind,
    p_slug,
    p_title,
    nullif(trim(p_description), ''),
    p_actor_user_id,
    p_linked_event_id,
    p_application_behavior
  )
  returning id into definition_id;

  insert into public.form_versions (
    form_definition_id,
    version_number,
    field_schema,
    application_behavior,
    created_by_user_id
  )
  values (
    definition_id,
    1,
    p_field_schema,
    p_application_behavior,
    p_actor_user_id
  )
  returning id into version_id;

  return query select definition_id, version_id;
end;
$function$;

create or replace function public.create_form_draft_version(
  p_form_definition_id uuid,
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
  next_version_number integer;
  version_id uuid;
begin
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

  select coalesce(max(version_number), 0) + 1
  into next_version_number
  from public.form_versions
  where form_definition_id = definition.id;

  insert into public.form_versions (
    form_definition_id,
    version_number,
    field_schema,
    application_behavior,
    created_by_user_id
  )
  values (
    definition.id,
    next_version_number,
    p_field_schema,
    p_application_behavior,
    p_actor_user_id
  )
  returning id into version_id;

  return query select version_id;
end;
$function$;

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

  if definition.kind = 'event_registration' and definition.linked_event_id is not null then
    update public.events
    set registration_form_version_id = version.id
    where id = definition.linked_event_id;
  end if;

  return query select definition.id, version.id;
end;
$function$;

create or replace function public.confirm_form_submission(
  p_submission_id uuid,
  p_confirmation_token_hash text
)
returns table (
  result_status text,
  form_kind text,
  form_submission_id uuid,
  review_case_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  submission public.form_submissions%rowtype;
  definition_kind text;
  application_behavior jsonb;
  field_mapping jsonb;
  full_name text;
  case_id uuid;
begin
  select submission_row, definition.kind, version.application_behavior
  into submission, definition_kind, application_behavior
  from public.form_submissions as submission_row
  join public.form_definitions as definition
    on definition.id = submission_row.form_definition_id
  join public.form_versions as version
    on version.id = submission_row.form_version_id
  where submission_row.id = p_submission_id
  for update of submission_row;

  if not found then
    return query select 'invalid'::text, null::text, null::uuid, null::uuid;
    return;
  end if;

  if submission.confirmation_status = 'confirmed' then
    return query select 'already_confirmed'::text, definition_kind, submission.id, null::uuid;
    return;
  end if;

  if submission.confirmation_status <> 'pending'
    or submission.confirmation_expires_at is null
    or submission.confirmation_expires_at <= now() then
    update public.form_submissions
    set confirmation_status = 'expired'
    where id = submission.id
      and confirmation_status = 'pending';

    return query select 'expired'::text, definition_kind, submission.id, null::uuid;
    return;
  end if;

  if submission.confirmation_token_hash is distinct from p_confirmation_token_hash then
    return query select 'invalid'::text, null::text, null::uuid, null::uuid;
    return;
  end if;

  field_mapping := application_behavior -> 'fieldMapping';
  full_name := submission.answers ->> (field_mapping ->> 'fullName');

  if definition_kind in ('membership_application', 'alumni_onboarding')
    and (field_mapping is null or full_name is null or submission.submitter_email is null) then
    raise exception 'Confirmed application is missing canonical identity mapping.';
  end if;

  update public.form_submissions
  set confirmation_status = 'confirmed',
      confirmed_at = now()
  where id = submission.id;

  if definition_kind = 'membership_application' then
    insert into public.membership_applications (
      form_submission_id,
      name,
      email,
      department_code,
      batch_label,
      student_id,
      phone,
      facebook_url,
      linkedin_url,
      status
    )
    values (
      submission.id,
      full_name,
      submission.submitter_email,
      submission.answers ->> (field_mapping ->> 'departmentCode'),
      submission.answers ->> (field_mapping ->> 'batchLabel'),
      submission.answers ->> (field_mapping ->> 'studentId'),
      submission.answers ->> (field_mapping ->> 'phone'),
      submission.answers ->> (field_mapping ->> 'facebookUrl'),
      submission.answers ->> (field_mapping ->> 'linkedinUrl'),
      'pending'
    )
    returning id into case_id;
  elsif definition_kind = 'alumni_onboarding' then
    insert into public.alumni_onboarding_cases (
      form_submission_id,
      full_name,
      email,
      jnuits_id,
      status
    )
    values (
      submission.id,
      full_name,
      submission.submitter_email,
      submission.answers ->> (field_mapping ->> 'jnuitsId'),
      'pending'
    )
    returning id into case_id;
  end if;

  return query select 'confirmed'::text, definition_kind, submission.id, case_id;
end;
$function$;

revoke execute on function public.create_form_definition_draft(text, text, text, text, uuid, jsonb, jsonb, uuid) from public, anon, authenticated;
revoke execute on function public.create_form_draft_version(uuid, jsonb, jsonb, uuid) from public, anon, authenticated;
revoke execute on function public.publish_form_version(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function public.confirm_form_submission(uuid, text) from public, anon, authenticated;

grant execute on function public.create_form_definition_draft(text, text, text, text, uuid, jsonb, jsonb, uuid) to service_role;
grant execute on function public.create_form_draft_version(uuid, jsonb, jsonb, uuid) to service_role;
grant execute on function public.publish_form_version(uuid, uuid, uuid) to service_role;
grant execute on function public.confirm_form_submission(uuid, text) to service_role;

commit;
