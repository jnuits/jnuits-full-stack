# Supabase DB, Admin, And Frontend Cleanup Audit

Generated: 2026-07-04

This report is metadata-only and read-only. It does not include service keys, auth tokens, raw invite links, or user PII. Evidence was gathered with the Codex Supabase plugin using read-only SQL plus local repo inspection.

## Summary Findings

- Live Supabase migration history includes the June admin/security migrations and stops before the two July certificate full-name migrations.
- Live `certificates` still uses `first_name` / `last_name`; `certificates.full_name` is missing.
- Live `public_certificates` still exposes `first_name` / `last_name`; `public_certificates.full_name` is missing.
- Live raw `certificates` still has a public `SELECT true` policy, so public reads must be moved to the safe view before tightening.
- Live `admin_invitations.claim_invitation_id` exists; `admin_invitations` currently has 0 rows.
- Live `gallery_album_items` is the active gallery model with 986 rows; legacy `gallery_entries` still has 6 rows and code references remain.
- Live `profile_update_requests` has 8 rows, including 4 pending requests; preserve this workflow/data.
- Live `operator_reports` has 17 rows, including 10 old cutover/reconciliation report types; keep as historical evidence unless explicitly archived.
- Several sensitive tables still grant broad privileges to `anon`/`authenticated`; RLS protects rows, but grants should be narrowed in a later approved DB hardening pass.
- One public `SECURITY DEFINER` helper is executable by `anon` (`is_admin_totp_enforced`); classify before revoking because it may intentionally support auth UI behavior.

## Migration State

| Version | Local file | Live state | Action |
|---|---|---|---|
| `20260703020515` | `20260703020515_certificate_full_name.sql` | Pending | Apply later after preflight; backfills `full_name` and recreates safe view. |
| `20260703040706` | `20260703040706_cleanup_certificate_legacy_names.sql` | Pending | Apply only after the first migration and verification; drops split certificate names. |

## Table Counts

| Table | Exists live | Rows | Cleanup signal |
|---|---:|---:|---|
| `admin_invitations` | yes | 0 | Schema exists; no invite data to preserve today. |
| `admin_profiles` | yes | 3 | Status and `is_active` are consistent. |
| `certificates` | yes | 134 | Needs full-name migration before removing code fallback. |
| `certificates_import_staging` | yes | 135 | Needs `full_name_raw` after July migration. |
| `content_posts` | yes | 5 | No cleanup action in this pass. |
| `gallery_album_items` | yes | 986 | Canonical gallery item table. |
| `gallery_albums` | yes | 65 | Canonical gallery album table. |
| `gallery_entries` | yes | 6 | Legacy gallery table; verify archival/mirrored state before removal. |
| `media_assets` | yes | 1125 | Active shared media registry. |
| `member_invitations` | yes | 6 | Preserve for onboarding/claim flows. |
| `members` | yes | 8 | `full_name` populated; split names incomplete on 3 rows, defer cleanup. |
| `membership_applications` | yes | 0 | No pending application data. |
| `operator_reports` | yes | 17 | Preserve history; simplify UI copy instead of deleting. |
| `profile_update_requests` | yes | 8 | Preserve; 4 pending requests need operator visibility. |

## Key Schema Drift

| Object | Live state | Expected current app state |
|---|---|---|
| `certificates.full_name` | missing | present, non-null canonical recipient name |
| `certificates.first_name` / `last_name` | present, non-null | removed after cleanup migration |
| `public_certificates.full_name` | missing | present |
| `public_certificates.first_name` / `last_name` | present | removed from public API surface |
| `certificates_import_staging.full_name_raw` | missing | present |
| `admin_invitations.claim_invitation_id` | present | present |
| `admin_profiles.status` | present | present |

## Grants And Policy Findings

Tables with broad `anon` grants observed:

| Table | `anon` privileges |
|---|---|
| `admin_invitations` | `INSERT, REFERENCES, SELECT, UPDATE` |
| `admin_profiles` | `DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE` |
| `gallery_album_items` | `DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE` |
| `gallery_entries` | `DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE` |
| `members` | `DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE` |
| `membership_applications` | `DELETE, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE` |
| `operator_reports` | `DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE` |
| `profile_update_requests` | `DELETE, INSERT, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE` |

Policy notes:

- `event_registrations`, `membership_applications`, `members`, `gallery_album_items`, `gallery_entries`, `operator_reports`, and `profile_update_requests` now use permission-aligned policies.
- Raw `certificates` still has policy `certificates are publicly readable` with `SELECT true`.
- `public_certificates` grants are limited to `SELECT` for `anon`/`authenticated`, but the view shape is still legacy split-name.

## Code Usage Map

| Table/object | Current code signal |
|---|---|
| `certificates` | Admin certificate page/actions still use `full_name`; temporary admin loader fallback now supports split-name drift. |
| `public_certificates` | Public certificate helpers query the safe view and expect `full_name`. |
| `gallery_album_items` | Current gallery admin/public flows use this canonical album item model. |
| `gallery_entries` | Legacy references remain in content actions, public content helpers, media asset dependency checks, reports, and cutover scripts. |
| `operator_reports` | Reports and Reconcile both read this table; preserve historical rows. |
| `profile_update_requests` | Dashboard, Profile Changes, portal profile/workplace APIs, and decisions log use this table. |
| `admin_profiles` / `admin_invitations` | Current Admin Accounts console uses these lifecycle/invitation objects. |

## Staged Cleanup Recommendations

- Certificate cleanup: apply `20260703020515_certificate_full_name.sql`, verify `full_name` and safe view, then apply `20260703040706_cleanup_certificate_legacy_names.sql`. Remove temporary split-name code only after live verification passes.
- Public certificate hardening: remove raw public reads from `certificates`; public/frontend code should read `public_certificates` only.
- Gallery cleanup: move the remaining code/report paths off `gallery_entries`; verify whether the 6 rows are mirrored in `gallery_album_items` or intentionally archival before any table removal.
- Grants cleanup: narrow broad `anon` and `authenticated` grants after route smoke tests confirm RLS/PostgREST behavior remains intact.
- Function cleanup: classify exposed `SECURITY DEFINER` functions before revocation; do not blindly revoke helpers used by auth, RLS, or claims.
- Reports cleanup: preserve `operator_reports` history; simplify UI labels around old cutover/reconciliation concepts instead of deleting records.
- Member name cleanup: keep `members.first_name` / `last_name` compatibility until onboarding/import requirements for 1000 alumni are finalized.

## Reproducible Verification

Run this when a Supabase CLI token is available:

```bash
SUPABASE_CLI_COMMAND="npx --yes supabase" npm run db:audit-cleanup
```

Then run local gates:

```bash
npm run typecheck
npm run lint
npm test
npm run audit:admin-access
npm run audit:admin-ui
npm audit --audit-level=moderate
npm run build
```
