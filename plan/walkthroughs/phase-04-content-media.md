# Phase 04: Content and Media

## Goal

Move notices, blogs, events, gallery, about content, and media handling into the unified stack.

## Implementation checklist

- Rebuild the placeholder public routes into structured content pages using legacy field mapping as the migration contract.
- Model the legacy public collections in Supabase-backed tables or approved content storage.
- Port media ingestion and delivery rules.
- Add safe admin/editor workflows for content moderation and publishing.

## Verification checklist

- Confirm the rebuilt public content routes render meaningfully before the final data import.
- Compare public page counts against the legacy site.
- Confirm image and file delivery behave correctly in preview and production.
- Confirm draft/publish or moderation states work as designed.

## Test data or fixture needs

- Legacy content export datasets
- Representative media assets for large/small image checks

## Acceptance gate

The public content collections render from the new stack with acceptable parity and media behavior.

## Rollback or recovery notes

Keep import scripts idempotent so content can be re-run from source exports if a model adjustment is needed.
