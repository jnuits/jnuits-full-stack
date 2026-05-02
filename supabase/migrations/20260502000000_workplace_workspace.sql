-- Workplace workspace support: richer request metadata, cancellation status,
-- indexes for review queues, and canonical RLS policies.

alter table public.profile_update_requests
  add column if not exists submitted_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists request_source text not null default 'portal',
  add column if not exists decision_reason text,
  add column if not exists previous_payload_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists applied_payload_snapshot jsonb not null default '{}'::jsonb,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

update public.profile_update_requests requests
set submitted_by_user_id = members.user_id
from public.members
where requests.member_id = members.id
  and requests.submitted_by_user_id is null;

alter table public.profile_update_requests
  drop constraint if exists profile_update_requests_status_check;

alter table public.profile_update_requests
  add constraint profile_update_requests_status_check
  check (status = any (array['pending', 'approved', 'rejected', 'cancelled']));

alter table public.profile_update_requests
  drop constraint if exists profile_update_requests_request_source_check;

alter table public.profile_update_requests
  add constraint profile_update_requests_request_source_check
  check (request_source = any (array['portal', 'admin', 'bulk', 'system']));

create index if not exists profile_update_requests_type_status_requested_idx
  on public.profile_update_requests (request_type, status, requested_at desc);

create index if not exists profile_update_requests_member_status_requested_idx
  on public.profile_update_requests (member_id, status, requested_at desc);

create index if not exists profile_update_requests_reviewed_at_idx
  on public.profile_update_requests (reviewed_at desc)
  where reviewed_at is not null;

create index if not exists profile_update_requests_submitter_requested_idx
  on public.profile_update_requests (submitted_by_user_id, requested_at desc)
  where submitted_by_user_id is not null;

drop policy if exists "profile update request own read" on public.profile_update_requests;
drop policy if exists "profile update request own insert" on public.profile_update_requests;
drop policy if exists "profile update request operator update" on public.profile_update_requests;
drop policy if exists "profile update request own or membership admin read" on public.profile_update_requests;
drop policy if exists "profile update request membership admin update" on public.profile_update_requests;

create policy "profile update request own or membership admin read"
on public.profile_update_requests
for select
using (
  public.has_permission('admin.membership.manage')
  or exists (
    select 1
    from public.members
    where members.id = profile_update_requests.member_id
      and members.user_id = (select auth.uid())
  )
);

create policy "profile update request own insert"
on public.profile_update_requests
for insert
with check (
  exists (
    select 1
    from public.members
    where members.id = profile_update_requests.member_id
      and members.user_id = (select auth.uid())
  )
);

create policy "profile update request membership admin update"
on public.profile_update_requests
for update
using (public.has_permission('admin.membership.manage'))
with check (public.has_permission('admin.membership.manage'));
