-- Events module rebuild: dedicated events table backed by media_assets while
-- keeping legacy content_posts event rows for rollback and transitional APIs.

create table if not exists public.events (
  id uuid primary key default extensions.gen_random_uuid(),
  legacy_content_post_id uuid null unique
    references public.content_posts (id) on delete set null,
  title text not null,
  slug text not null unique,
  summary text not null,
  body_markdown text null,
  category text not null
    check (
      category in (
        'workshop-training',
        'competition',
        'member-outreach',
        'ceremony-community',
        'community-social',
        'institutional',
        'tour',
        'other-real-event'
      )
    ),
  delivery_mode text not null
    check (delivery_mode in ('offline', 'online-or-hybrid', 'unknown')),
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  starts_at timestamptz not null,
  ends_at timestamptz null,
  timezone text not null default 'Asia/Dhaka',
  location_mode text not null default 'tba'
    check (location_mode in ('venue', 'online', 'hybrid', 'tba')),
  location_label text null,
  venue_name text null,
  venue_address text null,
  online_url text null,
  registration_mode text not null default 'none'
    check (registration_mode in ('internal', 'external', 'none')),
  registration_url text null,
  registration_open boolean not null default false,
  registration_closes_at timestamptz null,
  capacity integer null,
  cta_label text null,
  cta_url text null,
  cover_media_asset_id uuid null
    references public.media_assets (id) on delete set null,
  cover_alt_text_override text null,
  source text not null default 'seed',
  source_metadata jsonb not null default '{}'::jsonb,
  published_at timestamptz null,
  created_by_user_id uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  check (ends_at is null or ends_at >= starts_at),
  check (capacity is null or capacity > 0),
  check (registration_mode <> 'external' or registration_url is not null)
);

create index if not exists events_status_starts_at_idx
  on public.events (status, starts_at desc);

create index if not exists events_category_status_starts_at_idx
  on public.events (category, status, starts_at desc);

create index if not exists events_starts_at_idx
  on public.events (starts_at desc);

create index if not exists events_published_starts_at_idx
  on public.events (published_at desc nulls last, starts_at desc)
  where status = 'published';

drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at
before update on public.events
for each row execute function public.set_current_timestamp_updated_at();

alter table public.event_registrations
  add column if not exists event_id uuid null
  references public.events (id) on delete set null;

create index if not exists event_registrations_event_id_idx
  on public.event_registrations (event_id);

create index if not exists event_registrations_event_id_cancelled_at_idx
  on public.event_registrations (event_id, cancelled_at);

create unique index if not exists event_registrations_active_email_per_event_idx
  on public.event_registrations (event_id, lower(registrant_email::text))
  where event_id is not null and cancelled_at is null;

grant select on public.events to anon, authenticated;
grant insert, update, delete on public.events to authenticated;

alter table public.events enable row level security;

drop policy if exists "events public read" on public.events;
create policy "events public read"
on public.events
for select
to anon, authenticated
using (status = 'published');

drop policy if exists "events operator insert" on public.events;
create policy "events operator insert"
on public.events
for insert
to authenticated
with check (
  public.has_platform_role('super_admin')
  or public.has_platform_role('admin')
  or public.has_platform_role('moderator')
  or public.has_platform_role('content_editor')
);

drop policy if exists "events operator update" on public.events;
create policy "events operator update"
on public.events
for update
to authenticated
using (
  public.has_platform_role('super_admin')
  or public.has_platform_role('admin')
  or public.has_platform_role('moderator')
  or public.has_platform_role('content_editor')
)
with check (
  public.has_platform_role('super_admin')
  or public.has_platform_role('admin')
  or public.has_platform_role('moderator')
  or public.has_platform_role('content_editor')
);

drop policy if exists "events operator delete" on public.events;
create policy "events operator delete"
on public.events
for delete
to authenticated
using (
  public.has_platform_role('super_admin')
  or public.has_platform_role('admin')
  or public.has_platform_role('moderator')
  or public.has_platform_role('content_editor')
);
