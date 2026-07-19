-- Local migration only. Do not apply to any Supabase project without explicit
-- approval, pre-production migration parity, and RLS/advisor verification.

begin;

alter table public.form_submissions
  add column if not exists confirmation_resend_count integer not null default 0,
  add column if not exists confirmation_resend_window_started_at timestamptz,
  drop constraint if exists form_submissions_confirmation_resend_count_check,
  add constraint form_submissions_confirmation_resend_count_check
    check (confirmation_resend_count >= 0);

create index if not exists form_submissions_confirmation_resend_lookup_idx
  on public.form_submissions (
    form_definition_id,
    lower(submitter_email::text),
    created_at desc
  )
  where confirmation_status in ('pending', 'expired');

create or replace function public.refresh_form_submission_confirmation(
  p_form_definition_id uuid,
  p_submitter_email text,
  p_next_token_hash text,
  p_next_expires_at timestamptz
)
returns table (
  result_status text,
  form_submission_id uuid,
  applicant_name text
)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  submission public.form_submissions%rowtype;
  application_behavior jsonb;
  v_full_name text;
  v_resend_count integer;
  v_window_started_at timestamptz;
begin
  if coalesce(btrim(p_submitter_email), '') = ''
    or coalesce(btrim(p_next_token_hash), '') !~ '^[a-f0-9]{64}$'
    or p_next_expires_at is null
    or p_next_expires_at <= now() then
    raise exception 'Invalid form confirmation resend request.';
  end if;

  select submission_row.*
  into submission
  from public.form_submissions as submission_row
  where submission_row.form_definition_id = p_form_definition_id
    and lower(submission_row.submitter_email::text) = lower(btrim(p_submitter_email))
    and submission_row.confirmation_status in ('pending', 'expired')
  order by submission_row.created_at desc
  limit 1
  for update;

  if not found then
    return query select 'not_found'::text, null::uuid, null::text;
    return;
  end if;

  if submission.confirmation_resend_window_started_at is null
    or submission.confirmation_resend_window_started_at <= now() - interval '1 hour' then
    v_resend_count := 1;
    v_window_started_at := now();
  elsif submission.confirmation_resend_count >= 3 then
    return query select 'rate_limited'::text, null::uuid, null::text;
    return;
  else
    v_resend_count := submission.confirmation_resend_count + 1;
    v_window_started_at := submission.confirmation_resend_window_started_at;
  end if;

  select version_row.application_behavior
  into application_behavior
  from public.form_versions as version_row
  where version_row.id = submission.form_version_id;

  v_full_name := nullif(
    btrim(submission.answers ->> (application_behavior -> 'fieldMapping' ->> 'fullName')),
    ''
  );

  update public.form_submissions
  set
    confirmation_status = 'pending',
    confirmation_token_hash = p_next_token_hash,
    confirmation_expires_at = p_next_expires_at,
    confirmation_sent_at = null,
    confirmation_resend_count = v_resend_count,
    confirmation_resend_window_started_at = v_window_started_at
  where id = submission.id;

  return query select
    'resent'::text,
    submission.id,
    coalesce(v_full_name, 'JnUITS applicant');
end;
$function$;

revoke all on function public.refresh_form_submission_confirmation(
  uuid, text, text, timestamptz
) from public, anon, authenticated;
grant execute on function public.refresh_form_submission_confirmation(
  uuid, text, text, timestamptz
) to service_role;

commit;