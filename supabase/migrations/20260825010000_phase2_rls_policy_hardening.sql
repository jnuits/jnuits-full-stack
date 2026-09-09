-- Phase 2 RLS policy hardening (audit findings DB-003, DB-004, DB-007, DB-008, DB-009)
--
-- DB-003 mentorship_relationships: participants could previously rewrite ANY
-- column of a relationship they participate in (swap member_user_id /
-- alumni_user_id, reopen closed rows, forge created_by_user_id) while the
-- participant predicate stayed satisfied. The app itself only ever writes
-- `status` and `closed_at` (portal/mentorship actions), so ownership columns
-- are now locked by a BEFORE UPDATE trigger. The closed⇒closed_at invariant
-- from the integrity audit is enforced in the same trigger.
--
-- DB-004 projects / project_contributors: the unconditional public SELECT
-- policies exposed archived rows forever ("hidden at app layer" is not a
-- control). Anonymous readers now see non-archived rows only; authenticated
-- members keep full read; operators keep full access via their FOR ALL
-- permission policies.
--
-- DB-007 admin_invitations: the update policy let the invited target flip
-- status/accepted_at on their own row (audit forgery, no privilege gain).
-- Actual claim acceptance runs through the service-role-only
-- finalize_member_invitation_claim RPC, and every app write path uses the
-- service-role admin client, so the invitee branch is removed from the update
-- policy; invitees keep read-only visibility through the select policy.
--
-- DB-008 current_admin_role()/current_portal_role()/is_aal2(): residual
-- PUBLIC EXECUTE meant anon could still invoke them via PostgREST. They are
-- evaluated inside RLS policies for authenticated users, so EXECUTE is
-- re-granted explicitly to authenticated + service_role after revoking from
-- public/anon.
--
-- DB-009 operator_reports: the INSERT policy gated writes on the *read*
-- permission (admin.reports.read). Service-role server actions are the write
-- path; the insert policy is dropped so browser roles are read-only.

begin;

-- ── DB-003: mentorship relationship immutability + close-time invariant ─────

create or replace function public.enforce_mentorship_relationship_update_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.member_user_id is distinct from old.member_user_id
     or new.alumni_user_id is distinct from old.alumni_user_id
     or new.created_by_user_id is distinct from old.created_by_user_id
     or new.created_at is distinct from old.created_at then
    raise exception 'mentorship relationship ownership columns are immutable';
  end if;

  if new.status = 'closed' and new.closed_at is null then
    raise exception 'closing a mentorship relationship requires closed_at';
  end if;

  if new.status <> 'closed' then
    new.closed_at := null;
  end if;

  return new;
end;
$$;

drop trigger if exists mentorship_relationships_update_guard
  on public.mentorship_relationships;

create trigger mentorship_relationships_update_guard
  before update on public.mentorship_relationships
  for each row
  execute function public.enforce_mentorship_relationship_update_guard();

revoke execute on function public.enforce_mentorship_relationship_update_guard()
  from public, anon, authenticated;

-- ── DB-004: hide archived projects/contributors from anonymous readers ──────

drop policy if exists "projects unified select" on public.projects;
drop policy if exists "projects public select" on public.projects;
drop policy if exists "projects authenticated select" on public.projects;

create policy "projects public select"
  on public.projects
  for select
  to anon
  using (status is distinct from 'archived');

create policy "projects authenticated select"
  on public.projects
  for select
  to authenticated
  using (true);

drop policy if exists "project_contributors unified select"
  on public.project_contributors;
drop policy if exists "project_contributors public select"
  on public.project_contributors;
drop policy if exists "project_contributors authenticated select"
  on public.project_contributors;

create policy "project_contributors public select"
  on public.project_contributors
  for select
  to anon
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_id
        and p.status is distinct from 'archived'
    )
  );

create policy "project_contributors authenticated select"
  on public.project_contributors
  for select
  to authenticated
  using (true);

-- ── DB-007: admin invitations are manager-mutation-only ─────────────────────

drop policy if exists "admin invitations admin update"
  on public.admin_invitations;

create policy "admin invitations admin update"
  on public.admin_invitations
  for update
  to authenticated
  using (
    current_admin_role() = 'super_admin'
    or (
      has_permission('admin.roles.manage_admin')
      and invited_role_code = 'content_admin'
    )
  )
  with check (
    current_admin_role() = 'super_admin'
    or (
      has_permission('admin.roles.manage_admin')
      and invited_role_code = 'content_admin'
    )
  );

-- Invitees retain read-only visibility via "admin invitations admin read".

-- ── DB-008: lock down RBAC helper functions to the roles that need them ─────

revoke execute on function public.current_admin_role()
  from public, anon;
grant execute on function public.current_admin_role()
  to authenticated, service_role;

revoke execute on function public.current_portal_role()
  from public, anon;
grant execute on function public.current_portal_role()
  to authenticated, service_role;

revoke execute on function public.is_aal2()
  from public, anon;
grant execute on function public.is_aal2()
  to authenticated, service_role;

-- ── DB-009: operator_reports inserts are service-role-only ──────────────────

drop policy if exists "operator reports operator write"
  on public.operator_reports;

notify pgrst, 'reload schema';

commit;
