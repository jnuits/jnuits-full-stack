-- Admin permission policy hardening, staged from the admin audit.
--
-- Intent:
-- - replace remaining active management RLS policies that call
--   has_platform_role(...) with canonical has_permission(...) checks;
-- - keep intentional public read policies unchanged;
-- - revoke direct anon execution from privileged SECURITY DEFINER helpers;
-- - leave authenticated helper access in place where phase-one app/RLS paths
--   may still rely on it.
--
-- Rollback notes:
-- - restore prior policy bodies from supabase/schema.sql if a permission seed
--   is missing in a target environment;
-- - restore anon execute grants only for helpers that are proven public-safe.

-- Operational/audit reads.
drop policy if exists "audit events operator read" on public.audit_events;
create policy "audit events operator read"
on public.audit_events
for select
to authenticated
using (
  public.has_permission('admin.audit.read')
  or public.has_permission('admin.security.read')
  or public.has_permission('admin.reports.read')
);

drop policy if exists "certificate import batches operator read" on public.certificate_import_batches;
create policy "certificate import batches operator read"
on public.certificate_import_batches
for select
to authenticated
using (public.has_permission('admin.certificates.manage'));

drop policy if exists "certificate import staging operator read" on public.certificates_import_staging;
create policy "certificate import staging operator read"
on public.certificates_import_staging
for select
to authenticated
using (public.has_permission('admin.certificates.manage'));

-- Committee management already has canonical all-command policies. Remove the
-- older broad role-name policies so they cannot expand access.
drop policy if exists "committee assignments operator delete" on public.committee_assignments;
drop policy if exists "committee assignments operator insert" on public.committee_assignments;
drop policy if exists "committee assignments operator update" on public.committee_assignments;
drop policy if exists "committee roles operator delete" on public.committee_roles;
drop policy if exists "committee roles operator insert" on public.committee_roles;
drop policy if exists "committee roles operator update" on public.committee_roles;
drop policy if exists "committee terms operator delete" on public.committee_terms;
drop policy if exists "committee terms operator insert" on public.committee_terms;
drop policy if exists "committee terms operator update" on public.committee_terms;

-- Page singleton management. Public published-page reads remain untouched.
drop policy if exists "content pages operator delete" on public.content_pages;
create policy "content pages operator delete"
on public.content_pages
for delete
to authenticated
using (public.has_permission('cms.pages.manage'));

drop policy if exists "content pages operator insert" on public.content_pages;
create policy "content pages operator insert"
on public.content_pages
for insert
to authenticated
with check (public.has_permission('cms.pages.manage'));

drop policy if exists "content pages operator update" on public.content_pages;
create policy "content pages operator update"
on public.content_pages
for update
to authenticated
using (public.has_permission('cms.pages.manage'))
with check (public.has_permission('cms.pages.manage'));

-- Developer/project profile management. Public showcase reads remain untouched.
drop policy if exists "developer profiles operator delete" on public.developer_profiles;
create policy "developer profiles operator delete"
on public.developer_profiles
for delete
to authenticated
using (public.has_permission('cms.projects.manage'));

drop policy if exists "developer profiles operator insert" on public.developer_profiles;
create policy "developer profiles operator insert"
on public.developer_profiles
for insert
to authenticated
with check (public.has_permission('cms.projects.manage'));

drop policy if exists "developer profiles operator update" on public.developer_profiles;
create policy "developer profiles operator update"
on public.developer_profiles
for update
to authenticated
using (public.has_permission('cms.projects.manage'))
with check (public.has_permission('cms.projects.manage'));

-- Events and registration moderation.
drop policy if exists "event_registrations operator update" on public.event_registrations;
create policy "event_registrations operator update"
on public.event_registrations
for update
to authenticated
using (public.has_permission('cms.events.manage'))
with check (public.has_permission('cms.events.manage'));

drop policy if exists "events operator delete" on public.events;
create policy "events operator delete"
on public.events
for delete
to authenticated
using (public.has_permission('cms.events.manage'));

drop policy if exists "events operator insert" on public.events;
create policy "events operator insert"
on public.events
for insert
to authenticated
with check (public.has_permission('cms.events.manage'));

drop policy if exists "events operator update" on public.events;
create policy "events operator update"
on public.events
for update
to authenticated
using (public.has_permission('cms.events.manage'))
with check (public.has_permission('cms.events.manage'));

-- Gallery management. Published/public gallery reads remain untouched.
drop policy if exists "gallery album items operator delete" on public.gallery_album_items;
create policy "gallery album items operator delete"
on public.gallery_album_items
for delete
to authenticated
using (public.has_permission('cms.gallery.manage'));

drop policy if exists "gallery album items operator insert" on public.gallery_album_items;
create policy "gallery album items operator insert"
on public.gallery_album_items
for insert
to authenticated
with check (public.has_permission('cms.gallery.manage'));

drop policy if exists "gallery album items operator update" on public.gallery_album_items;
create policy "gallery album items operator update"
on public.gallery_album_items
for update
to authenticated
using (public.has_permission('cms.gallery.manage'))
with check (public.has_permission('cms.gallery.manage'));

drop policy if exists "gallery albums operator delete" on public.gallery_albums;
create policy "gallery albums operator delete"
on public.gallery_albums
for delete
to authenticated
using (public.has_permission('cms.gallery.manage'));

drop policy if exists "gallery albums operator insert" on public.gallery_albums;
create policy "gallery albums operator insert"
on public.gallery_albums
for insert
to authenticated
with check (public.has_permission('cms.gallery.manage'));

drop policy if exists "gallery albums operator update" on public.gallery_albums;
create policy "gallery albums operator update"
on public.gallery_albums
for update
to authenticated
using (public.has_permission('cms.gallery.manage'))
with check (public.has_permission('cms.gallery.manage'));

drop policy if exists "gallery entries operator delete" on public.gallery_entries;
create policy "gallery entries operator delete"
on public.gallery_entries
for delete
to authenticated
using (public.has_permission('cms.gallery.manage'));

drop policy if exists "gallery entries operator insert" on public.gallery_entries;
create policy "gallery entries operator insert"
on public.gallery_entries
for insert
to authenticated
with check (public.has_permission('cms.gallery.manage'));

drop policy if exists "gallery entries operator update" on public.gallery_entries;
create policy "gallery entries operator update"
on public.gallery_entries
for update
to authenticated
using (public.has_permission('cms.gallery.manage'))
with check (public.has_permission('cms.gallery.manage'));

-- Invitation batch canonical all-command policy already exists.
drop policy if exists "invitation batches operator read" on public.invitation_batches;

-- Membership lifecycle/cycles/application operator access.
drop policy if exists "lifecycle events operator delete" on public.membership_lifecycle_events;
create policy "lifecycle events operator delete"
on public.membership_lifecycle_events
for delete
to authenticated
using (public.has_permission('admin.membership.manage'));

drop policy if exists "lifecycle events operator insert" on public.membership_lifecycle_events;
create policy "lifecycle events operator insert"
on public.membership_lifecycle_events
for insert
to authenticated
with check (public.has_permission('admin.membership.manage'));

drop policy if exists "lifecycle events operator update" on public.membership_lifecycle_events;
create policy "lifecycle events operator update"
on public.membership_lifecycle_events
for update
to authenticated
using (public.has_permission('admin.membership.manage'))
with check (public.has_permission('admin.membership.manage'));

drop policy if exists "lifecycle own or operator read" on public.membership_lifecycle_events;
create policy "lifecycle own or operator read"
on public.membership_lifecycle_events
for select
to authenticated
using (
  public.has_permission('admin.membership.manage')
  or exists (
    select 1
    from public.members
    where members.id = membership_lifecycle_events.member_id
      and members.user_id = (select auth.uid())
  )
);

drop policy if exists "membership applications operator read" on public.membership_applications;
create policy "membership applications operator read"
on public.membership_applications
for select
to authenticated
using (public.has_permission('admin.membership.manage'));

drop policy if exists "membership applications operator update" on public.membership_applications;
create policy "membership applications operator update"
on public.membership_applications
for update
to authenticated
using (public.has_permission('admin.membership.manage'))
with check (public.has_permission('admin.membership.manage'));

drop policy if exists "membership cycle memberships operator delete" on public.membership_cycle_memberships;
create policy "membership cycle memberships operator delete"
on public.membership_cycle_memberships
for delete
to authenticated
using (public.has_permission('admin.membership.manage'));

drop policy if exists "membership cycle memberships operator insert" on public.membership_cycle_memberships;
create policy "membership cycle memberships operator insert"
on public.membership_cycle_memberships
for insert
to authenticated
with check (public.has_permission('admin.membership.manage'));

drop policy if exists "membership cycle memberships operator update" on public.membership_cycle_memberships;
create policy "membership cycle memberships operator update"
on public.membership_cycle_memberships
for update
to authenticated
using (public.has_permission('admin.membership.manage'))
with check (public.has_permission('admin.membership.manage'));

drop policy if exists "membership cycle memberships own or operator read" on public.membership_cycle_memberships;
create policy "membership cycle memberships own or operator read"
on public.membership_cycle_memberships
for select
to authenticated
using (
  public.has_permission('admin.membership.manage')
  or exists (
    select 1
    from public.members
    where members.id = membership_cycle_memberships.member_id
      and members.user_id = (select auth.uid())
  )
);

drop policy if exists "membership cycles operator delete" on public.membership_cycles;
create policy "membership cycles operator delete"
on public.membership_cycles
for delete
to authenticated
using (public.has_permission('admin.membership.manage'));

drop policy if exists "membership cycles operator insert" on public.membership_cycles;
create policy "membership cycles operator insert"
on public.membership_cycles
for insert
to authenticated
with check (public.has_permission('admin.membership.manage'));

drop policy if exists "membership cycles operator update" on public.membership_cycles;
create policy "membership cycles operator update"
on public.membership_cycles
for update
to authenticated
using (public.has_permission('admin.membership.manage'))
with check (public.has_permission('admin.membership.manage'));

-- Media management. Public media reads remain untouched.
drop policy if exists "media assets operator delete" on public.media_assets;
create policy "media assets operator delete"
on public.media_assets
for delete
to authenticated
using (public.has_permission('cms.media.manage'));

drop policy if exists "media assets operator insert" on public.media_assets;
create policy "media assets operator insert"
on public.media_assets
for insert
to authenticated
with check (public.has_permission('cms.media.manage'));

drop policy if exists "media assets operator update" on public.media_assets;
create policy "media assets operator update"
on public.media_assets
for update
to authenticated
using (public.has_permission('cms.media.manage'))
with check (public.has_permission('cms.media.manage'));

-- Operator reports currently have a read-only app permission; service-role
-- server actions remain the write path.
drop policy if exists "operator reports operator read" on public.operator_reports;
create policy "operator reports operator read"
on public.operator_reports
for select
to authenticated
using (public.has_permission('admin.reports.read'));

drop policy if exists "operator reports operator write" on public.operator_reports;
create policy "operator reports operator write"
on public.operator_reports
for insert
to authenticated
with check (public.has_permission('admin.reports.read'));

-- Project showcase management. Public showcase reads remain untouched.
drop policy if exists "project_contributors operator write" on public.project_contributors;
create policy "project_contributors operator write"
on public.project_contributors
for all
to authenticated
using (public.has_permission('cms.projects.manage'))
with check (public.has_permission('cms.projects.manage'));

drop policy if exists "projects operator write" on public.projects;
create policy "projects operator write"
on public.projects
for all
to authenticated
using (public.has_permission('cms.projects.manage'))
with check (public.has_permission('cms.projects.manage'));

-- Direct execution hardening for SECURITY DEFINER helpers. Keep intentionally
-- public helpers such as format_jnuits_id, normalize_jnuits_id, has_permission,
-- and is_admin_totp_enforced unchanged during this phase.
revoke execute on function public.allocate_membership_id(text) from anon;
revoke execute on function public.assign_advisor_jnuits_id() from anon, authenticated;
revoke execute on function public.bump_claim_version_from_member_link() from anon, authenticated;
revoke execute on function public.bump_claim_version_from_role_assignment() from anon, authenticated;
revoke execute on function public.bump_user_claim_version(uuid) from anon;
revoke execute on function public.can_access_mentorship_relationship(uuid) from anon;
revoke execute on function public.can_access_support_ticket(uuid) from anon;
revoke execute on function public.can_manage_support_ticket(uuid) from anon;
revoke execute on function public.commit_bulk_membership_operation(uuid) from anon;
revoke execute on function public.current_admin_role() from anon;
revoke execute on function public.current_member_id() from anon;
revoke execute on function public.current_member_type() from anon;
revoke execute on function public.current_portal_role() from anon;
revoke execute on function public.current_rbac_claims_snapshot() from anon;
revoke execute on function public.handle_new_auth_user() from anon, authenticated;
revoke execute on function public.has_platform_role(text) from anon;
revoke execute on function public.is_aal2() from anon;
revoke execute on function public.is_super_admin() from anon;
revoke execute on function public.is_super_admin_user(uuid) from anon;
revoke execute on function public.log_auth_user_security_event() from anon, authenticated;
revoke execute on function public.log_member_identity_security_event() from anon, authenticated;
revoke execute on function public.log_mfa_factor_security_event() from anon, authenticated;
revoke execute on function public.log_rbac_assignment_security_event() from anon, authenticated;
revoke execute on function public.log_security_settings_security_event() from anon, authenticated;
revoke execute on function public.preview_bulk_membership_operation(uuid) from anon;
revoke execute on function public.rls_auto_enable() from anon, authenticated;
revoke execute on function public.set_current_timestamp_updated_at() from anon, authenticated;
revoke execute on function public.set_member_lifecycle_status(uuid, text, text, text) from anon;
revoke execute on function public.sync_membership_id_sequence_from_member() from anon, authenticated;
revoke execute on function public.sync_user_platform_role_scope() from anon, authenticated;
revoke execute on function public.update_advisor_speech_timestamp() from anon, authenticated;
