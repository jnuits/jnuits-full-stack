# Audit remediation validation and release status — 2026-10-05

## Revisions and ownership

Primary main and origin/main are e67281d63e1e831528e0c350abf3086377f6dc66 (PR167 merged). The user-supplied AUDIT_REPORT.md remains untracked and preserved. Backend codex/audit-backend contains all twelve AGY commits plus the Codex backend/infrastructure work; current integrated code base isef0cf46b15ab4c55689624f1b20241abac442606, including the single scoped review correction pass. The original frontend branch remains clean at8dafa82225f0aa9b7eb547631bc5fe084bd23286, preserving its originald356b3d checkpoint and two delivered follow-up commits. Prior committee worktree, ignored execution ledgers and backup/pre-ai-it-fest-2026 are preserved.

[Draft PR168](https://github.com/jnuits/jnuits-full-stack/pull/168) is the integration release. It is not ready to merge: AGY's focused follow-up, required exact-head CI and release acceptance remain open. Codex owns final integration, migrations, PRs, merges and deployment verification; AGY owns frontend fixes and sanitized browser evidence.

## Findings and closure evidence

| Finding | Delivered implementation | Remaining acceptance |
|---|---|---|
| F1 | PR167 default API MFA-policy evaluation; native AAL2 when enforcement is enabled; optional routine AAL1 preserved; authentication/lifecycle/permission/policy failures deny before privileged work. | Production application deployment and original authenticated Task7 checks. |
| F2 | PR167 constant private/no-store410 status API; AGY7465c5a removes the legacy form. Behavioral privacy tests compare existing/nonexistent/malformed emails. | Integrated production UI/support guidance and deployment. |
| F3 | Applied security migration removes prohibited effective browser privileges; existing DML preserved; replay and hosted metrics verified. | supabase_admin-owned default ACLs require a supported provider/owner procedure. Current tables are verified; future provider-owned defaults remain open. |
| F4 | AGY19796f7/3aea381 onboarding navigation and legacy redirect integrated. Hosted home CMS joinPanel override absent/unused; no persisted correction required. | Homepage year-specific membership CTA and legacy status-check fallback copy; AGY follow-up. |
| F5 | Codex2fe180f double opt-in backend/private SQL/Resend synchronization; AGYa22d840 subscription/explicit confirmation UI. | AGY generic202 copy and browser states (readable errors/retry/idempotent wording integrated fromccd0a7a); owner provider configuration and real consenting-mailbox/CAPTCHA acceptance. |
| F6 | PR167 raw Git-blob migration baseline and trusted-base append-only CI gate; reconciliation receipts separate from deployed SQL-content evidence. | Required CI for each release; no historical SQL rewrite permitted. |
| F7 | Codex bounded24-post archive contract and category/clamping behavior; AGY8646534 paginated page integrated. | Remove AGY dynamic reflection/legacy24-post error fallback; real page2/category browser evidence with disposable data. |
| F8 | Codex bounded public detail sitemap projections; AGY69228ba notice/project metadata integrated. | Integrated detail/canonical browser evidence and production sitemap after rollout. |
| F9 | Applied PR167 role helper restricts arbitrary-user disclosure; empty search path and authenticated RLS/profile workflows preserved. | Production application acceptance; hosted function restriction verified. |
| F10 | AGYce5b6e4 truthful published-notice count integrated. | Integrated browser evidence. |
| F11 | PR167 byte-bounded256KiB webhook reader; oversized/aborted bodies cannot verify or persist; signatures use exact payload. | Production rollout; no live harmful payload tests required. |
| F12 | AGYa34d968 single public main/skip focus changes integrated. | AGY loading/error/detail and keyboard browser evidence. |
| Strict CSP | Codex10d0873 per-document nonce/session-header protection; AGY969e0c6 root/Turnstile consumers. | Real Turnstile/CSP and production performance acceptance after actual rollout. |
| Admin performance | Codex2fe180f database-filtered12-row pages and global summary projection. | Production query/render measurements after migration and deployment. |
| Backup/recovery | Codex10d0873/5d867b5 encrypted database+roles workflow, private ACL checks, retention, OAuth/MyDrive or service-account/SharedDrive, isolated restore. | Owner provisioning, private offsite upload/retrieval, production-sized restore timing and independent media recovery. |

## Verified checks

Final local full suite:2008 tests across309 files passed. Production build, lint, typecheck, admin access/UI audits, dependency gate, migration integrity and strict115-migration ordering passed. Clean SQL replay includes summary ACL/data projections, consent/quota/replay/expiry/suppression and real simultaneous newsletter transactions. Local Chromium26 plus Firefox/WebKit52 release smoke/CSP checks passed on the integrated production build using explicit reserved-endpoint read-only public-data fixtures. Fixtures do not prove real database, Auth, CAPTCHA, mailbox or provider acceptance.

Backup-focused15 tests passed, including MyDrive/service-account refusal, OAuth fail-closed behavior, private ancestor ACLs, integrity checks, multi-chunk lost-ack recovery and bounded zero-progress acknowledgments. A real disposable age-encrypted database/roles restore passed in6–10seconds with Auth/migration data and RLS, no network/ports/outbound mail. This tiny fixture is not production RTO evidence. All owned scratch containers and plaintext/key files were removed.

The first PR168 CI run passed unit/static/integrity/order/runtime/clean SQL checks; secret scan identified only historical API status-code prose at2fe180f:docs/operations/2026-10-04-agy-validation-follow-up.md:21. Its exact verified false-positive fingerprint is excluded; scanner rules and full history scope remain unchanged. The locally verified Gitleaks8.24.3 full-history scan found no leaks across635 commits at the documented snapshot. A new exact-head CI run is required after the exception/document update.

The scheduled main browser matrix run37241883611 failed30 WebKit launches due to missing Linux browser libraries, with120 passes/125 skips. The new workflow installs all browser system dependencies and labels its reserved public fixtures; the broader scheduled matrix is retained. Do not report its historical failed run as a passing gate.

## Hosted state and rollout

Fresh Supabase plugin checks:113 migrations; latest20261004161020; public RLS-disabled tables0; prohibited effective browser privileges0. Applied security statement MD5 is4c6237c34deb6df4f9624f2542550c44, matching the recorded raw SQL receipt. Do not apply the security or prior verification migrations again.

New committed migrations20261004171611_audit_content_query_summaries.sql and20261004171614_audit_newsletter_double_opt_in.sql remain UNAPPLIED. Review/CI and coordinated database/application release precede their plugin application; reconcile any assigned versions with identical SQL bytes and capture receipts.

Production alias still serves READY56daa010c2b6436b52ca0fa73e0b95b0f55839fd. The owner-supported deployment process remains necessary; neither PR167 nor the draft integration app is claimed live. Supabase Storage aggregate inventory currently reports0 buckets/objects. Cloudinary/external media bytes and versions require a separate owner-controlled inventory/recovery acceptance.

## Handoffs

Send AGY [the focused follow-up](2026-10-04-agy-validation-follow-up.md), preserving its original branch/evidence. Owner setup and live acceptance are documented in [newsletter operations](newsletter.md) and [encrypted backups](database-backups.md). The owner will perform mailbox steps and configure private provider/backup settings; never request secrets in chat.

Keep original Task7 email, human CAPTCHA/authenticated remote browser evidence, platform-owner defaults, owner-configured backups and release cleanup OPEN until their own evidence exists. Do not delete the backup branch or preserved worktree/ledgers. No real roles, requests, MFA factors or subscriptions were changed for testing.

## Single scoped review and correction pass

The new Codex backend/infrastructure diff received one independent scoped review; the already merged security slice and AGY UI were excluded. The three required findings were fixed atf1f22b2/22de8ab: conflicting Docker host/context settings now refuse before decryption and every child operation uses a pinned verified local daemon (remote named pipes also denied); manual backup acceptance on protected main is permitted while nightly scheduling remains disabled; notice searches preserve SQL literal escapes through PostgREST quoted-value parsing. Genuine RED regressions demonstrated Docker-context acceptance and wrong wildcard notice matches before their fixes. The optional transient Drive status-probe retry was also reproduced RED and fixed with bounded attempts. Focused21 tests and the real pinned-daemon encryption/restore fixture passed. No second independent review is requested.

All required non-Vercel checks passed oncdf2111 before the final AGY/review corrections. The broader branch matrix passed163/skipped125 but failed two responsive nonce tests because they selected a hidden desktop navigation link; the test now opens the actual mobile navigation menu where required, proves theme hydration and preserves a client-navigation marker. Mobile/tablet nonce smoke6 tests passed in15.1seconds after that correction. Final-head CI and broader matrix must confirm the corrections; historical failures remain explicitly recorded.