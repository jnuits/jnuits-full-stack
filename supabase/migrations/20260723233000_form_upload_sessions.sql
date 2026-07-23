-- Local migration only. Do not apply to any Supabase project without explicit approval.
-- Adds server-owned, short-lived, single-use upload sessions for public forms.

begin;

create table public.form_upload_sessions (
  id uuid primary key,
  form_definition_id uuid not null references public.form_definitions(id) on delete restrict,
  form_version_id uuid not null references public.form_versions(id) on delete restrict,
  manifest_sha256 text not null check (manifest_sha256 ~ '^[a-f0-9]{64}$'),
  expires_at timestamptz not null,
  consumed_at timestamptz,
  created_at timestamptz not null default now(),
  check (expires_at > created_at)
);

create index form_upload_sessions_expiry_idx
  on public.form_upload_sessions (expires_at)
  where consumed_at is null;

alter table public.form_upload_sessions enable row level security;
revoke all on table public.form_upload_sessions from public, anon, authenticated;
grant select, insert, update, delete on table public.form_upload_sessions to service_role;

create or replace function public.consume_form_upload_session(
  p_session_id uuid,
  p_form_definition_id uuid,
  p_form_version_id uuid,
  p_manifest_sha256 text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_consumed_id uuid;
begin
  update public.form_upload_sessions
  set consumed_at = now()
  where id = p_session_id
    and form_definition_id = p_form_definition_id
    and form_version_id = p_form_version_id
    and manifest_sha256 = p_manifest_sha256
    and consumed_at is null
    and expires_at > now()
  returning id into v_consumed_id;

  return v_consumed_id is not null;
end;
$function$;

revoke all on function public.consume_form_upload_session(uuid, uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.consume_form_upload_session(uuid, uuid, uuid, text)
  to service_role;

commit;
