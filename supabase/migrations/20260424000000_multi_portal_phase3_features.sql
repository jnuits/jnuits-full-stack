-- Phase 3: multi-portal permissions, security tables, portal features, and
-- blog moderation normalization.

alter table public.members
  add column if not exists first_name text null,
  add column if not exists last_name text null,
  add column if not exists student_id text null,
  add column if not exists graduation_year integer null;

update public.members
set
  first_name = coalesce(
    first_name,
    nullif(split_part(btrim(full_name), ' ', 1), '')
  ),
  last_name = coalesce(
    last_name,
    nullif(
      btrim(
        case
          when position(' ' in btrim(full_name)) > 0
            then substr(btrim(full_name), position(' ' in btrim(full_name)) + 1)
          else ''
        end
      ),
      ''
    )
  )
where first_name is null
   or last_name is null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'members_graduation_year_check'
      and conrelid = 'public.members'::regclass
  ) then
    alter table public.members
      add constraint members_graduation_year_check
      check (
        graduation_year is null
        or graduation_year between 1950 and 2100
      );
  end if;
end
$$;

create table if not exists public.rbac_user_claim_versions (
  user_id uuid primary key references auth.users (id) on delete cascade,
  version bigint not null default 1,
  updated_at timestamptz not null default timezone('utc', now())
);

create or replace function public.bump_user_claim_version(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if target_user_id is null then
    return;
  end if;

  insert into public.rbac_user_claim_versions (user_id, version, updated_at)
  values (target_user_id, 1, timezone('utc', now()))
  on conflict (user_id) do update
  set
    version = public.rbac_user_claim_versions.version + 1,
    updated_at = timezone('utc', now());
end;
$$;

create or replace function public.bump_claim_version_from_role_assignment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.bump_user_claim_version(coalesce(new.user_id, old.user_id));
  return coalesce(new, old);
end;
$$;

drop trigger if exists rbac_user_platform_roles_bump_claim_version on public.rbac_user_platform_roles;
create trigger rbac_user_platform_roles_bump_claim_version
after insert or update or delete
on public.rbac_user_platform_roles
for each row
execute function public.bump_claim_version_from_role_assignment();

create or replace function public.bump_claim_version_from_member_link()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform public.bump_user_claim_version(old.user_id);
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    perform public.bump_user_claim_version(new.user_id);
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists members_bump_claim_version on public.members;
create trigger members_bump_claim_version
after insert or update of user_id or delete
on public.members
for each row
execute function public.bump_claim_version_from_member_link();

insert into public.rbac_user_claim_versions (user_id, version)
select distinct grants.user_id, 1
from public.rbac_user_platform_roles as grants
where grants.user_id is not null
on conflict (user_id) do nothing;

insert into public.rbac_user_claim_versions (user_id, version)
select distinct members.user_id, 1
from public.members as members
where members.user_id is not null
on conflict (user_id) do nothing;

create or replace function public.current_member_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select members.id
  from public.members
  where members.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.current_member_type()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select members.member_type
  from public.members
  where members.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.is_aal2()
returns boolean
language sql
stable
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2';
$$;

grant execute on function public.current_member_id() to authenticated;
grant execute on function public.current_member_type() to authenticated;
grant execute on function public.is_aal2() to authenticated;

with permission_seed (code, scope, description) as (
  values
    ('admin.membership.manage', 'admin', 'Manage membership applications, invitations, and membership-cycle operations.'),
    ('admin.committee.manage', 'admin', 'Manage committee rosters and organization structures.'),
    ('admin.reports.read', 'admin', 'Read operator and administrative reports.'),
    ('admin.reconcile.manage', 'admin', 'Run reconciliation and remediation workflows.'),
    ('admin.certificates.manage', 'admin', 'Manage certificate imports, issuance, and verification tooling.'),
    ('admin.decisions.read', 'admin', 'Read organizational decisions and operator logs.'),
    ('admin.audit.read', 'admin', 'Read security and operational audit trails.'),
    ('admin.support.manage', 'admin', 'Read and manage portal support workflows across all audiences.'),
    ('cms.media.manage', 'admin', 'Manage the reusable media library and media asset registry.'),
    ('cms.pages.manage', 'admin', 'Manage singleton pages and static public content surfaces.'),
    ('cms.projects.manage', 'admin', 'Manage public project showcase content.'),
    ('portal.mentorship.request', 'portal', 'Request and access mentorship relationships as a portal user.')
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
    ('admin', 'admin.membership.manage'),
    ('admin', 'admin.committee.manage'),
    ('admin', 'admin.reports.read'),
    ('admin', 'admin.reconcile.manage'),
    ('admin', 'admin.certificates.manage'),
    ('admin', 'admin.decisions.read'),
    ('admin', 'admin.audit.read'),
    ('admin', 'admin.support.manage'),
    ('admin', 'cms.media.manage'),
    ('admin', 'cms.pages.manage'),
    ('admin', 'cms.projects.manage'),
    ('content_admin', 'cms.media.manage'),
    ('content_admin', 'cms.pages.manage'),
    ('content_admin', 'cms.projects.manage'),
    ('member', 'portal.mentorship.request'),
    ('alumni', 'portal.mentorship.request'),
    ('executive', 'portal.mentorship.request'),
    ('executive', 'portal.tickets.manage_member'),
    ('executive', 'portal.community.moderate'),
    ('alumni_ambassador', 'portal.mentorship.request'),
    ('alumni_ambassador', 'portal.tickets.manage_alumni'),
    ('alumni_ambassador', 'portal.community.moderate')
)
insert into public.rbac_role_permissions (role_id, permission_code)
select roles.id, role_permission_seed.permission_code
from role_permission_seed
join public.rbac_platform_roles as roles
  on roles.code = role_permission_seed.role_code
on conflict (role_id, permission_code) do nothing;

create table if not exists public.portal_user_settings (
  user_id uuid primary key references auth.users (id) on delete cascade,
  member_id uuid null references public.members (id) on delete set null,
  notification_email_opt_in boolean not null default true,
  mentorship_opt_in boolean not null default false,
  ticket_digest_opt_in boolean not null default true,
  preferred_theme text not null default 'system'
    check (preferred_theme in ('system', 'light', 'dark')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists portal_user_settings_set_updated_at on public.portal_user_settings;
create trigger portal_user_settings_set_updated_at
before update on public.portal_user_settings
for each row
execute function public.set_current_timestamp_updated_at();

create table if not exists public.security_events (
  id uuid primary key default extensions.gen_random_uuid(),
  actor_user_id uuid null references auth.users (id) on delete set null,
  target_user_id uuid null references auth.users (id) on delete set null,
  event_type text not null,
  severity text not null default 'info'
    check (severity in ('info', 'warning', 'critical')),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists security_events_target_created_idx
  on public.security_events (target_user_id, created_at desc);

create index if not exists security_events_actor_created_idx
  on public.security_events (actor_user_id, created_at desc);

create table if not exists public.support_tickets (
  id uuid primary key default extensions.gen_random_uuid(),
  opened_by_user_id uuid not null references auth.users (id) on delete cascade,
  member_id uuid null references public.members (id) on delete set null,
  audience_scope text not null
    check (audience_scope in ('member', 'alumni')),
  category text not null,
  status text not null default 'open'
    check (status in ('open', 'in_progress', 'waiting_on_member', 'resolved', 'closed')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  assigned_to_user_id uuid null references auth.users (id) on delete set null,
  assigned_role_scope text null
    check (assigned_role_scope in ('member', 'alumni', 'admin')),
  escalated_to_admin boolean not null default false,
  subject text not null,
  summary text not null,
  resolved_at timestamptz null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists support_tickets_opened_by_idx
  on public.support_tickets (opened_by_user_id, created_at desc);

create index if not exists support_tickets_audience_status_idx
  on public.support_tickets (audience_scope, status, created_at desc);

create index if not exists support_tickets_assigned_idx
  on public.support_tickets (assigned_to_user_id, status, created_at desc);

drop trigger if exists support_tickets_set_updated_at on public.support_tickets;
create trigger support_tickets_set_updated_at
before update on public.support_tickets
for each row
execute function public.set_current_timestamp_updated_at();

create table if not exists public.support_ticket_messages (
  id uuid primary key default extensions.gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  author_user_id uuid not null references auth.users (id) on delete cascade,
  body_markdown text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists support_ticket_messages_ticket_created_idx
  on public.support_ticket_messages (ticket_id, created_at asc);

create table if not exists public.support_ticket_events (
  id uuid primary key default extensions.gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets (id) on delete cascade,
  actor_user_id uuid null references auth.users (id) on delete set null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists support_ticket_events_ticket_created_idx
  on public.support_ticket_events (ticket_id, created_at asc);

create table if not exists public.mentorship_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  member_id uuid not null unique references public.members (id) on delete cascade,
  availability_status text not null default 'open'
    check (availability_status in ('open', 'limited', 'paused')),
  bio text not null default '',
  interests text[] not null default '{}'::text[],
  opt_in boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists mentorship_profiles_set_updated_at on public.mentorship_profiles;
create trigger mentorship_profiles_set_updated_at
before update on public.mentorship_profiles
for each row
execute function public.set_current_timestamp_updated_at();

create table if not exists public.mentorship_relationships (
  id uuid primary key default extensions.gen_random_uuid(),
  member_user_id uuid not null references auth.users (id) on delete cascade,
  alumni_user_id uuid not null references auth.users (id) on delete cascade,
  status text not null default 'requested'
    check (status in ('requested', 'active', 'declined', 'closed')),
  created_by_user_id uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now()),
  closed_at timestamptz null
);

create unique index if not exists mentorship_relationships_active_pair_idx
  on public.mentorship_relationships (member_user_id, alumni_user_id)
  where status in ('requested', 'active') and closed_at is null;

create index if not exists mentorship_relationships_member_idx
  on public.mentorship_relationships (member_user_id, created_at desc);

create index if not exists mentorship_relationships_alumni_idx
  on public.mentorship_relationships (alumni_user_id, created_at desc);

create table if not exists public.mentorship_messages (
  id uuid primary key default extensions.gen_random_uuid(),
  relationship_id uuid not null references public.mentorship_relationships (id) on delete cascade,
  author_user_id uuid not null references auth.users (id) on delete cascade,
  body_markdown text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists mentorship_messages_relationship_created_idx
  on public.mentorship_messages (relationship_id, created_at asc);

create table if not exists public.blog_review_events (
  id uuid primary key default extensions.gen_random_uuid(),
  post_id uuid not null references public.content_posts (id) on delete cascade,
  reviewer_user_id uuid null references auth.users (id) on delete set null,
  action text not null,
  note text null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists blog_review_events_post_created_idx
  on public.blog_review_events (post_id, created_at desc);

alter table public.content_posts
  drop constraint if exists content_posts_status_check;

update public.content_posts
set
  status = case
    when status = 'submitted' then 'pending_review'
    when status = 'returned' then 'change_requested'
    else status
  end,
  submitted_at = case
    when status = 'submitted' and submitted_at is null then updated_at
    else submitted_at
  end
where status in ('submitted', 'returned');

alter table public.content_posts
  add constraint content_posts_status_check
  check (status in ('draft', 'pending_review', 'change_requested', 'published', 'archived'));

create index if not exists content_posts_author_review_state_idx
  on public.content_posts (author_member_id, content_type, status, updated_at desc);

create index if not exists content_posts_pending_review_idx
  on public.content_posts (content_type, status, submitted_at desc nulls last, updated_at desc);

create or replace function public.can_access_support_ticket(target_ticket_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.support_tickets as tickets
    where tickets.id = target_ticket_id
      and (
        tickets.opened_by_user_id = auth.uid()
        or tickets.assigned_to_user_id = auth.uid()
        or public.has_permission('admin.support.manage')
        or (
          tickets.audience_scope = 'member'
          and public.has_permission('portal.tickets.manage_member')
        )
        or (
          tickets.audience_scope = 'alumni'
          and public.has_permission('portal.tickets.manage_alumni')
        )
      )
  );
$$;

create or replace function public.can_manage_support_ticket(target_ticket_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.support_tickets as tickets
    where tickets.id = target_ticket_id
      and (
        public.has_permission('admin.support.manage')
        or tickets.assigned_to_user_id = auth.uid()
        or (
          tickets.audience_scope = 'member'
          and public.has_permission('portal.tickets.manage_member')
        )
        or (
          tickets.audience_scope = 'alumni'
          and public.has_permission('portal.tickets.manage_alumni')
        )
      )
  );
$$;

create or replace function public.can_access_mentorship_relationship(target_relationship_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.mentorship_relationships as relationships
    where relationships.id = target_relationship_id
      and (
        relationships.member_user_id = auth.uid()
        or relationships.alumni_user_id = auth.uid()
        or public.has_permission('portal.community.moderate')
        or public.has_permission('admin.support.manage')
      )
  );
$$;

grant execute on function public.can_access_support_ticket(uuid) to authenticated;
grant execute on function public.can_manage_support_ticket(uuid) to authenticated;
grant execute on function public.can_access_mentorship_relationship(uuid) to authenticated;

create or replace function public.jnuits_custom_access_token_hook(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  claims jsonb := coalesce(event -> 'claims', '{}'::jsonb);
  user_uuid uuid;
  admin_role text;
  portal_role text;
  member_id uuid;
  claim_version bigint := 1;
  portals text[];
begin
  user_uuid := nullif(event ->> 'user_id', '')::uuid;

  if user_uuid is null then
    return jsonb_build_object('claims', claims);
  end if;

  with active_roles as (
    select roles.scope, roles.code
    from public.rbac_user_platform_roles as grants
    join public.rbac_platform_roles as roles
      on roles.id = grants.role_id
    where grants.user_id = user_uuid
      and grants.revoked_at is null
  ),
  reduced_roles as (
    select
      max(code) filter (where scope = 'admin') as admin_role,
      max(code) filter (where scope = 'portal') as portal_role
    from active_roles
  )
  select
    reduced_roles.admin_role,
    reduced_roles.portal_role,
    members.id,
    coalesce(role_versions.version, 1)
  into
    admin_role,
    portal_role,
    member_id,
    claim_version
  from reduced_roles
  left join public.members
    on members.user_id = user_uuid
  left join public.rbac_user_claim_versions as role_versions
    on role_versions.user_id = user_uuid;

  portals := array_remove(
    array[
      case when admin_role is not null then 'admin' end,
      case when portal_role is not null then 'portal' end
    ],
    null
  );

  claims := jsonb_set(
    claims,
    '{jnuits_admin_role}',
    coalesce(to_jsonb(admin_role), 'null'::jsonb),
    true
  );
  claims := jsonb_set(
    claims,
    '{jnuits_portal_role}',
    coalesce(to_jsonb(portal_role), 'null'::jsonb),
    true
  );
  claims := jsonb_set(
    claims,
    '{jnuits_portals}',
    to_jsonb(coalesce(portals, array[]::text[])),
    true
  );
  claims := jsonb_set(
    claims,
    '{jnuits_member_id}',
    coalesce(to_jsonb(member_id::text), 'null'::jsonb),
    true
  );
  claims := jsonb_set(
    claims,
    '{jnuits_role_version}',
    to_jsonb(claim_version),
    true
  );

  return jsonb_build_object('claims', claims);
end;
$$;

alter table public.portal_user_settings enable row level security;
alter table public.security_events enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;
alter table public.support_ticket_events enable row level security;
alter table public.mentorship_profiles enable row level security;
alter table public.mentorship_relationships enable row level security;
alter table public.mentorship_messages enable row level security;
alter table public.blog_review_events enable row level security;

drop policy if exists "portal user settings own select" on public.portal_user_settings;
drop policy if exists "portal user settings own insert" on public.portal_user_settings;
drop policy if exists "portal user settings own update" on public.portal_user_settings;

create policy "portal user settings own select"
on public.portal_user_settings
for select
to authenticated
using (user_id = auth.uid());

create policy "portal user settings own insert"
on public.portal_user_settings
for insert
to authenticated
with check (
  user_id = auth.uid()
  and (member_id is null or member_id = public.current_member_id())
);

create policy "portal user settings own update"
on public.portal_user_settings
for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and (member_id is null or member_id = public.current_member_id())
);

drop policy if exists "security events admin select" on public.security_events;
drop policy if exists "security events admin insert" on public.security_events;

create policy "security events admin select"
on public.security_events
for select
to authenticated
using (
  public.has_permission('admin.security.read')
  or public.has_permission('admin.audit.read')
);

create policy "security events admin insert"
on public.security_events
for insert
to authenticated
with check (
  actor_user_id = auth.uid()
  and public.has_permission('admin.security.write')
  and public.is_aal2()
);

drop policy if exists "support tickets select access" on public.support_tickets;
drop policy if exists "support tickets insert self" on public.support_tickets;
drop policy if exists "support tickets update managed" on public.support_tickets;

create policy "support tickets select access"
on public.support_tickets
for select
to authenticated
using (public.can_access_support_ticket(id));

create policy "support tickets insert self"
on public.support_tickets
for insert
to authenticated
with check (
  opened_by_user_id = auth.uid()
  and public.has_permission('portal.tickets.create_self')
  and (
    member_id is null
    or member_id = public.current_member_id()
  )
);

create policy "support tickets update managed"
on public.support_tickets
for update
to authenticated
using (public.can_manage_support_ticket(id))
with check (public.can_manage_support_ticket(id));

drop policy if exists "support ticket messages select access" on public.support_ticket_messages;
drop policy if exists "support ticket messages insert access" on public.support_ticket_messages;

create policy "support ticket messages select access"
on public.support_ticket_messages
for select
to authenticated
using (public.can_access_support_ticket(ticket_id));

create policy "support ticket messages insert access"
on public.support_ticket_messages
for insert
to authenticated
with check (
  author_user_id = auth.uid()
  and public.can_access_support_ticket(ticket_id)
);

drop policy if exists "support ticket events select access" on public.support_ticket_events;
drop policy if exists "support ticket events insert access" on public.support_ticket_events;

create policy "support ticket events select access"
on public.support_ticket_events
for select
to authenticated
using (public.can_access_support_ticket(ticket_id));

create policy "support ticket events insert access"
on public.support_ticket_events
for insert
to authenticated
with check (
  coalesce(actor_user_id, auth.uid()) = auth.uid()
  and public.can_access_support_ticket(ticket_id)
);

drop policy if exists "mentorship profiles select access" on public.mentorship_profiles;
drop policy if exists "mentorship profiles insert self" on public.mentorship_profiles;
drop policy if exists "mentorship profiles update self" on public.mentorship_profiles;

create policy "mentorship profiles select access"
on public.mentorship_profiles
for select
to authenticated
using (
  user_id = auth.uid()
  or opt_in = true
  or public.has_permission('portal.community.moderate')
  or public.has_permission('admin.support.manage')
);

create policy "mentorship profiles insert self"
on public.mentorship_profiles
for insert
to authenticated
with check (
  user_id = auth.uid()
  and member_id = public.current_member_id()
);

create policy "mentorship profiles update self"
on public.mentorship_profiles
for update
to authenticated
using (
  user_id = auth.uid()
  or public.has_permission('portal.community.moderate')
  or public.has_permission('admin.support.manage')
)
with check (
  (user_id = auth.uid() and member_id = public.current_member_id())
  or public.has_permission('portal.community.moderate')
  or public.has_permission('admin.support.manage')
);

drop policy if exists "mentorship relationships select access" on public.mentorship_relationships;
drop policy if exists "mentorship relationships insert participant" on public.mentorship_relationships;
drop policy if exists "mentorship relationships update access" on public.mentorship_relationships;

create policy "mentorship relationships select access"
on public.mentorship_relationships
for select
to authenticated
using (public.can_access_mentorship_relationship(id));

create policy "mentorship relationships insert participant"
on public.mentorship_relationships
for insert
to authenticated
with check (
  created_by_user_id = auth.uid()
  and (
    public.has_permission('portal.mentorship.request')
    or public.has_permission('portal.mentorship.participate')
    or public.has_permission('portal.community.moderate')
  )
  and (
    member_user_id = auth.uid()
    or alumni_user_id = auth.uid()
    or public.has_permission('portal.community.moderate')
  )
);

create policy "mentorship relationships update access"
on public.mentorship_relationships
for update
to authenticated
using (
  public.can_access_mentorship_relationship(id)
)
with check (
  public.can_access_mentorship_relationship(id)
);

drop policy if exists "mentorship messages select access" on public.mentorship_messages;
drop policy if exists "mentorship messages insert access" on public.mentorship_messages;

create policy "mentorship messages select access"
on public.mentorship_messages
for select
to authenticated
using (public.can_access_mentorship_relationship(relationship_id));

create policy "mentorship messages insert access"
on public.mentorship_messages
for insert
to authenticated
with check (
  author_user_id = auth.uid()
  and public.can_access_mentorship_relationship(relationship_id)
);

drop policy if exists "blog review events select access" on public.blog_review_events;
drop policy if exists "blog review events insert access" on public.blog_review_events;

create policy "blog review events select access"
on public.blog_review_events
for select
to authenticated
using (
  public.has_permission('cms.blogs.review')
  or exists (
    select 1
    from public.content_posts as posts
    where posts.id = blog_review_events.post_id
      and posts.author_member_id = public.current_member_id()
  )
);

create policy "blog review events insert access"
on public.blog_review_events
for insert
to authenticated
with check (
  public.has_permission('cms.blogs.review')
  or public.has_permission('portal.blogs.submit')
);

drop policy if exists "content posts operator insert" on public.content_posts;
drop policy if exists "content posts operator update" on public.content_posts;
drop policy if exists "content posts operator delete" on public.content_posts;
drop policy if exists "content posts author select" on public.content_posts;
drop policy if exists "content posts author insert" on public.content_posts;
drop policy if exists "content posts author update" on public.content_posts;
drop policy if exists "content posts admin select" on public.content_posts;
drop policy if exists "content posts admin insert" on public.content_posts;
drop policy if exists "content posts admin update" on public.content_posts;
drop policy if exists "content posts admin delete" on public.content_posts;

create policy "content posts author select"
on public.content_posts
for select
to authenticated
using (
  content_type = 'blog'
  and author_member_id = public.current_member_id()
);

create policy "content posts author insert"
on public.content_posts
for insert
to authenticated
with check (
  content_type = 'blog'
  and author_member_id = public.current_member_id()
  and public.has_permission('portal.blogs.submit')
  and status in ('draft', 'pending_review', 'change_requested')
);

create policy "content posts author update"
on public.content_posts
for update
to authenticated
using (
  content_type = 'blog'
  and author_member_id = public.current_member_id()
)
with check (
  content_type = 'blog'
  and author_member_id = public.current_member_id()
  and public.has_permission('portal.blogs.submit')
  and status in ('draft', 'pending_review', 'change_requested')
);

create policy "content posts admin select"
on public.content_posts
for select
to authenticated
using (
  (content_type = 'blog' and public.has_permission('cms.blogs.review'))
  or (content_type = 'notice' and public.has_permission('cms.notices.manage'))
  or (content_type = 'event' and public.has_permission('cms.events.manage'))
);

create policy "content posts admin insert"
on public.content_posts
for insert
to authenticated
with check (
  (content_type = 'blog' and public.has_permission('cms.blogs.review'))
  or (content_type = 'notice' and public.has_permission('cms.notices.manage'))
  or (content_type = 'event' and public.has_permission('cms.events.manage'))
);

create policy "content posts admin update"
on public.content_posts
for update
to authenticated
using (
  (content_type = 'blog' and public.has_permission('cms.blogs.review'))
  or (content_type = 'notice' and public.has_permission('cms.notices.manage'))
  or (content_type = 'event' and public.has_permission('cms.events.manage'))
)
with check (
  (content_type = 'blog' and public.has_permission('cms.blogs.review'))
  or (content_type = 'notice' and public.has_permission('cms.notices.manage'))
  or (content_type = 'event' and public.has_permission('cms.events.manage'))
);

create policy "content posts admin delete"
on public.content_posts
for delete
to authenticated
using (
  (content_type = 'blog' and public.has_permission('cms.blogs.publish'))
  or (content_type = 'notice' and public.has_permission('cms.notices.manage'))
  or (content_type = 'event' and public.has_permission('cms.events.manage'))
);
