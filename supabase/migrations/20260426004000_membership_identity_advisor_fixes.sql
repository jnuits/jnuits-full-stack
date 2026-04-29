-- Advisor fixes for the membership identity foundation.
-- Keeps the new sequencing table private to membership admins and adds indexes
-- for fresh FK columns introduced by the foundation migration.

create index if not exists admin_profiles_avatar_updated_by_user_id_idx
  on public.admin_profiles (avatar_updated_by_user_id)
  where avatar_updated_by_user_id is not null;

create index if not exists admin_profiles_created_by_user_id_idx
  on public.admin_profiles (created_by_user_id)
  where created_by_user_id is not null;

create index if not exists bulk_operations_committed_by_user_id_idx
  on public.bulk_operations (committed_by_user_id)
  where committed_by_user_id is not null;

create index if not exists members_lifecycle_changed_by_user_id_idx
  on public.members (lifecycle_changed_by_user_id)
  where lifecycle_changed_by_user_id is not null;

create index if not exists members_avatar_updated_by_user_id_idx
  on public.members (avatar_updated_by_user_id)
  where avatar_updated_by_user_id is not null;

drop policy if exists "membership id sequences membership admins read" on public.membership_id_sequences;
create policy "membership id sequences membership admins read"
on public.membership_id_sequences
for select
to authenticated
using (public.has_permission('admin.membership.manage'));

drop policy if exists "admin profiles managed by authorized admins" on public.admin_profiles;

drop policy if exists "admin profiles managed insert" on public.admin_profiles;
create policy "admin profiles managed insert"
on public.admin_profiles
for insert
to authenticated
with check (
  public.current_admin_role() = 'super_admin'
  or (
    public.has_permission('admin.admin_profiles.manage')
    and not public.is_super_admin_user(user_id)
  )
);

drop policy if exists "admin profiles managed update" on public.admin_profiles;
create policy "admin profiles managed update"
on public.admin_profiles
for update
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

drop policy if exists "admin profiles managed delete" on public.admin_profiles;
create policy "admin profiles managed delete"
on public.admin_profiles
for delete
to authenticated
using (
  public.current_admin_role() = 'super_admin'
  or (
    public.has_permission('admin.admin_profiles.manage')
    and not public.is_super_admin_user(user_id)
  )
);
