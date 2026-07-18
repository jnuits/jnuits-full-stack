-- Local migration only. Do not apply to any Supabase project without explicit
-- approval, pre-production migration parity, and RLS/advisor verification.

begin;

create table public.form_definitions (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in (
    'event_registration',
    'membership_application',
    'alumni_onboarding'
  )),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title text not null check (char_length(trim(title)) between 1 and 160),
  description text,
  lifecycle text not null default 'draft' check (lifecycle in ('draft', 'published', 'archived')),
  owner_user_id uuid not null references auth.users(id) on delete restrict,
  linked_event_id uuid references public.events(id) on delete restrict,
  payment_configuration jsonb not null default '{"enabled": false}'::jsonb
    check (
      jsonb_typeof(payment_configuration) = 'object'
      and coalesce(payment_configuration ->> 'enabled', 'false') = 'false'
    ),
  current_published_version_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz,
  published_by_user_id uuid references auth.users(id) on delete restrict
);

create table public.form_versions (
  id uuid primary key default gen_random_uuid(),
  form_definition_id uuid not null references public.form_definitions(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  lifecycle text not null default 'draft' check (lifecycle in ('draft', 'published', 'retired')),
  field_schema jsonb not null check (jsonb_typeof(field_schema) = 'object'),
  validation_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(validation_snapshot) = 'object'),
  payment_configuration jsonb not null default '{"enabled": false}'::jsonb
    check (
      jsonb_typeof(payment_configuration) = 'object'
      and coalesce(payment_configuration ->> 'enabled', 'false') = 'false'
    ),
  created_by_user_id uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  published_by_user_id uuid references auth.users(id) on delete restrict,
  unique (form_definition_id, version_number)
);

alter table public.form_definitions
  add constraint form_definitions_current_published_version_id_fkey
  foreign key (current_published_version_id)
  references public.form_versions(id)
  on delete restrict;

alter table public.events
  add column if not exists registration_form_version_id uuid;

alter table public.events
  add constraint events_registration_form_version_id_fkey
  foreign key (registration_form_version_id)
  references public.form_versions(id)
  on delete restrict;

create table public.form_submissions (
  id uuid primary key default gen_random_uuid(),
  form_definition_id uuid not null references public.form_definitions(id) on delete restrict,
  form_version_id uuid not null references public.form_versions(id) on delete restrict,
  submitter_email citext,
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  source_metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(source_metadata) = 'object'),
  confirmation_status text not null default 'not_required'
    check (confirmation_status in ('pending', 'confirmed', 'expired', 'not_required')),
  confirmation_token_hash text unique,
  confirmation_expires_at timestamptz,
  confirmation_sent_at timestamptz,
  confirmed_at timestamptz,
  review_status text not null default 'unreviewed'
    check (review_status in ('unreviewed', 'in_review', 'approved', 'rejected', 'withdrawn')),
  reviewed_at timestamptz,
  reviewed_by_user_id uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.form_submission_assets (
  id uuid primary key default gen_random_uuid(),
  form_submission_id uuid not null references public.form_submissions(id) on delete restrict,
  field_id text not null check (field_id ~ '^[a-z][a-z0-9_]{0,63}$'),
  cloudinary_asset_id text not null,
  cloudinary_public_id text not null,
  cloudinary_version text not null,
  cloudinary_folder text not null,
  content_type text not null check (content_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')),
  bytes integer not null check (bytes > 0 and bytes <= 10485760),
  sha256 text not null check (sha256 ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now(),
  unique (form_submission_id, field_id, cloudinary_asset_id)
);

create table public.form_export_jobs (
  id uuid primary key default gen_random_uuid(),
  form_definition_id uuid not null references public.form_definitions(id) on delete restrict,
  form_version_id uuid references public.form_versions(id) on delete restrict,
  requested_by_user_id uuid not null references auth.users(id) on delete restrict,
  format text not null check (format in ('csv', 'xlsx', 'google_sheet')),
  destination text not null check (destination in ('download', 'google_drive')),
  status text not null default 'requested' check (status in ('requested', 'completed', 'failed')),
  filter_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(filter_metadata) = 'object'),
  row_count integer not null default 0 check (row_count >= 0),
  checksum_sha256 text,
  google_drive_file_id text,
  expires_at timestamptz,
  error_code text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.form_archive_jobs (
  id uuid primary key default gen_random_uuid(),
  form_definition_id uuid not null references public.form_definitions(id) on delete restrict,
  requested_by_user_id uuid not null references auth.users(id) on delete restrict,
  approved_by_user_id uuid references auth.users(id) on delete restrict,
  status text not null default 'candidate'
    check (status in ('candidate', 'archive_requested', 'archived', 'purge_approved', 'purged', 'failed')),
  retention_eligible_at timestamptz not null,
  archive_manifest jsonb not null default '{}'::jsonb
    check (jsonb_typeof(archive_manifest) = 'object'),
  manifest_checksum_sha256 text,
  source_pii_purged_at timestamptz,
  error_code text,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

alter table public.membership_applications
  add column if not exists form_submission_id uuid references public.form_submissions(id) on delete restrict;

create table public.alumni_onboarding_cases (
  id uuid primary key default gen_random_uuid(),
  form_submission_id uuid not null unique references public.form_submissions(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  review_note text,
  reviewed_at timestamptz,
  reviewed_by_user_id uuid references auth.users(id) on delete restrict,
  processed_member_id uuid references public.members(id) on delete restrict,
  invitation_id uuid references public.member_invitations(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index form_versions_one_published_per_definition_idx
  on public.form_versions (form_definition_id)
  where lifecycle = 'published';

create index form_definitions_kind_lifecycle_idx
  on public.form_definitions (kind, lifecycle, created_at desc);

create index form_submissions_definition_created_idx
  on public.form_submissions (form_definition_id, created_at desc);

create index form_submissions_version_review_idx
  on public.form_submissions (form_version_id, review_status, created_at desc);

create index form_submissions_confirmation_lookup_idx
  on public.form_submissions (confirmation_token_hash)
  where confirmation_token_hash is not null;

create index form_export_jobs_definition_created_idx
  on public.form_export_jobs (form_definition_id, created_at desc);

create index form_archive_jobs_due_idx
  on public.form_archive_jobs (retention_eligible_at asc)
  where status in ('candidate', 'archive_requested', 'failed');

create unique index membership_applications_form_submission_unique_idx
  on public.membership_applications (form_submission_id)
  where form_submission_id is not null;

create or replace function public.prevent_published_form_version_mutation()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if old.lifecycle = 'published' and (
    new.form_definition_id is distinct from old.form_definition_id
    or new.version_number is distinct from old.version_number
    or new.field_schema is distinct from old.field_schema
    or new.validation_snapshot is distinct from old.validation_snapshot
    or new.payment_configuration is distinct from old.payment_configuration
  ) then
    raise exception 'Published form versions are immutable.';
  end if;

  if old.lifecycle = 'published' and new.lifecycle = 'draft' then
    raise exception 'A published form version cannot return to draft.';
  end if;

  return new;
end;
$function$;

create or replace function public.verify_form_definition_published_version()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if new.current_published_version_id is not null and not exists (
    select 1
    from public.form_versions as version
    where version.id = new.current_published_version_id
      and version.form_definition_id = new.id
      and version.lifecycle = 'published'
  ) then
    raise exception 'Current published version must belong to this form and be published.';
  end if;

  return new;
end;
$function$;

create or replace function public.verify_form_submission_version()
returns trigger
language plpgsql
set search_path = ''
as $function$
begin
  if not exists (
    select 1
    from public.form_versions as version
    where version.id = new.form_version_id
      and version.form_definition_id = new.form_definition_id
      and version.lifecycle = 'published'
  ) then
    raise exception 'Submissions must target a published version of the selected form.';
  end if;

  return new;
end;
$function$;

drop trigger if exists form_versions_prevent_published_mutation on public.form_versions;
create trigger form_versions_prevent_published_mutation
before update on public.form_versions
for each row execute function public.prevent_published_form_version_mutation();

drop trigger if exists form_definitions_verify_published_version on public.form_definitions;
create trigger form_definitions_verify_published_version
before insert or update of current_published_version_id on public.form_definitions
for each row execute function public.verify_form_definition_published_version();

drop trigger if exists form_submissions_verify_version on public.form_submissions;
create trigger form_submissions_verify_version
before insert or update of form_definition_id, form_version_id on public.form_submissions
for each row execute function public.verify_form_submission_version();

drop trigger if exists form_definitions_set_updated_at on public.form_definitions;
create trigger form_definitions_set_updated_at
before update on public.form_definitions
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists form_submissions_set_updated_at on public.form_submissions;
create trigger form_submissions_set_updated_at
before update on public.form_submissions
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists alumni_onboarding_cases_set_updated_at on public.alumni_onboarding_cases;
create trigger alumni_onboarding_cases_set_updated_at
before update on public.alumni_onboarding_cases
for each row execute function public.set_current_timestamp_updated_at();

alter table public.form_definitions enable row level security;
alter table public.form_versions enable row level security;
alter table public.form_submissions enable row level security;
alter table public.form_submission_assets enable row level security;
alter table public.form_export_jobs enable row level security;
alter table public.form_archive_jobs enable row level security;
alter table public.alumni_onboarding_cases enable row level security;

revoke all on table public.form_definitions from public, anon, authenticated;
revoke all on table public.form_versions from public, anon, authenticated;
revoke all on table public.form_submissions from public, anon, authenticated;
revoke all on table public.form_submission_assets from public, anon, authenticated;
revoke all on table public.form_export_jobs from public, anon, authenticated;
revoke all on table public.form_archive_jobs from public, anon, authenticated;
revoke all on table public.alumni_onboarding_cases from public, anon, authenticated;

grant select, insert, update on table public.form_definitions to service_role;
grant select, insert, update on table public.form_versions to service_role;
grant select, insert, update on table public.form_submissions to service_role;
grant select, insert, update on table public.form_submission_assets to service_role;
grant select, insert, update on table public.form_export_jobs to service_role;
grant select, insert, update on table public.form_archive_jobs to service_role;
grant select, insert, update on table public.alumni_onboarding_cases to service_role;

insert into public.rbac_permissions (code, scope, description)
values
  ('cms.forms.manage', 'admin', 'Create and edit form drafts.'),
  ('cms.forms.publish', 'admin', 'Publish form versions.'),
  ('admin.forms.review', 'admin', 'Review membership and alumni form submissions.'),
  ('admin.forms.export', 'admin', 'Export approved form submission data.')
on conflict (code) do update
set scope = excluded.scope,
    description = excluded.description;

with role_permission_seed (role_code, permission_code) as (
  values
    ('super_admin', 'cms.forms.manage'),
    ('super_admin', 'cms.forms.publish'),
    ('super_admin', 'admin.forms.review'),
    ('super_admin', 'admin.forms.export'),
    ('admin', 'cms.forms.manage'),
    ('admin', 'cms.forms.publish'),
    ('admin', 'admin.forms.review'),
    ('admin', 'admin.forms.export'),
    ('content_admin', 'cms.forms.manage'),
    ('content_admin', 'cms.forms.publish')
)
insert into public.rbac_role_permissions (role_id, permission_code)
select role.id, seed.permission_code
from role_permission_seed as seed
join public.rbac_platform_roles as role
  on role.code = seed.role_code
  and role.scope = 'admin'
on conflict (role_id, permission_code) do nothing;

commit;
