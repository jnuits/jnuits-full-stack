# Phase 6 Legacy Cleanup Evidence

Generated: 2026-07-12

This evidence was collected with read-only Supabase MCP SQL queries and local
source inspection. It contains no credentials, user PII, raw invite links, or
other secrets. No database schema or data was changed.

## Live Migration Evidence

| Migration | Live state |
| --- | --- |
| 20260703020515 certificate_full_name | Applied |
| 20260703040706 cleanup_certificate_legacy_names | Applied |
| 20260710074151 archive_legacy_gallery_entries | Applied |

## Legacy Gallery Evidence

| Check | Result |
| --- | --- |
| Remaining public.gallery_entries rows | 6 |
| Legacy entry status | All 6 are archived |
| Canonical gallery_album_items rows | 992 active items |
| Legacy archive album exists | Yes |
| Items in legacy-public-gallery-archive | 6 |
| Legacy media assets not represented in archive album | 0 |
| anon/authenticated table grants on gallery_entries | None returned; the archive migration revoked them |

Conclusion: public.gallery_entries is archival evidence, not an active
application data source. The runtime media-reference check was removed because
it only searched for non-archived rows, of which there are none. The canonical
gallery source is gallery_albums and gallery_album_items.

## Certificate Full-name Evidence

The live certificates table contains full_name and no first_name or last_name
columns. The public_certificates view exposes full_name only. The only
anon/authenticated SELECT grant returned by the read-only check is on
public_certificates; direct table grants on certificates were not returned.

The remaining first/last-name references are CSV input aliases and import-staging
audit fields. They normalize into full_name and do not reintroduce legacy
certificate columns.
## Operator Report Evidence

operator_reports remains active historical evidence, not disposable legacy
data. The latest reconciliation_snapshot record was created on 2026-07-11.
Live report categories include reconciliation snapshots, content inventory,
membership reconciliation, CSV onboarding, and committee roster records.

Conclusion: keep the Reconcile route and historical reports. Any future
consolidation into Reports is an operator-experience decision, not a cleanup
deletion.

## Local Dependency And Script Classification

| Item | Classification |
| --- | --- |
| mysql2 | Recovery-only dependency used by the former Strapi/MySQL content importer |
| content:import:legacy | Recovery-only import tool; default dry-run |
| committee:import:legacy | Recovery-only import tool |
| rehearse:cutover, rehearse:cloudinary, rehearse:rollback, rehearse:evidence | Recovery-only release evidence tooling |
| members:reconcile and members:rollover-cycle | Active operational workflows |

See docs/operations/legacy-tooling-register.md for use boundaries and removal
criteria. See docs/operations/admin-workflow-ownership.md for the current
one-workflow-per-navigation ownership map.

## Remaining Approval-Gated Work

- Do not drop public.gallery_entries until data-retention ownership approves it.
- Do not remove mysql2 or recovery scripts until the former content source and
  rollback plan are formally retired.
- Narrow broad grants on the active gallery tables only in the separate RLS and
  PostgREST hardening pass, after route-level smoke checks.
- The repository CLI cleanup audit currently fails closed on this machine because
  no local Supabase access token is available. The MCP results above provide the
  current read-only evidence; no token values were inspected or printed.

## Reproducible Read-only Query Groups

1. Migration history from supabase_migrations.schema_migrations.
2. Gallery row counts across gallery_entries, gallery_albums, and
   gallery_album_items.
3. Status grouping for gallery_entries and a media-asset coverage check against
   the archive album.
4. anon/authenticated grant and policy metadata from information_schema and
   pg_policies.
5. Aggregate report-type counts from operator_reports.
