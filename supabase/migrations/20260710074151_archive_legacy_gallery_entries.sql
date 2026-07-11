begin;

-- Preserve the previous flat public gallery in the canonical album-first model.
-- The legacy rows are archived rather than deleted so the migration remains
-- reversible and media-reference checks can continue to account for history.
insert into public.gallery_albums (
  slug,
  title,
  event_name,
  description,
  year,
  category,
  status,
  featured,
  source,
  source_metadata
)
values (
  'legacy-public-gallery-archive',
  'Legacy Public Gallery Archive',
  'Legacy public site archive',
  'Public images preserved from the pre-album JnUITS gallery.',
  2026,
  'institutional',
  'published',
  false,
  'legacy_gallery_entries',
  jsonb_build_object('migration', 'archive_legacy_gallery_entries')
)
on conflict (slug) do nothing;

with archive_album as (
  select id
  from public.gallery_albums
  where slug = 'legacy-public-gallery-archive'
), legacy_entries as (
  select e.*
  from public.gallery_entries e
  where e.status = 'published'
), copied as (
  insert into public.gallery_album_items (
    album_id,
    media_asset_id,
    title,
    description,
    alt_text,
    source_caption,
    sort_order,
    status,
    source_metadata,
    created_at,
    updated_at
  )
  select
    a.id,
    e.media_asset_id,
    e.title,
    e.caption,
    e.title,
    e.caption,
    e.sort_order,
    'published',
    jsonb_build_object(
      'legacy_gallery_entry_id', e.id,
      'legacy_status', e.status
    ),
    e.created_at,
    e.updated_at
  from legacy_entries e
  cross join archive_album a
  join public.media_assets m
    on m.id = e.media_asset_id
   and m.is_public = true
   and m.deleted_at is null
  on conflict (album_id, media_asset_id) do nothing
  returning id
)
select count(*) from copied;

with archive_album as (
  select id
  from public.gallery_albums
  where slug = 'legacy-public-gallery-archive'
), first_item as (
  select i.id, i.album_id
  from public.gallery_album_items i
  join archive_album a on a.id = i.album_id
  where i.deleted_at is null
  order by i.sort_order, i.id
  limit 1
)
update public.gallery_albums a
set cover_item_id = f.id
from first_item f
where a.id = f.album_id
  and a.cover_item_id is null;

with archive_album as (
  select id
  from public.gallery_albums
  where slug = 'legacy-public-gallery-archive'
), first_item as (
  select i.id
  from public.gallery_album_items i
  join archive_album a on a.id = i.album_id
  where i.deleted_at is null
  order by i.sort_order, i.id
  limit 1
)
update public.gallery_album_items i
set is_cover = true
from first_item f
where i.id = f.id
  and not i.is_cover;

with archive_album as (
  select id
  from public.gallery_albums
  where slug = 'legacy-public-gallery-archive'
)
update public.gallery_entries e
set status = 'archived'
where e.status = 'published'
  and exists (
    select 1
    from public.gallery_album_items i
    join archive_album a on a.id = i.album_id
    where i.media_asset_id = e.media_asset_id
      and i.deleted_at is null
  );

-- The active public and admin gallery now uses gallery_albums/items. The
-- archived legacy table remains available only to server-side maintenance code.
revoke all privileges on table public.gallery_entries from anon, authenticated;

notify pgrst, 'reload schema';

commit;