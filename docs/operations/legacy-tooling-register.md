# Legacy Tooling Register

This register records compatibility tooling that remains in the repository after
the public-site migration. It prevents operators from mistaking recovery tools
for everyday product workflows and prevents unsafe cleanup of a still-useful
rollback path.

## Status Labels

- **Active operator workflow**: used during normal administration or scheduled
  operational work. Keep visible and documented.
- **Recovery-only**: retained for a bounded migration, validation, or rollback
  need. Do not run without an operator runbook and a current backup.
- **Archived data compatibility**: retained in the database only to preserve
  historical evidence. Application code must use the canonical replacement.

## Database Compatibility

| Item | Status | Canonical replacement | Evidence / rule |
| --- | --- | --- | --- |
| public.gallery_entries | Archived data compatibility | gallery_albums + gallery_album_items | Migration 20260710074151_archive_legacy_gallery_entries copied all six legacy records to the legacy-public-gallery-archive album, marked the originals archived, and revoked anon/authenticated table access. Do not add new reads or writes. Drop only after a separately approved data-retention decision. |
| Legacy public gallery archive album | Active historical content | gallery_albums + gallery_album_items | It is the public-facing, canonical preservation of the old gallery data. Treat it like any other published album. |

## Scripts And Dependencies

| Command or dependency | Status | Why it remains | Safe-use boundary |
| --- | --- | --- | --- |
| npm run content:import:legacy | Recovery-only | Imports published content from the former Strapi/MySQL site when a documented recovery or one-time gap fill is required. | Default is dry-run. --apply requires a verified backup, a reviewed report, and an operator approval. |
| mysql2 | Recovery-only dependency | Used only by the legacy content importer. | Do not remove until the legacy content source is formally retired and the importer is no longer part of the rollback plan. |
| Certificate CSV first/last header aliases | One-way input compatibility | Older spreadsheets can still supply first and last name headers. | The importer normalizes them into full_name only; it does not read or write split-name certificate database columns. |
| npm run committee:import:legacy | Recovery-only | Retains a controlled committee-history import path. | Run only with a reviewed source file and generated report. |
| npm run rehearse:cutover | Recovery-only verification | Produces a release/cutover inventory against the current Supabase state. | Read-only; retain as release evidence tooling. |
| npm run rehearse:cloudinary | Recovery-only verification | Validates migrated Cloudinary assets before a release or rollback decision. | Read-only validation only. |
| npm run rehearse:rollback | Recovery-only verification | Exercises the documented rollback plan without deleting production data. | Never substitute it for a real backup. |
| npm run rehearse:evidence | Recovery-only verification | Bundles cutover evidence for review. | Generated artifacts are not runtime dependencies. |
| npm run members:reconcile | Active operator workflow | Reconciles member records as onboarding data changes. | Use --dry-run first; it is not legacy cleanup. |
| npm run members:rollover-cycle | Active operator workflow | Advances an approved membership cycle. | Requires an explicit cycle decision and normal operator audit trail. |

## Route Compatibility

| Route | Status | Current owner |
| --- | --- | --- |
| /admin/settings/profile | Compatibility redirect | Admin Accounts self-profile view. Keep for bookmarked links; do not show as a separate navigation item. |
| /admin/dashboard | Compatibility entry | Dashboard / post-login routing. Keep until historic links and external redirects are no longer in use. |
| /admin/workplace | Active workflow | Profile Requests moderation. It is not a disposable alias. |
| /admin/reconcile | Active historical-report view | Reconciliation snapshot workflow. It may be merged into Reports only after a separate operator-UX decision. |
| /admin/content/pages | Advanced CMS workflow | Generic singleton-page editing; keep behind its existing advanced access boundary. |

## Review Cadence

Review this register after each major onboarding wave. A recovery-only script or
archived table may be removed only when all of these are true:

1. A current backup and migration evidence have been retained.
2. No package script, CI job, operator runbook, or code path still references it.
3. The canonical replacement has passed public, portal, and admin smoke checks.
4. A data-retention owner explicitly approves removal.
