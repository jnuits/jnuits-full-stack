# Profile editing and workplace review patch

Approved by the owner on 2026-10-05. Base: `9387f5be8ded69cecaa28ea0e6c0d0db9294c312`. Implementation branch: `codex/profile-edit-policy`.

## Policy

| Fields | Required flow |
| --- | --- |
| Full name, JnUITS ID, email, university student ID, department, batch, graduation year | Current-password unlock followed by an administrator-reviewed request. Email changes retain verification of both addresses. |
| Phone, organization, designation, work location, social/website links, workplace visibility, photo | Current-password unlock, then immediate self-service save. |
| Roles, membership/lifecycle status, portal access, membership dates | Existing administrator-controlled workflows. |

Password unlock lasts 15 minutes in the current browser. The server derives ownership from verified authentication, rejects unknown or protected direct-edit keys, and rechecks mutable membership access. Direct edits and their audit records commit together through service-only functions. Native MFA requirements for privileged admin operations and optional enforcement for routine reviews are unchanged.

## Workplace queue diagnosis

Read-only hosted reproduction confirmed `PGRST201`: `profile_update_requests` has more than one relationship to `members`, including reverse membership-case and appeal links. The unqualified embedded relation failed while the separate pending count succeeded. The page silently converted that failure into an empty list.

Request-member loads now select `members!profile_update_requests_member_id_fkey`. Failed list/history/metrics loads surface an error rather than claiming the queue is empty. Existing row review controls remain available for loaded requests. No real request was approved, rejected, or cancelled during verification.

## Existing requests and integrity

Previously submitted workplace/profile requests remain pending and reviewable. New workplace edits use the direct-save flow; the legacy submission API returns `410` and directs clients to refresh the editor. Its read/history and password-verified cancellation behavior remain supported.

Approval, rejection, and workplace cancellation serialize using member-then-request locks. Decisions cannot replace an already committed decision. A direct save stamps overlapping pending requests with a server-owned supersession marker; neither a client-supplied future timestamp nor malformed metadata can bypass it. Approval of an overlapping older request fails visibly, leaving it pending for explicit rejection or resubmission. Unrelated identity corrections can still be approved. Legacy blank optional values retain their previous no-change semantics.

A permanently superseded request returns the documented [PostgREST HTTP conflict](https://docs.postgrest.org/en/v16/references/errors.html) (`PT409`) rather than a transaction retry signal.

The database validates stored field types before conversion, including numeric academic fields. Graduation years use the existing database range, 1950–2100. Existing email/JnUITS ID approval workflows retain their verification and canonical-ID rules; their rejection updates require a still-pending row.

## Release procedure and evidence

1. Run full unit/component, lint, typecheck, production build, access/UI, credential/dependency, immutable migration/order gates, and clean SQL replay.
2. Verify the complete profile/review flow using the guarded disposable browser runner:
   `PROFILE_SELF_SERVICE_QA=DISPOSABLE_SCRATCH node supabase/verification/run-admin-verification-browser-qa.mjs`.
3. Require all non-Vercel pull-request checks. Apply only the reviewed forward migration through the Supabase plugin, recording assigned version and SQL-content receipts. Do not reapply any previously hosted migration.
4. Merge normally, verify main checks and read-only Production Readiness, then verify the actual production deployment SHA. A Vercel collaboration block requires the owner's supported deployment process.

The disposable suite uses fictional accounts, real local Supabase Auth, and actual Next.js production-mode browser interactions. The runner builds with only local fixture Auth credentials and provider placeholders, validates that build configuration, and then starts the production server. CAPTCHA and email transport fixtures do not certify production provider or mailbox acceptance. Screenshots contain only fictional data; credential/password/token traces and automatic screenshots are disabled.

Execution evidence and the focused review are kept in the ignored `.superpowers/sdd/2026-10-05-profile-edit-policy/` ledger. Hosted SQL receipts and final release checkpoints will be recorded alongside this document when verified.

## Follow-up boundary

The older remaining-work register in the primary checkout stays open. Real newsletter delivery, Task 7 remote MFA/email acceptance, provider CAPTCHA/CSP compatibility, production performance, provider-owned default ACLs, backups/recovery, media coverage, and release cleanup must each obtain their own evidence. Resume those items only after this patch is verified in production. Preserve the existing ledgers/worktrees and `backup/pre-ai-it-fest-2026`.

## Verified release checkpoint

- Application source and SQL: `e716a609aafdea76ee00326fc61270f760896683`; full suite 2,037 tests across 311 files passed.
- Clean replay of all 117 migrations, profile/permission assertions and compile lint passed. Lint, typecheck, access/UI/dependency/order and immutable SQL checks passed.
- Production-mode Chromium acceptance passed with fictional accounts: full workplace/academic decisions, password unlock and denial, immediate routine saves, clearing and field boundaries, permanent stale-request conflict and explicit rejection. Three viewports in both actual themes passed keyboard/focus and overflow checks. Twelve sanitized screenshots are preserved in the ignored execution ledger.
- The fixture configuration explicitly permits only HTTP loopback Auth/app and disables Sentry. The real deployment validator remains unchanged. This evidence does not certify live CAPTCHA or mailbox providers.
- Supabase migration `20261005165555` is applied; hosted SQL SHA-256 is byte-identical to the committed SQL. See [migration receipt](2026-10-05-profile-migration-receipt.json). Do not apply it again. Browser execution of all three profile functions is denied; existing public RLS and privilege checks remain intact.
- PR [#169](https://github.com/jnuits/jnuits-full-stack/pull/169) is pending final-head checks and normal merge. Production deployment is not yet verified; defer old-plan execution until its actual SHA includes this patch.
