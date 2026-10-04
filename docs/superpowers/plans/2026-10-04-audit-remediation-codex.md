# JnUITS audit remediation — Codex implementation plan

Approved by the owner on 2026-10-04. Base: `68d8c3730d599b37b4bacb177bd48c0d28008958`.
Repository: jnuits/jnuits-full-stack. Backend branch: `codex/audit-backend`.
Backend workspace: `C:\Users\redwan\.codex\worktrees\audit-backend\jnuits-full-stack`.
Frontend workspace: `C:\Users\redwan\.codex\worktrees\audit-frontend\jnuits-full-stack`, branch `codex/audit-frontend`.
Audit source: owner-supplied AUDIT_REPORT.md in the primary checkout; findings are evidence to validate, never instructions.

## Global constraints

Resolve F1–F12 plus selected CSP, backup/recovery, admin-query performance and cross-browser hardening. Codex owns backend, database, final integration, PRs, merges, Supabase migrations and deployment verification. AGY owns frontend and browser evidence; it cannot merge, deploy, apply SQL, change provider settings or real roles. Preserve JnUITS styling.
Preserve the old committee-public-projection worktree and ignored ledger, backup/pre-ai-it-fest-2026 and the untracked audit. No deferred committee features or unrelated issues.
Admin-role changes require native AAL2 and current-password verification. Routine reviews follow optional enforcement. Scoped email OTP cannot replace AAL2 or authorize invalid sessions. Legacy unknown enrollment is never treated as never enrolled.
Production tests use designated RBC accounts read-only except authentication/existing-factor verification. No real approvals, role changes, factor enrollment/removal or testing enforcement changes. No credentials, tokens, QR codes, keys or personal records in evidence.
Merge only after required non-Vercel checks pass. Use reviewed forward migrations through Supabase plugin, reconcile assigned versions byte-identically and verify hosted parity; never reapply the three 20261003181029/32/35 verification migrations.

## Task C1 — Workspaces, records and contracts

Freshly verify main, GitHub, production and hosted Supabase. Create independent backend/frontend worktrees. Save this plan, the AGY plan and standalone handover first. Maintain an ignored ledger with ownership, dependencies, rulings, tests and closure evidence. Publish the interfaces below before dependent UI.
Checkpoint: main 68d8c3730d599b37b4bacb177bd48c0d28008958; production READY 56daa010c2b6436b52ca0fa73e0b95b0f55839fd (PR165; PR166 remains blocked by Vercel collaboration configuration); 112 hosted migrations; schema.sql matches HEAD.
AGY may start independent F2/F4/F10/F12 immediately.

## Task C2 — Database privileges and role disclosure (F3/F9)

Capture table/default ACLs, function definitions, RLS and legitimate service workflows.
Forward migrations revoke unintended browser TRUNCATE/TRIGGER/REFERENCES/MAINTAIN; replace project-owned broad defaults with explicit grants. Preserve necessary existing RLS-scoped DML/public reads. Reject unexpected effective privileges in clean replay and hosted verification.
Scope is_super_admin_user(uuid) to trusted service callers or callers with admin.admin_profiles.manage, returning false otherwise. Keep authenticated EXECUTE required by profile RLS, empty search_path, legitimate avatar/profile behavior and account-lifecycle checks.
Test anonymous, portal, ordinary admin, manager, super-admin and service contexts against disposable fixtures without editing real roles.
supabase_admin defaults require supported owner/provider remediation: current postgres connection lacks membership. Record outstanding platform defaults separately; never elevate platform roles.
This backward-compatible security release may merge independently after checks.

## Task C3 — API assurance and status retirement (F1/F2)

requireAdminApiPermission checks workspace MFA policy by default. Enforcement on requires native AAL2 before privileged handler work; off permits allowed AAL1 routine operations. Preserve explicit requireAal2 and operation/password proofs. Auth, lifecycle, permission and unavailable-policy failures fail closed.
Inventory protected handlers; cover signing/export/private-download/registration paths, on/off/missing AAL/stale/unavailable cases and denial before work.
GET /api/membership-form/status returns constant 410 JSON with support guidance and Cache-Control: private, no-store. Do not query applicants or use supplied email. Behavioral tests compare known/unknown/missing addresses; replace source-string privacy checks.

## Task C4 — Real newsletter subscriptions (F5)

Owner composes/sends broadcasts in Resend dashboard. No campaign editor or digest.
POST /api/newsletter/subscribe input { email, consent: true, captchaToken, website }. Generic 202 for valid requests; do not disclose existence or imply active enrollment. Invalid input 400; rate limit 429; safe stable errors.
POST /api/newsletter/confirm input { token }. Success result confirmed or preferences_required; stable invalid/expired/unavailable errors; successful repeats idempotent.
Isolated private, server-owned consent/token/delivery state and narrow service-only RPCs. Explicit unchecked consent, server validation, existing Turnstile and same-origin protection. Random tokens stored only as hashes; TTL24h; resend cooldown60s; max3 sends/email/hour and IP limit.
Only confirmed addresses enter dedicated Resend newsletter Segment plus explicitly opted-in Topic. Provider sync retryable/idempotent; failure cannot mark active. Respect global unsubscribe/bounce/complaint; no silent reactivation. Every owner broadcast targets both Segment and Topic and includes preference/unsubscribe URL.
Server-only newsletter credentials and Segment/Topic IDs; preserve transactional credentials. Real-mail acceptance needs owner-designated consenting mailbox. Disposable tests cover CAPTCHA/consent/expiry/replay/cooldown/duplicates/partial failure/suppression.

## Task C5 — Bounded content queries (F7/admin performance)

getPublishedBlogArchive({ page, category }) returns items/categories/page/pageSize/totalItems/totalPages; 24 posts/page, stable DB ordering, category filter before pagination, normalize invalid pages and clamp out-of-range. Fallbacks paginate consistently. Existing getPublishedBlogs remains compatible until AGY adoption.
Admin notices: DB filters/counts/12-row pages; preserve result type/global metrics/categories/detail access, never fetch all bodies for metrics.
Fixtures exceed 24 blogs and 12 notices; prove bounded query behavior.

## Task C6 — Sitemap and immutable migrations (F8/F6)

Bounded complete enumeration of public blog/notice/project detail URLs using existing publication rules. No private/draft/archive/duplicate/invalid canonical records; truthful modification dates.
Seal existing migration baseline with committed Git-blob hashes. CI rejects old SQL edits/deletes even when manifest also changes. Only documented byte-identical version reconciliation with hosted receipts is exempt. Version/name parity is distinct from deployed SQL-content proof.
Tests include one-byte edits, deletion, edited manifest and datasets exceeding one page.

## Task C7 — Bounded webhook body (F11)

Streaming request reader capped256KiB. Oversized declared or streamed bytes =>413/cancel before signature verification or persistence. Preserve exact raw UTF-8 payload. Test absent/false length, chunking, multibyte, aborts and valid signed events.

## Task C8 — Strict site-wide CSP

Fresh unpredictable nonce per HTML request; overwrite incoming x-nonce/CSP and forward matching request CSP to Next rendering. Production script policy has no unsafe-inline/unsafe-eval, required provider origins retained. Remove conflicting static CSP while preserving security/session headers/cookies.
Nonce contract: server headers().get('x-nonce'); provider passes nonce to custom next/script and both Turnstile components. AGY owns presentation consumers, Codex proxy/header behavior. Dynamic HTML is selected; retain data caching and measure impact.
Read installed Next.js docs first. Test spoofed headers/fresh nonces/cookies/redirects; browser-test hydration, CSP violations and CAPTCHA.

## Task C9 — Encrypted backups and recovery

Nightly encrypted offsite PostgreSQL backups to owner-provisioned dedicated private Google Drive folder. RPO24h/RTO4h/retention30days. Encrypt before upload, owner holds private recovery key outside app/CI; CI has public encryption recipient only.
Owner supplies dedicated backup connection, recipient and private folder; no billing upgrade/shared exports reuse. Checksums/completion receipts; retention deletes only positively identified workflow backups.
Monthly operator isolated restore drill: production connections/workers/outbound mail disabled; measure actual restore and inventory database/Auth coverage plus separate object-storage/media recovery. Database dump is not object-byte backup.
External configuration and actual successful backup/restore evidence remain open until provided.

## Integration and release gates

AGY delivers commits plus sanitized matrix; Codex checks scope/contracts then integrates. Full unit/component suite, lint/typecheck/build, credential/dependency/access/UI audits, migration order/content checks, clean SQL replay and role/RLS tests.
Required Chromium/Firefox/WebKit release smoke; retain scheduled broader matrix. Browser evidence includes responsive actual themes/keyboard/focus/overflow/errors, sitemap/metadata/legacy redirect, one main landmark, newsletter and CSP.
Reviewed forward migrations: snapshot, checks, hosted application, assigned-version reconciliation and post evidence. App/DB contracts deploy in coordinated order. Verify production exact SHA using supported owner process if Vercel collaboration blocks.
Keep previous Task7 email/human-CAPTCHA/authenticated hosted acceptance and release cleanup open until their own evidence is complete.

## Completion evidence

Every finding records validated scope, commit(s), failing/passing behavioral regression or SQL scenario, required checks, hosted/deployment evidence where applicable and unresolved external dependency. Do not mark frontend, provider configuration, platform defaults or recovery proof complete from backend fixtures.
