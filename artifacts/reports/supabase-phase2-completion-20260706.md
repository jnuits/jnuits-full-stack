# Supabase Phase 2 Completion Evidence - 2026-07-06

## Scope
Applied reviewed production Supabase changes for backend/data-integrity closure. No user data was exported or modified directly. Changes were DDL/grants/indexes only.

## Applied Live Migrations
- `20260705205024_add_operational_foreign_key_indexes`
- `20260706025103_tighten_admin_operational_grants`
- `20260706030908_drop_duplicate_fk_indexes`
- `20260706031032_add_remaining_advisor_fk_indexes`
- `20260706035422_drop_duplicate_content_post_indexes`
- `20260706074012_phase2_rls_policy_advisor_cleanup`

## Verified Live State
- Migration history contains all six versions above.
- Public certificate lookup still resolves certificate `24007` via `public_certificates` with `full_name`.
- `anon` / `authenticated` can read only safe certificate columns from `certificates`; internal source identifiers are not selectable.
- Broad table grants were removed for:
  - `certificate_import_batches`
  - `certificates_import_staging`
  - `security_rate_limits`
- `public_certificates` remains `SELECT`-only for `anon` and `authenticated`.
- `security_settings` remains `SELECT`-only for `authenticated`; writes now go through server-side service-role action code.
- `security_rate_limits` now has a service-role-only RLS policy. This keeps the table private while removing the RLS-enabled/no-policy advisor finding.
- Supabase performance advisors no longer report unindexed foreign-key findings.
- Supabase performance advisors no longer report duplicate `content_posts` indexes after dropping `content_posts_author_member_idx` and `content_posts_review_queue_idx`.

## Connector Verification
- Supabase project `jnuits.org.bd` (`fsirdkjgrcocowxqjhjg`) is active on Postgres 17.
- Read-only SQL confirmed all six Phase 2 migrations are present in `supabase_migrations.schema_migrations`.
- `security_rate_limits` has one service-role-only policy and no `anon` / `authenticated` table grants.
- `public_certificates` exposes only `certificate_id`, `full_name`, `details`, `exam_or_event`, `exam_or_event_name`, `issue_date`, and `asset_url`.
- `anon` and `authenticated` cannot directly `SELECT` from raw `certificates`; both can `SELECT` from `public_certificates`.

## Remaining Supabase Advisor Backlog
- Authenticated-callable `SECURITY DEFINER` helpers remain for now. Local code/RLS usage confirms they are active auth/RBAC/portal helpers:
  - `current_rbac_claims_snapshot()` is used by session/proxy role resolution.
  - `is_admin_totp_enforced()` is used by MFA enforcement.
  - `current_member_type()` is used by portal ticket actions.
  - `is_super_admin_user(uuid)` is used by avatar authorization.
  - `has_permission(text)`, `current_member_id()`, `can_access_support_ticket(uuid)`, `can_manage_support_ticket(uuid)`, and `can_access_mentorship_relationship(uuid)` are used by RLS policies.
- These helper RPCs should be redesigned later by moving privileged helpers to a private schema or converting selected helpers to security invoker only after policy-by-policy tests. Blind revocation would break active flows.
- Supabase Auth leaked-password protection is disabled and should be enabled in the Supabase dashboard.
- Performance advisor still reports RLS initplan optimization opportunities and multiple permissive policies. A broad policy rewrite was intentionally not applied without explicit approval because it touches auth-sensitive access rules.
- Unused-index INFO warnings remain for newly-created FK/trigram indexes. These should be evaluated after real traffic; do not drop them immediately.

## Local Verification
- `npm run typecheck` passed.
- `npm run lint` passed.
- `npm test` passed.
- `npm run audit:admin-access` passed.
- `npm run audit:admin-ui` passed.
- `npm audit --audit-level=moderate` passed.
- `npm run build` passed.
- `npm run test:e2e` passed.
- `npm run test:e2e:matrix` passed after installing Firefox/WebKit browser binaries and capping matrix concurrency.
- `npm run test:runtime-probe` passed against local production server on port 3100.

## Blocked Local Checks
- `npm run migration:check` and `npm run db:audit-cleanup` still fail locally because this shell does not have a Supabase access token available to the CLI. Live state was verified through the Supabase connector instead.

## Approval Boundary
- A broad RLS policy rewrite was evaluated but not applied. The Supabase connector rejected it as too risky without explicit approval because it touched many auth-sensitive policies at once.
- Remaining RLS initplan and multiple-permissive-policy advisor findings are documented for a later dedicated policy rewrite with route-level smoke tests and rollback notes.




