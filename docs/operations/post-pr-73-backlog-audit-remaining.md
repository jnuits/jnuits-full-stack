# Post-PR-73 Backlog Audit — Remaining Nine Issues

Companion to `post-pr-73-backlog-reconciliation.md`. Same audit basis: `main`
at `f5353bbd5ff0402eb356f81b28ec4fda675b2729`.

Every verdict below cites the file that was read. Nothing here is inferred from
PR #73's description, and no verdict rests on "CI green".

## Summary

| Issue | Verdict | Action |
| --- | --- | --- |
| #23 | Partially completed | Narrow to atomicity + idempotency |
| #24 | Partially completed | Narrow to six remaining fire-and-forget sites |
| #29 | Not started | Leave open, unchanged |
| #32 | Partially completed | Narrow to migrated-database coverage |
| #33 | Substantially completed | Narrow to two residuals |
| #34 | **Completed** | Close with follow-up |
| #35 | **Completed** | Close |
| #42 | Not started | Leave open, unchanged |
| #64 | Blocked by children | Keep open |

---

## #23 — Atomic public form persistence

**Partially completed.**

### Resolved

`src/app/api/forms/[slug]/submit/route.ts` no longer treats email failure as a
reason to recreate the submission. Delivery now carries a deterministic key,
`form-confirmation/{submissionId}`, and `recordFormConfirmationDelivery()`
persists a `sent`/`failed` ledger row. Criterion 3 of the issue ("email failure
creates one retryable delivery record, not a duplicate submission") is met.

### Not resolved

Persistence is still two sequential calls:

```ts
const submissionId = await createPendingFormSubmission({ ... });
try { await createFormSubmissionAssets(submissionId, submissionAssets); }
catch (error) { /* 503 */ }
```

If `createFormSubmissionAssets` throws, the pending submission has already been
written and is returned to no one — an orphan with a live confirmation token
and no assets. There is no rollback and no explicit recoverable state, which
fails criterion 1. There is still no submission-level idempotency key and no
uniqueness rule for active duplicates, so a client retry after the 503 creates
a second submission with a second token, failing criteria 2 and 4.

**Remaining scope:** move submission + asset creation into one RPC, and accept
or derive a stable idempotency key.

---

## #24 — Durable transactional delivery

**Partially completed. Do not close.**

### Resolved for two workflows

Form confirmation and event registration both now `await` delivery, pass a
deterministic `Idempotency-Key` through to Resend
(`src/lib/notifications/send-email.ts` forwards `options.idempotencyKey` as a
request header), and write a ledger row afterwards via
`recordFormConfirmationDelivery()` / `recordEventRegistrationDelivery()`.

### Not resolved

Six `void sendEmail(...)` call sites remain, in exactly the files the issue
named:

| File | Occurrences |
| --- | --- |
| `src/app/admin/applications/alumni-actions.ts` | 2 |
| `src/app/admin/applications/membership-actions.ts` | 2 |
| `src/app/admin/membership/moderation-actions.ts` | 2 |
| `src/app/admin/membership/actions.ts` | 1 |
| `src/app/admin/bulk-operations/actions.ts` | 1 |
| `src/app/api/portal/workplace-requests/route.ts` | 1 |

Two of these carry comments describing the unawaited call as deliberately
"non-blocking", which is the exact pattern the issue rejects: in a serverless
invocation the work is not guaranteed to run after the response is committed.

Even on the two fixed paths, this is a **post-hoc ledger, not a transactional
outbox**. The delivery row is written *after* the send attempt, so an
invocation frozen between database commit and Resend call leaves no pending
record to retry from. There is still no background dispatcher, no bounded
backoff, no `next_retry`/`attempts` progression, and no operator-visible retry
control — criteria 3, 4, and 5 are unmet.

**Remaining scope:** convert the six sites, then add persist-before-send plus a
dispatcher.

---

## #29 — Admin access audit coverage

**Not started. Leave open exactly as written.**

`scripts/check-admin-access-map.cjs` is unchanged in substance. It verifies:
admin page routes appear in the access map; five required routes are mapped;
used permissions exist in the `AdminPermission` union; eight required
permissions exist; used permissions appear somewhere in local SQL;
`src/lib/site.ts` sources navigation from `getAdminNavigationLinks()`; and the
single `/admin/settings/security` route block contains `requireAal2: true`.

It walks only `src/app/admin/**/page.tsx`. It never reads
`src/app/api/admin/**`, never inspects exported server actions, and never
compares an action's guard permission against its mapped route. The blind spot
the issue describes is fully intact, and #28 is the live proof of it: the
access map demands AAL2 for `/admin/settings/security` and the script asserts
that, while `saveAdminSecuritySettings()` can still be invoked directly without
it.

---

## #32 — Migrated-database and browser coverage

**Partially completed.**

### Resolved

`e2e/` now contains `form-studio-workflows.spec.ts`,
`alumni-onboarding.spec.ts`, `alumni-onboarding-protected.spec.ts`, and
`smoke.spec.ts`. Public alumni intake and responsive layouts have real browser
coverage. The `"created"` status mock the issue called out is gone, because the
route contract itself changed (see #36).

### Not resolved

There is still no integration suite running against a database built from the
real migrations. The `migration_integrity` CI job runs nine Vitest files that
parse and assert on migration SQL; that is static analysis, not execution. The
`migration_runtime` job does execute real PostgreSQL, but its scope is the two
unapplied migrations under test, not the forms and events RPC contracts.

So the specific defect class #32 exists to catch — RPC status drift, capacity
and duplicate concurrency, constraint and locking behaviour — remains uncovered
by execution. `form-studio-workflows.spec.ts` additionally skips without
`E2E_AUTH_SMOKE=1`, which is blocked evidence, not coverage.

**#36's integration-test criterion is inherited here and must not be dropped
when #36 closes.**

---

## #33 — Event-form publication compatibility

**Substantially completed. Narrow, do not close as written.**

### Resolved

`getFormPublicationCompatibilityError()` in `src/lib/forms/management.ts`
rejects an event-registration form that has no linked event, whose linked event
is missing, whose event does not use `internal` registration, or whose event is
archived. `src/app/api/admin/forms/[formId]/publish/route.ts` calls
`getFormPublicationError()` and returns 409 with the specific message, so
Form Studio surfaces the reason before publish.

The upload half of the issue was resolved by the opposite route to the one
recommended: rather than rejecting `image`/`pdf` fields on event forms, the
runtime now genuinely supports them. `src/app/api/events/[eventId]/register/route.ts`
verifies proofs, checks Cloudinary provenance, and consumes upload sessions.
The "published but unserveable" scenario for uploads no longer exists.

### Residual

1. The compatibility check runs **in the route, before** the
   `publish_form_version` RPC — not inside the publish transaction, as the
   issue's recommended direction specifies. An event switched to `external`
   between check and commit still yields an unserveable published version.
2. Criterion 3, "every successfully published form passes an automated submit
   smoke test", has no implementation.

---

## #34 — Upload proof binding and Cloudinary verification

**Completed. Close with a follow-up.**

### Evidence

`src/lib/forms/upload-proof.ts` — the proof payload is `version: 2` and now
carries both `formVersionId` and a `sessionId` (both `uuid`, both required by
the strict schema). `verifyFormUploadProof()` rejects on signature mismatch via
`timingSafeEqual`, on expiry, on `formDefinitionId` mismatch, and on
`formVersionId` mismatch. Criterion 1 ("proofs fail after a new form version is
published") is met.

`src/lib/forms/cloudinary-assets.ts` — `loadVerifiedCloudinaryFormAsset()`
queries the Cloudinary Admin API for the asset and rejects unless *all* of
`asset_id`, `public_id`, `version`, `asset_folder`, `resource_type`,
`type === "authenticated"`, `bytes`, and `format` match, plus the custom
context fields `form_definition_id`, `form_version_id`, `field_id`,
`upload_id`, and `sha256`. The call carries `AbortSignal.timeout(5_000)`.
Criteria 2 and 4 are met, and this is a genuine provider query, not a URL
shape check.

`consumeFormUploadSession()` is called with the session ID and a manifest hash
(`hashFormUploadManifest`) in both the public submit route and the event
registration route, and a falsy result rejects the submission. Criterion 3
("replaying a consumed proof fails") is met.

### Follow-up to track separately

Criterion 5, "abandoned uploads are discoverable and cleaned up", was not
verified. Nothing observed in these modules reconciles or reaps sessions that
are signed but never consumed. Open a focused issue rather than holding #34.

---

## #35 — Expired confirmation recovery

**Completed.**

### Evidence

`src/app/api/forms/[slug]/confirmations/resend/route.ts` exists, with tests at
`route.test.ts`. It:

- rotates the token and expiry atomically through
  `refreshFormSubmissionConfirmation()`, which reuses the existing submission
  rather than creating a new one — criteria 1 and 5;
- returns `202` with an identical body on every path, including unknown
  email, delivery failure, and honeypot hit — criterion 4;
- applies `RATE_LIMITS.formConfirmationResend` plus Turnstile through
  `enforceAuthActionProtection()` — criterion 3;
- keys delivery on `form-confirmation-resend/{submissionId}/{tokenHash}`, so
  the key changes with each rotation and repeats are bounded;
- rejects `event_registration` forms with 409, which is correct: events do not
  use confirmation links.

`src/components/forms/form-confirmation-screen.tsx` renders
`FormConfirmationRecoveryForm` inline when the confirm call returns `410`,
replacing the old dead-end copy. The guidance now matches a control that
exists.

Criterion 2 ("old tokens stop working after rotation") follows from the
token-hash rotation but is asserted in the route's unit tests rather than
against a live database. Recorded as a known limit, not a blocker.

---

## #42 — Pending member-request uniqueness

**Not started at the database level. Leave open.**

A search across `supabase/migrations/` finds no partial unique index on
`profile_update_requests`. The only index on that table is from
`20260408001000_identity_certificates_rls.sql`:

```sql
create index if not exists profile_update_requests_member_idx
  on public.profile_update_requests (member_id, requested_at desc);
```

A non-unique btree. `20260426003000_membership_identity_foundation.sql` adds
only a `request_type` check constraint. Nothing enforces one pending request
per `(member_id, request_type)`.

The adjacent unique index that does exist —
`membership_applications_cycle_student_active_idx` from
`20260723171500_membership_application_cycles.sql`, partial on
`status in ('pending','needs_review','approved')` — is on a different table and
serves the annual-cycle dedupe, not this issue. It is a good template for the
fix, and should not be mistaken for the fix.

Workplace, alumni-conversion, deletion, and profile-change flows therefore
remain check-then-insert with no database backstop.

---

## #64 — Non-payment forms umbrella

**Keep open.** Per the issue's own closing rule, it may close only once every
remaining item is represented by a focused open issue. Open children after this
audit: #20, #23, #24, #29, #31, #32, #33, #37, #42, #54, plus the new
abandoned-upload-cleanup follow-up from #34. Its unchecked body items on
authenticated coverage remain blocked under #47, #45, and #32.

---

## Final tally

**Closeable: 2** — #34, #35.
**Closeable with an inherited criterion preserved elsewhere: 1** — #36 (into #32).
**Narrow the scope: 4** — #23, #24, #32, #33.
**Leave open unchanged: 4** — #20, #29, #31, #37, #42, #54.
**Keep open as umbrella: 1** — #64.

Of the fourteen candidates flagged as likely complete, **three** survive
inspection. That ratio is the finding.
