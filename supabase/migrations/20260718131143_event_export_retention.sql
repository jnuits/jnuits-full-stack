-- Local migration only. Do not apply to a live Supabase project without
-- explicit production approval and pre-production verification.

begin;

create table if not exists public.event_export_jobs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  requested_by_user_id uuid not null references auth.users(id) on delete restrict,
  export_kind text not null default 'event_registrations'
    check (export_kind in ('event_registrations', 'event_archive')),
  format text not null
    check (format in ('archive_manifest', 'csv', 'google_sheet', 'json', 'xlsx')),
  destination text not null default 'download'
    check (destination in ('download', 'google_drive')),
  status text not null default 'completed'
    check (status in ('completed', 'failed', 'requested')),
  row_count integer not null default 0 check (row_count >= 0),
  filter_metadata jsonb not null default '{}'::jsonb,
  checksum_sha256 text,
  google_drive_file_id text,
  expires_at timestamptz,
  error_code text,
  created_at timestamptz not null default now()
);

create table if not exists public.event_retention_jobs (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete restrict,
  requested_by_user_id uuid not null references auth.users(id) on delete restrict,
  approved_by_user_id uuid references auth.users(id) on delete restrict,
  archive_export_job_id uuid references public.event_export_jobs(id) on delete restrict,
  status text not null default 'candidate'
    check (status in (
      'archive_requested',
      'archived',
      'candidate',
      'failed',
      'purge_approved',
      'purged'
    )),
  retention_eligible_at timestamptz not null,
  archive_manifest jsonb not null default '{}'::jsonb,
  manifest_checksum_sha256 text,
  source_pii_purged_at timestamptz,
  error_code text,
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

insert into public.rbac_permissions (code, scope, description) values ('admin.retention.manage', 'admin', 'Create archive records and approve retention purges after AAL2 verification.') on conflict (code) do update set scope = excluded.scope, description = excluded.description;
insert into public.rbac_role_permissions (role_id, permission_code) select role.id, 'admin.retention.manage' from public.rbac_platform_roles as role where role.scope = 'admin' and role.code in ('admin', 'super_admin') on conflict (role_id, permission_code) do nothing;
create index if not exists event_export_jobs_event_checksum_idx
  on public.event_export_jobs (event_id, checksum_sha256)
  where checksum_sha256 is not null;

create index if not exists event_export_jobs_event_created_idx
  on public.event_export_jobs (event_id, created_at desc);

create unique index if not exists event_retention_jobs_event_active_unique
  on public.event_retention_jobs (event_id)
  where status in ('archive_requested', 'archived', 'candidate', 'purge_approved');

create index if not exists event_retention_jobs_due_idx
  on public.event_retention_jobs (retention_eligible_at asc)
  where status in ('candidate', 'archive_requested', 'failed');

alter table public.event_export_jobs enable row level security;
alter table public.event_retention_jobs enable row level security;

revoke all on table public.event_export_jobs from public;
revoke all on table public.event_export_jobs from anon;
revoke all on table public.event_export_jobs from authenticated;
revoke all on table public.event_retention_jobs from public;
revoke all on table public.event_retention_jobs from anon;
revoke all on table public.event_retention_jobs from authenticated;

grant select, insert, update on table public.event_export_jobs to service_role;
grant select, insert, update on table public.event_retention_jobs to service_role;

commit;
