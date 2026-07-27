# Post-PR-73 Backlog Reconciliation

Audit basis: `main` at `f5353bbd5ff0402eb356f81b28ec4fda675b2729`.
Merge under review: PR #73 (`6dc72676707865dd97ee0f759ef3973187b3fc7f`).

This document records what was **verified by reading the code on `main`**, and
what remains **assumed**. "CI green" is not treated as verification anywhere in
this document. A skipped test is recorded as blocked evidence, never as a pass.

## 0. Corrections to the working assumptions

Four beliefs carried into this task did not survive contact with `main`.

| Assumption | Verified state |
| --- | --- |
| `main` is at `6dc7267` | **False.** `main` is `f5353bb`. Two `Update README.md` commits were pushed directly to `main` on 2026-07-26 at 11:24Z and 11:27Z, after the PR #73 merge. Only `README.md` changed. This is issue #48 (unprotected default branch) being exercised in practice. |
| The verification harness has never executed | **Stale.** PR #73 added the `migration_runtime` job to `.github/workflows/quality-gate.yml`, and `Required CI` hard-requires its result. It has run on every push and PR since the merge. Whether those runs *passed* is unverified here, because GitHub Actions logs are not readable from this workstream. |
| The harness replays all migrations, including the two under test | **Already fixed.** `supabase/verification/run-unapplied-migrations.sh` copies the historical chain only while `migration_version <= 20260723233000`, then injects the verification-only baseline helper. There is no `supabase db reset`. |
| Seven `copilot/fix-151169143-*` branches need deleting | **Already gone.** The repository has exactly three refs: `main`, `codex/supabase-modern-auth`, `feature/non-payment-forms-phases-2-4`. No `git push origin --delete` is required. |

## 1. Issue audit

Each verdict below cites the file that was read. Issues marked **audit pending**
were not inspected and must not be closed on the strength of this document.

### Verified still open — do not close

#### #31 — spreadsheet formula injection in audit CSV exports

**Verdict: open. No remediation present.**

`src/lib/admin/audit-explorer.ts` still serialises through a local `csvCell()`
helper that only doubles quotes and wraps the value:

```ts
function csvCell(value: unknown) {
  const text = typeof value === "string" ? value : value == null ? "" : JSON.stringify(value);
  return `"${text.replace(/"/g, '""')}"`;
}
```

`auditEventsToCsv()` calls `csvCell` for every column, including `metadata`.
The shared `protectSpreadsheetCell()` helper in `src/lib/exports/tabular.ts` is
not imported. A cell beginning with `=`, `+`, `-`, or `@` is exported verbatim.
The issue's recommendation to add `Cache-Control: private, no-store` to the
audit export route is also unaddressed in this module.

#### #54 — membership application privacy

**Verdict: open. The documented defence does not match the behaviour.**

`src/app/api/membership-form/status/route.ts` accepts an `email` query
parameter alone and returns either `{ status: null, updatedAt: null }` or
`{ status: <pending|approved|rejected>, updatedAt: <timestamp> }`. The file's
own header comment claims found and not-found paths are indistinguishable;
the two response bodies are materially different and the client depends on
that difference. Jitter (`getAntiEnumerationDelayMs`, 80-199 ms) and IP rate
limiting raise the cost of enumeration but do not establish that the caller
controls the address. No ownership proof, OTP, or emailed status link exists.

#### #37 — waitlist availability in public event state

**Verdict: open. Public model and backend still disagree.**

In `src/lib/content/events.ts`:

- `EventRegistrationState` is `"open" | "full" | "closed" | "external" | "none"`.
  There is no waitlist member.
- Neither `EVENT_SELECT` nor `EVENT_LIST_SELECT` selects `waitlist_enabled`.
- `getRegistrationState()` returns `"full"` whenever
  `registeredCount >= capacity`, with no waitlist branch.
- `getRegistrationLabel()` maps that to `"Registration Full"`.

Meanwhile the registration route does accept and return `waitlisted`. A
capacity-reached event with waitlisting enabled therefore advertises
"Registration Full" while the backend would happily create a waitlist entry.

#### #20 — Google Drive export idempotency and orphaned PII

**Verdict: open. The core ordering defect is intact.**

In `src/app/api/admin/events/[eventId]/registrations/export/route.ts`:

- The handler is still `GET`, so refresh and retry re-run the side effect.
- `uploadGoogleSheetSnapshot()` runs **before** any local persistence.
- Only after the upload does the code insert `event_export_jobs` with
  `status: "completed"`, then insert `audit_events`.
- If either insert returns an error the handler returns 500 and the Drive file
  remains, with its file ID recorded nowhere.
- There is no deterministic idempotency key, no pre-created `requested` job,
  no `cleanup_required` state, and no reconciliation path.

PR #73's "Drive idempotency" work is not visible at this call site. If it lives
inside `uploadGoogleSheetSnapshot()` it addresses duplicate transport retries,
not the durable-local-identity-before-external-upload requirement that #20
actually specifies.

### Verified closeable

#### #36 — event registration API success states

**Verdict: closeable. Contract mismatch is resolved.**

`src/app/api/events/[eventId]/register/route.ts` now branches on
`duplicate` (409), `full` (409), `closed` (409), `waitlisted` (200 with
`waitlisted: true`), and treats `confirmed` with a registration code as the
success path. The final guard rejects anything that is not `confirmed`. The
string `"created"` no longer appears in the handler. Confirmation and waitlist
mail both route through `sendEventRegistrationEmail()`, which derives a
deterministic idempotency key
(`event-registration/{eventId}/{code}/{kind}`) and records the attempt via
`recordEventRegistrationDelivery()`.

**Closure is still conditional.** #36's verification criterion 1 requires
*migrated-database integration tests* across confirmed, waitlisted, duplicate,
full, closed, and invalid outcomes for both the legacy and linked-form RPCs.
That evidence belongs to #32 and is not yet produced. Close #36 for the route
contract, and leave the integration-coverage requirement recorded on #32 so it
is not erased.

### Audit pending — not yet inspected

`#23`, `#24`, `#29`, `#32`, `#33`, `#34`, `#35`, `#42`, `#64`.

No verdict is recorded for these. They keep their current state until the code
backing each acceptance criterion has been read.

### Adjacent finding, outside the named candidate list

#### #59 — pinning every Action to an immutable SHA

`scripts/github-actions-workflows.test.mjs` asserts that every external `uses:`
reference matches `/^[0-9a-f]{40}$/`, and the check runs inside `npm test`,
which `Required CI` requires. Spot-checking `quality-gate.yml` confirms
`actions/checkout`, `actions/setup-node`, `actions/cache`,
`actions/upload-artifact`, `supabase/setup-cli`, and `gitleaks-action` are all
pinned to full SHAs with a version comment.

The gap is coverage, not compliance: `workflowNames` in that test lists only
`e2e-matrix.yml`, `preproduction-verify.yml`, `production-readiness.yml`, and
`quality-gate.yml`. Two workflows on disk are unguarded — `diff-check.yml` and
`preproduction-alumni.yml`. #59 should be narrowed to "extend the policy test
to every file in `.github/workflows/`" rather than closed or left as written.

## 2. Issue #18 — supported clean migration replay

### What already exists

The `migration_runtime` job in `.github/workflows/quality-gate.yml`:

- pins Supabase CLI `2.109.1` via `supabase/setup-cli` at a full commit SHA;
- runs `supabase/verification/run-unapplied-migrations.sh`;
- tees output to `artifacts/reports/unapplied-migration-verification.log`;
- uploads that log with `if-no-files-found: error`;
- is a hard dependency of the `Required CI` aggregate job.

The runner itself:

- creates a uniquely named scratch directory with `mktemp -d`;
- copies migrations **only** while `migration_version <= 20260723233000`;
- injects `supabase/verification/baseline/20260608092959_restore_rls_auto_enable.sql`,
  which lives deliberately outside `supabase/migrations`;
- starts a heavily excluded local stack (Postgres only, effectively);
- refuses to delete a scratch path that does not match its own prefix;
- stops the stack and removes the volume via an `EXIT` trap;
- requires a `DISPOSABLE_SCRATCH` acknowledgement and an exact
  `current_database()` match inside the SQL harness.

### The actual `rls_auto_enable` problem

A true replay from zero reaches
`20260608093000_admin_permission_policy_hardening.sql`, which expects
`public.rls_auto_enable()`. That function exists in `supabase/schema.sql` but
was never introduced by any migration in the chain, and `schema.sql` is not
independently executable because of constraint ordering. Production history is
authoritative and cannot be rewritten, so the honest options are:

1. **Baseline replay (current, recommended).** Declare a supported bootstrap
   point, restore the missing historical helper from a version-controlled
   verification-only file, and replay forward from there. Honest, already
   implemented, but it is explicitly *not* a from-zero replay.
2. **Forward-fix migration.** Add a new `create or replace function` migration
   for `rls_auto_enable()`. Safe against production (idempotent, additive) but
   it does not repair the historical gap: a from-zero replay still fails at
   `20260608093000`, because the new migration sorts after it.
3. **Rewrite applied history.** Prohibited.

Option 1 is the only one that satisfies #18's intent without violating the
safety rules. The remaining work is therefore **narrowing and completing**, not
greenfield implementation.

### Remaining work

- Replay forward through the **latest** migration, not only to the baseline.
  The current harness stops at `20260723233000` and applies the two migrations
  under test separately as its subject.
- Add an explicit assertion inventory: required extensions, expected functions,
  triggers, RLS enablement per table, grants, and
  `supabase_migrations.schema_migrations` contents.
- Prove the gate fails on a missing dependency and on a reordered migration.
- Document the exact bootstrap/recovery command and state the
  full-historical-replay versus supported-baseline-replay distinction in terms
  an operator can act on during an incident.
- Confirm no artifact can contain a connection URL or secret.

## 3. Issue #19 — applied migration integrity

### Design

Identity is **logical**, not positional. Remote Supabase history assigns its own
application timestamp, which does not equal the local filename timestamp:

| Logical migration | Local file | Remote record |
| --- | --- | --- |
| `form_publication_and_upload_session_hardening` | `20260724140000_form_publication_and_upload_session_hardening.sql` | `20260726105745_form_publication_and_upload_session_hardening` |
| `retention_purge_boundary_enforcement` | `20260726020000_retention_purge_boundary_enforcement.sql` | `20260726105843_retention_purge_boundary_enforcement` |

The manifest therefore records, per migration: logical name (the filename with
its leading 14-digit version stripped), local filename, local version,
SHA-256 of the file bytes, review state, and — where known — the remote applied
version as separate evidence. The manifest never claims the two timestamps are
equal.

### Checksum policy

- Hash **raw bytes**, not normalised text. Normalising line endings before
  hashing would let a CRLF/LF rewrite mask a genuine SQL edit, which
  #19 explicitly forbids.
- Determinism across Windows and Linux is achieved by requiring the files to
  be byte-identical on checkout, enforced through `.gitattributes` marking
  `supabase/migrations/*.sql` as `-text` so Git performs no EOL translation.
  This is the honest fix; hashing normalised content is not.
- Changing an applied migration's bytes fails CI. The remedy is a corrective
  forward migration, never an edit.
- Adding a forward migration is a documented two-step: add the `.sql`, then
  regenerate and commit the manifest in the same PR.
- The manifest contains no credentials, connection strings, or project refs.

### Known blocker

The manifest's SHA-256 values cannot be produced from this workstream. The
GitHub API exposes Git blob SHA-1, not content SHA-256, and the analysis
sandbox has no network access to clone the repository. Committing placeholder
or guessed digests would be precisely the unrecorded patch the safety rules
prohibit, and would make the gate lie.

The manifest must be generated by one local command and committed by the
maintainer or Codex. Until then the checksum job fails by design, which is the
correct failure: an integrity gate with no trusted baseline must not report
success.

## 4. Implementation sequence

Ordered by dependency. Steps 1-3 are independent of each other; step 4 depends
on 2 and 3; step 5 depends on the local manifest generation in step 3.

| # | Step | Depends on | Owner | Blocking |
| --- | --- | --- | --- | --- |
| 1 | Finish the issue audit for the nine pending issues; apply closures, partial updates, and blocked records | none | audit | no |
| 2 | Extend the replay harness: forward to latest, assertion inventory, negative-case proofs | none | db | no |
| 3 | Add the checksum manifest tooling, CI gate, and fixture-based tamper tests | none | db | no |
| 4 | Document bootstrap, recovery, and the baseline-versus-full-replay distinction | 2, 3 | docs | no |
| 5 | Generate and commit the real manifest locally, then confirm the gate | 3 | **Codex/maintainer** | **yes** |

Step 5 cannot be performed through the GitHub-only workstream. It is the
handover point.

## 5. Verification status

| Area | Status |
| --- | --- |
| Issue audit | In progress — 5 of 14 candidates verified |
| Clean replay (supported baseline) | Implemented on `main`; runtime result unverified from here |
| Clean replay (full historical) | **Not achievable** without rewriting applied history |
| Applied migration checksums | Blocked on local manifest generation |
| Applied migrations unchanged | Verified — this branch changes no file under `supabase/migrations/` |
| `src/lib/db/types.ts` unchanged | Verified — untouched |
| GitHub Actions result | **Unverifiable from this workstream.** Logs are not readable here. |
