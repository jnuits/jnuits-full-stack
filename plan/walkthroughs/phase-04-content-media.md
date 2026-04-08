# Phase 04: Content and Media

## Goal

Move notices, blogs, events, gallery, about content, and media handling into the unified stack.

## Implementation checklist

- Rebuild the placeholder public routes into structured content pages using legacy field mapping as the migration contract.
- Model the legacy public collections in Supabase-backed tables and keep large media in Cloudinary with metadata stored in Supabase.
- Port media ingestion and delivery rules with a Cloudinary URL contract and safe publish-state handling.
- Add safe admin/editor workflows for content moderation and publishing in `/admin/content`.

## Verification checklist

- Confirm the rebuilt public content routes render meaningfully before the final data import and fall back cleanly when the database is empty.
- Compare public page counts against the legacy site.
- Confirm Cloudinary-backed image and file delivery behave correctly in preview and production.
- Confirm draft/publish or moderation states work as designed.
- Confirm public pages remain responsive on desktop and phone widths after content/admin changes.

## Test data or fixture needs

- Legacy content export datasets
- Representative Cloudinary assets for large/small image checks

## Acceptance gate

The public content collections render from the new stack with acceptable parity, the admin content workspace can manage publish state and media references, and Cloudinary-backed delivery behaves correctly.

## Rollback or recovery notes

Keep import scripts idempotent so content can be re-run from source exports if a model adjustment is needed.
