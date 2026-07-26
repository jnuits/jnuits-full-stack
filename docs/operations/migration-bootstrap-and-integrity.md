# Migration Bootstrap and Clean Replay

Covers issue #18. Read this before rebuilding a database from migrations and
during a schema incident.

**Issue #19, applied-migration checksums, is deferred.** See §6 for what was
built, why it was removed, and what to know if it is ever picked back up.

## 1. The two kinds of replay, and why the distinction matters

| | Full historical replay | Supported baseline replay |
| --- | --- | --- |
| Starts from | An empty database, migration one | An empty database plus one version-controlled bootstrap helper |
| Status | **Impossible today** | **Supported. This is the real recovery path.** |
| Proven by | Nothing. It cannot pass. | `npm run db:replay-bootstrap` |

### Why full historical replay is impossible

`supabase/migrations/20260608093000_admin_permission_policy_hardening.sql`
calls `public.rls_auto_enable()`. No migration in the chain creates that
function. It exists only in `supabase/schema.sql`, and `schema.sql` is not
independently executable because of constraint ordering.

Production migration history is authoritative and must never be rewritten, so
the function cannot be back-inserted into the chain. Three options were
considered:

1. **Supported baseline replay.** Restore the missing helper from a
   verification-only file, then replay the whole chain forward. Honest, and
   what is implemented.
2. **Forward-fix migration.** Add a new `create or replace function` migration.
   Safe against production, but it does not repair the gap: a new migration
   sorts *after* `20260608093000`, so from-zero replay still fails there.
3. **Rewrite applied history.** Prohibited.

Option 1 is the only honest one. Anyone claiming this repository supports a
from-zero replay is wrong, and the checker in §4 will say so.

## 2. Recovery and bootstrap command

Requires Docker and Supabase CLI `2.109.1`.

```bash
npm run db:replay-bootstrap
```

Or directly, when the CLI is not on `PATH`:

```bash
SUPABASE_BIN=/path/to/supabase bash supabase/verification/run-bootstrap-replay.sh
```

What it does:

1. Creates a uniquely named scratch project with `mktemp -d`.
2. Copies `supabase/verification/baseline/20260608092959_restore_rls_auto_enable.sql`
   into the scratch migration set. **This file must never move into
   `supabase/migrations`.**
3. Copies **every** file from `supabase/migrations` with no version ceiling.
4. Starts a Postgres-only local stack and applies the chain.
5. Runs `supabase/verification/assert-bootstrap-replay.sql`.
6. Stops the stack and deletes the volume through an `EXIT` trap, refusing to
   remove any path that does not match its own scratch prefix.

There is no `--linked` and no `--db-url` path. It cannot reach production.

### Do not confuse it with the other harness

`run-unapplied-migrations.sh` is a different tool with a different job: it
copies the chain **only through `20260723233000`** so the two most recent
migrations can be tested against a genuine pre-migration snapshot. Its
`pg_get_functiondef` output is the only rollback artifact that exists for those
two functions.

`run-bootstrap-replay.sh` replays **everything**. Use it to prove the chain
builds; use the other to prove a specific migration is safe to apply.

## 3. What the replay asserts, and what it only records

Two tiers, deliberately.

**Enforced.** Failure aborts the run.

1. Every migration copied in is recorded in
   `supabase_migrations.schema_migrations`, with no extras and matching counts.
   This is the assertion that actually proves a clean replay.
2. `public.rls_auto_enable()` exists after replay, so the bootstrap baseline
   still satisfies the historical chain.
3. The replay produced a real schema: non-zero tables, functions, policies,
   triggers, and constraints. Guards against an empty database passing every
   other check vacuously.

**Recorded as evidence.** Raised as notices, not exceptions.

4. Installed extensions.
5. Tables in `public` without RLS enabled.
6. `SECURITY DEFINER` functions in `public` that do not pin `search_path`.
   Cross-check against `security-definer-function-register.md`.
7. `anon` write privileges on `public` tables.
8. Oldest and newest applied versions.

Checks 5 through 7 are security invariants and should become blocking. They are
not blocking yet because their legitimate allowlists have never been confirmed
against a real replay, and inventing an allowlist would produce false failures.
**Promote them after one local run establishes the true list. Do not promote
them by guessing.**

No assertion or notice emits a connection string, project ref, key, or PII. The
only log surfaced on failure is local container output.

## 4. Static ordering and forward-reference check

```bash
npm run migration:check-order          # report only
npm run migration:check-order:strict   # fail on findings
```

Catches, without a database:

- malformed filenames, duplicate 14-digit versions, duplicate logical names,
  and files whose version order disagrees with sort order;
- **forward references**: a migration that executes `public.some_function()`
  before any earlier migration creates it. This is precisely the
  `rls_auto_enable()` defect.

References inside a `create function` body are ignored, because those resolve
when the function is called. References in `DO` blocks and bare statements are
checked, because those execute immediately.

Known historical gaps live in `BOOTSTRAP_FUNCTIONS` in
`scripts/check-migration-dependencies.mjs`. That set is the machine-readable
statement of the difference between full historical replay and supported
baseline replay. Adding an entry is an admission of a new gap, not a fix.

**Repo-wide strict mode is not wired into CI.** The true allowlist has never
been confirmed against a real run. Confirm locally, extend the list, then
enable `--strict`. The fixture tests in
`scripts/check-migration-dependencies.test.mjs` already prove the checker
detects every failure class.

## 5. Line endings in `supabase/migrations`

`.gitattributes` marks migration SQL as `-text`, so Git performs no end-of-line
translation on checkout or commit. Migrations are historical records; their
bytes should never be rewritten by tooling.

**The directory currently contains a mix of LF and CRLF blobs** from before
that rule existed. This is deliberately left alone. Normalising it would
rewrite the bytes of already-applied migrations, which is exactly what the
safety rules forbid.

**Never run `git add --renormalize` on `supabase/migrations`.** With `-text`
set, that would commit whatever line endings your working tree happens to have
back into the blobs, silently rewriting applied migrations while looking like a
tidy-up in review.

If you cloned before `.gitattributes` landed and `core.autocrlf` is on, your
working tree may hold CRLF where the repository holds LF. To realign without
changing any committed byte:

```bash
rm -rf supabase/migrations
git checkout -- supabase/migrations
git status --short supabase/migrations   # must be empty
```

## 6. Deferred: applied-migration checksums (issue #19)

A SHA-256 manifest gate was built and then removed on 2026-07-27. Recorded here
so the reasoning is not lost.

**What it did.** Recorded a digest per migration keyed on *logical* name
(filename minus the leading 14-digit version), with `localVersion` and
`remoteAppliedVersion` as separate fields, because Supabase assigns its own
version at application time:

| Logical name | Local file | Remote record |
| --- | --- | --- |
| `form_publication_and_upload_session_hardening` | `20260724140000_...sql` | `20260726105745_...` |
| `retention_purge_boundary_enforcement` | `20260726020000_...sql` | `20260726105843_...` |

Digests covered raw bytes, with no newline normalisation, on purpose:
normalising would let a CRLF rewrite carry a real SQL edit past the gate.

**Why it was removed.** It worked correctly and immediately surfaced the
mixed-line-ending reality described in §5: a manifest generated from a
CRLF working tree disagreed with the LF blobs in the repository on 32 files.
No migration SQL had been edited. Reconciling that split was judged not worth
blocking delivery on.

**If it is picked back up.** Generate the manifest from a *fresh checkout* made
after `.gitattributes` is in place, or from the committed blobs
(`git cat-file`) rather than the working tree. Do not solve it by normalising
newlines in the hasher, and do not solve it by renormalising the blobs.

Until then, `npm run migration:check` remains the only migration integrity
check, and it compares filename versions against linked remote history only. It
does not detect edited content. Treat migration files as append-only by
convention, not by enforcement.

## 7. Promoting the replay gate to required

The `migration_bootstrap_replay` job runs but is deliberately absent from the
`Required CI` `needs` list in `.github/workflows/quality-gate.yml`.

The full chain has never been replayed, so requiring it today would report a
control gap as a code failure and block every unrelated change. Promote in this
order:

1. Run `npm run db:replay-bootstrap` locally. If the chain fails, that failure
   is the answer #18 was asking for; fix it forward before promoting.
2. Confirm the job is green on a pull request.
3. Add `migration_bootstrap_replay` to the `Required CI` `needs` list and to
   its result assertions.
4. Only then rely on it as release evidence.

Until step 3 lands, the job is not a release gate, and the release checklist
must not claim otherwise.
