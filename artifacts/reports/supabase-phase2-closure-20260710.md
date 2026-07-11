# Supabase Phase 2 Closure Evidence - 2026-07-10

## Scope

This record closes the reviewed backend/data-integrity work for the current release. It contains metadata only; no credentials or user PII are included.

## Applied Production Changes

- `20260710073007_phase2_rls_initplan_uid_wrap`
  - Rewrote 16 existing RLS predicates to use `(select auth.uid())` where the value is request-stable.
  - Preserves the original authorization conditions while avoiding per-row Auth lookups.
- `20260710073629_tighten_sensitive_table_grants`
  - Revoked browser-role table privileges from server-owned operational tables: `admin_invitations`, `admin_profiles`, `audit_events`, `event_registrations`, `member_invitations`, `profile_update_requests`, `rbac_user_claim_versions`, `rbac_user_platform_roles`, and `security_events`.
  - RLS remains enabled as defense in depth; active routes use server-only service-role clients.
- `20260710074151_archive_legacy_gallery_entries`
  - Copied six published legacy `gallery_entries` into the canonical `gallery_album_items` model under the published `legacy-public-gallery-archive` album.
  - Archived, rather than deleted, all six legacy rows and revoked browser-role access to that legacy table.

## Verified Live State

- All public tables have RLS enabled.
- The nine server-owned tables above have no `anon` or `authenticated` table grants.
- Admin lifecycle records are internally consistent: active profiles have active admin grants, non-active profiles do not, and the pending profile has a matching pending invitation.
- Gallery archive contains six canonical items; all six legacy rows are archived; no browser-role grant remains on `gallery_entries`.
- The Supabase performance advisor no longer reports the RLS init-plan warnings covered by the applied migration.

## Application Lifecycle Enforcement

- `requireAdminUser()` now loads the matching `admin_profiles` lifecycle record through the server-only service-role client before protected admin work continues.
- Only `status = active` together with `is_active = true` is permitted. Pending, frozen, removed, missing, inconsistent, or unavailable records redirect to the safe admin access-pending explanation route.
- This closes the stale-session gap: an RBAC grant left intact during a freeze cannot keep an existing session inside the admin panel.
## Intentionally Retained Authenticated SECURITY DEFINER Helpers

All remaining helpers set `search_path` to the empty schema and are not executable by `anon`. They remain executable by `authenticated` because current RLS policies or authenticated session flows require them:

- RLS access checks: `can_access_mentorship_relationship`, `can_access_support_ticket`, `can_manage_support_ticket`, `current_member_id`, `has_permission`, `is_super_admin`, and `is_super_admin_user`.
- Caller-scoped session/portal helpers: `current_rbac_claims_snapshot`, `current_member_type`, and `is_admin_totp_enforced`.

They must not be revoked without a private-schema or policy-by-policy redesign and authenticated portal/admin smoke tests. Direct execution is constrained to the caller's identity or a narrow role/status predicate; no `anon` execution remains.

## Remaining Manual Security Configuration

Supabase Auth leaked-password protection is still disabled. This is a hosted Auth configuration rather than a SQL migration. Enable **Prevent Leaked Passwords** in the project Auth settings before declaring the release fully security-complete. Supabase documents this as password protection backed by HaveIBeenPwned.

## Temporary QA Configuration

Supabase Auth CAPTCHA has been temporarily disabled by the project owner to permit local authenticated QA. `AUTH_CAPTCHA_REQUIRED=false` now disables the app-side challenge only outside deployed production, and deployed production still forces CAPTCHA. Before the next production release, set `AUTH_CAPTCHA_REQUIRED=true` and re-enable CAPTCHA in Supabase Auth so both layers are aligned.
## Deferred Advisor Work

- Unused-index notices should be reviewed after real traffic, not dropped solely because the project is young.
- Multiple permissive-policy notices require a dedicated policy redesign and route-level regression pass; they are not a safe bulk cleanup.