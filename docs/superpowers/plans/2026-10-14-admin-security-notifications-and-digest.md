# Admin Security Notifications and Digest Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for Codex-owned work. Frontend ownership follows docs/operations/2026-10-14-gemini-frontend-accountability-handover.md. Codex retains backend and release ownership. Steps use checkbox syntax for tracking.

**Status:** Approved by the owner on 2026-10-14; branch/handover preparation only, implementation not started.
**Goal:** Deliver relevant security notices and optional monthly personal recommendations without duplicate mail, privacy leaks or a recurring AI task.
**Architecture:** Trusted Release 2 events create recipient-bound private notices and durable delivery records. The existing Resend transport delivers checked recipients; one bounded daily application job handles ingestion/retry and due monthly recommendations.
**Tech Stack:** Installed Next.js/TypeScript, Supabase Postgres/Auth, existing Resend HTTP transport/preferences/webhook, ordinary Vercel cron, Vitest, Playwright.
**Spec:** ../specs/2026-10-14-profile-completion-admin-accountability-design.md, Release 3.
**Prerequisites:** Releases 1–2 provide verified completion/security-guidance/event/summary interfaces and an operational collection-only job. Provider capture coverage and payload mappings have actual receipts. This release extends that job rather than adding another schedule.

## Refinement and user-facing behavior

- Cross-admin logs/notices use existing audit permissions, confirmed by the owner. Account-holder security email remains distinct from permission-scoped peer notices.
- Panel notices are non-blocking: a dedicated inbox/unread indicator, explicit owned mark-read, no automatic modal/navigation and no CAPTCHA.
- Password changes from a linked member/alumni portal still affect the same Auth account; recipient identity is derived server-side, not from whichever portal submitted the change.
- Dashboard session guidance and scheduled account-level recommendations are separate. The job never fabricates a user session or sends a “verify this session” recommendation.
- Codex supplies notices/preferences/delivery/DTOs; AGY's later prompt will cover only assigned inbox/settings/checklist presentation and browser evidence.

## Global Constraints

- Peer notices require current eligible active admin identity and admin.audit.read; no access widening for content admins.
- New optional peer-security and recommendation email preferences default off. Essential account-holder security notice is separate.
- Sender remains JnUITS <no-reply@jnuits.org.bd>. No newsletter subscription/contact changes or credential replacement.
- Durable event/recipient/channel and account/month uniqueness outlives Resend's 24-hour idempotency window.
- No secrets, invitation codes/links, full IPs or recipient address lists in notices/emails/logs.
- No paid upgrade or Codex heartbeat. One daily application job; ordinary function/email quotas still apply.
- Bound each invocation: 500 source events, 100 evaluated accounts, ten sends, at most one provider request/second and 20 seconds of work.
- Existing business mutations and native AAL2/password/intent rules remain unchanged.

## Review Focus

- A recipient who loses permission between enqueue and delivery receives no privileged notice (Task 1).
- Unknown accepted-send outcome after 24 hours does not cause duplicate mail (Task 2).
- An empty/complete account or opt-out receives no pointless monthly digest (Task 3).
- Concurrent daily/manual invocations cannot repeat sends or manufacture missed-month digests (Tasks 2–4).
- Provider-only password changes and failed changes use truthful, single-source notices (Tasks 1, 4).

### Task 1: permission-scoped panel notices

**Files:** Create src/lib/admin/notifications/model.ts, policy.ts, policy.test.ts, store.ts and store.test.ts. Add generated forward migration admin_notifications_foundation. Create src/app/admin/notifications/page.tsx and src/app/api/admin/notifications/route.ts with behavioral tests; extend src/components/admin/admin-shell.tsx at its existing navigation area, preserving permission-filtered navigation and layouts.

**Interfaces:** createAdminSecurityNotices(event: AdminActivityEvent): Promise<{ created; skipped }>. loadOwnAdminNotices({ page, pageSize: 25 }): Promise<{ items; totalItems }>. markOwnNoticeRead(noticeId): Promise<void>. Notice kinds follow the spec; private notices/deliveries are keyed by canonical event, recipient and channel.

- [ ] Add failing tests for password native completion, invitation creation/acceptance/revocation, role/MFA completion, failure/cancellation, missing target/actor, duplicate ingestion, pre-cutover/backfilled events, inactive/non-reader recipient and cross-recipient read/mark attempts. Old events remain audit-visible but create no retroactive unread broadcasts or email.
- [ ] Run focused policy/store/API tests and SQL replay permission tests; verify failures before new contracts exist.
- [ ] Implement recipient policy and private RLS/service-only storage. Snapshot event identity safely; recheck current recipient authorization at read/send. Record a delivery activation cutover and keep email processing independently disabled until acceptance. No all-admin blanket broadcast.
- [ ] Implement the paginated in-panel view and own read state using existing session/origin/rate limits. Link to permission-checked existing screens; never render invitation secrets or raw event payload.
- [ ] Run focused tests and accessible panel browser checks; commit.

### Task 2: preferences and durable mail delivery

**Files:** Modify src/lib/notifications/preferences.ts and preferences.test.ts; existing Admin Notification Settings form/action; src/lib/notifications/email-builders.ts, send-email.ts and resend-webhook.ts only where required. Create src/lib/admin/notifications/delivery.ts, delivery.test.ts and security-email.test.ts. Include preference changes in the generated migration from Task 1 or a new generated admin_notification_preferences migration.

**Interfaces:** Add admin_security_email_opt_in and admin_recommendation_email_opt_in (default false) to the existing self-owned preferences. deliverAdminNotifications({ maxSends: 10, deadline }): Promise<DeliveryBatchResult>. State = pending | sending | accepted | delivered | suppressed | failed | uncertain. Ledger uses unique event/recipient/channel, an atomic claim/lease, immutable payload hash and provider idempotency key.

- [ ] Write failing tests for explicit opt-in, missing preferences, preference lookup failure, verified-address lookup, peer recipient revocation, an account holder without audit permission still receiving their own essential security notice, suppression, provider rejection/timeout, concurrent leases and delayed duplicate webhook receipts.
- [ ] Add tests for accepted response persistence failure and uncertain outcomes before/after 24 hours. Assert no blind resend beyond the idempotency window and no retry of the underlying password/invitation action.
- [ ] Run focused delivery/preference/security-email tests; confirm new behavior fails.
- [ ] Implement durable delivery and immutable retry payloads using existing transport/webhook verification. Known rejection can retry according to classified error; uncertain sends require safe reconciliation. Suppressed/permanent failures remain visible without reactivation.
- [ ] Verify the native Supabase account-holder password-security notification setting. Choose exactly one owner: reuse native security mail if enabled/rehearsed, otherwise deliver from the canonical provider event through this ledger. Do not send both.
- [ ] Run focused tests and existing email/webhook regressions. Commit.

### Task 3: personal recommendations without XP

**Files:** Create src/lib/admin/recommendations.ts, recommendations.test.ts, recommendations-email.test.ts, recommendation-inputs.ts and recommendation-inputs.test.ts. Consume Release 1 completion/security guidance and existing permission-scoped queue counts. Modify src/app/admin/page.tsx to share the safe personal checklist without another polling component.

**Interfaces:** buildAdminRecommendations({ ownCompletion, accountProtection, permittedQueueCounts }): AdminRecommendation[] (maximum three). accountProtection: AdminAccountProtectionSummary has enrollment state configured | needs_setup | unknown and no session AAL/proof. loadAdminRecommendationInputs(subjectUserId, asOf): Promise<AdminRecommendationInputs | null> is server-only, checks authoritative active admin identity/permissions/preferences for that subject and is callable only from the authenticated service/operator job path. It shares the pure completion rubric through a service-owned adapter; it must not call getOwnProfileCompletion for another account or construct a fake signed-in actor. generateMonthlyAdminDigests({ monthKey, now, accountLimit: 100 }): Promise<{ queued; skipped; cursor }>. monthKey is Asia/Dhaka YYYY-MM; unique delivery key is account/month; rubric version is immutable payload metadata, not a reason to send again. No caller can inject a recipient or bypass preferences.

- [ ] Write failing tests for profile missing/complete including phone, partial workplace and explicit not-applicable workplace, configured/needs-setup/unknown account-level MFA states, denied queue permissions, opted-out email, empty recommendations and an account with no member identity. A job with no browser session must still work without inventing AAL2, and disabled/revoked subjects must be skipped.
- [ ] Add tests for month boundaries, stable current-month regeneration, changed rubric within the same month, concurrent invocations and outages across month boundaries. Assert at most one digest/account/month; a rubric upgrade does not send a second monthly email.
- [ ] Run focused recommendation tests; confirm failure first.
- [ ] Implement deterministic prioritized suggestions (account-level security setup, own profile, permitted duty queue) and short templates. Do not rank admins, count logins for XP, infer idleness or automatically revoke access.
- [ ] Run focused tests and verify no another-user private fields or denied queues in rendered HTML/text. Commit.

### Task 4: bounded daily job and operator controls

**Files:** Extend src/app/api/cron/admin-accountability/route.ts and route.test.ts; src/lib/admin/accountability-job.ts and accountability-job.test.ts; scripts/run-admin-accountability.mjs (dry-run by default); and docs/operations/admin-accountability.md from Release 2. Preserve its single daily cron configuration. Extend scripts/validate-env.mjs with conditional delivery-setting validation.

**Interfaces:** runAdminAccountability({ now, dryRun, deadline }): Promise<{ imported; notices; sends; digests; backlog; coverage; errors }>. Daily route requires the supported CRON_SECRET bearer check, fails closed if absent, and is production-only; manual execution uses equivalent private operator authorization. Never log its token or use query-string credentials.

- [ ] Write failing tests for missing/wrong auth, replay/concurrency lease, production versus preview, max batch/send/time budget, one-second provider pacing, security-before-digest priority, persisted cursor/backlog and run failure health.
- [ ] Run focused route/job tests; confirm failures first.
- [ ] Extend the existing daily collection job (0 3 * * *, 09:00–09:59 Asia/Dhaka under current Hobby timing) with current-month-only digest enqueueing and resumable delivery batches; do not add a second schedule. No exact-time guarantee; no hourly/ten-minute trigger.
- [ ] Implement dry-run output with counts and sanitized IDs only, no addresses/PII. Persist last successful job and coverage warnings for authorized operator display; capture failures without claiming complete coverage.
- [ ] Verify actual Vercel plan/function quota and Resend remaining email capacity before activation; reserve capacity for password resets/invitations. Configure CRON_SECRET privately and document supported manual recovery. If capacity is insufficient, leave automatic delivery disabled and report the measured constraint.
- [ ] Run focused tests, disposable provider-event replay and Resend delivered/bounced/complained test-address rehearsals using authorized test configuration. Owner performs real consenting-mailbox acceptance; never send test mail to arbitrary real addresses.
- [ ] Commit Task 4 changes and configuration instructions. Schedule activation is a separately recorded execution action, never a planning side effect.

### Task 5: Release 3 acceptance

**Files:** Create e2e/admin-notifications.spec.ts. Record execution in .superpowers/sdd/2026-10-14-admin-security-notifications-and-digest/progress.md (ignored).

- [ ] Test successful/failed native password change and admin invitation → single canonical event → authorized panel notice → opt-in/suppression-aware delivery → retry/replay without duplicates, using disposable accounts.
- [ ] Test own recommendation delivery at a month boundary, empty/opt-out accounts, permissions removed mid-flight, three-month detail retention with durable deduplication, and operator attention for unknown delivery.
- [ ] Run full repository gates, clean SQL replay/RLS checks, credential/dependency/access/UI audits, three-engine responsive/theme/browser acceptance and one focused release review.
- [ ] Apply reviewed forward migrations through Supabase with receipts; merge normally only after exact-head required non-Vercel checks pass. Verify post-merge main and actual production SHA/smoke.
- [ ] Enable the daily job's notice/email processing only after provider settings, owner-mailbox acceptance and quota receipts are complete; preserve collection and verify the first real bounded delivery run and health record. Code deployed with delivery disabled is not complete email acceptance.
- [ ] Keep earlier backup/recovery and other production acceptance gaps explicitly open. No XP/leaderboard or automatic inactivity enforcement is part of this release.
