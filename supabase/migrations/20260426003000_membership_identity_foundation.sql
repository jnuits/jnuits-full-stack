-- Membership identity foundation:
-- - separates admin-only identity from public member profiles
-- - adds lifecycle/access states and avatar metadata
-- - creates atomic membership ID allocation
-- - creates staging tables for preview-then-commit bulk operations

insert into public.rbac_permissions (code, scope, description)
values
  ('admin.admin_profiles.manage', 'admin', 'Manage non-public admin profile records.'),
  ('admin.bulk.manage', 'admin', 'Preview and commit bulk membership operations.')
on conflict (code) do update
set
  scope = excluded.scope,
  description = excluded.description;

insert into public.rbac_role_permissions (role_id, permission_code)
select roles.id, permission_code
from public.rbac_platform_roles as roles
cross join (
  values
    ('admin.admin_profiles.manage'),
    ('admin.bulk.manage')
) as permissions(permission_code)
where roles.code = 'admin'
  and roles.scope = 'admin'
on conflict do nothing;

create table if not exists public.admin_profiles (
  id uuid primary key default extensions.gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  linked_member_id uuid references public.members(id) on delete set null,
  admin_code extensions.citext not null,
  display_name text not null,
  email extensions.citext,
  title text,
  avatar_public_id text,
  avatar_secure_url text,
  avatar_width integer,
  avatar_height integer,
  avatar_bytes bigint,
  avatar_format text,
  avatar_updated_at timestamptz,
  avatar_updated_by_user_id uuid references auth.users(id) on delete set null,
  is_active boolean not null default true,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint admin_profiles_admin_code_key unique (admin_code),
  constraint admin_profiles_user_id_key unique (user_id),
  constraint admin_profiles_linked_member_id_key unique (linked_member_id),
  constraint admin_profiles_avatar_dimensions_check check (
    (avatar_width is null and avatar_height is null)
    or (avatar_width = 400 and avatar_height = 400)
  ),
  constraint admin_profiles_avatar_bytes_check check (
    avatar_bytes is null or avatar_bytes >= 0
  )
);

create index if not exists admin_profiles_email_idx
  on public.admin_profiles (email)
  where email is not null;

create index if not exists admin_profiles_active_idx
  on public.admin_profiles (is_active, updated_at desc);

drop trigger if exists admin_profiles_updated_at on public.admin_profiles;
create trigger admin_profiles_updated_at
before update on public.admin_profiles
for each row execute function public.set_current_timestamp_updated_at();

alter table public.admin_profiles enable row level security;

create table if not exists public.membership_id_sequences (
  year_block text primary key,
  last_serial integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint membership_id_sequences_year_block_check check (year_block ~ '^[0-9]{4}$'),
  constraint membership_id_sequences_last_serial_check check (last_serial >= 0 and last_serial <= 999)
);

drop trigger if exists membership_id_sequences_updated_at on public.membership_id_sequences;
create trigger membership_id_sequences_updated_at
before update on public.membership_id_sequences
for each row execute function public.set_current_timestamp_updated_at();

with parsed_ids as (
  select
    substring(upper(jnuits_id::text) from '^JNUITS-([0-9]{4})[0-9]{3}$') as year_block,
    substring(upper(jnuits_id::text) from '^JNUITS-[0-9]{4}([0-9]{3})$')::integer as serial
  from public.members
  where upper(jnuits_id::text) ~ '^JNUITS-[0-9]{7}$'
),
max_serials as (
  select year_block, max(serial) as last_serial
  from parsed_ids
  where year_block is not null
  group by year_block
)
insert into public.membership_id_sequences (year_block, last_serial)
select year_block, last_serial
from max_serials
on conflict (year_block) do update
set last_serial = greatest(public.membership_id_sequences.last_serial, excluded.last_serial);

insert into public.membership_id_sequences (year_block, last_serial)
values ('0000', 0)
on conflict (year_block) do nothing;

alter table public.members
  add column if not exists lifecycle_status text not null default 'current',
  add column if not exists portal_access_status text not null default 'active',
  add column if not exists lifecycle_changed_at timestamptz,
  add column if not exists lifecycle_changed_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists lifecycle_note text,
  add column if not exists avatar_public_id text,
  add column if not exists avatar_secure_url text,
  add column if not exists avatar_width integer,
  add column if not exists avatar_height integer,
  add column if not exists avatar_bytes bigint,
  add column if not exists avatar_format text,
  add column if not exists avatar_updated_at timestamptz,
  add column if not exists avatar_updated_by_user_id uuid references auth.users(id) on delete set null;

alter table public.members
  drop constraint if exists members_lifecycle_status_check,
  add constraint members_lifecycle_status_check
    check (lifecycle_status = any (array['current', 'former', 'alumni', 'deleted'])),
  drop constraint if exists members_portal_access_status_check,
  add constraint members_portal_access_status_check
    check (portal_access_status = any (array['active', 'frozen', 'suspended', 'deletion_requested', 'deactivated'])),
  drop constraint if exists members_avatar_dimensions_check,
  add constraint members_avatar_dimensions_check
    check (
      (avatar_width is null and avatar_height is null)
      or (avatar_width = 400 and avatar_height = 400)
    ),
  drop constraint if exists members_avatar_bytes_check,
  add constraint members_avatar_bytes_check
    check (avatar_bytes is null or avatar_bytes >= 0);

create index if not exists members_lifecycle_status_idx
  on public.members (lifecycle_status, portal_access_status, updated_at desc);

create index if not exists members_public_directory_idx
  on public.members (member_type, lifecycle_status, portal_access_status, full_name)
  where lifecycle_status <> 'deleted'
    and portal_access_status = 'active'
    and upper(jnuits_id::text) !~ '^JNUITS-ADMIN-';

update public.members
set
  lifecycle_status = case
    when upper(jnuits_id::text) ~ '^JNUITS-ADMIN-' then 'deleted'
    when member_type = 'alumni' then 'alumni'
    else 'current'
  end,
  portal_access_status = case
    when upper(jnuits_id::text) ~ '^JNUITS-ADMIN-' then 'deactivated'
    else 'active'
  end,
  lifecycle_changed_at = coalesce(lifecycle_changed_at, timezone('utc', now())),
  lifecycle_note = case
    when upper(jnuits_id::text) ~ '^JNUITS-ADMIN-' then 'Migrated to admin_profiles identity surface.'
    else lifecycle_note
  end
where lifecycle_status = 'current'
  and (
    member_type = 'alumni'
    or upper(jnuits_id::text) ~ '^JNUITS-ADMIN-'
  );

insert into public.admin_profiles (
  user_id,
  linked_member_id,
  admin_code,
  display_name,
  email,
  title,
  is_active,
  created_at,
  updated_at
)
select distinct on (users.id)
  users.id,
  null::uuid,
  coalesce(
    nullif(case when upper(members.jnuits_id::text) ~ '^JNUITS-ADMIN-' then upper(members.jnuits_id::text) end, ''),
    'JNUITS-ADMIN-' || upper(left(replace(users.id::text, '-', ''), 8))
  )::extensions.citext,
  coalesce(nullif(members.full_name, ''), nullif(users.raw_user_meta_data ->> 'display_name', ''), users.email, 'JnUITS Admin'),
  coalesce(members.email::text, users.email)::extensions.citext,
  roles.display_name,
  true,
  coalesce(members.created_at, users.created_at, timezone('utc', now())),
  timezone('utc', now())
from public.rbac_user_platform_roles as grants
join public.rbac_platform_roles as roles
  on roles.id = grants.role_id
join auth.users as users
  on users.id = grants.user_id
left join public.members as members
  on members.user_id = users.id
where grants.revoked_at is null
  and roles.scope = 'admin'
on conflict (user_id) do update
set
  display_name = excluded.display_name,
  email = excluded.email,
  title = excluded.title,
  is_active = true,
  updated_at = timezone('utc', now());

do $$
begin
  if exists (
    select 1
    from pg_constraint
    where conrelid = 'public.profile_update_requests'::regclass
      and conname = 'profile_update_requests_request_type_check'
  ) then
    alter table public.profile_update_requests
      drop constraint profile_update_requests_request_type_check;
  end if;
end $$;

alter table public.profile_update_requests
  add constraint profile_update_requests_request_type_check
  check (
    request_type = any (
      array[
        'workplace_update',
        'profile_change',
        'email_change',
        'jnuits_id_change',
        'alumni_conversion',
        'account_deletion'
      ]
    )
  );

create table if not exists public.bulk_operations (
  id uuid primary key default extensions.gen_random_uuid(),
  operation_type text not null,
  status text not null default 'draft',
  original_filename text,
  total_rows integer not null default 0,
  valid_rows integer not null default 0,
  error_rows integer not null default 0,
  committed_rows integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id uuid references auth.users(id) on delete set null,
  committed_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  previewed_at timestamptz,
  committed_at timestamptz,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint bulk_operations_operation_type_check check (
    operation_type = any (
      array[
        'legacy_member_import',
        'member_invite',
        'alumni_invite',
        'lifecycle_update',
        'role_update',
        'alumni_conversion',
        'account_deletion_review'
      ]
    )
  ),
  constraint bulk_operations_status_check check (
    status = any (array['draft', 'previewed', 'committing', 'committed', 'failed', 'cancelled'])
  ),
  constraint bulk_operations_counts_check check (
    total_rows >= 0 and valid_rows >= 0 and error_rows >= 0 and committed_rows >= 0
  )
);

create index if not exists bulk_operations_created_by_idx
  on public.bulk_operations (created_by_user_id, created_at desc);

create index if not exists bulk_operations_status_idx
  on public.bulk_operations (status, created_at desc);

drop trigger if exists bulk_operations_updated_at on public.bulk_operations;
create trigger bulk_operations_updated_at
before update on public.bulk_operations
for each row execute function public.set_current_timestamp_updated_at();

alter table public.bulk_operations enable row level security;

create table if not exists public.bulk_operation_rows (
  id uuid primary key default extensions.gen_random_uuid(),
  operation_id uuid not null references public.bulk_operations(id) on delete cascade,
  row_number integer not null,
  raw_data jsonb not null default '{}'::jsonb,
  normalized_data jsonb not null default '{}'::jsonb,
  status text not null default 'pending',
  errors jsonb not null default '[]'::jsonb,
  result jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint bulk_operation_rows_row_number_check check (row_number > 0),
  constraint bulk_operation_rows_status_check check (
    status = any (array['pending', 'valid', 'error', 'committed', 'skipped'])
  ),
  constraint bulk_operation_rows_operation_row_unique unique (operation_id, row_number)
);

create index if not exists bulk_operation_rows_operation_status_idx
  on public.bulk_operation_rows (operation_id, status, row_number);

drop trigger if exists bulk_operation_rows_updated_at on public.bulk_operation_rows;
create trigger bulk_operation_rows_updated_at
before update on public.bulk_operation_rows
for each row execute function public.set_current_timestamp_updated_at();

alter table public.bulk_operation_rows enable row level security;

create or replace function public.is_super_admin_user(target_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.rbac_user_platform_roles as grants
    join public.rbac_platform_roles as roles
      on roles.id = grants.role_id
    where grants.user_id = target_user_id
      and grants.revoked_at is null
      and roles.scope = 'admin'
      and roles.code = 'super_admin'
  );
$$;

revoke all on function public.is_super_admin_user(uuid) from public;
grant execute on function public.is_super_admin_user(uuid) to authenticated, service_role;

create or replace function public.format_jnuits_id(raw_id text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when raw_id is null or btrim(raw_id) = '' then ''
    when upper(btrim(raw_id)) ~ '^JNUITS-' then 'JnUITS-' || substring(upper(btrim(raw_id)) from '^JNUITS-(.+)$')
    else 'JnUITS-' || upper(btrim(raw_id))
  end;
$$;

create or replace function public.normalize_jnuits_id(raw_id text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when raw_id is null or btrim(raw_id) = '' then ''
    when upper(btrim(raw_id)) ~ '^JNUITS-' then upper(btrim(raw_id))
    else 'JNUITS-' || upper(btrim(raw_id))
  end;
$$;

create or replace function public.allocate_membership_id(year_block text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  safe_block text := btrim(coalesce(year_block, ''));
  next_serial integer;
begin
  if auth.role() is distinct from 'service_role' and not public.has_permission('admin.membership.manage') then
    raise exception 'Insufficient permission to allocate membership IDs.'
      using errcode = '42501';
  end if;

  if safe_block !~ '^[0-9]{4}$' then
    raise exception 'Membership ID block must be exactly four digits.';
  end if;

  insert into public.membership_id_sequences (year_block, last_serial)
  values (safe_block, 0)
  on conflict (year_block) do nothing;

  update public.membership_id_sequences
  set last_serial = last_serial + 1
  where year_block = safe_block
    and last_serial < 999
  returning last_serial into next_serial;

  if next_serial is null then
    raise exception 'Membership ID block % has no remaining serials.', safe_block;
  end if;

  return 'JNUITS-' || safe_block || lpad(next_serial::text, 3, '0');
end;
$$;

revoke all on function public.allocate_membership_id(text) from public;
grant execute on function public.allocate_membership_id(text) to authenticated, service_role;

create or replace function public.set_member_lifecycle_status(
  target_member_id uuid,
  next_lifecycle_status text,
  next_portal_access_status text,
  reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid := auth.uid();
  previous_record public.members%rowtype;
  now_value timestamptz := timezone('utc', now());
begin
  if auth.role() is distinct from 'service_role' and not public.has_permission('admin.membership.manage') then
    raise exception 'Insufficient permission to change member lifecycle status.'
      using errcode = '42501';
  end if;

  if not (next_lifecycle_status = any (array['current', 'former', 'alumni', 'deleted'])) then
    raise exception 'Invalid lifecycle status %.', next_lifecycle_status;
  end if;

  if not (next_portal_access_status = any (array['active', 'frozen', 'suspended', 'deletion_requested', 'deactivated'])) then
    raise exception 'Invalid portal access status %.', next_portal_access_status;
  end if;

  select *
    into previous_record
  from public.members
  where id = target_member_id
  for update;

  if not found then
    raise exception 'Member was not found.';
  end if;

  update public.members
  set
    lifecycle_status = next_lifecycle_status,
    portal_access_status = next_portal_access_status,
    lifecycle_changed_at = now_value,
    lifecycle_changed_by_user_id = actor_id,
    lifecycle_note = nullif(btrim(reason), ''),
    member_type = case
      when next_lifecycle_status = 'alumni' then 'alumni'
      when member_type = 'alumni' and next_lifecycle_status = 'current' then 'current'
      else member_type
    end,
    alumni_since = case
      when next_lifecycle_status = 'alumni' then coalesce(alumni_since, now_value::date)
      else alumni_since
    end,
    updated_at = now_value
  where id = target_member_id;

  insert into public.membership_lifecycle_events (
    member_id,
    event_type,
    occurred_at,
    summary,
    metadata,
    created_by_user_id
  )
  values (
    target_member_id,
    'lifecycle_status_changed',
    now_value,
    'Member lifecycle/access status changed.',
    jsonb_build_object(
      'previous_lifecycle_status', previous_record.lifecycle_status,
      'previous_portal_access_status', previous_record.portal_access_status,
      'current_lifecycle_status', next_lifecycle_status,
      'current_portal_access_status', next_portal_access_status,
      'reason', nullif(btrim(reason), '')
    ),
    actor_id
  );

  insert into public.security_events (
    actor_user_id,
    target_user_id,
    event_type,
    severity,
    payload
  )
  values (
    actor_id,
    previous_record.user_id,
    'member.lifecycle_status_changed',
    case
      when next_portal_access_status in ('suspended', 'deactivated') or next_lifecycle_status = 'deleted' then 'warning'
      else 'info'
    end,
    jsonb_build_object(
      'member_id', target_member_id,
      'previous_lifecycle_status', previous_record.lifecycle_status,
      'previous_portal_access_status', previous_record.portal_access_status,
      'current_lifecycle_status', next_lifecycle_status,
      'current_portal_access_status', next_portal_access_status
    )
  );

  return jsonb_build_object(
    'member_id', target_member_id,
    'lifecycle_status', next_lifecycle_status,
    'portal_access_status', next_portal_access_status
  );
end;
$$;

revoke all on function public.set_member_lifecycle_status(uuid, text, text, text) from public;
grant execute on function public.set_member_lifecycle_status(uuid, text, text, text) to authenticated, service_role;

create or replace function public.preview_bulk_membership_operation(target_operation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  total_count integer;
  valid_count integer;
  error_count integer;
begin
  if auth.role() is distinct from 'service_role' and not public.has_permission('admin.bulk.manage') then
    raise exception 'Insufficient permission to preview bulk operations.'
      using errcode = '42501';
  end if;

  select
    count(*),
    count(*) filter (where status = 'valid'),
    count(*) filter (where status = 'error')
  into total_count, valid_count, error_count
  from public.bulk_operation_rows
  where operation_id = target_operation_id;

  update public.bulk_operations
  set
    total_rows = coalesce(total_count, 0),
    valid_rows = coalesce(valid_count, 0),
    error_rows = coalesce(error_count, 0),
    status = 'previewed',
    previewed_at = timezone('utc', now())
  where id = target_operation_id
    and status in ('draft', 'previewed', 'failed');

  if not found then
    raise exception 'Bulk operation was not found or cannot be previewed.';
  end if;

  return jsonb_build_object(
    'operation_id', target_operation_id,
    'total_rows', coalesce(total_count, 0),
    'valid_rows', coalesce(valid_count, 0),
    'error_rows', coalesce(error_count, 0)
  );
end;
$$;

revoke all on function public.preview_bulk_membership_operation(uuid) from public;
grant execute on function public.preview_bulk_membership_operation(uuid) to authenticated, service_role;

create or replace function public.commit_bulk_membership_operation(target_operation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  operation_record public.bulk_operations%rowtype;
begin
  if auth.role() is distinct from 'service_role' and not public.has_permission('admin.bulk.manage') then
    raise exception 'Insufficient permission to commit bulk operations.'
      using errcode = '42501';
  end if;

  select *
    into operation_record
  from public.bulk_operations
  where id = target_operation_id
  for update;

  if not found then
    raise exception 'Bulk operation was not found.';
  end if;

  if operation_record.status = 'committed' then
    return jsonb_build_object(
      'operation_id', target_operation_id,
      'status', 'committed',
      'committed_rows', operation_record.committed_rows
    );
  end if;

  if operation_record.status <> 'previewed' or operation_record.error_rows > 0 then
    raise exception 'Bulk operation must be previewed with zero row errors before commit.';
  end if;

  raise exception 'Bulk operation type % is staged but not yet implemented in commit handler.', operation_record.operation_type;
end;
$$;

revoke all on function public.commit_bulk_membership_operation(uuid) from public;
grant execute on function public.commit_bulk_membership_operation(uuid) to authenticated, service_role;

drop policy if exists "admin profiles self or admin read" on public.admin_profiles;
create policy "admin profiles self or admin read"
on public.admin_profiles
for select
to authenticated
using (
  user_id = (select auth.uid())
  or public.current_admin_role() = 'super_admin'
  or (
    public.has_permission('admin.admin_profiles.manage')
    and not public.is_super_admin_user(user_id)
  )
);

drop policy if exists "admin profiles managed by authorized admins" on public.admin_profiles;
create policy "admin profiles managed by authorized admins"
on public.admin_profiles
for all
to authenticated
using (
  public.current_admin_role() = 'super_admin'
  or (
    public.has_permission('admin.admin_profiles.manage')
    and not public.is_super_admin_user(user_id)
  )
)
with check (
  public.current_admin_role() = 'super_admin'
  or (
    public.has_permission('admin.admin_profiles.manage')
    and not public.is_super_admin_user(user_id)
  )
);

drop policy if exists "bulk operations membership admins" on public.bulk_operations;
create policy "bulk operations membership admins"
on public.bulk_operations
for all
to authenticated
using (public.has_permission('admin.bulk.manage'))
with check (public.has_permission('admin.bulk.manage'));

drop policy if exists "bulk operation rows membership admins" on public.bulk_operation_rows;
create policy "bulk operation rows membership admins"
on public.bulk_operation_rows
for all
to authenticated
using (public.has_permission('admin.bulk.manage'))
with check (public.has_permission('admin.bulk.manage'));

drop policy if exists "member invitations operator only" on public.member_invitations;
drop policy if exists "member invitations membership admins" on public.member_invitations;
create policy "member invitations membership admins"
on public.member_invitations
for all
to authenticated
using (public.has_permission('admin.membership.manage'))
with check (public.has_permission('admin.membership.manage'));

grant select, insert, update, delete on public.admin_profiles to authenticated;
grant select, insert, update, delete on public.bulk_operations to authenticated;
grant select, insert, update, delete on public.bulk_operation_rows to authenticated;
grant select on public.membership_id_sequences to authenticated;
