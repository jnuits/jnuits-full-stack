# Gallery Reconstruction Trello Tracker

Last updated: 2026-04-20

This is the repo-local Trello-style tracker for the gallery reconstruction phase. A live Trello connector is not available in this Codex session, so this file is the source of truth until the board is manually mirrored.

## Board Summary

| Metric | Status |
| --- | --- |
| Local implementation | Mostly complete |
| Remote Supabase schema | Blocked |
| Real gallery data import | Blocked by schema |
| Public gallery with real albums | Seed-backed until schema/import completes |
| Admin gallery with real albums | Code-ready; seed-backed schema-gated CRUD preview until schema/import completes |
| Verification | Local checks pass; live write checks blocked |

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

Status: Done locally

Evidence:
- `scripts/build-gallery-seed.mjs`
- `scripts/import-gallery-seed.mjs`
- `npm run gallery:build-seed`
- `npm run gallery:import -- --dry-run`
- `npm run gallery:import -- --apply`

Exit gate:
- Dry-run works locally.
- Apply is now schema-preflighted and safely stops before mutations when `gallery_albums` or `gallery_album_items` are missing.

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

Status: Done locally, seed-backed preview enabled

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
- Dashboard pagination, 20 albums per page
- Seed-preview mode shows the complete CRUD workflow while disabling save/mutation actions until the Supabase schema exists
- Event name, date range, category, Cloudinary folder, featured state, and updated time visible in the queue
- Item metadata edits
- Cover flag management
- Drag-and-drop ordering
- Image editor pagination, 20 image records per page
- Shows the sanitized seed as a read-only preview instead of a migration error while Supabase tables are unavailable

### G-009: Admin bulk upload and item operations

Status: Done locally, real-data verification blocked

Evidence:
- `src/components/admin/gallery-album-bulk-upload-panel.tsx`
- `src/app/api/admin/gallery/albums/[albumId]/media/route.ts`

Implemented:
- Multiple Cloudinary uploads into selected album folder
- Registers uploaded files into `media_assets`
- Attaches uploads as `gallery_album_items`
- Supabase stores gallery metadata and album links only; image files remain in Cloudinary
- Bulk item actions are implemented through admin gallery actions.

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

## Blocked

### G-011: Apply gallery migration to Supabase staging

Status: Blocked

Blocker:
- Supabase MCP is not exposed in this session.
- Supabase CLI is authenticated to a different organization/project list.
- Local environment is missing direct Postgres credentials or a Supabase access token for the JnUITS project.

Required evidence:
- `gallery_albums` exists in Supabase staging.
- `gallery_album_items` exists in Supabase staging.
- Migration output archived in `artifacts/reports/gallery/`.

Next action:
- Provide a direct staging Postgres connection string or apply `supabase/migrations/20260420000000_gallery_album_rebuild.sql` manually from the Supabase SQL editor.

### G-012: Import real gallery seed into Supabase staging

Status: Blocked by G-011

Command:
- `npm run gallery:import -- --apply`

Required evidence:
- Apply report with 64 albums.
- Apply report with 986 linked album items.
- Apply report with 1,112 media assets.
- Second apply report proving idempotency.

### G-013: Real-data public verification

Status: Blocked by G-011 and G-012

Required evidence:
- `/gallery` loads Supabase albums, not fallback data.
- `/gallery/aparahner-ariyal` resolves.
- `/gallery/typing-master-2018-campaign-day-1` resolves.
- Album detail initial payload has 20 items or fewer.
- Load more works.
- Images use transformed Cloudinary URLs.
- Mobile/tablet/desktop screenshots archived.

### G-014: Real-data admin verification

Status: Blocked by G-011 and G-012

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
| Import tooling | 100% local, 0% applied remotely |
| Public gallery code | 90% local, live data verification blocked |
| Admin gallery code | 95% local, live data verification blocked |
| Deletion lifecycle | 80% local, Cloudinary runtime verification pending |
| End-to-end production readiness | Blocked until Supabase migration/import |

Overall local code completion estimate: 92%.

Overall functional completion against staging data: blocked until the gallery migration and seed import are applied.

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
- Seed preview covers now use the same computed best-cover selection as the public gallery, instead of only explicit `isCover` flags.
- Admin album queue pagination shows every page number when the page count is small.
- Public album pagination and album editor pagination use the same small-page numbering behavior.
- Admin album creation includes event name plus start/end dates.
- Admin album rows show event name, date range, Cloudinary folder, featured state, and inline lifecycle actions.
- Album detail cover lookup now loads `cover_item_id` directly, so selected covers outside the first 20 images are not lost.

Still blocked:
- Remote Supabase migration remains unapplied; `gallery_albums` and `gallery_album_items` are missing from the schema cache.
- `SUPABASE_PAT` visible to the CLI currently lists a different organization/project set and does not expose the JnUITS project ref.
