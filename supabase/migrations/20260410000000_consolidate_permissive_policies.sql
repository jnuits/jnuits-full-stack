-- Migration: 20260410000000_consolidate_permissive_policies
-- Purpose: Fix "multiple permissive policies" advisor warnings on 13 tables.
--
-- Root cause: Each affected table has both a FOR ALL policy (which covers SELECT,
-- INSERT, UPDATE, DELETE) AND a dedicated SELECT policy. The query planner must
-- evaluate both SELECT conditions, which is redundant and slow.
--
-- Fix: Convert the FOR ALL operator-write policies to explicit INSERT + UPDATE +
-- DELETE policies only. The dedicated SELECT policy then becomes the sole gatekeeper
-- for reads, eliminating the dual-evaluation overhead.
-- ──────────────────────────────────────────────────────────────────────────────

-- ── 1. committee_assignments ─────────────────────────────────────────────────
drop policy if exists "committee assignments operator write" on public.committee_assignments;
create policy "committee assignments operator insert" on public.committee_assignments
  for insert to authenticated
  with check (public.has_platform_role('admin'));
create policy "committee assignments operator update" on public.committee_assignments
  for update to authenticated
  using (public.has_platform_role('admin'));
create policy "committee assignments operator delete" on public.committee_assignments
  for delete to authenticated
  using (public.has_platform_role('admin'));

-- ── 2. committee_roles ───────────────────────────────────────────────────────
drop policy if exists "committee roles operator write" on public.committee_roles;
create policy "committee roles operator insert" on public.committee_roles
  for insert to authenticated
  with check (public.has_platform_role('admin'));
create policy "committee roles operator update" on public.committee_roles
  for update to authenticated
  using (public.has_platform_role('admin'));
create policy "committee roles operator delete" on public.committee_roles
  for delete to authenticated
  using (public.has_platform_role('admin'));

-- ── 3. committee_terms ───────────────────────────────────────────────────────
drop policy if exists "committee terms operator write" on public.committee_terms;
create policy "committee terms operator insert" on public.committee_terms
  for insert to authenticated
  with check (public.has_platform_role('admin'));
create policy "committee terms operator update" on public.committee_terms
  for update to authenticated
  using (public.has_platform_role('admin'));
create policy "committee terms operator delete" on public.committee_terms
  for delete to authenticated
  using (public.has_platform_role('admin'));

-- ── 4. content_pages ─────────────────────────────────────────────────────────
drop policy if exists "content pages operator write" on public.content_pages;
create policy "content pages operator insert" on public.content_pages
  for insert to authenticated
  with check (public.has_platform_role('admin'));
create policy "content pages operator update" on public.content_pages
  for update to authenticated
  using (public.has_platform_role('admin'));
create policy "content pages operator delete" on public.content_pages
  for delete to authenticated
  using (public.has_platform_role('admin'));

-- ── 5. content_posts ─────────────────────────────────────────────────────────
drop policy if exists "content posts operator write" on public.content_posts;
create policy "content posts operator insert" on public.content_posts
  for insert to authenticated
  with check (public.has_platform_role('admin'));
create policy "content posts operator update" on public.content_posts
  for update to authenticated
  using (public.has_platform_role('admin'));
create policy "content posts operator delete" on public.content_posts
  for delete to authenticated
  using (public.has_platform_role('admin'));

-- ── 6. developer_profiles ────────────────────────────────────────────────────
drop policy if exists "developer profiles operator write" on public.developer_profiles;
create policy "developer profiles operator insert" on public.developer_profiles
  for insert to authenticated
  with check (public.has_platform_role('admin'));
create policy "developer profiles operator update" on public.developer_profiles
  for update to authenticated
  using (public.has_platform_role('admin'));
create policy "developer profiles operator delete" on public.developer_profiles
  for delete to authenticated
  using (public.has_platform_role('admin'));

-- ── 7. gallery_entries ───────────────────────────────────────────────────────
drop policy if exists "gallery entries operator write" on public.gallery_entries;
create policy "gallery entries operator insert" on public.gallery_entries
  for insert to authenticated
  with check (public.has_platform_role('admin'));
create policy "gallery entries operator update" on public.gallery_entries
  for update to authenticated
  using (public.has_platform_role('admin'));
create policy "gallery entries operator delete" on public.gallery_entries
  for delete to authenticated
  using (public.has_platform_role('admin'));

-- ── 8. invitation_batches ────────────────────────────────────────────────────
drop policy if exists "invitation batches operator write" on public.invitation_batches;
create policy "invitation batches operator insert" on public.invitation_batches
  for insert to authenticated
  with check (public.has_platform_role('admin'));
create policy "invitation batches operator update" on public.invitation_batches
  for update to authenticated
  using (public.has_platform_role('admin'));
create policy "invitation batches operator delete" on public.invitation_batches
  for delete to authenticated
  using (public.has_platform_role('admin'));

-- ── 9. media_assets ──────────────────────────────────────────────────────────
drop policy if exists "media assets content operator write" on public.media_assets;
create policy "media assets operator insert" on public.media_assets
  for insert to authenticated
  with check (public.has_platform_role('admin'));
create policy "media assets operator update" on public.media_assets
  for update to authenticated
  using (public.has_platform_role('admin'));
create policy "media assets operator delete" on public.media_assets
  for delete to authenticated
  using (public.has_platform_role('admin'));

-- ── 10. membership_cycle_memberships ─────────────────────────────────────────
drop policy if exists "membership cycle memberships operator write" on public.membership_cycle_memberships;
create policy "membership cycle memberships operator insert" on public.membership_cycle_memberships
  for insert to authenticated
  with check (public.has_platform_role('admin'));
create policy "membership cycle memberships operator update" on public.membership_cycle_memberships
  for update to authenticated
  using (public.has_platform_role('admin'));
create policy "membership cycle memberships operator delete" on public.membership_cycle_memberships
  for delete to authenticated
  using (public.has_platform_role('admin'));

-- ── 11. membership_cycles ────────────────────────────────────────────────────
drop policy if exists "membership cycles operator write" on public.membership_cycles;
create policy "membership cycles operator insert" on public.membership_cycles
  for insert to authenticated
  with check (public.has_platform_role('admin'));
create policy "membership cycles operator update" on public.membership_cycles
  for update to authenticated
  using (public.has_platform_role('admin'));
create policy "membership cycles operator delete" on public.membership_cycles
  for delete to authenticated
  using (public.has_platform_role('admin'));

-- ── 12. membership_lifecycle_events ──────────────────────────────────────────
drop policy if exists "lifecycle operator write" on public.membership_lifecycle_events;
create policy "lifecycle events operator insert" on public.membership_lifecycle_events
  for insert to authenticated
  with check (public.has_platform_role('admin'));
create policy "lifecycle events operator update" on public.membership_lifecycle_events
  for update to authenticated
  using (public.has_platform_role('admin'));
create policy "lifecycle events operator delete" on public.membership_lifecycle_events
  for delete to authenticated
  using (public.has_platform_role('admin'));

-- ── 13. rbac_user_platform_roles ─────────────────────────────────────────────
drop policy if exists "rbac user roles operator write" on public.rbac_user_platform_roles;
create policy "rbac user roles operator insert" on public.rbac_user_platform_roles
  for insert to authenticated
  with check (public.has_platform_role('admin'));
create policy "rbac user roles operator update" on public.rbac_user_platform_roles
  for update to authenticated
  using (public.has_platform_role('admin'));
create policy "rbac user roles operator delete" on public.rbac_user_platform_roles
  for delete to authenticated
  using (public.has_platform_role('admin'));
