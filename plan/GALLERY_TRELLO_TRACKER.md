# Gallery Reconstruction Trello Tracker

Last updated: 2026-04-20

This is the repo-local Trello-style tracker for the gallery reconstruction phase. A live Trello connector is not available in this Codex session, so this file is the source of truth until the board is manually mirrored.

## Board Summary

| Metric | Status |
| --- | --- |
| Local implementation | Complete for this gallery phase |
| Remote Supabase schema | Applied on staging |
| Real gallery data import | Applied on staging |
| Public gallery with real albums | Supabase-backed after import |
| Admin gallery with real albums | Supabase-backed CRUD workspace enabled |
| Verification | Migration/import/lint/typecheck/build/data probes passed |

## Done

### G-001: Album schema migration authored

Status: Done locally

Evidence:
- `supabase/migrations/20260420000000_gallery_album_rebuild.sql`
- Adds `gallery_albums`, `gallery_album_items`, media trash metadata, indexes, triggers, RLS, and grants.

Exit gate:
- Apply migration on Supabase staging. This remains blocked by missing DB write access in the current session.

### G-002: DB types updated

Status: Done locally

Evidence:
- `src/lib/db/types.ts`
- Includes `gallery_albums`, `gallery_album_items`, and media trash metadata fields.

### G-003: Sanitized seed artifact created

Status: Done locally

Evidence:
- `plan/data/jnuits-gallery-seed.json`
- Current seed summary: 64 albums, 986 linked album items, 1,112 Cloudinary media assets.

Notes:
- The original target expected 1,112 uploaded images and 64 albums. The seed currently links 986 items into albums because not every Cloudinary media asset has an album mapping yet.

### G-004: Deterministic seed import tooling

Status: Done on staging

Evidence:
- `scripts/build-gallery-seed.mjs`
- `scripts/import-gallery-seed.mjs`
- `npm run gallery:build-seed`
- `npm run gallery:import -- --dry-run`
- `npm run gallery:import -- --apply`

Exit gate:
- Dry-run works locally.
- Apply is schema-preflighted and safely stops before mutations when `gallery_albums` or `gallery_album_items` are missing.
- Apply succeeded on staging with 64 albums, 986 linked items, and 1,112 media assets.
- Re-running apply is idempotent.

Runtime fixes:
- Importer sanitizes malformed Facebook-exported surrogate characters before inserting text/JSONB payloads.
- Cloudinary public ID lookup batches are capped to avoid PostgREST URL-length failures.

### G-005: Public gallery rebuilt

Status: Done locally, seed-backed fallback enabled

Evidence:
- `src/app/(public)/gallery/page.tsx`
- `src/app/(public)/gallery/[identifier]/page.tsx`
- `src/components/gallery/gallery-load-more.tsx`
- `src/lib/content/gallery.ts`

Implemented:
- Album archive page
- Search/year/category filtering
- Album detail pages by slug
- Initial detail render capped at 20 items
- Load more via cursor pagination
- Cloudinary transformed URLs
- `next/image` dimensions and blur placeholders
- Empty state that clearly says import is pending instead of showing fallback data
- Uses `plan/data/jnuits-gallery-seed.json` when Supabase gallery tables are missing or empty

### G-006: Public pagination API

Status: Done locally, seed-backed fallback enabled

Evidence:
- `src/app/api/gallery/albums/[slug]/items/route.ts`

Implemented:
- `GET /api/gallery/albums/[slug]/items?cursor=<cursor>&limit=20`
- Max limit 40
- Published and non-deleted filtering
- Transformed image URLs and raw Cloudinary URL in response
- Falls back to seed pagination by slug when Supabase gallery tables are missing

### G-007: Dynamic gallery sitemap

Status: Done locally, seed-backed fallback enabled

Evidence:
- `src/app/sitemap.ts`

Implemented:
- Fetches published, non-deleted gallery albums when the table exists.
- Falls back to seed album slugs while the Supabase import is pending.
- Keeps `/gallery` indexed.

### G-008: Admin album dashboard and editor

Status: Done on staging code path; browser screenshot evidence pending

Evidence:
- `src/app/admin/content/gallery/page.tsx`
- `src/app/admin/content/gallery/[albumId]/page.tsx`
- `src/app/admin/content/gallery/actions.ts`
- `src/components/admin/gallery-album-reorder-panel.tsx`

Implemented:
- Album metrics
- Search/filter dashboard
- Create/edit album metadata, including event name, description, event month/year, date range, category, status, and featured state
- Publish/archive/restore/soft-delete albums
- Dashboard pagination, 12 albums per page
- Seed-preview mode shows the complete CRUD workflow while disabling save/mutation actions until the Supabase schema exists
- Admin album dashboard pagination reduced to 12 albums per page to keep the workspace scannable.
- Admin album dashboard now uses a list-first responsive layout with the create-album panel at the top instead of a narrow left rail.
- Album queue rows now use a responsive card layout, an icon-only public link, and an `Edit album` entry point.
- Event name, date range, category, Cloudinary folder, featured state, and updated time visible in the queue
- Item metadata edits
- Cover flag management
- Drag-and-drop ordering
- Image editor pagination, 20 image records per page
- Seed-preview album editor route opens from the dashboard so operators can review the intended edit/add/remove workflow before the migration is applied.
- Shows the sanitized seed as a read-only preview instead of a migration error while Supabase tables are unavailable
- Post-import dashboard uses `cover_item_id -> is_cover -> first published image` cover selection, so imported albums do not render gray placeholders when a valid Cloudinary image exists.
- Row actions are reduced to `Edit album`, icon-only public preview, and a compact lifecycle menu for publish/archive/restore/soft-delete.
- The album editor has a public cover preview, category dropdowns for all imported categories, cleaner lifecycle controls, and empty states for albums without photos.
- CRUD actions now revalidate both public and admin routes and clear stale cover pointers when cover images are archived, removed, or soft-deleted.

### G-009: Admin bulk upload and item operations

Status: Done on staging code path; Cloudinary runtime evidence pending

Evidence:
- `src/components/admin/gallery-album-bulk-upload-panel.tsx`
- `src/app/api/admin/gallery/albums/[albumId]/media/route.ts`

Implemented:
- Multiple Cloudinary uploads into selected album folder
- Registers uploaded files into `media_assets`
- Attaches uploads as `gallery_album_items`
- Supabase stores gallery metadata and album links only; image files remain in Cloudinary
- Bulk item actions are implemented through admin gallery actions.
- First upload to a coverless album automatically becomes the album cover.
- Upload registration revalidates the dashboard, editor, and public album routes.

### G-010: Media deletion lifecycle

Status: Done locally, Cloudinary runtime verification pending

Evidence:
- `src/lib/cloudinary/admin.ts`
- `src/lib/content/media-assets.ts`
- `src/app/admin/content/media/actions.ts`
- `src/app/admin/content/media/page.tsx`

Implemented:
- Explicit media-library trash action only.
- Reference checks block deletion if the media asset is still linked by gallery album items, legacy gallery entries, content posts, or developer profiles.
- Cloudinary rename moves approved assets to `jnuits/jnuits-full-stack/trash/YYYY/MM/<source>/<asset>`.
- Restore is allowed within the 30-day app restore window.
- App never hard-deletes Cloudinary assets in this phase.
- Album item removal remains separate and does not delete `media_assets`.

## Done On Staging

### G-011: Apply gallery migration to Supabase staging

Status: Done

Evidence:
- Applied `supabase/migrations/20260420000000_gallery_album_rebuild.sql` using Supabase MCP through the authenticated Codex CLI session.
- `gallery_albums` exists in Supabase staging.
- `gallery_album_items` exists in Supabase staging.

Verification:
- Supabase project URL confirmed as `https://fsirdkjgrcocowxqjhjg.supabase.co`.
- `public.gallery_albums`: base table.
- `public.gallery_album_items`: base table.

### G-012: Import real gallery seed into Supabase staging

Status: Done

Command:
- `npm run gallery:import -- --apply`

Evidence:
- First apply report: `artifacts/reports/gallery/gallery-seed-import-report-20260420T085331Z.json`
- Idempotency apply report: `artifacts/reports/gallery/gallery-seed-import-report-20260420T085405Z.json`
- Direct count check after import:
- `media_assets`: 1,125 total rows, including the 1,112 Cloudinary media rows from the seed plus pre-existing media records.
- `gallery_albums`: 64 rows.
- `gallery_album_items`: 986 rows.

Notes:
- Gallery images remain in Cloudinary. Supabase stores media metadata and album-item links only.

## Blocked / Pending Runtime Evidence

### G-013: Real-data public verification

Status: Partially verified with data/build probes; browser screenshots pending

Required evidence:
- `/gallery` loads Supabase albums, not fallback data.
- `/gallery/aparahner-ariyal` resolves.
- `/gallery/typing-master-2018-campaign-day-1` resolves.
- Album detail initial payload has 20 items or fewer.
- Load more works.
- Images use transformed Cloudinary URLs.
- Mobile/tablet/desktop screenshots archived.

### G-014: Real-data admin verification

Status: Partially verified with data/build probes; browser screenshots pending

Required evidence:
- Super Admin can create/edit/publish/archive/restore/soft-delete albums.
- Bulk upload attaches multiple assets to one album.
- Bulk item actions work.
- Media trash/restore works against Cloudinary.
- Non-operators are rejected.

## To Do

### G-015: Resolve missing or unmapped historical album content

Status: To do

Known gap:
- The plan references `/gallery/heritage-tour`, but the current seed does not contain a `heritage-tour` slug.

Next action:
- Confirm the correct historical tour album name/slug and source assets, then add it to `plan/data/jnuits-event-catalog.json` and rebuild the seed.

### G-016: Production evidence pack

Status: To do after real-data import

Required evidence:
- Migration output
- Import dry-run/apply/idempotency reports
- Public gallery screenshots
- Admin gallery screenshots
- Sitemap proof
- Cloudinary trash/restore proof
- Build/lint/typecheck output

## Completion Estimate

| Area | Completion |
| --- | --- |
| Local schema and types | 100% |
| Import tooling | 100% local and applied on staging |
| Public gallery code | 100% for imported album archive; browser screenshot evidence pending |
| Admin gallery code | 100% for metadata CRUD, lifecycle, pagination, cover management, and bulk item operations; Cloudinary upload proof pending |
| Deletion lifecycle | 85% local/staging metadata complete; Cloudinary trash/restore runtime proof pending |
| End-to-end production readiness | Migration/import complete; final browser and Cloudinary runtime evidence pending |

Overall local code completion estimate: 100% for the current gallery reconstruction phase.

Overall functional completion against staging data: complete for Supabase-backed read/write code paths; public/admin browser evidence and Cloudinary trash/restore runtime screenshots still pending.

## Verification Log

### 2026-04-20 seed fallback verification

Passed:
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `node scripts/import-gallery-seed.mjs --dry-run`

Seed confirms:
- 64 albums
- 986 linked album items
- 1,112 media assets
- `/gallery/aparahner-ariyal` source exists
- `/gallery/typing-master-2018-campaign-day-1` source exists

Known content gap:
- `/gallery/heritage-tour` source is not present in the current seed.

### 2026-04-20 local verification

Passed:
- `npm run typecheck`
- `npm run lint`
- `npm run build`
- `node scripts/import-gallery-seed.mjs --dry-run`

Expected blocked result:
- `node scripts/import-gallery-seed.mjs --apply`

Blocked output:
- `gallery_albums`: table missing from Supabase schema cache.
- `gallery_album_items`: table missing from Supabase schema cache.

Interpretation:
- The gallery code compiles and the seed artifact is readable.
- The importer is correctly refusing to mutate staging until the album migration is applied.

### 2026-04-20 admin gallery audit follow-up

Fixed locally:
- Admin seed-preview mode no longer renders a large blank create-column area.
- Admin seed-preview mode now exposes the create-album workflow fields for operator review while keeping the save action disabled until `gallery_albums` exists.
- Admin create/edit workflow explicitly supports late-uploaded content metadata: description, event name, event month/year, start/end dates, category, status, featured state, and Cloudinary folder.
- Admin copy now states that gallery images stay in Cloudinary and Supabase stores only metadata/album links.
- Admin album list responsiveness fixed by removing the two-column create/list rail and replacing wide row actions with wrapping action controls.
- Admin album list now shows 12 albums per page.
- Public preview links are icon-only.
- `Edit metadata` was renamed to `Edit album`, and seed preview now opens an album editor page showing metadata/photo add/remove controls in a disabled schema-gated state.
- Seed preview covers now use the same computed best-cover selection as the public gallery, instead of only explicit `isCover` flags.
- Admin album queue pagination shows every page number when the page count is small.
- Public album pagination and album editor pagination use the same small-page numbering behavior.
- Admin album creation includes event name plus start/end dates.
- Admin album rows show event name, date range, Cloudinary folder, featured state, and inline lifecycle actions.
- Album detail cover lookup now loads `cover_item_id` directly, so selected covers outside the first 20 images are not lost.

Still blocked:
- Browser verification screenshots for public and admin gallery flows are still pending.
- Cloudinary trash/restore runtime proof is still pending.

### 2026-04-20 staging migration and import

Applied:
- `supabase/migrations/20260420000000_gallery_album_rebuild.sql`

Verified:
- `public.gallery_albums` exists on Supabase staging.
- `public.gallery_album_items` exists on Supabase staging.

Imported:
- `npm run gallery:import -- --apply`
- 64 albums.
- 986 linked album items.
- 1,112 Cloudinary media assets from the gallery seed.

Idempotency:
- A second `npm run gallery:import -- --apply` completed successfully with the same expected counts.

Reports:
- `artifacts/reports/gallery/gallery-seed-import-report-20260420T085331Z.json`
- `artifacts/reports/gallery/gallery-seed-import-report-20260420T085405Z.json`

Code checks:
- `npm run lint`
- `npm run typecheck`
- `npm run build`

### 2026-04-20 admin gallery post-import audit

Fixed:
- Admin dashboard now uses a bounded responsive workspace instead of stretching rows across ultra-wide desktop widths.
- Admin album rows now use image-led cards, compact badges, icon-only public links, and a `Manage` lifecycle menu.
- Admin dashboard cover selection now matches imported Supabase data and falls back safely when an album has no explicit cover.
- Album editor now shows the current public cover preview, category dropdowns including `community-social`, and relevant lifecycle actions only.
- Item save/bulk actions now clear cover pointers when a cover is archived, removed, or soft-deleted.
- Bulk upload registration assigns the first uploaded photo as cover when an album has no cover.
- Public gallery and album detail pages now show branded fallback states if a cover is missing instead of empty gray blocks.
- Album detail photo captions now use compact `Photo 01` style fallback titles and suppress repeated long Facebook captions.

Data probe:
- Supabase staging has 64 `gallery_albums` rows.
- All 64 albums have `cover_item_id`.
- The first 12 admin-dashboard albums all resolve to Cloudinary cover URLs.
- Active album items: 986.

Verification:
- `npm run lint`
- `npm run typecheck`
- `npm run build`
