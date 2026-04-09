create table if not exists public.membership_cycles (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  title text not null,
  starts_on date not null,
  ends_on date null,
  renewal_open_on date null,
  renewal_close_on date null,
  status text not null default 'draft'
    check (status in ('draft', 'active', 'closed', 'archived')),
  created_by_user_id uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (ends_on is null or ends_on >= starts_on),
  check (renewal_open_on is null or renewal_open_on >= starts_on),
  check (renewal_close_on is null or renewal_open_on is null or renewal_close_on >= renewal_open_on)
);

create table if not exists public.membership_cycle_memberships (
  id uuid primary key default extensions.gen_random_uuid(),
  cycle_id uuid not null references public.membership_cycles (id) on delete cascade,
  member_id uuid not null references public.members (id) on delete cascade,
  state text not null default 'active'
    check (state in ('active', 'pending_renewal', 'renewed', 'expired', 'lapsed')),
  enrolled_at timestamptz not null default timezone('utc', now()),
  renewed_at timestamptz null,
  expires_on date null,
  note text null,
  created_by_user_id uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (cycle_id, member_id)
);

create table if not exists public.invitation_batches (
  id uuid primary key default extensions.gen_random_uuid(),
  cycle_id uuid null references public.membership_cycles (id) on delete set null,
  label text not null,
  source text not null default 'manual'
    check (source in ('manual', 'csv_onboarding', 'reconciliation', 'renewal')),
  status text not null default 'draft'
    check (status in ('draft', 'active', 'closed', 'archived')),
  issued_count integer not null default 0 check (issued_count >= 0),
  claimed_count integer not null default 0 check (claimed_count >= 0),
  expires_at timestamptz null,
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists membership_cycles_status_idx
  on public.membership_cycles (status, starts_on desc);

create index if not exists membership_cycle_memberships_cycle_state_idx
  on public.membership_cycle_memberships (cycle_id, state, updated_at desc);

create index if not exists membership_cycle_memberships_member_idx
  on public.membership_cycle_memberships (member_id, state, updated_at desc);

create index if not exists invitation_batches_cycle_status_idx
  on public.invitation_batches (cycle_id, status, created_at desc);

drop trigger if exists membership_cycles_set_updated_at on public.membership_cycles;
create trigger membership_cycles_set_updated_at
before update on public.membership_cycles
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists membership_cycle_memberships_set_updated_at on public.membership_cycle_memberships;
create trigger membership_cycle_memberships_set_updated_at
before update on public.membership_cycle_memberships
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists invitation_batches_set_updated_at on public.invitation_batches;
create trigger invitation_batches_set_updated_at
before update on public.invitation_batches
for each row execute function public.set_current_timestamp_updated_at();

grant select, insert, update on public.membership_cycles to authenticated;
grant select, insert, update on public.membership_cycle_memberships to authenticated;
grant select, insert, update on public.invitation_batches to authenticated;

alter table public.membership_cycles enable row level security;
alter table public.membership_cycle_memberships enable row level security;
alter table public.invitation_batches enable row level security;

drop policy if exists "membership cycles authenticated read" on public.membership_cycles;
create policy "membership cycles authenticated read"
on public.membership_cycles
for select
to authenticated
using (auth.uid() is not null);

drop policy if exists "membership cycles operator write" on public.membership_cycles;
create policy "membership cycles operator write"
on public.membership_cycles
for all
to authenticated
using (
  (select public.has_platform_role('admin'))
  or (select public.has_platform_role('moderator'))
)
with check (
  (select public.has_platform_role('admin'))
  or (select public.has_platform_role('moderator'))
);

drop policy if exists "membership cycle memberships own or operator read" on public.membership_cycle_memberships;
create policy "membership cycle memberships own or operator read"
on public.membership_cycle_memberships
for select
to authenticated
using (
  (select public.has_platform_role('admin'))
  or (select public.has_platform_role('moderator'))
  or exists (
    select 1
    from public.members
    where public.members.id = membership_cycle_memberships.member_id
      and public.members.user_id = auth.uid()
  )
);

drop policy if exists "membership cycle memberships operator write" on public.membership_cycle_memberships;
create policy "membership cycle memberships operator write"
on public.membership_cycle_memberships
for all
to authenticated
using (
  (select public.has_platform_role('admin'))
  or (select public.has_platform_role('moderator'))
)
with check (
  (select public.has_platform_role('admin'))
  or (select public.has_platform_role('moderator'))
);

drop policy if exists "invitation batches operator read" on public.invitation_batches;
create policy "invitation batches operator read"
on public.invitation_batches
for select
to authenticated
using (
  (select public.has_platform_role('admin'))
  or (select public.has_platform_role('moderator'))
);

drop policy if exists "invitation batches operator write" on public.invitation_batches;
create policy "invitation batches operator write"
on public.invitation_batches
for all
to authenticated
using (
  (select public.has_platform_role('admin'))
  or (select public.has_platform_role('moderator'))
)
with check (
  (select public.has_platform_role('admin'))
  or (select public.has_platform_role('moderator'))
);
