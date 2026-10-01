# Membership lifecycle implementation checkpoint

Authority: the approved [finalization design](../specs/2026-09-29-membership-lifecycle-committee-finalization-design.md) and [renewal/departure plan](../plans/2026-09-29-membership-renewal-and-departure.md).

## Locally completed

1. Database-state-driven anniversary presentation and access contracts.
2. Anniversary renewal ledger, reconciliation/Cron, departure/withdrawal/appeal and review transactions.
3. Cycle-free application approval and retirement of cycle-writing browser actions/forms.
4. Separate authenticated identity, mutable, restricted and blocked portal access. Former members retain sign-in and password changes but cannot access normal profile/workplace/photo mutations. The owned loader returns only a minimal membership DTO for restricted access and never selects a directory-code hash. Advisor navigation is preserved.
5. Membership choices for overdue/former members: renewal requests, alumni requests, typed-confirmation departure, pending withdrawal and one appeal. Actions derive ownership from the authenticated identity, reject stale revisions, and use the guarded database transactions. The grace dashboard links to renewal guidance; old alumni forms hand off to the same workflow. No online payment is implied.

New approvals accept a reviewed earlier joining date; blank dates for **new** members default to the Dhaka approval date. Existing unknown dates are not invented. Known joining dates, membership identity and security restrictions are preserved. ID allocation follows the joining year. Conflicting identities and already-claimed profiles are not merged or reclaimed.

Historical cycle tables, indexes and nullable foreign keys remain intact. New intake and batches are unbound; the old cycle-transition RPC is retired. Invitation batches reuse the established sender with a bounded explicit list of existing JnUITS IDs. Claim outreach is not payment processing or renewal confirmation.

The real replay exposed an old ID-allocator parameter/column ambiguity; the forward migration fixes it without rewriting migration history.

## Verification at this checkpoint

- Full suite: **251 files, 1,612 tests passed**.
- Type checking and lint passed.
- Strict migration order: **107 migrations, no findings**.
- Disposable clean replay: all 107 migrations plus the verification-only bootstrap helper passed; member intake, anniversary lifecycle, cycle-free approval, identity conflicts, retries, known/unknown dates, security preservation, minimal lifecycle projection and privilege checks passed. Synthetic fixtures roll back.
- Database types generated from the disposable stack only.
- Admin access map: 39 routes / 20 permissions; responsive pattern audit passed.
- Component browser QA: 56 synthetic state/theme/viewport combinations passed with no horizontal overflow or browser errors. Departure, withdrawal, single-appeal and mobile keyboard interactions passed. This is not yet authenticated Next.js/Supabase end-to-end verification.

## Still required — not 100% complete

- Renewal tasks 6–8: administrative renewal/departure queues, loader reconciliation integration verification and full browser/integration verification.
- Subsequent committee-roster finalization and member/advisor photo plans.
- The existing positive live public-Google-Sheet verification gate remains open.
- Release review, GitHub checks, approved hosted migrations, production data verification and deployment verification.

This checkpoint is local development evidence, **not** a production-readiness or deployment claim. No hosted database migration, remote push or merge was performed for this checkpoint. The pre-fest backup remains untouched.
