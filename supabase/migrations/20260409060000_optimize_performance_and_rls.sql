-- Optimize Supabase Query Performance and RLS INITPLAN Bottlenecks

-- ==============================================================================
-- 1. DROP UNUSED INDEXES to improve write speeds and storage
-- ==============================================================================
drop index if exists public.members_department_code_idx;
drop index if exists public.audit_events_created_idx;
drop index if exists public.certificates_issue_date_idx;
drop index if exists public.certificates_import_staging_batch_idx;
drop index if exists public.membership_applications_reviewed_idx;
drop index if exists public.operator_reports_type_idx;
drop index if exists public.media_assets_kind_public_idx;
drop index if exists public.committee_terms_rollover_source_idx;
drop index if exists public.committee_assignments_rollover_source_idx;
drop index if exists public.membership_cycles_status_idx;
drop index if exists public.membership_cycle_memberships_cycle_state_idx;
drop index if exists public.invitation_batches_cycle_status_idx;

-- ==============================================================================
-- 2. CREATE COVERING INDEXES FOR UNINDEXED FOREIGN KEYS
-- ==============================================================================
create index if not exists audit_events_actor_user_id_idx on public.audit_events (actor_user_id);
create index if not exists cert_import_batches_created_by_user_id_idx on public.certificate_import_batches (created_by_user_id);
create index if not exists committee_assignments_created_by_idx on public.committee_assignments (created_by_user_id);
create index if not exists committee_assignments_role_id_idx on public.committee_assignments (role_id);
create index if not exists committee_terms_created_by_idx on public.committee_terms (created_by_user_id);
create index if not exists content_pages_created_by_idx on public.content_pages (created_by_user_id);
create index if not exists content_posts_created_by_idx on public.content_posts (created_by_user_id);
create index if not exists content_posts_media_asset_id_idx on public.content_posts (media_asset_id);
create index if not exists content_posts_reviewed_by_user_id_idx on public.content_posts (reviewed_by_user_id);
create index if not exists dev_profiles_created_by_user_id_idx on public.developer_profiles (created_by_user_id);
create index if not exists dev_profiles_media_asset_id_idx on public.developer_profiles (media_asset_id);
create index if not exists gallery_entries_created_by_user_id_idx on public.gallery_entries (created_by_user_id);
create index if not exists gallery_entries_media_asset_id_idx on public.gallery_entries (media_asset_id);
create index if not exists invitation_batches_created_by_user_id_idx on public.invitation_batches (created_by_user_id);
create index if not exists media_assets_created_by_user_id_idx on public.media_assets (created_by_user_id);
create index if not exists member_invitations_created_by_user_id_idx on public.member_invitations (created_by_user_id);
create index if not exists membership_apps_dept_code_idx on public.membership_applications (department_code);
create index if not exists membership_apps_invitation_id_idx on public.membership_applications (invitation_id);
create index if not exists membership_apps_reviewed_by_idx on public.membership_applications (reviewed_by_user_id);
create index if not exists membership_cycle_memberships_created_by_idx on public.membership_cycle_memberships (created_by_user_id);
create index if not exists membership_cycles_created_by_idx on public.membership_cycles (created_by_user_id);
create index if not exists membership_lifecycle_events_created_by_idx on public.membership_lifecycle_events (created_by_user_id);
create index if not exists operator_reports_created_by_idx on public.operator_reports (created_by_user_id);
create index if not exists profile_update_requests_reviewed_by_idx on public.profile_update_requests (reviewed_by_user_id);
create index if not exists profiles_department_code_idx on public.profiles (department_code);
create index if not exists rbac_user_platform_roles_granted_by_idx on public.rbac_user_platform_roles (granted_by);
create index if not exists rbac_user_platform_roles_role_id_idx on public.rbac_user_platform_roles (role_id);

-- ==============================================================================
-- 3. REWRITE RLS INITIALIZATION PLAN FOR PERFORMANCE (auth.uid() -> (select auth.uid()))
-- ==============================================================================

-- profiles
drop policy if exists "profiles self select" on public.profiles;
create policy "profiles self select" on public.profiles for select using ((select auth.uid()) = id or public.has_platform_role('admin') or public.has_platform_role('moderator'));

drop policy if exists "profiles self insert" on public.profiles;
create policy "profiles self insert" on public.profiles for insert with check ((select auth.uid()) = id);

drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles for update using ((select auth.uid()) = id or public.has_platform_role('admin') or public.has_platform_role('moderator')) with check ((select auth.uid()) = id or public.has_platform_role('admin') or public.has_platform_role('moderator'));

-- members
drop policy if exists "members owner or operator select" on public.members;
create policy "members owner or operator select" on public.members for select using ((select auth.uid()) = user_id or public.has_platform_role('admin') or public.has_platform_role('moderator'));

-- rbac_platform_roles
drop policy if exists "rbac roles authenticated read" on public.rbac_platform_roles;
create policy "rbac roles authenticated read" on public.rbac_platform_roles for select using ((select auth.uid()) is not null);

-- rbac_user_platform_roles
drop policy if exists "rbac user roles own or operator read" on public.rbac_user_platform_roles;
create policy "rbac user roles own or operator read" on public.rbac_user_platform_roles for select using (user_id = (select auth.uid()) or public.has_platform_role('admin') or public.has_platform_role('moderator'));

-- membership_lifecycle_events
drop policy if exists "lifecycle own or operator read" on public.membership_lifecycle_events;
create policy "lifecycle own or operator read" on public.membership_lifecycle_events for select using (
  exists (
    select 1 from public.members
    where public.members.id = membership_lifecycle_events.member_id and public.members.user_id = (select auth.uid())
  )
  or public.has_platform_role('admin') or public.has_platform_role('moderator')
);

-- profile_update_requests
drop policy if exists "profile update request own read" on public.profile_update_requests;
create policy "profile update request own read" on public.profile_update_requests for select using (
  exists (
    select 1 from public.members
    where public.members.id = profile_update_requests.member_id and public.members.user_id = (select auth.uid())
  )
  or public.has_platform_role('admin') or public.has_platform_role('moderator')
);

drop policy if exists "profile update request own insert" on public.profile_update_requests;
create policy "profile update request own insert" on public.profile_update_requests for insert with check (
  exists (
    select 1 from public.members
    where public.members.id = profile_update_requests.member_id and public.members.user_id = (select auth.uid())
  )
);

-- membership_cycles
drop policy if exists "membership cycles authenticated read" on public.membership_cycles;
create policy "membership cycles authenticated read" on public.membership_cycles for select using ((select auth.uid()) is not null);

-- membership_cycle_memberships
drop policy if exists "membership cycle memberships own or operator read" on public.membership_cycle_memberships;
create policy "membership cycle memberships own or operator read" on public.membership_cycle_memberships for select using (
  exists (
    select 1 from public.members
    where public.members.id = membership_cycle_memberships.member_id and public.members.user_id = (select auth.uid())
  )
  or public.has_platform_role('admin') or public.has_platform_role('moderator')
);
