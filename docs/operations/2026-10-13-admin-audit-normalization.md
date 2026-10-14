# Admin audit normalization — 2026-10-13

The owner-approved implementation follows [the validated plan](../superpowers/plans/2026-10-13-admin-audit-normalization.md) and [audit triage](2026-10-13-admin-audit-triage.md). It builds on main `59152c0ae4afcf830b45a6b8828db1382d1bcdf9`; release receipts are recorded in the ignored execution ledger for this plan.

## Resulting behavior

- Named page permissions run before privileged content, membership, reporting, history and committee readers. Existing proxy assurance and action permissions remain in force.
- Every active admin has a scoped My Profile view; account directories/invitations remain management-only. Own metadata saves return to My Profile with feedback. Caller-provided identity never defines the authenticated actor.
- Projects edit their actual database fields/statuses. Existing cover URLs and omitted optional values survive saves; explicit clears still work. Covers use the existing visual selector and uploads require media permission. Existing public slugs stay stable.
- Advisor menu actions open Profile or Access as appropriate and link to real published sections. Profile edits cannot assign or clear Auth links. The separate email-based linking workflow remains, with a warning and Confirm/Cancel. Nested confirmation Escape leaves its editor open.
- Sidebar identity-review counts use the same three request types as their queue. Unavailable counts are unknown, with navigation retained. Ordinary password-unlocked profile updates remain direct; legacy workplace/account workflows remain separate.
- Singleton saves merge only owned copy fields into current server content. Slider/stat/unknown fields and unedited hero slides survive. Revision-bound updates reject stale/conflicting saves; inserts cannot overwrite a raced new page. About body content remains in its dedicated editor. Page selection loads fresh server state.
- Content Hub shows only permitted workspaces and their counts, including About, Slider, Forms and Contact Settings. Duplicate unscoped summary queries are removed.
- Audit actor suggestions use only bounded recent actor IDs and `admin_profiles.display_name`; the current custom UUID and all query/export filters remain valid. Manual media registration is an Advanced disclosure. Bulk Operations retains all seven types and history, with permitted links to existing Intake anchors.

## Deliberately retained

No blanket `admin.content.manage` permission, invented project sort/media columns, generic combined review queue, single sequential member-save operation, reports/reconcile consolidation, bulk-operation removal or new certificate enum is introduced. Existing certificate types already cover Event, Exam and Course. Deferred committee term/roster policy is unchanged. JnUITS styling, native department selectors and AGY control-height fixes are retained.

Public forms/login keep Turnstile; authenticated dashboards have none. Session/lifecycle/origin/rate-limit protection stays active. Role changes still require native AAL2, current-password verification and exact session/intent-bound proof. Scoped email OTP does not replace AAL2.

## Verification and release gates

Behavioral denial, scoped-read, omission/clear, link-preservation, mixed-counter, singleton concurrency and audit-filter regressions accompany the changes. A fresh-context review found two important regressions (actor column and self-save redirect); both were reproduced and corrected with focused tests.

`ADMIN_AUDIT_QA=DISPOSABLE_SCRATCH` extends the existing unlinked local-Supabase runner. Together with `PROFILE_SELF_SERVICE_QA=DISPOSABLE_SCRATCH` and `MEMBER_EDITOR_QA=DISPOSABLE_SCRATCH`, it builds the real production application and exercises synthetic account self-save, denied management access, project saves, singleton preservation/conflicts, advisor confirmation, named audit actors and advanced media controls at 375/768/1280 in both themes. It mirrors independently verified service grants only inside its newly created scratch database. No hosted credentials or real user mutations are used. Traces/automatic screenshots are disabled.

The required Quality Gate runs the new suite in Chromium, Firefox and WebKit on Linux with zero retries for mutable acceptance. Local Windows Firefox lacks Universal C Runtime dependencies; a local Chromium-only diagnostic is not evidence of three-engine Linux completion. Required non-Vercel checks must pass before normal merge, then the actual production SHA and exact-deployment smoke must pass. Current test/run/release receipts belong in the execution ledger; this document does not substitute for them.

No schema changes or migration application are required. Read-only Supabase verification confirmed 120 applied migrations, latest `20261012164801`, and service SELECT/INSERT/UPDATE on the relevant existing tables. Older owner-mailbox, backup configuration/restore, and separate authenticated production acceptance gaps stay open. Preserve all ledgers, worktrees, AGY stash/work and backup branches.
