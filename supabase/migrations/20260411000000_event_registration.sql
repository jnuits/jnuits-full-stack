-- Sprint 8: Event Registration Lifecycle
-- Events are stored in content_posts (content_type='event'); this migration
-- adds registration tracking against that existing table.

-- Core registrations table
create table if not exists public.event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_post_id uuid not null references public.content_posts(id) on delete cascade,
  member_id uuid null references public.members(id) on delete set null,
  registrant_name text not null,
  registrant_email extensions.citext not null,
  registrant_phone text null,
  registration_code text not null unique
    default upper(left(replace(gen_random_uuid()::text, '-', ''), 8)),
  checked_in_at timestamptz null,
  cancelled_at timestamptz null,
  created_at timestamptz not null default now()
);

-- Capacity + registration control on the events CMS posts
alter table public.content_posts
  add column if not exists event_capacity integer null,
  add column if not exists registration_open boolean not null default false,
  add column if not exists registration_closes_at timestamptz null;

-- Performance indexes
create index if not exists event_registrations_event_post_id_idx
  on public.event_registrations(event_post_id);

create index if not exists event_registrations_checkin_idx
  on public.event_registrations(event_post_id, checked_in_at);

create index if not exists event_registrations_code_idx
  on public.event_registrations(registration_code);

create index if not exists event_registrations_email_idx
  on public.event_registrations(registrant_email);

-- RLS
alter table public.event_registrations enable row level security;

-- Public can insert (rate-limited at API layer)
create policy "event_registrations public register"
  on public.event_registrations for insert
  with check (true);

-- Open read for all (allow fetching own registration by code from API)
create policy "event_registrations unified select"
  on public.event_registrations for select
  using (true);

-- Only operators may update (for check-in stamps)
create policy "event_registrations operator update"
  on public.event_registrations for update
  using (public.has_platform_role('admin') or public.has_platform_role('super_admin'));
