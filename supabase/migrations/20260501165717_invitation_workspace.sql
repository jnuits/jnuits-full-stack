-- Dedicated invitation workspace support.
-- Keeps invitation codes hash-only while adding operational metadata for
-- batch ownership, delivery tracking, replacement, and revocation workflows.

alter table public.member_invitations
  add column if not exists batch_id uuid references public.invitation_batches(id) on delete set null,
  add column if not exists invitation_type text not null default 'member_claim',
  add column if not exists delivery_status text not null default 'pending',
  add column if not exists last_sent_at timestamptz,
  add column if not exists send_attempts integer not null default 0,
  add column if not exists recipient_email_snapshot text,
  add column if not exists recipient_name_snapshot text,
  add column if not exists revoked_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists revocation_reason text;

alter table public.member_invitations
  drop constraint if exists member_invitations_invitation_type_check,
  add constraint member_invitations_invitation_type_check
    check (invitation_type in (
      'member_claim',
      'alumni_direct',
      'renewal',
      'replacement',
      'manual',
      'bulk_csv'
    )),
  drop constraint if exists member_invitations_delivery_status_check,
  add constraint member_invitations_delivery_status_check
    check (delivery_status in (
      'pending',
      'sent',
      'failed',
      'skipped',
      'claimed',
      'revoked',
      'expired'
    )),
  drop constraint if exists member_invitations_send_attempts_check,
  add constraint member_invitations_send_attempts_check
    check (send_attempts >= 0);

with parsed as (
  select
    id,
    ((regexp_match(notes, '\[batch:([0-9a-fA-F-]{36})\]'))[1])::uuid as parsed_batch_id
  from public.member_invitations
  where batch_id is null
    and notes ~ '\[batch:[0-9a-fA-F-]{36}\]'
),
matched as (
  select parsed.id, parsed.parsed_batch_id
  from parsed
  join public.invitation_batches on invitation_batches.id = parsed.parsed_batch_id
)
update public.member_invitations invitations
set batch_id = matched.parsed_batch_id
from matched
where invitations.id = matched.id;

update public.member_invitations invitations
set
  recipient_email_snapshot = coalesce(invitations.recipient_email_snapshot, members.email),
  recipient_name_snapshot = coalesce(invitations.recipient_name_snapshot, members.full_name),
  delivery_status = case
    when invitations.revoked_at is not null or invitations.is_active = false then 'revoked'
    when invitations.used_count > 0 then 'claimed'
    when invitations.last_used_at is not null then 'claimed'
    when invitations.expires_at < now() then 'expired'
    else invitations.delivery_status
  end
from public.members
where members.id = invitations.member_id;

create table if not exists public.invitation_email_deliveries (
  id uuid primary key default gen_random_uuid(),
  invitation_id uuid not null references public.member_invitations(id) on delete cascade,
  channel text not null default 'email',
  recipient_email text not null,
  status text not null,
  provider_message_id text,
  error_message text,
  sent_at timestamptz,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint invitation_email_deliveries_channel_check
    check (channel in ('email')),
  constraint invitation_email_deliveries_status_check
    check (status in ('pending', 'sent', 'failed', 'skipped'))
);

drop trigger if exists trg_invitation_email_deliveries_updated_at on public.invitation_email_deliveries;
create trigger trg_invitation_email_deliveries_updated_at
before update on public.invitation_email_deliveries
for each row execute function public.set_current_timestamp_updated_at();

create index if not exists member_invitations_active_workspace_idx
  on public.member_invitations (expires_at, created_at desc)
  where is_active = true and revoked_at is null;

create index if not exists member_invitations_batch_idx
  on public.member_invitations (batch_id, created_at desc)
  where batch_id is not null;

create index if not exists member_invitations_delivery_status_idx
  on public.member_invitations (delivery_status, created_at desc);

create index if not exists member_invitations_member_workspace_idx
  on public.member_invitations (member_id, created_at desc);

create index if not exists invitation_email_deliveries_invitation_idx
  on public.invitation_email_deliveries (invitation_id, created_at desc);

create index if not exists invitation_email_deliveries_status_idx
  on public.invitation_email_deliveries (status, created_at desc);

alter table public.member_invitations enable row level security;
alter table public.invitation_batches enable row level security;
alter table public.invitation_email_deliveries enable row level security;

drop policy if exists "member invitations operator only" on public.member_invitations;
drop policy if exists "member invitations membership admins" on public.member_invitations;
create policy "member invitations membership admins"
on public.member_invitations
for all
to authenticated
using ((select public.has_permission('admin.membership.manage')))
with check ((select public.has_permission('admin.membership.manage')));

drop policy if exists "invitation batches operator insert" on public.invitation_batches;
drop policy if exists "invitation batches operator update" on public.invitation_batches;
drop policy if exists "invitation batches operator delete" on public.invitation_batches;
drop policy if exists "invitation batches membership admins" on public.invitation_batches;
create policy "invitation batches membership admins"
on public.invitation_batches
for all
to authenticated
using ((select public.has_permission('admin.membership.manage')))
with check ((select public.has_permission('admin.membership.manage')));

drop policy if exists "invitation email deliveries membership admins" on public.invitation_email_deliveries;
create policy "invitation email deliveries membership admins"
on public.invitation_email_deliveries
for all
to authenticated
using ((select public.has_permission('admin.membership.manage')))
with check ((select public.has_permission('admin.membership.manage')));

grant select, insert, update, delete on public.member_invitations to authenticated;
grant select, insert, update, delete on public.invitation_batches to authenticated;
grant select, insert, update, delete on public.invitation_email_deliveries to authenticated;
