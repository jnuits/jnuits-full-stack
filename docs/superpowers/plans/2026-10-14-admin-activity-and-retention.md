# Admin Activity and Retention Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for Codex-owned work. Frontend ownership follows docs/operations/2026-10-14-gemini-frontend-accountability-handover.md. Codex retains backend and release ownership. Steps use checkbox syntax for tracking.

**Status:** Approved by the owner on 2026-10-14; branch/handover preparation only, implementation not started.
**Goal:** Give authorized operators trustworthy admin sign-in/action history and evidence-qualified activity summaries, retaining details for at least three calendar months.
**Architecture:** Service-owned private normalized events project trusted Auth/application receipts into the existing audit explorer. Compact per-admin summaries and ingestion coverage survive detail expiry without inventing historical attendance.
**Tech Stack:** Installed Next.js/TypeScript, Supabase Auth/Postgres, existing permission guards, Vitest, SQL replay, Playwright.
**Spec:** ../specs/2026-10-14-profile-completion-admin-accountability-design.md, Release 2.

## Global Constraints

- Hosted auth.audit_log_entries had zero rows on 2026-10-14; absence proves no “never logged in” claim.
- No browser access to auth/private tables, no auth-table triggers, no caller-supplied trusted actor/outcome.
- Event details live at least three calendar months; never shorten existing audit/security/verification retention.
- Preserve live-session/current-policy/permission checks and native AAL2/password/intent rules.
- No full request bodies, passwords, cookies, tokens, invitation codes, QR/setup keys or fingerprinting in logs.
- Public/login CAPTCHA stays; authenticated dashboards use existing guards and meaningful confirmations.
- New migrations are generated at execution with supabase migration new; historical SQL and all 120 applied versions remain untouched.

## Review Focus

- Forged legacy audit rows cannot establish workspace attendance/completed work (Tasks 1, 3).
- Reauthentication, refresh and background calls do not become new logins/work (Task 3).
- Direct-origin forged Cloudflare headers cannot become verified visitor IP/country (Task 2).
- A coverage interruption or removed identity cannot become a false never-used/inactive claim (Task 4).
- Pagination/retention/replay cannot lose summaries or resurrect duplicate events/notices (Tasks 1, 4).

### Task 1: source catalog and private event store

**Files:** Create docs/operations/admin-activity-event-catalog.md; src/lib/admin/activity/model.ts, model.test.ts, store.ts and store.test.ts; generated forward migration admin_activity_foundation; supabase/verification/assert-admin-activity.sql. Update generated database types through the existing replay/type-generation path.

**Interfaces:** AdminActivityEvent = { id, source, sourceId, actorUserId, targetUserId, action, outcome, occurredAt, recordedAt, context, provenance }. outcome = succeeded | failed | denied | unknown. model.ts also defines AuditRequestContext with observedIp/clientIp/countryCode (nullable strings), browser/os/deviceClass (bounded coarse strings) and networkSource; Task 2 implements its trusted resolver. No later-file import is needed to compile the foundation. Private tables: admin_activity_events, admin_activity_summaries, admin_activity_ingestion_state. Source/sourceId is unique. AdminActivityStore.appendTrusted(event): Promise<stored | duplicate>; service-only RPCs validate input, sessions where applicable and source receipts.

- [ ] Inventory admin mutation/audit writers with rg in src/app/admin, src/app/api/admin and src/lib; map every current privileged mutation and Auth entry/password/MFA path to its committed receipt and actual outcome. Record any instrumentation gaps as release work, not assumed coverage.
- [ ] Write failing event/store and SQL permission tests for source replay, immutable actor/outcome, anon/portal/content-admin/ordinary-admin/manager/super-admin/service contexts and rejected browser writes. Legacy source evidence is explicitly non-authoritative for attendance.
- [ ] Run focused Vitest and the disposable SQL replay; verify failures before new tables/RPCs exist.
- [ ] Add private RLS-enabled tables and explicit service-only grants/RPCs with empty search paths where definer access is required. Index actor/time, target/time and action/time; use stable timestamp/ID ordering and monotonic ingestion checkpoints.
- [ ] Run focused tests and clean replay including assert-admin-activity.sql. Verify current effective grants and event/summary constraints; commit the foundation and catalog.

### Task 2: safe context and existing audit viewer

**Files:** Create src/lib/admin/activity/request-context.ts and request-context.test.ts; src/lib/admin/activity/query.ts and query.test.ts. Modify src/lib/admin/audit-explorer.ts, src/app/admin/audit/page.tsx, src/app/admin/audit/export/route.ts and src/components/admin/admin-profile-activity-list.tsx. Extend src/app/admin/audit/page.actor.dom.test.tsx.

**Interfaces:** resolveAuditRequestContext(headers, verifiedIngress): AuditRequestContext consumes the type defined in Task 1. No unrestricted raw UA. loadAdminActivity(filters): Promise<{ items; totalItems; page; pageSize; coverage }> uses 25-row default / 100-row maximum and bounded database filters/counts. Export is a sanitized projection, never raw context JSON.

- [ ] Add failing spoofing/IPv4/IPv6/missing/malformed/oversized-UA tests, anonymous/cross-role read/export tests, fixtures over 100 events and equal-time ordering fixtures. Assert direct-origin CF headers are not trusted, unknown country is not invented and default export omits network context.
- [ ] Run npx vitest run src/lib/admin/activity/request-context.test.ts src/lib/admin/activity/query.test.ts src/app/admin/audit/page.actor.dom.test.tsx; confirm new behavior fails.
- [ ] Implement a verified ingress policy using actual Cloudflare/Vercel receipts. Edge-only evidence is labelled proxy/edge. If visitor provenance cannot be proved on the free setup, show unavailable visitor fields; do not buy a proxy service or weaken origin security.
- [ ] Add the Admin activity view within the existing audit explorer. Require admin.audit.read near reads; require that plus admin.security.read for full network details. Preserve legacy audit paths, actor filters and existing target visibility on Admin Accounts.
- [ ] Run focused tests and disposable browser acceptance for audit reader, full-context reader, non-reader and own summary. Commit.

### Task 3: application and native Auth evidence

**Files:** Create src/lib/admin/activity/capture.ts, capture.test.ts, auth-source.ts and auth-source.test.ts. Modify src/app/(auth)/actions.ts, src/lib/auth/session.ts at verified admin entry, src/app/admin/admin-profiles/actions.ts and catalogued action-completion paths. Extend existing disposable authenticated verification fixtures.

**Interfaces:** recordAdminWorkspaceEntry(verifiedActor): Promise<void> deduplicates per native session; recordAdminPageAccess(verifiedActor, now): Promise<void> updates at most once/admin/UTC day on verified workspace page rendering, excluding known prefetch/background/API requests; it never claims human attention or online presence. ingestAdminAuthEvents({ cursor, limit: 500 }): Promise<{ cursor; read; stored; coverage }>. Only stable source IDs identify replay; no timestamp-window event merging.

- [ ] Verify supported Supabase Auth audit-storage settings and event payload shapes using disposable password/sign-in/MFA scenarios. Capture sanitized schema receipts. Prepare the owner-controlled supported setting change and establish coverage start; do not enable settings during planning.
- [ ] Write failing tests for denied signin, MFA pending/completed, member-only login, role-valid existing-session entry, password recheck, token refresh, browser close, duplicate source import and interrupted ingestion. Assert no false login/work and no false success after failed/cancelled mutations.
- [ ] Run npx vitest run src/lib/admin/activity/capture.test.ts src/lib/admin/activity/auth-source.test.ts; confirm failing contracts.
- [ ] Instrument the catalogued verified boundaries. Log actual workspace entry only after required assurance and identity checks. For DB mutations reuse/append in the committed transaction; for external Auth mutations use verified provider outcomes and flag capture failures without retrying business actions.
- [ ] Normalize native user_updated_password as the canonical password-notice event; keep other provider rows labelled with their own source. Do not count provider credential checks as admin work. Import in bounded batches with verified admin identity at event time; unknown historical actor/role stays unknown.
- [ ] Run the focused suite plus existing authenticated/action tests and disposable native replay. Complete the event catalog with each path's tested result; commit.

### Task 4: coverage-qualified account summaries and retention

**Files:** Create src/lib/admin/activity/summary.ts, summary.test.ts, retention.ts and retention.test.ts. Modify src/lib/admin/admin-profile-model.ts, src/lib/admin/admin-profiles.ts and Admin Accounts activity presentation. Create docs/operations/admin-activity-retention.md; add generated forward migration admin_activity_retention only if the foundation migration did not include its service-only functions.

**Interfaces:** classifyAdminActivity({ accessActivatedAt, invitationStatus, firstEntryAt, lastSignInAt, lastWorkspaceAccessAt, lastCompletedWorkAt, coverage, now }): AdminActivitySummary. status = invitation_pending | never_used | not_seen_six_months | seen_recently | history_unavailable. previewAdminActivityRetention(now): RetentionPreview; purgeExpiredAdminActivity({ cutoff, limit: 500 }): Promise<{ deleted; remaining }>, activated only after reviewed first-production dry-run.

- [ ] Write failing tests for new accepted invitation with continuous coverage/no entry, legacy creation/no history, leap/end-of-month six-calendar-month threshold in Asia/Dhaka, fresh workspace access on an old session, revoked target and coverage gaps. A never-used label includes its observed-since date.
- [ ] Add retention tests preserving at least three calendar months from both event and ingestion date, preserving summaries/checkpoints, late events and existing public audit/security/verification rows. Replaying a purged source batch cannot recreate an event.
- [ ] Run focused summary/retention tests; confirm failures first.
- [ ] Implement monotonic compact summaries, separate last-seen/login/work dates and factual display. Keep account access lifecycle distinct from activity status; no automatic role revocation.
- [ ] Implement bounded private-projection-only cleanup and dry-run documentation. Retention does not touch provider-owned auth audit/MFA evidence or delete legacy records. Review summary/deletion lifecycle separately.
- [ ] Run focused tests, SQL replay/grant checks and representative EXPLAIN plans for bounded queries; commit.

### Task 5: independently operational collection

**Files:** Create src/lib/admin/accountability-job.ts and accountability-job.test.ts, src/app/api/cron/admin-accountability/route.ts and route.test.ts, scripts/run-admin-accountability.mjs, and docs/operations/admin-accountability.md. Create/extend the project's existing Vercel cron configuration without replacing unrelated configuration. Release 3 extends these same files.

**Interfaces:** runAdminAccountability({ now, dryRun, deadline }): Promise<{ imported; backlog; coverage; errors }>. This release processes collection/summary health only. Authenticate the daily route with supported CRON_SECRET bearer validation, production-only; manual runs use equivalent private operator authorization. Default to dry-run for the operator script.

- [ ] Write failing tests for missing/wrong job auth, concurrent invocations, cursor resume, 500-source-event/20-second budgets, interrupted collection, unknown source shape and visible stale coverage.
- [ ] Run npx vitest run src/lib/admin/accountability-job.test.ts src/app/api/cron/admin-accountability/route.test.ts; confirm failure before new interfaces exist.
- [ ] Implement the collection-only job with a bounded lease/checkpoint and daily schedule 0 3 * * * (09:00–09:59 Asia/Dhaka under the verified Hobby timing). Keep it independent of notices/email, and do not call signed-in-user helpers or impersonate an admin.
- [ ] Run the focused tests and operator dry-run against disposable/native fixtures. Verify current function quotas and configure the job secret privately at execution.
- [ ] Record collection activation and first successful receipt, or leave it disabled and explicitly state that continuous coverage has not started. Commit only this task's changes.

### Task 6: Release 2 acceptance

**Files:** Create e2e/admin-activity.spec.ts. Record execution in .superpowers/sdd/2026-10-14-admin-activity-and-retention/progress.md (ignored).

- [ ] Verify the complete disposable flow: admin login/MFA → successful workspace entry → completed/denied action → canonical event → permission-scoped audit view → summary; test collection failure and replay.
- [ ] Run full repository gates, clean SQL replay and current effective permission checks, three-engine browser checks, one focused review, and exact-head required non-Vercel CI.
- [ ] Apply only reviewed forward migrations through the Supabase plugin with pre/post grant and version receipts; apply backward-compatible SQL before enabling dependent application contracts. Keep the legacy audit path working and new collection-unavailable states honest; a code rollback preserves captured private events.
- [ ] Merge normally after gates; verify post-merge main and actual production SHA/smoke. Confirm the standalone collection job/coverage is active and network evidence honestly labelled before calling logging complete; Release 3 email machinery is not a prerequisite.
- [ ] Keep first purge disabled until its dry-run/activation approval. Hand verified event/summary interfaces to Release 3.

Next release: admin-security-notifications-and-digest. No monthly email or delivery is enabled by this release. Only its reviewed collection-only daily job may be activated.
