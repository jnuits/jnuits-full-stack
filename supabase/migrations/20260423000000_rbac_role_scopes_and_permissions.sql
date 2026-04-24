-- Phase 1: RBAC schema normalization, canonical roles, and permission catalog

alter table public.rbac_platform_roles
  add column if not exists scope text,
  add column if not exists rank integer,
  add column if not exists is_hidden boolean,
  add column if not exists is_assignable boolean,
  add column if not exists display_name text;

alter table public.rbac_user_platform_roles
  add column if not exists scope text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'rbac_platform_roles_scope_check'
      and conrelid = 'public.rbac_platform_roles'::regclass
  ) then
    alter table public.rbac_platform_roles
      add constraint rbac_platform_roles_scope_check
      check (scope in ('admin', 'portal'));
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'rbac_user_platform_roles_scope_check'
      and conrelid = 'public.rbac_user_platform_roles'::regclass
  ) then
    alter table public.rbac_user_platform_roles
      add constraint rbac_user_platform_roles_scope_check
      check (scope in ('admin', 'portal'));
  end if;
end
$$;

update public.rbac_platform_roles
set
  rank = coalesce(rank, 100),
  is_hidden = coalesce(is_hidden, false),
  is_assignable = coalesce(is_assignable, true),
  display_name = coalesce(display_name, title, initcap(replace(code, '_', ' ')));

with role_seed (
  code,
  title,
  display_name,
  scope,
  rank,
  is_hidden,
  is_assignable,
  is_system
) as (
  values
    ('super_admin', 'Super Administrator', 'Super Admin', 'admin', 1000, true, false, true),
    ('admin', 'Platform Administrator', 'Admin', 'admin', 900, false, true, true),
    ('content_admin', 'Content Administrator', 'Content Admin', 'admin', 700, false, true, true),
    ('moderator', 'Moderator', 'Moderator (Legacy)', 'admin', 850, false, false, true),
    ('content_editor', 'Content Editor', 'Content Editor (Legacy)', 'admin', 650, false, false, true),
    ('committee_author', 'Committee Author', 'Committee Author (Legacy)', 'admin', 640, false, false, true),
    ('member', 'Member', 'Member', 'portal', 100, false, true, true),
    ('alumni', 'Alumni', 'Alumni', 'portal', 120, false, true, true),
    ('executive', 'Executive', 'Executive', 'portal', 300, false, true, true),
    ('alumni_ambassador', 'Alumni Ambassador', 'Alumni Ambassador', 'portal', 320, false, true, true)
)
insert into public.rbac_platform_roles (
  code,
  title,
  display_name,
  scope,
  rank,
  is_hidden,
  is_assignable,
  is_system
)
select
  role_seed.code,
  role_seed.title,
  role_seed.display_name,
  role_seed.scope,
  role_seed.rank,
  role_seed.is_hidden,
  role_seed.is_assignable,
  role_seed.is_system
from role_seed
on conflict (code) do update
set
  title = excluded.title,
  display_name = excluded.display_name,
  scope = excluded.scope,
  rank = excluded.rank,
  is_hidden = excluded.is_hidden,
  is_assignable = excluded.is_assignable,
  is_system = excluded.is_system;

do $$
begin
  if exists (
    select 1
    from public.rbac_platform_roles
    where scope is null
       or display_name is null
       or rank is null
       or is_hidden is null
       or is_assignable is null
  ) then
    raise exception 'RBAC role normalization left null metadata; inspect rbac_platform_roles before continuing.';
  end if;
end
$$;

alter table public.rbac_platform_roles
  alter column scope set not null,
  alter column rank set not null,
  alter column rank set default 100,
  alter column is_hidden set not null,
  alter column is_hidden set default false,
  alter column is_assignable set not null,
  alter column is_assignable set default true,
  alter column display_name set not null;

create or replace function public.sync_user_platform_role_scope()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  resolved_scope text;
begin
  select roles.scope
  into resolved_scope
  from public.rbac_platform_roles as roles
  where roles.id = new.role_id;

  if resolved_scope is null then
    raise exception 'Unable to resolve scope for role_id %', new.role_id;
  end if;

  new.scope = resolved_scope;
  return new;
end;
$$;

drop trigger if exists rbac_user_platform_roles_sync_scope on public.rbac_user_platform_roles;
create trigger rbac_user_platform_roles_sync_scope
before insert or update of role_id
on public.rbac_user_platform_roles
for each row
execute function public.sync_user_platform_role_scope();

update public.rbac_user_platform_roles as grants
set scope = roles.scope
from public.rbac_platform_roles as roles
where roles.id = grants.role_id
  and grants.scope is distinct from roles.scope;

with legacy_role_map (legacy_code, target_code) as (
  values
    ('moderator', 'admin'),
    ('content_editor', 'content_admin'),
    ('committee_author', 'content_admin')
),
legacy_assignments as (
  select
    grants.id as source_grant_id,
    grants.user_id,
    grants.granted_by,
    grants.granted_at,
    grants.note,
    target_role.id as target_role_id,
    target_role.scope as target_scope,
    legacy_role_map.legacy_code
  from public.rbac_user_platform_roles as grants
  join public.rbac_platform_roles as legacy_role
    on legacy_role.id = grants.role_id
  join legacy_role_map
    on legacy_role_map.legacy_code = legacy_role.code
  join public.rbac_platform_roles as target_role
    on target_role.code = legacy_role_map.target_code
  where grants.revoked_at is null
),
inserted_assignments as (
  insert into public.rbac_user_platform_roles (
    user_id,
    role_id,
    scope,
    granted_by,
    granted_at,
    note
  )
  select
    legacy_assignments.user_id,
    legacy_assignments.target_role_id,
    legacy_assignments.target_scope,
    legacy_assignments.granted_by,
    legacy_assignments.granted_at,
    concat_ws(
      E'\n',
      nullif(legacy_assignments.note, ''),
      format('Migrated from legacy role: %s', legacy_assignments.legacy_code)
    )
  from legacy_assignments
  where not exists (
    select 1
    from public.rbac_user_platform_roles as existing
    where existing.user_id = legacy_assignments.user_id
      and existing.role_id = legacy_assignments.target_role_id
      and existing.revoked_at is null
  )
  returning user_id
)
select count(*) from inserted_assignments;

with legacy_role_map (legacy_code, target_code) as (
  values
    ('moderator', 'admin'),
    ('content_editor', 'content_admin'),
    ('committee_author', 'content_admin')
)
update public.rbac_user_platform_roles as grants
set
  revoked_at = coalesce(grants.revoked_at, timezone('utc', now())),
  note = concat_ws(
    E'\n',
    nullif(grants.note, ''),
    format('Revoked after migration to canonical role: %s', legacy_role_map.target_code)
  )
from public.rbac_platform_roles as legacy_role
join legacy_role_map
  on legacy_role_map.legacy_code = legacy_role.code
where grants.role_id = legacy_role.id
  and grants.revoked_at is null;

with portal_roles as (
  select code, id, scope
  from public.rbac_platform_roles
  where code in ('member', 'alumni')
),
eligible_members as (
  select
    members.user_id,
    members.id as member_id,
    case
      when members.member_type = 'alumni' then 'alumni'
      else 'member'
    end as target_role_code
  from public.members as members
  where members.user_id is not null
),
portal_backfill as (
  insert into public.rbac_user_platform_roles (
    user_id,
    role_id,
    scope,
    note
  )
  select
    eligible_members.user_id,
    portal_roles.id,
    portal_roles.scope,
    'Backfilled from members.member_type during portal RBAC initialization'
  from eligible_members
  join portal_roles
    on portal_roles.code = eligible_members.target_role_code
  where not exists (
    select 1
    from public.rbac_user_platform_roles as existing
    where existing.user_id = eligible_members.user_id
      and existing.scope = 'portal'
      and existing.revoked_at is null
  )
  returning user_id
)
select count(*) from portal_backfill;

with ranked_assignments as (
  select
    grants.id,
    grants.user_id,
    roles.scope,
    roles.code,
    first_value(roles.code) over (
      partition by grants.user_id, roles.scope
      order by roles.rank desc, grants.granted_at asc, grants.created_at asc, grants.id asc
    ) as retained_role_code,
    row_number() over (
      partition by grants.user_id, roles.scope
      order by roles.rank desc, grants.granted_at asc, grants.created_at asc, grants.id asc
    ) as row_number
  from public.rbac_user_platform_roles as grants
  join public.rbac_platform_roles as roles
    on roles.id = grants.role_id
  where grants.revoked_at is null
)
update public.rbac_user_platform_roles as grants
set
  revoked_at = coalesce(grants.revoked_at, timezone('utc', now())),
  note = concat_ws(
    E'\n',
    nullif(grants.note, ''),
    format(
      'Auto-revoked during single-role-per-scope normalization; retained higher-ranked role: %s',
      ranked_assignments.retained_role_code
    )
  )
from ranked_assignments
where grants.id = ranked_assignments.id
  and ranked_assignments.row_number > 1
  and grants.revoked_at is null;

update public.rbac_user_platform_roles as grants
set scope = roles.scope
from public.rbac_platform_roles as roles
where roles.id = grants.role_id
  and grants.scope is distinct from roles.scope;

do $$
begin
  if exists (
    select 1
    from public.rbac_user_platform_roles
    where scope is null
  ) then
    raise exception 'RBAC user role scope backfill left null scope values; inspect rbac_user_platform_roles before continuing.';
  end if;
end
$$;

alter table public.rbac_user_platform_roles
  alter column scope set not null;

create unique index if not exists rbac_user_role_active_scope_unique
  on public.rbac_user_platform_roles (user_id, scope)
  where revoked_at is null;

create index if not exists rbac_user_roles_user_scope_role_idx
  on public.rbac_user_platform_roles (user_id, revoked_at, scope, role_id);

create index if not exists members_user_id_not_null_idx
  on public.members (user_id)
  where user_id is not null;

create table if not exists public.rbac_permissions (
  code text primary key,
  scope text not null check (scope in ('admin', 'portal')),
  description text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.rbac_role_permissions (
  role_id uuid not null references public.rbac_platform_roles (id) on delete cascade,
  permission_code text not null references public.rbac_permissions (code) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (role_id, permission_code)
);

create index if not exists rbac_role_permissions_role_permission_idx
  on public.rbac_role_permissions (role_id, permission_code);

with permission_seed (code, scope, description) as (
  values
    ('admin.dashboard.read', 'admin', 'Read the admin dashboard and operational metrics.'),
    ('admin.settings.read', 'admin', 'Read administrative settings modules.'),
    ('admin.settings.write', 'admin', 'Update administrative settings modules.'),
    ('admin.roles.read', 'admin', 'Read visible role definitions and assignments.'),
    ('admin.roles.manage_admin', 'admin', 'Manage admin-scope role assignments.'),
    ('admin.roles.manage_portal', 'admin', 'Manage portal-scope role assignments.'),
    ('admin.security.read', 'admin', 'Read security state and security-sensitive admin data.'),
    ('admin.security.write', 'admin', 'Mutate security-sensitive admin settings and controls.'),
    ('cms.notices.manage', 'admin', 'Create, update, publish, archive, and delete notices.'),
    ('cms.gallery.manage', 'admin', 'Create, update, publish, archive, and delete gallery content.'),
    ('cms.events.manage', 'admin', 'Create, update, publish, archive, and delete events.'),
    ('cms.blogs.review', 'admin', 'Review and moderate blog submissions.'),
    ('cms.blogs.publish', 'admin', 'Publish official or reviewed blog content.'),
    ('cms.contacts.manage', 'admin', 'Review and respond to contact form submissions.'),
    ('cms.email_marketing.manage', 'admin', 'Manage email marketing audiences and sends.'),
    ('portal.profile.manage_self', 'portal', 'Manage the authenticated user''s own portal profile.'),
    ('portal.blogs.submit', 'portal', 'Create and submit blog drafts for review.'),
    ('portal.tickets.create_self', 'portal', 'Create support tickets for the authenticated user.'),
    ('portal.mentorship.participate', 'portal', 'Participate in the mentorship module.'),
    ('portal.tickets.manage_member', 'portal', 'Manage member-facing ticket queues.'),
    ('portal.tickets.manage_alumni', 'portal', 'Manage alumni-facing ticket queues.'),
    ('portal.community.moderate', 'portal', 'Moderate community workflows within the portal.')
)
insert into public.rbac_permissions (code, scope, description)
select code, scope, description
from permission_seed
on conflict (code) do update
set
  scope = excluded.scope,
  description = excluded.description;

with role_permission_seed (role_code, permission_code) as (
  values
    ('admin', 'admin.dashboard.read'),
    ('admin', 'admin.settings.read'),
    ('admin', 'admin.settings.write'),
    ('admin', 'admin.roles.read'),
    ('admin', 'admin.roles.manage_portal'),
    ('admin', 'admin.security.read'),
    ('admin', 'admin.security.write'),
    ('admin', 'cms.notices.manage'),
    ('admin', 'cms.gallery.manage'),
    ('admin', 'cms.events.manage'),
    ('admin', 'cms.blogs.review'),
    ('admin', 'cms.blogs.publish'),
    ('admin', 'cms.contacts.manage'),
    ('admin', 'cms.email_marketing.manage'),
    ('content_admin', 'admin.dashboard.read'),
    ('content_admin', 'cms.notices.manage'),
    ('content_admin', 'cms.gallery.manage'),
    ('content_admin', 'cms.events.manage'),
    ('content_admin', 'cms.blogs.review'),
    ('content_admin', 'cms.blogs.publish'),
    ('content_admin', 'cms.contacts.manage'),
    ('content_admin', 'cms.email_marketing.manage'),
    ('member', 'portal.profile.manage_self'),
    ('member', 'portal.blogs.submit'),
    ('member', 'portal.tickets.create_self'),
    ('alumni', 'portal.profile.manage_self'),
    ('alumni', 'portal.blogs.submit'),
    ('alumni', 'portal.tickets.create_self'),
    ('alumni', 'portal.mentorship.participate'),
    ('executive', 'portal.profile.manage_self'),
    ('executive', 'portal.blogs.submit'),
    ('executive', 'portal.tickets.create_self'),
    ('executive', 'portal.tickets.manage_member'),
    ('executive', 'portal.community.moderate'),
    ('alumni_ambassador', 'portal.profile.manage_self'),
    ('alumni_ambassador', 'portal.blogs.submit'),
    ('alumni_ambassador', 'portal.tickets.create_self'),
    ('alumni_ambassador', 'portal.mentorship.participate'),
    ('alumni_ambassador', 'portal.tickets.manage_alumni'),
    ('alumni_ambassador', 'portal.community.moderate')
)
insert into public.rbac_role_permissions (role_id, permission_code)
select roles.id, role_permission_seed.permission_code
from role_permission_seed
join public.rbac_platform_roles as roles
  on roles.code = role_permission_seed.role_code
on conflict (role_id, permission_code) do nothing;
