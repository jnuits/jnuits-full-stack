-- Local migration only. Do not apply to any Supabase project without explicit
-- approval, pre-production migration parity, and RLS/advisor verification.

begin;

alter table public.form_definitions
  add column if not exists application_behavior jsonb not null default '{}'::jsonb
  check (jsonb_typeof(application_behavior) = 'object');

alter table public.form_submissions
  add constraint form_submissions_confirmation_state_check
  check (
    (confirmation_status = 'pending'
      and confirmation_token_hash is not null
      and confirmation_expires_at is not null)
    or confirmation_status <> 'pending'
  );

alter table public.form_submissions
  add constraint form_submissions_confirmation_token_hash_check
  check (
    confirmation_token_hash is null
    or confirmation_token_hash ~ '^[a-f0-9]{64}$'
  );

alter table public.alumni_onboarding_cases
  add column if not exists full_name text,
  add column if not exists email citext,
  add column if not exists jnuits_id text;

create index if not exists alumni_onboarding_cases_status_created_idx
  on public.alumni_onboarding_cases (status, created_at desc);

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
  select submission_row, definition.kind, definition.application_behavior
  into submission, definition_kind, application_behavior
  from public.form_submissions as submission_row
  join public.form_definitions as definition
    on definition.id = submission_row.form_definition_id
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

revoke execute on function public.confirm_form_submission(uuid, text) from public, anon, authenticated;
grant execute on function public.confirm_form_submission(uuid, text) to service_role;

revoke execute on function public.prevent_published_form_version_mutation() from public, anon, authenticated;
revoke execute on function public.verify_form_definition_published_version() from public, anon, authenticated;
revoke execute on function public.verify_form_submission_version() from public, anon, authenticated;

commit;
