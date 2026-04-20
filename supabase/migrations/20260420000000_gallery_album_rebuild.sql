-- Gallery album rebuild: album-first public archive backed by Cloudinary assets.
-- Keeps legacy gallery_entries for rollback while new public/admin code uses
-- gallery_albums and gallery_album_items.

alter table public.media_assets
  add column if not exists deleted_at timestamptz null,
  add column if not exists deleted_by_user_id uuid null references auth.users (id) on delete set null,
  add column if not exists trash_original_public_id text null,
  add column if not exists trash_public_id text null,
  add column if not exists trash_moved_at timestamptz null,
  add column if not exists trash_restore_deadline timestamptz null;

create table if not exists public.gallery_albums (
  id uuid primary key default extensions.gen_random_uuid(),
  slug text not null unique,
  title text not null,
  event_name text null,
  description text null,
  year integer not null check (year between 2015 and 2100),
  month integer null check (month between 1 and 12),
  starts_on date null,
  ends_on date null,
  category text not null default 'event',
  status text not null default 'published'
    check (status in ('draft', 'published', 'archived')),
  featured boolean not null default false,
  cover_item_id uuid null,
  cloudinary_folder text null,
  source text not null default 'manual',
  source_metadata jsonb not null default '{}'::jsonb,
  deleted_at timestamptz null,
  deleted_by_user_id uuid null references auth.users (id) on delete set null,
  trash_reason text null,
  trash_metadata jsonb not null default '{}'::jsonb,
  restorable_until timestamptz null,
  created_by_user_id uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  check (ends_on is null or starts_on is null or ends_on >= starts_on)
);

create table if not exists public.gallery_album_items (
  id uuid primary key default extensions.gen_random_uuid(),
  album_id uuid not null references public.gallery_albums (id) on delete cascade,
  media_asset_id uuid not null references public.media_assets (id) on delete restrict,
  title text null,
  description text null,
  alt_text text null,
  source_caption text null,
  width integer null check (width is null or width > 0),
  height integer null check (height is null or height > 0),
  blur_data_url text null,
  sort_order integer not null default 100,
  is_cover boolean not null default false,
  status text not null default 'published'
    check (status in ('draft', 'published', 'archived')),
  source_metadata jsonb not null default '{}'::jsonb,
  deleted_at timestamptz null,
  deleted_by_user_id uuid null references auth.users (id) on delete set null,
  trash_reason text null,
  trash_metadata jsonb not null default '{}'::jsonb,
  restorable_until timestamptz null,
  created_by_user_id uuid null references auth.users (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (album_id, media_asset_id)
);

alter table public.gallery_albums
  drop constraint if exists gallery_albums_cover_item_id_fkey;

alter table public.gallery_albums
  add constraint gallery_albums_cover_item_id_fkey
  foreign key (cover_item_id)
  references public.gallery_album_items (id)
  on delete set null;

create index if not exists media_assets_deleted_at_idx
  on public.media_assets (deleted_at)
  where deleted_at is not null;

create index if not exists gallery_albums_public_idx
  on public.gallery_albums (status, deleted_at, featured desc, year desc, month desc, updated_at desc);

create index if not exists gallery_albums_year_category_idx
  on public.gallery_albums (year desc, category, status)
  where deleted_at is null;

create index if not exists gallery_albums_search_idx
  on public.gallery_albums
  using gin (
    to_tsvector(
      'english',
      coalesce(title, '') || ' ' ||
      coalesce(event_name, '') || ' ' ||
      coalesce(description, '') || ' ' ||
      coalesce(category, '') || ' ' ||
      coalesce(year::text, '')
    )
  );

create index if not exists gallery_album_items_album_order_idx
  on public.gallery_album_items (album_id, status, deleted_at, sort_order, id);

create index if not exists gallery_album_items_media_asset_id_idx
  on public.gallery_album_items (media_asset_id);

create unique index if not exists gallery_album_items_single_cover_idx
  on public.gallery_album_items (album_id)
  where is_cover = true and deleted_at is null;

drop trigger if exists gallery_albums_set_updated_at on public.gallery_albums;
create trigger gallery_albums_set_updated_at
before update on public.gallery_albums
for each row execute function public.set_current_timestamp_updated_at();

drop trigger if exists gallery_album_items_set_updated_at on public.gallery_album_items;
create trigger gallery_album_items_set_updated_at
before update on public.gallery_album_items
for each row execute function public.set_current_timestamp_updated_at();

grant select on public.gallery_albums to anon, authenticated;
grant select on public.gallery_album_items to anon, authenticated;
grant insert, update, delete on public.gallery_albums to authenticated;
grant insert, update, delete on public.gallery_album_items to authenticated;

alter table public.gallery_albums enable row level security;
alter table public.gallery_album_items enable row level security;

drop policy if exists "media assets public read" on public.media_assets;
create policy "media assets public read"
on public.media_assets
for select
to anon, authenticated
using (is_public = true and deleted_at is null);

drop policy if exists "gallery albums public read" on public.gallery_albums;
create policy "gallery albums public read"
on public.gallery_albums
for select
to anon, authenticated
using (status = 'published' and deleted_at is null);

drop policy if exists "gallery albums operator insert" on public.gallery_albums;
create policy "gallery albums operator insert"
on public.gallery_albums
for insert
to authenticated
with check (
  public.has_platform_role('super_admin')
  or public.has_platform_role('admin')
  or public.has_platform_role('moderator')
  or public.has_platform_role('content_editor')
);

drop policy if exists "gallery albums operator update" on public.gallery_albums;
create policy "gallery albums operator update"
on public.gallery_albums
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

drop policy if exists "gallery albums operator delete" on public.gallery_albums;
create policy "gallery albums operator delete"
on public.gallery_albums
for delete
to authenticated
using (
  public.has_platform_role('super_admin')
  or public.has_platform_role('admin')
  or public.has_platform_role('moderator')
  or public.has_platform_role('content_editor')
);

drop policy if exists "gallery album items public read" on public.gallery_album_items;
create policy "gallery album items public read"
on public.gallery_album_items
for select
to anon, authenticated
using (
  status = 'published'
  and deleted_at is null
  and exists (
    select 1
    from public.gallery_albums
    where gallery_albums.id = gallery_album_items.album_id
      and gallery_albums.status = 'published'
      and gallery_albums.deleted_at is null
  )
  and exists (
    select 1
    from public.media_assets
    where media_assets.id = gallery_album_items.media_asset_id
      and media_assets.is_public = true
      and media_assets.deleted_at is null
  )
);

drop policy if exists "gallery album items operator insert" on public.gallery_album_items;
create policy "gallery album items operator insert"
on public.gallery_album_items
for insert
to authenticated
with check (
  public.has_platform_role('super_admin')
  or public.has_platform_role('admin')
  or public.has_platform_role('moderator')
  or public.has_platform_role('content_editor')
);

drop policy if exists "gallery album items operator update" on public.gallery_album_items;
create policy "gallery album items operator update"
on public.gallery_album_items
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

drop policy if exists "gallery album items operator delete" on public.gallery_album_items;
create policy "gallery album items operator delete"
on public.gallery_album_items
for delete
to authenticated
using (
  public.has_platform_role('super_admin')
  or public.has_platform_role('admin')
  or public.has_platform_role('moderator')
  or public.has_platform_role('content_editor')
);
