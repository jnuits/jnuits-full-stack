# Membership lifecycle implementation checkpoint

Authority: the approved [finalization design](../specs/2026-09-29-membership-lifecycle-committee-finalization-design.md) and [renewal/departure plan](../plans/2026-09-29-membership-renewal-and-departure.md).

## Locally completed

1. Database-state-driven anniversary presentation and access contracts.
2. Anniversary renewal ledger, reconciliation/Cron, departure/withdrawal/appeal and review transactions.
3. Cycle-free application approval and retirement of cycle-writing browser actions/forms.
4. Separate authenticated identity, mutable, restricted and blocked portal access. Former members retain sign-in and password changes but cannot access normal profile/workplace/photo mutations. The owned loader returns only a minimal membership DTO for restricted access and never selects a directory-code hash. Advisor navigation is preserved.
5. Membership choices for overdue/former members: renewal requests, alumni requests, typed-confirmation departure, pending withdrawal and one appeal. Actions derive ownership from the authenticated identity, reject stale revisions, and use the guarded database transactions. The grace dashboard links to renewal guidance; old alumni forms hand off to the same workflow. No online payment is implied.
6. Paginated administrative queues for missing joining dates, upcoming/overdue anniversaries, renewal requests, departures, appeals and alumni requests. Reviewed confirmations/waivers require membership permission and MFA, advance one expected anniversary only, and preserve security restrictions. The old account reviewer is restricted to deletion so it cannot bypass the new alumni transaction.
7. Admin reads reconcile a bounded batch after permission checks; portal access reconciles only its owned member. Both use the same PostgreSQL function as the daily Cron job and fail safely on database/transport errors. Replay proves fixed-date retries produce a single former-transition event.
8. Authenticated integration verification covers eight lifecycle/security states. It exposed and fixed a frozen-member redirect loop: middleware now permits the restricted-access explanation rather than treating a retained role as mutable eligibility. The explanation does not ask an existing frozen member to claim again. Departure copy explicitly distinguishes rejection of the one appeal from rejection of the departure request.
9. Final independent review identified five integration gaps; one regression-first fix pass corrected atomic alumni portal-role replacement, present-day eligibility for historical renewal receipts, legacy unpaid-former reactivation, missed-Cron direct profile endpoints, and normal-request database policy boundaries. An additional retained alumni-onboarding column/parameter ambiguity discovered by real database lint was qualified in the same forward fix. No earlier migration was rewritten. See the [review decisions and evidence](2026-10-01-membership-lifecycle-review.md).

New approvals accept a reviewed earlier joining date; blank dates for **new** members default to the Dhaka approval date. Existing unknown dates are not invented. Known joining dates, membership identity and security restrictions are preserved. ID allocation follows the joining year. Conflicting identities and already-claimed profiles are not merged or reclaimed.

Historical cycle tables, indexes and nullable foreign keys remain intact. New intake and batches are unbound; the old cycle-transition RPC is retired. Invitation batches reuse the established sender with a bounded explicit list of existing JnUITS IDs. Claim outreach is not payment processing or renewal confirmation.

The real replay exposed an old ID-allocator parameter/column ambiguity; the forward migration fixes it without rewriting migration history.

## Verification at this checkpoint

- Full suite: **259 files, 1,670 tests passed**.
- Type checking and lint passed.
- Strict migration order: **109 migrations, no findings**.
- Disposable clean replay: all 109 migrations plus the verification-only bootstrap helper passed; member intake, anniversary lifecycle, cycle-free approval, identity conflicts, retries, known/unknown dates, security preservation, minimal lifecycle projection, bounded admin queues, role/permission transitions, historical-confirmation and authenticated-policy checks passed. Synthetic fixtures roll back. Real PostgreSQL public/private function lint reports no schema errors and now runs on every replay.
- Database types generated from the disposable stack only.
- Admin access map: 39 routes / 20 permissions; responsive pattern audit passed.
- Component browser QA: 56 member-state and 56 admin-queue theme/viewport combinations passed with no horizontal overflow or browser errors. Departure, withdrawal, single-appeal, confirmation guards and modal/mobile keyboard interactions passed.
- Authenticated local browser QA: eight states × two themes × four widths = **64 combinations passed** using real Next.js and disposable Supabase Auth/Postgres. Direct former-member editing redirects, workplace mutation restrictions, CSRF denial, ordinary-member renewal-confirmation denial, and real departure/withdrawal server actions passed. CAPTCHA stayed enabled; login was preauthenticated with synthetic accounts. This is not production or admin-MFA browser verification. See [reproduction and safety instructions](../../operations/membership-browser-verification.md).
- Production build passed with the existing CI placeholder environment; the isolated worktree has no production `.env.local`. No production secret configuration was changed.
- Disposable local database security advisors: no issues reported. This is not a hosted advisor certification.
- Read-only Supabase-plugin inspection: hosted project `fsirdkjgrcocowxqjhjg` has **102** migration entries versus **109** locally. The seven pending versions are `20260929110000`, `20261001090000`, `20261001090001`–`20261001090004`, and `20261001154954`. Hosted authenticated request-table grants remain revoked; policy tests independently exercise hypothetical legacy exposure inside rollback-only fixtures. No hosted migration or grant change was applied during this execution.

## Still required — not 100% complete

- Subsequent committee-roster finalization and member/advisor photo plans.
- The existing positive live public-Google-Sheet verification gate remains open.
- Release review, GitHub checks, approved hosted migrations, production data verification and deployment verification.

This checkpoint is local development evidence, **not** a production-readiness or deployment claim. No hosted database migration, remote push or merge was performed for this checkpoint. The pre-fest backup remains untouched.
