grant usage on schema public to anon, authenticated, service_role;

create table if not exists public.departments (
  code text primary key,
  name text not null,
  sort_order integer not null default 100,
  is_active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text null,
  email extensions.citext null,
  phone text null,
  department_code text null references public.departments (code) on delete set null,
  batch_no integer null check (batch_no is null or batch_no > 0),
  status text not null default 'pending' check (status in ('active', 'suspended', 'pending')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists profiles_email_unique
  on public.profiles (email)
  where email is not null;

create table if not exists public.members (
  id uuid primary key default extensions.gen_random_uuid(),
  jnuits_id extensions.citext not null unique,
  full_name text not null,
  email extensions.citext null,
  phone text null,
  department_code text null references public.departments (code) on delete set null,
  batch_no integer null check (batch_no is null or batch_no > 0),
  member_type text not null default 'current' check (member_type in ('current', 'alumni')),
  alumni_since date null,
  current_organization text null,
  designation text null,
  work_location text null,
  linkedin_url text null,
  website_url text null,
  professional_visibility text not null default 'members-only'
    check (professional_visibility in ('public', 'members-only', 'private')),
  verification_code_hash text null,
  is_profile_claimed boolean not null default false,
  profile_claimed_at timestamptz null,
  user_id uuid null unique references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists members_email_unique
  on public.members (email)
  where email is not null;

create index if not exists members_user_id_idx on public.members (user_id);
create index if not exists members_member_type_idx on public.members (member_type);
create index if not exists members_department_code_idx on public.members (department_code);

create table if not exists public.membership_applications (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  email extensions.citext not null,
  department_code text null references public.departments (code) on delete set null,
  batch_label text null,
  student_id text null,
  phone text null,
  facebook_url text null,
  linkedin_url text null,
  photo_url text null,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.rbac_platform_roles (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  title text not null,
  is_system boolean not null default true,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.rbac_user_platform_roles (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  role_id uuid not null references public.rbac_platform_roles (id) on delete cascade,
  granted_by uuid null references auth.users (id) on delete set null,
  granted_at timestamptz not null default timezone('utc', now()),
  revoked_at timestamptz null,
  note text null,
  created_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists rbac_user_role_active_unique
  on public.rbac_user_platform_roles (user_id, role_id)
  where revoked_at is null;

create index if not exists rbac_user_roles_user_idx
  on public.rbac_user_platform_roles (user_id, revoked_at);

create or replace function public.has_platform_role(role_code text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.rbac_user_platform_roles user_roles
    join public.rbac_platform_roles roles
      on roles.id = user_roles.role_id
    where user_roles.user_id = auth.uid()
      and user_roles.revoked_at is null
      and roles.code = role_code
  );
$$;

grant execute on function public.has_platform_role(text) to anon, authenticated;

create table if not exists public.membership_lifecycle_events (
  id uuid primary key default extensions.gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  event_type text not null,
  occurred_at timestamptz not null default timezone('utc', now()),
  summary text null,
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists membership_lifecycle_events_member_idx
  on public.membership_lifecycle_events (member_id, occurred_at desc);

create table if not exists public.profile_update_requests (
  id uuid primary key default extensions.gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  request_type text not null check (request_type in ('workplace_update', 'profile_change')),
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  requested_at timestamptz not null default timezone('utc', now()),
  reviewed_at timestamptz null,
  review_note text null,
  reviewed_by_user_id uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists profile_update_requests_member_idx
  on public.profile_update_requests (member_id, requested_at desc);

create table if not exists public.member_invitations (
  id uuid primary key default extensions.gen_random_uuid(),
  member_id uuid not null references public.members (id) on delete cascade,
  code_hash text not null unique,
  max_uses integer not null default 1 check (max_uses > 0),
  used_count integer not null default 0 check (used_count >= 0),
  expires_at timestamptz not null,
  is_active boolean not null default true,
  revoked_at timestamptz null,
  last_used_at timestamptz null,
  notes text null,
  created_by_user_id uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists member_invitations_member_idx
  on public.member_invitations (member_id, expires_at desc);

create table if not exists public.audit_events (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_user_id uuid null references auth.users (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists audit_events_created_idx
  on public.audit_events (created_at desc);

create table if not exists public.certificate_import_batches (
  id uuid primary key default extensions.gen_random_uuid(),
  source_name text not null,
  source_checksum text null,
  source_row_count integer not null default 0,
  status text not null default 'pending' check (status in ('pending', 'completed', 'failed')),
  inserted_count integer not null default 0,
  updated_count integer not null default 0,
  rejected_count integer not null default 0,
  report jsonb not null default '{}'::jsonb,
  started_at timestamptz not null default timezone('utc', now()),
  finished_at timestamptz null,
  created_by_user_id uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.certificates (
  id uuid primary key default extensions.gen_random_uuid(),
  certificate_id extensions.citext not null unique,
  first_name text not null,
  last_name text not null,
  details text not null default '',
  exam_or_event text not null,
  exam_or_event_name text not null,
  issue_date date not null,
  asset_url text null,
  source_document_id text null,
  source_record_id text null,
  source_migrated_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists certificates_issue_date_idx
  on public.certificates (issue_date desc);

create table if not exists public.certificates_import_staging (
  id uuid primary key default extensions.gen_random_uuid(),
  import_batch_id uuid not null references public.certificate_import_batches (id) on delete cascade,
  row_number integer not null,
  certificate_id_raw text null,
  first_name_raw text null,
  last_name_raw text null,
  details_raw text null,
  exam_or_event_raw text null,
  exam_or_event_name_raw text null,
  issue_date_raw text null,
  asset_url_raw text null,
  source_document_id_raw text null,
  source_record_id_raw text null,
  parse_error text null,
  imported_at timestamptz not null default timezone('utc', now())
);

create index if not exists certificates_import_staging_batch_idx
  on public.certificates_import_staging (import_batch_id, row_number);

insert into public.rbac_platform_roles (code, title, is_system)
values
  ('admin', 'Platform Administrator', true),
  ('moderator', 'Moderator', true),
  ('content_editor', 'Content Editor', true),
  ('committee_author', 'Committee Author', true)
on conflict (code) do update
  set title = excluded.title,
      is_system = excluded.is_system;

drop trigger if exists departments_set_updated_at on public.departments;
create trigger departments_set_updated_at
before update on public.departments
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists members_set_updated_at on public.members;
create trigger members_set_updated_at
before update on public.members
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists membership_applications_set_updated_at on public.membership_applications;
create trigger membership_applications_set_updated_at
before update on public.membership_applications
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists profile_update_requests_set_updated_at on public.profile_update_requests;
create trigger profile_update_requests_set_updated_at
before update on public.profile_update_requests
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists member_invitations_set_updated_at on public.member_invitations;
create trigger member_invitations_set_updated_at
before update on public.member_invitations
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists certificates_set_updated_at on public.certificates;
create trigger certificates_set_updated_at
before update on public.certificates
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_auth_user();

grant select on public.departments to anon, authenticated;

grant select, insert, update on public.profiles to authenticated;
grant select, update on public.members to authenticated;
grant select, update on public.membership_applications to authenticated;
grant select on public.rbac_platform_roles to authenticated;
grant select on public.rbac_user_platform_roles to authenticated;
grant select on public.membership_lifecycle_events to authenticated;
grant select, insert, update on public.profile_update_requests to authenticated;
grant select on public.certificates to anon, authenticated;
grant select on public.certificate_import_batches to authenticated;
grant select on public.certificates_import_staging to authenticated;
grant select on public.audit_events to authenticated;
grant select on public.member_invitations to authenticated;

alter table public.departments enable row level security;
alter table public.profiles enable row level security;
alter table public.members enable row level security;
alter table public.membership_applications enable row level security;
alter table public.rbac_platform_roles enable row level security;
alter table public.rbac_user_platform_roles enable row level security;
alter table public.membership_lifecycle_events enable row level security;
alter table public.profile_update_requests enable row level security;
alter table public.member_invitations enable row level security;
alter table public.audit_events enable row level security;
alter table public.certificate_import_batches enable row level security;
alter table public.certificates enable row level security;
alter table public.certificates_import_staging enable row level security;

drop policy if exists "departments are publicly readable" on public.departments;
create policy "departments are publicly readable"
on public.departments
for select
using (true);

drop policy if exists "profiles self select" on public.profiles;
create policy "profiles self select"
on public.profiles
for select
using (auth.uid() = id or public.has_platform_role('admin') or public.has_platform_role('moderator'));

drop policy if exists "profiles self insert" on public.profiles;
create policy "profiles self insert"
on public.profiles
for insert
with check (auth.uid() = id);

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update"
on public.profiles
for update
using (auth.uid() = id or public.has_platform_role('admin') or public.has_platform_role('moderator'))
with check (auth.uid() = id or public.has_platform_role('admin') or public.has_platform_role('moderator'));

drop policy if exists "members owner or operator select" on public.members;
create policy "members owner or operator select"
on public.members
for select
using (
  auth.uid() = user_id
  or public.has_platform_role('admin')
  or public.has_platform_role('moderator')
);

drop policy if exists "members operator insert" on public.members;
create policy "members operator insert"
on public.members
for insert
with check (public.has_platform_role('admin') or public.has_platform_role('moderator'));

drop policy if exists "members operator update" on public.members;
create policy "members operator update"
on public.members
for update
using (public.has_platform_role('admin') or public.has_platform_role('moderator'))
with check (public.has_platform_role('admin') or public.has_platform_role('moderator'));

drop policy if exists "membership applications operator read" on public.membership_applications;
create policy "membership applications operator read"
on public.membership_applications
for select
using (public.has_platform_role('admin') or public.has_platform_role('moderator'));

drop policy if exists "membership applications operator update" on public.membership_applications;
create policy "membership applications operator update"
on public.membership_applications
for update
using (public.has_platform_role('admin') or public.has_platform_role('moderator'))
with check (public.has_platform_role('admin') or public.has_platform_role('moderator'));

drop policy if exists "rbac roles authenticated read" on public.rbac_platform_roles;
create policy "rbac roles authenticated read"
on public.rbac_platform_roles
for select
using (auth.uid() is not null);

drop policy if exists "rbac user roles own or operator read" on public.rbac_user_platform_roles;
create policy "rbac user roles own or operator read"
on public.rbac_user_platform_roles
for select
using (
  user_id = auth.uid()
  or public.has_platform_role('admin')
  or public.has_platform_role('moderator')
);

drop policy if exists "rbac user roles operator write" on public.rbac_user_platform_roles;
create policy "rbac user roles operator write"
on public.rbac_user_platform_roles
for all
using (public.has_platform_role('admin') or public.has_platform_role('moderator'))
with check (public.has_platform_role('admin') or public.has_platform_role('moderator'));

drop policy if exists "lifecycle own or operator read" on public.membership_lifecycle_events;
create policy "lifecycle own or operator read"
on public.membership_lifecycle_events
for select
using (
  exists (
    select 1
    from public.members
    where public.members.id = membership_lifecycle_events.member_id
      and public.members.user_id = auth.uid()
  )
  or public.has_platform_role('admin')
  or public.has_platform_role('moderator')
);

drop policy if exists "lifecycle operator write" on public.membership_lifecycle_events;
create policy "lifecycle operator write"
on public.membership_lifecycle_events
for all
using (public.has_platform_role('admin') or public.has_platform_role('moderator'))
with check (public.has_platform_role('admin') or public.has_platform_role('moderator'));

drop policy if exists "profile update request own read" on public.profile_update_requests;
create policy "profile update request own read"
on public.profile_update_requests
for select
using (
  exists (
    select 1
    from public.members
    where public.members.id = profile_update_requests.member_id
      and public.members.user_id = auth.uid()
  )
  or public.has_platform_role('admin')
  or public.has_platform_role('moderator')
);

drop policy if exists "profile update request own insert" on public.profile_update_requests;
create policy "profile update request own insert"
on public.profile_update_requests
for insert
with check (
  exists (
    select 1
    from public.members
    where public.members.id = profile_update_requests.member_id
      and public.members.user_id = auth.uid()
  )
);

drop policy if exists "profile update request operator update" on public.profile_update_requests;
create policy "profile update request operator update"
on public.profile_update_requests
for update
using (public.has_platform_role('admin') or public.has_platform_role('moderator'))
with check (public.has_platform_role('admin') or public.has_platform_role('moderator'));

drop policy if exists "member invitations operator only" on public.member_invitations;
create policy "member invitations operator only"
on public.member_invitations
for all
using (public.has_platform_role('admin') or public.has_platform_role('moderator'))
with check (public.has_platform_role('admin') or public.has_platform_role('moderator'));

drop policy if exists "audit events operator read" on public.audit_events;
create policy "audit events operator read"
on public.audit_events
for select
using (public.has_platform_role('admin') or public.has_platform_role('moderator'));

drop policy if exists "certificate import batches operator read" on public.certificate_import_batches;
create policy "certificate import batches operator read"
on public.certificate_import_batches
for select
using (public.has_platform_role('admin') or public.has_platform_role('moderator'));

drop policy if exists "certificate import staging operator read" on public.certificates_import_staging;
create policy "certificate import staging operator read"
on public.certificates_import_staging
for select
using (public.has_platform_role('admin') or public.has_platform_role('moderator'));

drop policy if exists "certificates are publicly readable" on public.certificates;
create policy "certificates are publicly readable"
on public.certificates
for select
using (true);
