create table if not exists public.committee_terms (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique,
  title text not null,
  summary text null,
  starts_on date not null,
  ends_on date null,
  status text not null default 'draft'
    check (status in ('draft', 'upcoming', 'active', 'archived')),
  is_public boolean not null default false,
  created_by_user_id uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (ends_on is null or ends_on >= starts_on)
);

create index if not exists committee_terms_status_idx
  on public.committee_terms (status, starts_on desc);

create table if not exists public.committee_roles (
  id uuid primary key default extensions.gen_random_uuid(),
  code text not null unique,
  title text not null,
  sort_order integer not null default 100,
  is_executive boolean not null default false,
  is_public boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.committee_assignments (
  id uuid primary key default extensions.gen_random_uuid(),
  term_id uuid not null references public.committee_terms (id) on delete cascade,
  role_id uuid not null references public.committee_roles (id) on delete restrict,
  member_id uuid null references public.members (id) on delete set null,
  display_name text null,
  bio text null,
  sort_order integer not null default 100,
  starts_on date null,
  ends_on date null,
  status text not null default 'active'
    check (status in ('planned', 'active', 'completed')),
  created_by_user_id uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create index if not exists committee_assignments_term_idx
  on public.committee_assignments (term_id, sort_order, created_at);

create index if not exists committee_assignments_member_idx
  on public.committee_assignments (member_id, status);

create table if not exists public.operator_reports (
  id uuid primary key default extensions.gen_random_uuid(),
  report_type text not null
    check (
      report_type in (
        'membership_overview',
        'committee_roster',
        'content_inventory',
        'reconciliation_snapshot',
        'workplace_moderation'
      )
    ),
  title text not null,
  status text not null default 'completed'
    check (status in ('pending', 'completed', 'failed')),
  summary text null,
  report jsonb not null default '{}'::jsonb,
  created_by_user_id uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists operator_reports_type_idx
  on public.operator_reports (report_type, created_at desc);

create table if not exists public.media_assets (
  id uuid primary key default extensions.gen_random_uuid(),
  provider text not null default 'cloudinary'
    check (provider = 'cloudinary'),
  media_kind text not null
    check (media_kind in ('image', 'video')),
  title text null,
  alt_text text null,
  is_public boolean not null default true,
  secure_url text not null,
  thumbnail_url text null,
  public_id text not null unique,
  resource_type text not null,
  format text null,
  width integer null check (width is null or width > 0),
  height integer null check (height is null or height > 0),
  bytes bigint null check (bytes is null or bytes >= 0),
  duration_seconds numeric(10,2) null check (duration_seconds is null or duration_seconds >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_by_user_id uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists media_assets_kind_public_idx
  on public.media_assets (media_kind, is_public, created_at desc);

create table if not exists public.content_pages (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique
    check (slug in ('home', 'about', 'contact', 'footer')),
  title text not null,
  eyebrow text null,
  summary text null,
  body jsonb not null default '{}'::jsonb,
  status text not null default 'draft'
    check (status in ('draft', 'published')),
  created_by_user_id uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.content_posts (
  id uuid primary key default extensions.gen_random_uuid(),
  content_type text not null
    check (content_type in ('blog', 'notice', 'event')),
  slug text not null unique,
  title text not null,
  category text null,
  summary text null,
  excerpt text null,
  body text null,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  published_at timestamptz null,
  read_time text null,
  location text null,
  starts_at timestamptz null,
  ends_at timestamptz null,
  cta_href text null,
  media_asset_id uuid null references public.media_assets (id) on delete set null,
  created_by_user_id uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (ends_at is null or starts_at is null or ends_at >= starts_at)
);

create index if not exists content_posts_listing_idx
  on public.content_posts (content_type, status, published_at desc nulls last, created_at desc);

create table if not exists public.gallery_entries (
  id uuid primary key default extensions.gen_random_uuid(),
  title text not null,
  caption text null,
  sort_order integer not null default 100,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  media_asset_id uuid not null references public.media_assets (id) on delete restrict,
  created_by_user_id uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists gallery_entries_status_idx
  on public.gallery_entries (status, sort_order, created_at desc);

create table if not exists public.developer_profiles (
  id uuid primary key default extensions.gen_random_uuid(),
  name text not null,
  role text not null,
  focus text not null,
  bio text not null,
  sort_order integer not null default 100,
  is_lead boolean not null default false,
  status text not null default 'draft'
    check (status in ('draft', 'published', 'archived')),
  media_asset_id uuid null references public.media_assets (id) on delete set null,
  created_by_user_id uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists developer_profiles_status_idx
  on public.developer_profiles (status, sort_order, created_at desc);

insert into public.committee_roles (code, title, sort_order, is_executive, is_public)
values
  ('president', 'President', 10, true, true),
  ('vice-president', 'Vice President', 20, true, true),
  ('general-secretary', 'General Secretary', 30, true, true),
  ('joint-secretary', 'Joint Secretary', 40, true, true),
  ('organizing-secretary', 'Organizing Secretary', 50, true, true),
  ('office-secretary', 'Office Secretary', 60, true, true),
  ('treasurer', 'Treasurer', 70, true, true),
  ('public-relations-secretary', 'Public Relations Secretary', 80, true, true),
  ('publication-secretary', 'Publication Secretary', 90, true, true),
  ('executive-member', 'Executive Member', 110, true, true)
on conflict (code) do update
  set title = excluded.title,
      sort_order = excluded.sort_order,
      is_executive = excluded.is_executive,
      is_public = excluded.is_public;

drop trigger if exists committee_terms_set_updated_at on public.committee_terms;
create trigger committee_terms_set_updated_at
before update on public.committee_terms
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists committee_roles_set_updated_at on public.committee_roles;
create trigger committee_roles_set_updated_at
before update on public.committee_roles
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists committee_assignments_set_updated_at on public.committee_assignments;
create trigger committee_assignments_set_updated_at
before update on public.committee_assignments
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists media_assets_set_updated_at on public.media_assets;
create trigger media_assets_set_updated_at
before update on public.media_assets
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists content_pages_set_updated_at on public.content_pages;
create trigger content_pages_set_updated_at
before update on public.content_pages
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists content_posts_set_updated_at on public.content_posts;
create trigger content_posts_set_updated_at
before update on public.content_posts
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists gallery_entries_set_updated_at on public.gallery_entries;
create trigger gallery_entries_set_updated_at
before update on public.gallery_entries
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists developer_profiles_set_updated_at on public.developer_profiles;
create trigger developer_profiles_set_updated_at
before update on public.developer_profiles
for each row execute function public.set_current_timestamp_updated_at();

grant select on public.committee_terms to anon, authenticated;
grant select on public.committee_roles to anon, authenticated;
grant select on public.committee_assignments to anon, authenticated;
grant select on public.media_assets to anon, authenticated;
grant select on public.content_pages to anon, authenticated;
grant select on public.content_posts to anon, authenticated;
grant select on public.gallery_entries to anon, authenticated;
grant select on public.developer_profiles to anon, authenticated;
grant select on public.operator_reports to authenticated;

alter table public.committee_terms enable row level security;
alter table public.committee_roles enable row level security;
alter table public.committee_assignments enable row level security;
alter table public.operator_reports enable row level security;
alter table public.media_assets enable row level security;
alter table public.content_pages enable row level security;
alter table public.content_posts enable row level security;
alter table public.gallery_entries enable row level security;
alter table public.developer_profiles enable row level security;

drop policy if exists "committee terms public read" on public.committee_terms;
create policy "committee terms public read"
on public.committee_terms
for select
to anon, authenticated
using (is_public = true and status in ('upcoming', 'active', 'archived'));

drop policy if exists "committee terms operator write" on public.committee_terms;
create policy "committee terms operator write"
on public.committee_terms
for all
to authenticated
using (
  (select public.has_platform_role('admin'))
  or (select public.has_platform_role('moderator'))
  or (select public.has_platform_role('committee_author'))
)
with check (
  (select public.has_platform_role('admin'))
  or (select public.has_platform_role('moderator'))
  or (select public.has_platform_role('committee_author'))
);

drop policy if exists "committee roles public read" on public.committee_roles;
create policy "committee roles public read"
on public.committee_roles
for select
to anon, authenticated
using (is_public = true);

drop policy if exists "committee roles operator write" on public.committee_roles;
create policy "committee roles operator write"
on public.committee_roles
for all
to authenticated
using (
  (select public.has_platform_role('admin'))
  or (select public.has_platform_role('moderator'))
  or (select public.has_platform_role('committee_author'))
)
with check (
  (select public.has_platform_role('admin'))
  or (select public.has_platform_role('moderator'))
  or (select public.has_platform_role('committee_author'))
);

drop policy if exists "committee assignments public read" on public.committee_assignments;
create policy "committee assignments public read"
on public.committee_assignments
for select
to anon, authenticated
using (
  status <> 'planned'
  and exists (
    select 1
    from public.committee_terms
    where public.committee_terms.id = committee_assignments.term_id
      and public.committee_terms.is_public = true
      and public.committee_terms.status in ('upcoming', 'active', 'archived')
  )
);

drop policy if exists "committee assignments operator write" on public.committee_assignments;
create policy "committee assignments operator write"
on public.committee_assignments
for all
to authenticated
using (
  (select public.has_platform_role('admin'))
  or (select public.has_platform_role('moderator'))
  or (select public.has_platform_role('committee_author'))
)
with check (
  (select public.has_platform_role('admin'))
  or (select public.has_platform_role('moderator'))
  or (select public.has_platform_role('committee_author'))
);

drop policy if exists "operator reports operator read" on public.operator_reports;
create policy "operator reports operator read"
on public.operator_reports
for select
to authenticated
using (
  (select public.has_platform_role('admin'))
  or (select public.has_platform_role('moderator'))
);

drop policy if exists "operator reports operator write" on public.operator_reports;
create policy "operator reports operator write"
on public.operator_reports
for insert
to authenticated
with check (
  (select public.has_platform_role('admin'))
  or (select public.has_platform_role('moderator'))
);

drop policy if exists "media assets public read" on public.media_assets;
create policy "media assets public read"
on public.media_assets
for select
to anon, authenticated
using (is_public = true);

drop policy if exists "media assets content operator write" on public.media_assets;
create policy "media assets content operator write"
on public.media_assets
for all
to authenticated
using (
  (select public.has_platform_role('admin'))
  or (select public.has_platform_role('moderator'))
  or (select public.has_platform_role('content_editor'))
)
with check (
  (select public.has_platform_role('admin'))
  or (select public.has_platform_role('moderator'))
  or (select public.has_platform_role('content_editor'))
);

drop policy if exists "content pages public read" on public.content_pages;
create policy "content pages public read"
on public.content_pages
for select
to anon, authenticated
using (status = 'published');

drop policy if exists "content pages operator write" on public.content_pages;
create policy "content pages operator write"
on public.content_pages
for all
to authenticated
using (
  (select public.has_platform_role('admin'))
  or (select public.has_platform_role('moderator'))
  or (select public.has_platform_role('content_editor'))
)
with check (
  (select public.has_platform_role('admin'))
  or (select public.has_platform_role('moderator'))
  or (select public.has_platform_role('content_editor'))
);

drop policy if exists "content posts public read" on public.content_posts;
create policy "content posts public read"
on public.content_posts
for select
to anon, authenticated
using (status = 'published');

drop policy if exists "content posts operator write" on public.content_posts;
create policy "content posts operator write"
on public.content_posts
for all
to authenticated
using (
  (select public.has_platform_role('admin'))
  or (select public.has_platform_role('moderator'))
  or (select public.has_platform_role('content_editor'))
)
with check (
  (select public.has_platform_role('admin'))
  or (select public.has_platform_role('moderator'))
  or (select public.has_platform_role('content_editor'))
);

drop policy if exists "gallery entries public read" on public.gallery_entries;
create policy "gallery entries public read"
on public.gallery_entries
for select
to anon, authenticated
using (
  status = 'published'
  and exists (
    select 1
    from public.media_assets
    where public.media_assets.id = gallery_entries.media_asset_id
      and public.media_assets.is_public = true
  )
);

drop policy if exists "gallery entries operator write" on public.gallery_entries;
create policy "gallery entries operator write"
on public.gallery_entries
for all
to authenticated
using (
  (select public.has_platform_role('admin'))
  or (select public.has_platform_role('moderator'))
  or (select public.has_platform_role('content_editor'))
)
with check (
  (select public.has_platform_role('admin'))
  or (select public.has_platform_role('moderator'))
  or (select public.has_platform_role('content_editor'))
);

drop policy if exists "developer profiles public read" on public.developer_profiles;
create policy "developer profiles public read"
on public.developer_profiles
for select
to anon, authenticated
using (status = 'published');

drop policy if exists "developer profiles operator write" on public.developer_profiles;
create policy "developer profiles operator write"
on public.developer_profiles
for all
to authenticated
using (
  (select public.has_platform_role('admin'))
  or (select public.has_platform_role('moderator'))
  or (select public.has_platform_role('content_editor'))
)
with check (
  (select public.has_platform_role('admin'))
  or (select public.has_platform_role('moderator'))
  or (select public.has_platform_role('content_editor'))
);
