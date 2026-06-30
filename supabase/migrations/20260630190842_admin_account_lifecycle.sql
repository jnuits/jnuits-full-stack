-- Admin account lifecycle, invitation metadata, and revocation attribution.
-- Additive only. No existing admin/member/auth records are deleted.

alter table public.admin_profiles
  add column if not exists status text not null default 'active',
  add column if not exists status_reason text,
  add column if not exists status_updated_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists status_updated_at timestamptz not null default timezone('utc', now());

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'admin_profiles_status_check'
      and conrelid = 'public.admin_profiles'::regclass
  ) then
    alter table public.admin_profiles
      add constraint admin_profiles_status_check
      check (status in ('pending_invite', 'active', 'frozen', 'removed'));
  end if;
end
$$;

update public.admin_profiles
set
  status = case when is_active then 'active' else 'removed' end,
  status_updated_at = coalesce(status_updated_at, updated_at, timezone('utc', now()))
where status is null
   or status not in ('pending_invite', 'active', 'frozen', 'removed');

create index if not exists admin_profiles_status_idx
  on public.admin_profiles (status, updated_at desc);

create index if not exists admin_profiles_status_updated_by_idx
  on public.admin_profiles (status_updated_by_user_id)
  where status_updated_by_user_id is not null;

alter table public.rbac_user_platform_roles
  add column if not exists revoked_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists revocation_reason text;

create index if not exists rbac_user_platform_roles_revoked_by_idx
  on public.rbac_user_platform_roles (revoked_by_user_id)
  where revoked_by_user_id is not null;

create table if not exists public.admin_invitations (
  id uuid primary key default extensions.gen_random_uuid(),
  email extensions.citext not null,
  target_user_id uuid references auth.users(id) on delete set null,
  target_admin_profile_id uuid references public.admin_profiles(id) on delete set null,
  invited_role_code text not null
    check (invited_role_code in ('super_admin', 'admin', 'content_admin')),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'expired', 'revoked', 'failed')),
  invited_by_user_id uuid references auth.users(id) on delete set null,
  accepted_at timestamptz,
  accepted_by_user_id uuid references auth.users(id) on delete set null,
  revoked_at timestamptz,
  revoked_by_user_id uuid references auth.users(id) on delete set null,
  expires_at timestamptz not null default timezone('utc', now()) + interval '7 days',
  delivery_status text not null default 'pending'
    check (delivery_status in ('pending', 'sent', 'failed', 'skipped')),
  provider_message_id text,
  last_sent_at timestamptz,
  send_attempts integer not null default 0 check (send_attempts >= 0),
  note text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists admin_invitations_set_updated_at on public.admin_invitations;
create trigger admin_invitations_set_updated_at
before update on public.admin_invitations
for each row
execute function public.set_current_timestamp_updated_at();

alter table public.admin_invitations enable row level security;

drop policy if exists "admin invitations admin read" on public.admin_invitations;
drop policy if exists "admin invitations admin insert" on public.admin_invitations;
drop policy if exists "admin invitations admin update" on public.admin_invitations;
drop policy if exists "admin invitations admin delete" on public.admin_invitations;

create policy "admin invitations admin read"
on public.admin_invitations
for select
to authenticated
using (
  public.current_admin_role() = 'super_admin'
  or (
    public.has_permission('admin.roles.manage_admin')
    and invited_role_code = 'content_admin'
  )
  or target_user_id = auth.uid()
);

create policy "admin invitations admin insert"
on public.admin_invitations
for insert
to authenticated
with check (
  public.current_admin_role() = 'super_admin'
  or (
    public.has_permission('admin.roles.manage_admin')
    and invited_role_code = 'content_admin'
  )
);

create policy "admin invitations admin update"
on public.admin_invitations
for update
to authenticated
using (
  public.current_admin_role() = 'super_admin'
  or (
    public.has_permission('admin.roles.manage_admin')
    and invited_role_code = 'content_admin'
  )
  or target_user_id = auth.uid()
)
with check (
  public.current_admin_role() = 'super_admin'
  or (
    public.has_permission('admin.roles.manage_admin')
    and invited_role_code = 'content_admin'
  )
  or target_user_id = auth.uid()
);

create index if not exists admin_invitations_email_status_idx
  on public.admin_invitations (email, status, created_at desc);

create index if not exists admin_invitations_target_status_idx
  on public.admin_invitations (target_user_id, status, created_at desc)
  where target_user_id is not null;

create index if not exists admin_invitations_invited_by_idx
  on public.admin_invitations (invited_by_user_id, created_at desc)
  where invited_by_user_id is not null;

grant select, insert, update on public.admin_invitations to authenticated;
grant select, insert, update, delete on public.admin_invitations to service_role;
revoke delete, truncate, trigger on public.admin_invitations from anon, authenticated;

with admin_role as (
  select id
  from public.rbac_platform_roles
  where code = 'admin'
    and scope = 'admin'
  limit 1
)
insert into public.rbac_role_permissions (role_id, permission_code)
select admin_role.id, 'admin.roles.manage_admin'
from admin_role
on conflict (role_id, permission_code) do nothing;

create or replace function public.log_rbac_assignment_security_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user uuid := coalesce(new.user_id, old.user_id);
  role_code text;
  event_name text;
  actor_user uuid;
begin
  select roles.code
    into role_code
  from public.rbac_platform_roles as roles
  where roles.id = coalesce(new.role_id, old.role_id);

  if tg_op = 'INSERT' then
    event_name := 'rbac.role_assignment_granted';
    actor_user := new.granted_by;
  elsif tg_op = 'DELETE' then
    event_name := 'rbac.role_assignment_deleted';
    actor_user := coalesce(old.revoked_by_user_id, old.granted_by);
  elsif old.revoked_at is null and new.revoked_at is not null then
    event_name := 'rbac.role_assignment_revoked';
    actor_user := coalesce(new.revoked_by_user_id, new.granted_by, old.granted_by);
  else
    event_name := 'rbac.role_assignment_updated';
    actor_user := coalesce(new.granted_by, old.granted_by);
  end if;

  insert into public.security_events (
    actor_user_id,
    target_user_id,
    event_type,
    severity,
    payload
  )
  values (
    actor_user,
    target_user,
    event_name,
    case when role_code = 'super_admin' then 'critical' else 'info' end,
    jsonb_build_object(
      'role_code', role_code,
      'scope', coalesce(new.scope, old.scope),
      'assignment_id', coalesce(new.id, old.id),
      'revocation_reason', coalesce(new.revocation_reason, old.revocation_reason)
    )
  );

  return coalesce(new, old);
end;
$$;

revoke all on function public.log_rbac_assignment_security_event() from public;
grant execute on function public.log_rbac_assignment_security_event() to service_role;
