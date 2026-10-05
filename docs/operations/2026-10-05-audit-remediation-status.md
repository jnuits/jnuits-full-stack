# Audit remediation release status — 2026-10-05

## Integration and release authority

The owner requested combining all remediation work and merging to main for deployment once every applicable non-Vercel GitHub Actions release check passes. PR #168 is the single combined release branch, codex/audit-backend. The original twelve AGY commits and all five frontend follow-up commits are integrated; the old frontend branch, follow-up branch, committee worktree, ignored execution ledgers, user-supplied audit and backup/pre-ai-it-fest-2026 remain preserved.

Codex validated the actual AGY diff and artifacts. The follow-up removes the misleading archive fallback, uses the real bounded query contract, supplies policy-neutral membership guidance, corrects newsletter acceptance copy and server/client site-key parity, and vendors licensed Noto Sans Bengali through next/font/local. The font blob exactly matches the official Google Fonts upstream blob 25e13e26dc15c4933f8fe49c9efcda54152349db (463668 bytes). License trailing whitespace was corrected for the diff gate.

The stricter integration gate exposed focus failures that AGY's explicit input.focus() calls had hidden. Event newsletter links now use native fragment anchors; the public skip link has explicit tabindex=0. Actual pointer, Enter and first-Tab browser regressions cover these changes. Tests use disposable providers and the reserved example.supabase.co endpoint, never production subscription mutations or CAPTCHA bypass.

This integration also prevents delayed hydration from erasing newsletter input. Email, consent and submit controls remain disabled in server HTML and through initial hydration, then enable once React can capture changes. A server-render regression and browser checks with JavaScript held back reproduce the former behavior and validate the correction.

## Findings and implementation status

| Finding / hardening | Implementation | Separate outstanding acceptance |
| --- | --- | --- |
| F1 | Default API workspace MFA policy, denial before privileged work, native AAL2 when enforced, optional routine AAL1 when disabled. Unconditional AAL2/password/operation proof guards remain. | Production SHA and original authenticated remote Task 7 acceptance. |
| F2 | Constant private/no-store 410 status API and removal of the email-only form; behavioral privacy tests. | Production UI deployment. |
| F3 | Security SQL already applied once; forbidden effective browser privileges removed, necessary DML preserved. | supabase_admin-owned defaults require a supported owner/provider procedure. |
| F4 | Policy-neutral homepage, membership/support copy and /members/join -> /membership-form. No consumed hosted CMS override requires editing. | Production deployment. |
| F5 | Private double opt-in state, hashed 24-hour tokens, consent/CAPTCHA/rate limits, suppression-aware Resend synchronization, explicit POST confirmation and accessible UI. | Owner Resend Segment/opt-out Topic credentials and real consenting-mailbox/CAPTCHA acceptance. |
| F6 | Raw committed migration hashes, trusted-base immutable historical SQL gate and separate hosted receipts. | Continue enforcing on every release. |
| F7 | Direct bounded 24-post archive contract, category filtering, stable pagination/clamping, honest query failure; browser page-two/reset checks with 40 disposable posts. | Production data/render acceptance. |
| F8 | Complete bounded public sitemap projections and public-safe notice/project detail metadata. | Production canonical/sitemap acceptance after deployment. |
| F9 | Permission/service-scoped role helper with empty search path and legitimate RLS/profile workflows preserved. | Production workflow acceptance. |
| F10 | Truthful published notice totals. | Production deployment. |
| F11 | Exact-payload streaming webhook reader capped at 256 KiB; oversize/abort cannot verify or persist. | Production deployment. |
| F12 | Single public main landmark, keyboard skip focus, accessible newsletter/confirmation states. | Final production loading/error/detail smoke. |
| CSP | Fresh document nonce, matching request/response policy, preserved session cookies, no production script unsafe-inline/unsafe-eval, nonce consumers. | Real provider CSP and rendering/performance measurements after deployment. |
| Admin queries | Database-filtered/count-bounded 12-row notice pages and body-free summary projections. | Production query measurements after migration/deployment. |
| Backups | Encrypted database/roles workflow, private Drive ACL/retention controls, OAuth/MyDrive or service account/SharedDrive, isolated restore tooling. Nightly scheduling remains opt-in. | Owner provisioning, actual offsite retrieval, production-sized restore timing and media recovery. |

## Validation and evidence limits

Local integrated unit/component suite: 2009 tests across 309 files pass. All 50 focused browser cases and 144 strict shell checks pass across Chromium, Firefox and WebKit; the latter cover eight routes, three viewport sizes and both actual themes. Lint, typecheck, production build, access/UI audits, dependency checks and immutable SQL/order/replay checks passed at their recorded revisions. The final supported clean SQL replay covers 116 migrations, real newsletter transaction concurrency and permission/RLS contexts. The pending SQL bytes have not changed during frontend integration.

AGY's 96 shell checks cover Chromium and WebKit with synthetic CAPTCHA. Its metadata named the base revision while changes were uncommitted; Codex does not use that base SHA as proof of a tested final server. The revised gate separates source HEAD/local build artifacts from explicitly attested server revision/build ID, rejects missing nonce CSP, checks both themes and fails actual focus/runtime/overflow assertions.

Codex adds browser cases for delayed hydration, consent/pending/error/retry/accepted newsletter UI, all confirmation results without GET mutations, focus transfer, first-Tab skip navigation and older blog/category navigation. All fixture evidence is labelled; it does not prove live CAPTCHA, email delivery, Resend synchronization or authenticated remote acceptance.

The broader Linux matrix on integrated AGY revision 64c133f succeeded (run 37259685580), including the two previously failing WebKit CSP cases. Earlier failed runs are historical evidence, not green checks. The final release revision must independently pass Quality Gate, Diff Check and the manually dispatched full browser matrix before merge. Protected preproduction mutation rehearsals and owner-configured backup runs are operational workflows, not PR release checks; do not execute them against real accounts merely to obtain a green badge. Production Readiness is a main-only read-only workflow and may run after release rollout.

The single independent new-backend review and its correction pass are complete. Corrections pin a verified local restore daemon, permit the first protected manual backup while nightly scheduling is disabled, preserve literal notice search through PostgREST quoting and bound transient upload status retries. No repeated independent whole-branch review is requested.

The owner renewed the protected GitHub Production SUPABASE_ACCESS_TOKEN. Main-only read-only Production Readiness [37269359080](https://github.com/jnuits/jnuits-full-stack/actions/runs/37269359080) passed on pre-release main e67281d, including Supabase linking, migration parity and metadata security evidence. The Codex Supabase plugin connection independently remains valid; no reconnect was required. The earlier Unauthorized run remains historical evidence. Final reconciled release-head checks and post-merge readiness remain required.

## Hosted rollout and open operations

Pre-release hosted evidence: 113 migrations, latest 20261004161020, public tables without RLS 0 and prohibited effective browser privileges 0. The security migration and the three original verification migrations are already applied; never replay them.

Applied once through the Supabase plugin: 20261005054954_audit_content_query_summaries and 20261005055016_audit_newsletter_double_opt_in. Their former release-only filenames were 20261004171611 and 20261004171614; reconciliation changed no SQL bytes. Hosted statement SHA-256 and MD5 match the reviewed Git blobs. Post-DDL advice identified an uncovered delivery-event token foreign key; after clean replay, the separate forward 20261005055358_audit_newsletter_delivery_fk_index was applied and verified. The original applied newsletter SQL remains unchanged.

Hosted state is now 116 migrations. All 71 public tables retain RLS; prohibited effective browser privileges remain zero. All 852 public role/table/DML comparisons are unchanged. The three new private tables have RLS and no direct anon/authenticated/service-role privileges. Newsletter mutation is limited to the service-only, guarded, empty-search-path RPC; public category and service-only notice summaries retain their intended invoker scopes. All four new indexes are valid. See [sanitized hosted SQL receipts](2026-10-05-audit-migration-receipts.json).

The advisor's existing warning categories/counts are unchanged. Three new private tables intentionally have no direct RLS policies; the service-only RPC is their access boundary. New unused-index notices reflect the four newly created indexes. The new unindexed foreign-key notice was resolved; the previous 24 remain separately scoped. Supabase-admin-owned defaults still require the supported owner/provider procedure.

Production currently serves READY 56daa010c2b6436b52ca0fa73e0b95b0f55839fd. A main merge is not evidence that the alias contains the release. Verify the alias SHA and use the owner's supported process if Vercel collaboration configuration blocks deployment.

Keep Task 7 live email/human CAPTCHA/authenticated remote evidence, platform-owner defaults, private offsite backups and media recovery open until separately evidenced. Storage aggregate inventory was 0 buckets/objects; Cloudinary/external media recovery remains separate from database backups. Keep release cleanup open and preserve all pending worktrees/ledgers and the backup branch.

Owner configuration and mailbox steps are documented in [newsletter operations](newsletter.md) and [encrypted backups](database-backups.md). Never request passwords, tokens, private keys or setup codes in chat.
