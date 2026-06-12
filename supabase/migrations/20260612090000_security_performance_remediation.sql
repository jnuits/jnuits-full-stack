-- Security and performance remediation staged from the June 2026 audits.
-- This migration is intentionally idempotent and does not rely on live secrets.

begin;

-- ---------------------------------------------------------------------------
-- Event registration PII must not be readable through the public Data API.
-- Public registration now goes through the Next.js server route and service role.
-- ---------------------------------------------------------------------------

drop policy if exists "event_registrations unified select" on public.event_registrations;
drop policy if exists "event_registrations public register" on public.event_registrations;
drop policy if exists "event_registrations operator select" on public.event_registrations;
drop policy if exists "event_registrations operator update" on public.event_registrations;

revoke all on table public.event_registrations from anon;
revoke all on table public.event_registrations from authenticated;

grant select, update on table public.event_registrations to authenticated;
grant select, insert, update, delete on table public.event_registrations to service_role;

create policy "event_registrations operator select"
on public.event_registrations
for select
to authenticated
using (public.has_permission('cms.events.manage'::text));

create policy "event_registrations operator update"
on public.event_registrations
for update
to authenticated
using (public.has_permission('cms.events.manage'::text))
with check (public.has_permission('cms.events.manage'::text));

create or replace function public.register_for_event_atomic(
  p_event_id uuid,
  p_legacy_event_post_id uuid,
  p_member_id uuid,
  p_registrant_name text,
  p_registrant_email text,
  p_registrant_phone text
)
returns table(result_status text, registration_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.events%rowtype;
  v_existing public.event_registrations%rowtype;
  v_inserted public.event_registrations%rowtype;
  v_registered_count integer := 0;
  v_email text := lower(trim(coalesce(p_registrant_email, '')));
  v_name text := trim(coalesce(p_registrant_name, ''));
  v_now timestamptz := clock_timestamp();
begin
  if p_event_id is null or v_email = '' or v_name = '' then
    return query select 'invalid'::text, null::text;
    return;
  end if;

  select *
  into v_event
  from public.events
  where id = p_event_id
  for update;

  if not found or v_event.status <> 'published' then
    return query select 'not_found'::text, null::text;
    return;
  end if;

  if v_event.registration_mode <> 'internal' then
    return query select 'not_internal'::text, null::text;
    return;
  end if;

  if not v_event.registration_open
    or (v_event.registration_closes_at is not null and v_event.registration_closes_at <= v_now)
    or (v_event.ends_at is not null and v_event.ends_at < v_now)
  then
    return query select 'closed'::text, null::text;
    return;
  end if;

  select *
  into v_existing
  from public.event_registrations
  where event_id = p_event_id
    and lower(registrant_email::text) = v_email
    and cancelled_at is null
  limit 1;

  if found then
    return query select 'duplicate'::text, v_existing.registration_code;
    return;
  end if;

  if v_event.capacity is not null then
    select count(*)::integer
    into v_registered_count
    from public.event_registrations
    where event_id = p_event_id
      and cancelled_at is null;

    if v_registered_count >= v_event.capacity then
      return query select 'full'::text, null::text;
      return;
    end if;
  end if;

  insert into public.event_registrations (
    event_id,
    event_post_id,
    member_id,
    registrant_email,
    registrant_name,
    registrant_phone
  )
  values (
    p_event_id,
    coalesce(p_legacy_event_post_id, v_event.legacy_content_post_id),
    p_member_id,
    v_email,
    v_name,
    nullif(trim(coalesce(p_registrant_phone, '')), '')
  )
  returning *
  into v_inserted;

  return query select 'created'::text, v_inserted.registration_code;
end;
$$;

revoke all on function public.register_for_event_atomic(uuid, uuid, uuid, text, text, text) from public;
revoke all on function public.register_for_event_atomic(uuid, uuid, uuid, text, text, text) from anon;
revoke all on function public.register_for_event_atomic(uuid, uuid, uuid, text, text, text) from authenticated;
grant execute on function public.register_for_event_atomic(uuid, uuid, uuid, text, text, text) to service_role;

-- ---------------------------------------------------------------------------
-- Centralized production rate-limit store for server-side API routes.
-- Keys are stored only as salted hashes by the application.
-- ---------------------------------------------------------------------------

create table if not exists public.security_rate_limits (
  key_hash text primary key,
  count integer not null default 0,
  window_start timestamptz not null default clock_timestamp(),
  reset_at timestamptz not null,
  updated_at timestamptz not null default clock_timestamp()
);

alter table public.security_rate_limits enable row level security;

revoke all on table public.security_rate_limits from anon;
revoke all on table public.security_rate_limits from authenticated;
grant select, insert, update, delete on table public.security_rate_limits to service_role;

create index if not exists security_rate_limits_reset_at_idx
on public.security_rate_limits (reset_at);

create or replace function public.hit_rate_limit(
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
)
returns table(success boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_window interval := make_interval(secs => greatest(p_window_seconds, 1));
  v_count integer;
  v_reset_at timestamptz;
  v_limit integer := greatest(p_limit, 1);
begin
  if nullif(trim(coalesce(p_key_hash, '')), '') is null then
    return query select false, 0, v_now + v_window;
    return;
  end if;

  insert into public.security_rate_limits (
    key_hash,
    count,
    window_start,
    reset_at,
    updated_at
  )
  values (
    p_key_hash,
    1,
    v_now,
    v_now + v_window,
    v_now
  )
  on conflict (key_hash) do update
  set
    count = case
      when public.security_rate_limits.reset_at <= v_now then 1
      else public.security_rate_limits.count + 1
    end,
    window_start = case
      when public.security_rate_limits.reset_at <= v_now then v_now
      else public.security_rate_limits.window_start
    end,
    reset_at = case
      when public.security_rate_limits.reset_at <= v_now then v_now + v_window
      else public.security_rate_limits.reset_at
    end,
    updated_at = v_now
  returning public.security_rate_limits.count, public.security_rate_limits.reset_at
  into v_count, v_reset_at;

  return query select v_count <= v_limit, greatest(v_limit - v_count, 0), v_reset_at;
end;
$$;

revoke all on function public.hit_rate_limit(text, integer, integer) from public;
revoke all on function public.hit_rate_limit(text, integer, integer) from anon;
revoke all on function public.hit_rate_limit(text, integer, integer) from authenticated;
grant execute on function public.hit_rate_limit(text, integer, integer) to service_role;

-- ---------------------------------------------------------------------------
-- Targeted indexes for public archives and media picker query paths.
-- ---------------------------------------------------------------------------

create index if not exists media_assets_event_picker_idx
on public.media_assets (created_at desc)
where provider = 'cloudinary'
  and media_kind = 'image'
  and is_public = true
  and deleted_at is null;

create index if not exists content_posts_public_notice_listing_idx
on public.content_posts (published_at desc nulls last, created_at desc)
where content_type = 'notice'
  and status = 'published';

create index if not exists events_published_status_starts_at_asc_idx
on public.events (status, starts_at asc)
where status = 'published';

-- ---------------------------------------------------------------------------
-- Public gallery album cards should not fetch every published gallery item.
-- security_invoker keeps the existing base-table RLS policies active.
-- ---------------------------------------------------------------------------

create or replace view public.gallery_album_cards
with (security_invoker = true)
as
select
  album.id,
  album.slug,
  album.title,
  album.event_name,
  album.description,
  album.year,
  album.month,
  album.starts_on,
  album.ends_on,
  album.category,
  album.featured,
  album.cover_item_id,
  album.cloudinary_folder,
  album.updated_at,
  coalesce(item_counts.item_count, 0)::integer as item_count,
  cover.id as cover_id,
  cover.alt_text as cover_alt_text,
  cover.blur_data_url as cover_blur_data_url,
  cover.description as cover_description,
  cover.height as cover_height,
  cover.sort_order as cover_sort_order,
  cover.source_caption as cover_source_caption,
  cover.title as cover_title,
  cover.width as cover_width,
  cover_media.alt_text as cover_media_alt_text,
  cover_media.height as cover_media_height,
  cover_media.id as cover_media_id,
  cover_media.media_kind as cover_media_kind,
  cover_media.public_id as cover_media_public_id,
  cover_media.secure_url as cover_media_secure_url,
  cover_media.thumbnail_url as cover_media_thumbnail_url,
  cover_media.title as cover_media_title,
  cover_media.width as cover_media_width
from public.gallery_albums album
left join lateral (
  select count(*)::integer as item_count
  from public.gallery_album_items item
  join public.media_assets asset
    on asset.id = item.media_asset_id
  where item.album_id = album.id
    and item.status = 'published'
    and item.deleted_at is null
    and asset.is_public = true
    and asset.deleted_at is null
) item_counts on true
left join lateral (
  select item.*
  from public.gallery_album_items item
  join public.media_assets asset
    on asset.id = item.media_asset_id
  where item.album_id = album.id
    and item.status = 'published'
    and item.deleted_at is null
    and asset.is_public = true
    and asset.deleted_at is null
  order by
    (item.id = album.cover_item_id) desc,
    item.is_cover desc,
    item.sort_order asc,
    item.id asc
  limit 1
) cover on true
left join public.media_assets cover_media
  on cover_media.id = cover.media_asset_id
  and cover_media.is_public = true
  and cover_media.deleted_at is null
where album.status = 'published'
  and album.deleted_at is null;

grant select on public.gallery_album_cards to anon, authenticated;

commit;
