begin;

-- Supabase RLS performance advisor: wrap auth.uid() in SELECT so the value is
-- evaluated once per statement instead of once per row. These rewrites preserve
-- the existing access predicates.

drop policy if exists "admin invitations admin read" on public.admin_invitations;
create policy "admin invitations admin read"
on public.admin_invitations
for select
to authenticated
using (
  current_admin_role() = 'super_admin'
  or (has_permission('admin.roles.manage_admin') and invited_role_code = 'content_admin')
  or target_user_id = (select auth.uid())
);

drop policy if exists "admin invitations admin update" on public.admin_invitations;
create policy "admin invitations admin update"
on public.admin_invitations
for update
to authenticated
using (
  current_admin_role() = 'super_admin'
  or (has_permission('admin.roles.manage_admin') and invited_role_code = 'content_admin')
  or target_user_id = (select auth.uid())
)
with check (
  current_admin_role() = 'super_admin'
  or (has_permission('admin.roles.manage_admin') and invited_role_code = 'content_admin')
  or target_user_id = (select auth.uid())
);

drop policy if exists "mentorship messages insert access" on public.mentorship_messages;
create policy "mentorship messages insert access"
on public.mentorship_messages
for insert
to authenticated
with check (
  author_user_id = (select auth.uid())
  and can_access_mentorship_relationship(relationship_id)
);

drop policy if exists "mentorship profiles insert self" on public.mentorship_profiles;
create policy "mentorship profiles insert self"
on public.mentorship_profiles
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and member_id = current_member_id()
);

drop policy if exists "mentorship profiles select access" on public.mentorship_profiles;
create policy "mentorship profiles select access"
on public.mentorship_profiles
for select
to authenticated
using (
  user_id = (select auth.uid())
  or opt_in = true
  or has_permission('portal.community.moderate')
  or has_permission('admin.support.manage')
);

drop policy if exists "mentorship profiles update self" on public.mentorship_profiles;
create policy "mentorship profiles update self"
on public.mentorship_profiles
for update
to authenticated
using (
  user_id = (select auth.uid())
  or has_permission('portal.community.moderate')
  or has_permission('admin.support.manage')
)
with check (
  (
    user_id = (select auth.uid())
    and member_id = current_member_id()
  )
  or has_permission('portal.community.moderate')
  or has_permission('admin.support.manage')
);

drop policy if exists "mentorship relationships insert participant" on public.mentorship_relationships;
create policy "mentorship relationships insert participant"
on public.mentorship_relationships
for insert
to authenticated
with check (
  created_by_user_id = (select auth.uid())
  and (
    has_permission('portal.mentorship.request')
    or has_permission('portal.mentorship.participate')
    or has_permission('portal.community.moderate')
  )
  and (
    member_user_id = (select auth.uid())
    or alumni_user_id = (select auth.uid())
    or has_permission('portal.community.moderate')
  )
);

drop policy if exists "portal user settings own insert" on public.portal_user_settings;
create policy "portal user settings own insert"
on public.portal_user_settings
for insert
to authenticated
with check (
  user_id = (select auth.uid())
  and (member_id is null or member_id = current_member_id())
);

drop policy if exists "portal user settings own select" on public.portal_user_settings;
create policy "portal user settings own select"
on public.portal_user_settings
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "portal user settings own update" on public.portal_user_settings;
create policy "portal user settings own update"
on public.portal_user_settings
for update
to authenticated
using (user_id = (select auth.uid()))
with check (
  user_id = (select auth.uid())
  and (member_id is null or member_id = current_member_id())
);

drop policy if exists "rbac claim versions self read" on public.rbac_user_claim_versions;
create policy "rbac claim versions self read"
on public.rbac_user_claim_versions
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "rbac user roles self read" on public.rbac_user_platform_roles;
create policy "rbac user roles self read"
on public.rbac_user_platform_roles
for select
to authenticated
using (user_id = (select auth.uid()));

drop policy if exists "security events admin insert" on public.security_events;
create policy "security events admin insert"
on public.security_events
for insert
to authenticated
with check (
  actor_user_id = (select auth.uid())
  and has_permission('admin.security.write')
  and is_aal2()
);

drop policy if exists "support ticket events insert access" on public.support_ticket_events;
create policy "support ticket events insert access"
on public.support_ticket_events
for insert
to authenticated
with check (
  coalesce(actor_user_id, (select auth.uid())) = (select auth.uid())
  and can_access_support_ticket(ticket_id)
);

drop policy if exists "support ticket messages insert access" on public.support_ticket_messages;
create policy "support ticket messages insert access"
on public.support_ticket_messages
for insert
to authenticated
with check (
  author_user_id = (select auth.uid())
  and can_access_support_ticket(ticket_id)
);

drop policy if exists "support tickets insert self" on public.support_tickets;
create policy "support tickets insert self"
on public.support_tickets
for insert
to authenticated
with check (
  opened_by_user_id = (select auth.uid())
  and has_permission('portal.tickets.create_self')
  and (member_id is null or member_id = current_member_id())
);

notify pgrst, 'reload schema';

commit;
