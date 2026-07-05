# Supabase Phase 2 Audit Evidence - 2026-07-05

Project: `jnuits.org.bd` (`fsirdkjgrcocowxqjhjg`)

Scope: read-only verification after the certificate full-name and public certificate hardening migrations. This report contains metadata and aggregate counts only.

## Migration State

Live migration history includes the expected backend/security migrations from June 2026 and the certificate migrations applied during the July 2026 release-readiness pass:

- `20260608093000_admin_permission_policy_hardening`
- `20260612090000_security_performance_remediation`
- `20260613090000_public_certificate_safe_view`
- `20260628034000_tighten_public_view_and_function_grants`
- `20260630190842_admin_account_lifecycle`
- `20260630191141_admin_invitation_member_search_hardening`
- `20260703020515_certificate_full_name`
- `20260703040706_cleanup_certificate_legacy_names`
- `20260705013614_tighten_certificate_public_access`
- `20260705013928_public_certificate_view_access`
- `20260705020732_public_certificate_security_invoker_view`
- `20260705022356_revoke_anon_admin_totp_helper`

## Certificate Verification State

- `certificates`: 134 rows.
- `public_certificates`: 134 rows.
- Raw `certificates` contains `certificate_id`, `source_document_id`, `source_record_id`, and canonical `full_name`.
- Raw `certificates` no longer contains `first_name` or `last_name`.
- Public `public_certificates` exposes the public-safe certificate projection with `full_name`.
- Public `public_certificates` no longer exposes `first_name`, `last_name`, `source_document_id`, or `source_record_id`.
- `anon` can select certificate `24007` from `public.public_certificates`.
- `public_certificates` is a `security_invoker=true` view. Public roles have column-scoped SELECT on safe certificate fields in `certificates`, while source identifier columns remain denied.

Conclusion: certificate schema drift is closed. Public certificate verification should use `public_certificates`; direct base-table access is limited to the same safe public columns so the security-invoker view can operate without bypassing RLS.

## RLS And Policy State

- Public tables with RLS disabled: `0`.
- Active public RLS policies still referencing `has_platform_role(...)`: `0`.

Conclusion: the earlier role-policy drift is closed at the policy layer. Keep `has_platform_role(...)` only as a compatibility helper until app usage no longer needs it.

## Grants Still Requiring Cleanup Review

Current public-role table grants remain broad:

- Non-SELECT grant entries to `anon` / `authenticated`: `599`.
- Public objects affected by non-SELECT grants: `52`.
- SELECT grant entries to `anon` / `authenticated`: `105`.

These grants are partially mitigated by RLS, but they are still broader than the app needs. Recommended next step is a reviewed, table-by-table grant tightening migration with route smoke tests, not a blanket revoke.

Priority tables to review first:

- `admin_profiles`
- `admin_invitations`
- `audit_events`
- `security_events`
- `member_invitations`
- `membership_applications`
- `profile_update_requests`
- `certificate_import_batches`
- `certificates_import_staging`
- RBAC tables
- support and mentorship tables

## Security Definer Function Exposure

`SECURITY DEFINER` functions executable by public roles:

| Function | anon | authenticated | Initial classification |
|---|---:|---:|---|
| `is_admin_totp_enforced()` | no | yes | Anonymous execute revoked; authenticated/service-role kept for admin MFA routing. |
| `allocate_membership_id(year_block text)` | no | yes | Sensitive mutation helper; review before authenticated execute remains. |
| `commit_bulk_membership_operation(target_operation_id uuid)` | no | yes | Sensitive mutation helper; likely should be service-role or permission-gated inside function. |
| `preview_bulk_membership_operation(target_operation_id uuid)` | no | yes | Review function body and permission checks. |
| `set_member_lifecycle_status(...)` | no | yes | Sensitive mutation helper; review function body and permission checks. |
| `has_permission(requested_permission text)` | no | yes | Required RLS/helper function; keep if body is safe. |
| `has_platform_role(role_code text)` | no | yes | Compatibility helper; remove later after code and policy usage are gone. |
| `is_super_admin()` / `is_super_admin_user(target_user_id uuid)` | no | yes | Required helper candidates; verify no broad data leak. |
| `current_member_id()` / `current_member_type()` | no | yes | Required portal/RLS helper candidates. |
| `current_rbac_claims_snapshot()` | no | yes | Verify output does not expose more than needed. |
| `can_access_mentorship_relationship(...)`, `can_access_support_ticket(...)`, `can_manage_support_ticket(...)` | no | yes | Likely RLS helpers; keep after body review. |

Conclusion: do not revoke these blindly. The next migration should classify each function by actual app dependency and either keep with documented body-level authorization or restrict execution.


## Advisor Notes

- public_certificates no longer appears as a security-definer view after 20260705020732_public_certificate_security_invoker_view.
- Anonymous execution of public.is_admin_totp_enforced() is closed by 20260705022356_revoke_anon_admin_totp_helper.
- public.security_rate_limits still appears as RLS-enabled with no policies. This is expected for a service-role-only rate-limit backend and should remain documented unless a public RPC path requires otherwise.

## Legacy And Data Integrity State

| Object | Live rows | Recommendation |
|---|---:|---|
| `gallery_album_items` | 986 | Canonical gallery item model; keep. |
| `gallery_entries` | 6 | Legacy candidate; active reports now use `gallery_album_items`. Keep table/code references only for legacy scripts and media-delete safety until rows are confirmed mirrored or archival. |
| `profile_update_requests` | 8 | Preserve. Current state: 4 pending, 4 approved. |
| `member_invitations` | 6 | Preserve for onboarding audit/history. |
| `admin_invitations` | 0 | Schema ready; no live queue yet. |
| `operator_reports` | 17 | Preserve as history. Types include `content_inventory`, `reconciliation_snapshot`, `csv_onboarding`, `membership_reconciliation`, and `committee_roster`. |
| `admin_profiles` | 3 | All are `status = active` and `is_active = true`. |

## Phase 2 Status

Completed:

- Certificate migration drift closed.
- Public certificate safe view verified.
- Raw certificate source identifier fields denied to `anon`; safe public fields are column-granted for the security-invoker view.
- Public table RLS coverage verified.
- Old `has_platform_role(...)` policy drift verified as closed.
- Admin profile lifecycle consistency verified.

Still remaining:

- Reviewed grant-tightening migration for the 52 public objects with broad non-SELECT grants.
- Remaining authenticated security-definer helper classification; anonymous `is_admin_totp_enforced()` exposure is closed.
- Final gallery legacy data decision for the 6 `gallery_entries` rows.
- Route smoke tests after any grant/function hardening changes.

## Recommended Next Actions

1. Keep the certificate migrations and audit-script updates in the current change set.
2. Create a separate Supabase hardening migration for grants/functions only after reviewing exact app dependencies.
3. Run browser/API smoke tests for public content, portal member flows, admin invitation/member flows, events, gallery, support, and certificates before narrowing broad grants.
4. Keep `gallery_entries` until its 6 rows are confirmed migrated or intentionally archival; active runtime reporting has been moved to `gallery_album_items`.
## Local Resume Checkpoint - 2026-07-05

- Active runtime/reporting code no longer writes to or counts from `gallery_entries`; reports count canonical `gallery_album_items`.
- Legacy `gallery_entries` references remain intentionally limited to DB types, legacy import/rehearsal scripts, cleanup audit inventory, and media-delete reference safety.
- `db:verify-admin-invite-search` now uses the Windows-safe Supabase CLI invocation path. With `SUPABASE_CLI_COMMAND="npx --yes supabase"`, local execution reaches Supabase and then fails only if no `SUPABASE_ACCESS_TOKEN`/`SUPABASE_PAT` is available.
- Connector read-only verification confirmed admin invite search migration, `claim_invitation_id`, `pg_trgm`, and all four invite-search trigram indexes exist live.
## Gallery Legacy Row Verification - 2026-07-05

Read-only Supabase comparison against production found:

- `gallery_entries`: 6 rows, all `status = published`.
- `gallery_album_items`: 986 canonical rows.
- Legacy rows matched to canonical rows by `media_asset_id`: 0 of 6.

Conclusion: do not drop `gallery_entries` or its media-delete safety checks yet. The six published legacy rows must be explicitly migrated into a canonical album or archived by owner decision before the table/code references can be removed.
## SECURITY DEFINER Classification - 2026-07-05

Read-only live metadata and runtime code search classified remaining authenticated SECURITY DEFINER advisor warnings:

### Staged hardening candidates

A local migration was created and applied live: `20260705151405_restrict_authenticated_security_definer_exec.sql`.

It revokes direct `authenticated` RPC execution for helpers that have no live RLS policy references and are called by current app code through server-only service-role clients:

- `public.allocate_membership_id(text)`
- `public.commit_bulk_membership_operation(uuid)`
- `public.preview_bulk_membership_operation(uuid)`
- `public.set_member_lifecycle_status(uuid, text, text, text)`
- `public.has_platform_role(text)`

Expected effect after approved live application: reduce Supabase authenticated SECURITY DEFINER advisor warnings without affecting RLS policy evaluation or normal app server actions.

### Intentionally authenticated for now

Keep authenticated execution until a deeper RLS/private-schema redesign is planned because these helpers are referenced by live policies or active authenticated flows:

- `public.current_member_id()`
- `public.current_member_type()`
- `public.current_rbac_claims_snapshot()`
- `public.has_permission(text)`
- `public.is_super_admin()`
- `public.is_super_admin_user(uuid)`
- `public.can_access_mentorship_relationship(uuid)`
- `public.can_access_support_ticket(uuid)`
- `public.can_manage_support_ticket(uuid)`
- `public.is_admin_totp_enforced()`

`public.security_rate_limits` remains RLS-enabled with no policies by design because the rate-limit backend is service-role-only.

## Live Hardening Applied - 2026-07-05

- Applied migration recorded live as 20260705151405_restrict_authenticated_security_definer_exec.
- Verified uthenticated no longer has EXECUTE on llocate_membership_id, commit_bulk_membership_operation, preview_bulk_membership_operation, set_member_lifecycle_status, or has_platform_role.
- Verified service_role retains EXECUTE on those helpers.

## Post-Resume Live Verification - 2026-07-05

Read-only verification through the Supabase connector confirmed live migration version `20260705151405` is present. The five hardened functions remain inaccessible to `anon` and `authenticated`, and executable by `service_role`:

- `public.allocate_membership_id(text)`
- `public.commit_bulk_membership_operation(uuid)`
- `public.preview_bulk_membership_operation(uuid)`
- `public.set_member_lifecycle_status(uuid, text, text, text)`
- `public.has_platform_role(text)`

## Post-Apply Advisor Result - 2026-07-05

After live migration `20260705151405_restrict_authenticated_security_definer_exec`, Supabase security advisors no longer list these five helpers as authenticated-executable SECURITY DEFINER functions:

- `public.allocate_membership_id(text)`
- `public.commit_bulk_membership_operation(uuid)`
- `public.preview_bulk_membership_operation(uuid)`
- `public.set_member_lifecycle_status(uuid, text, text, text)`
- `public.has_platform_role(text)`

Remaining advisor warnings are intentionally deferred because they are live RLS/session helpers or require product-level Supabase Auth configuration:

- `public.can_access_mentorship_relationship(uuid)`
- `public.can_access_support_ticket(uuid)`
- `public.can_manage_support_ticket(uuid)`
- `public.current_member_id()`
- `public.current_member_type()`
- `public.current_rbac_claims_snapshot()`
- `public.has_permission(text)`
- `public.is_admin_totp_enforced()`
- `public.is_super_admin()`
- `public.is_super_admin_user(uuid)`
- Supabase Auth leaked password protection is disabled in dashboard settings.

Do not revoke the remaining function grants without redesigning affected RLS policies/session refresh paths and smoke-testing portal/admin flows.

## Public Certificate View Grant Drift - 2026-07-06

Read-only Supabase verification found `public.gallery_album_cards` is already SELECT-only for `anon` and `authenticated`, but `public.public_certificates` still has broad non-SELECT grants (`DELETE`, `INSERT`, `REFERENCES`, `TRIGGER`, `TRUNCATE`, `UPDATE`) for both public API roles.

A local follow-up migration was prepared: `20260705202621_tighten_public_certificate_view_grants.sql`.

Expected migration effect:

- Revoke all privileges on `public.public_certificates` from `public`, `anon`, and `authenticated`.
- Grant only SELECT on `public.public_certificates` to `anon` and `authenticated`.
- Reload the PostgREST schema cache.

This is intentionally scoped to the public-safe view only; broader table grant tightening still requires table-by-table smoke testing.

## Public Certificate View Grant Hardening Applied - 2026-07-06

Applied live migration: `20260705202621_tighten_public_certificate_view_grants`.

Post-apply read-only verification:

- Public tables without RLS: `0`.
- Active public RLS policies still referencing `has_platform_role(...)`: `0`.
- Broad non-SELECT grants on `public.public_certificates`: `0`.
- `public.gallery_album_cards` grants for `anon` and `authenticated`: SELECT only.
- `public.public_certificates` grants for `anon` and `authenticated`: SELECT only.
- `certificates`: 135 rows, `blankFullNameCount = 0`.
- `public_certificates`: 135 rows.
- Known certificate `24007` still resolves through `public.public_certificates` with canonical `full_name`.

Supabase advisor state after this migration:

- `public.security_rate_limits` remains RLS-enabled with no policies by design for service-role-only rate limiting.
- Remaining SECURITY DEFINER warnings are the intentionally deferred authenticated RLS/session helpers already classified in this report.
- Supabase Auth leaked password protection remains a dashboard-level setting to enable outside SQL migration flow.

## Gallery Legacy Runtime Cleanup - 2026-07-06

Operational cutover rehearsal now counts canonical `gallery_album_items` with `status = published` and `deleted_at IS NULL` instead of legacy `gallery_entries`.

Remaining `gallery_entries` references are intentionally limited to:

- generated DB types/schema/migration history;
- media asset delete-safety checks, so legacy published rows cannot be orphaned accidentally;
- cleanup audit inventory;
- legacy public-content import tooling.

The six live `gallery_entries` rows are still not mirrored into `gallery_album_items` by `media_asset_id`, so table removal remains blocked pending owner archival/migration decision.

## Performance Advisor Snapshot - 2026-07-06

Supabase performance advisors still report non-blocking tuning items that should be handled separately from this security/grant cleanup batch:

- unindexed foreign keys across admin invitations, gallery, events, media, membership, mentorship, settings, and related operational tables;
- multiple permissive RLS policies on several content/RBAC/committee/project tables;
- duplicate indexes on `content_posts` review/author paths;
- newly added admin-invite trigram indexes are currently reported as unused because the feature has not had enough production traffic yet. Do not remove them during the onboarding buildout.

No performance advisor item was introduced by the `public_certificates` grant-only migration; the post-apply grant check shows SELECT-only public access on that view.

## Operational FK Index Plan - 2026-07-06

Supabase performance advisors reported unindexed foreign keys across many public tables. A broad 104-index live rollout was rejected as too high-blast-radius, so the local migration was narrowed to a first-wave pending migration: `20260705205024_add_operational_foreign_key_indexes.sql`.

The pending migration adds 35 indexes for release-critical paths only:

- media and gallery tables with the largest current row counts;
- certificate import staging and batch ownership;
- admin/member invitations, members, and profile update requests for onboarding scale;
- audit/security/operator report actor joins;
- event registration and event ownership/media joins.

This migration has not been applied live in this batch. It should be applied during a low-traffic window, then verified with the FK-index gap query and route smoke tests. Remaining lower-priority FK advisor items should be handled table-by-table later.
