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
| Proven by | Nothing. It cannot pass. | `npm run db:replay-bootstrap`, and the required `Clean migration replay` CI job |

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

Requires Docker and Supabase CLI `2.109.1`. The runner rejects other CLI versions until their image mapping is verified.

For type generation and database lint, `prepare-pgmeta-image.sh` uses the official
GHCR copy of `supabase/postgres-meta:v0.96.6`. CLI `2.109.1` can pull that image
from ECR directly despite a registry override ([upstream issue #5785](https://github.com/supabase/cli/issues/5785)).
The helper pulls by immutable OCI digest
`sha256:a84cc713585eea7b401e4a2561ec4a1e48c87083d1c7ecb4502f204bb4391300`,
independently verified to match the ECR image, then assigns the local ECR name
expected by the CLI. It rejects a cached image with unexpected provenance,
failed mirror downloads, mismatched digests or mismatched local image IDs.
Registry outages still fail the gate; SQL checks and generated-type validation
are never skipped. When updating the CLI, verify its actual image tag and the
matching official registry digests, then update the version/image pins together.


```bash
npm run db:replay-bootstrap
```

Or directly, when the CLI is not on `PATH`:

```bash
SUPABASE_BIN=/path/to/supabase bash supabase/verification/run-bootstrap-replay.sh
```

If the default local database port `54322` is unavailable, choose a free,
unreserved port and set `SUPABASE_REPLAY_DB_PORT`. On Windows PowerShell:

```powershell
netsh interface ipv4 show excludedportrange protocol=tcp
$env:SUPABASE_REPLAY_DB_PORT = "55122" # Replace with a free, unreserved port.
npm run db:replay-bootstrap
Remove-Item Env:SUPABASE_REPLAY_DB_PORT
```

The runner accepts only integer ports from `1024` through `65535`, changes
only the scratch project's `[db].port`, and refuses an unexpected generated
config shape. It never changes the repository's `supabase/config.toml`.

What it does:

1. Creates a uniquely named scratch project with `mktemp -d` under
   **`.replay-scratch/` at the repository root**, not under `TMPDIR`. That
   directory is git-ignored, and `actions/checkout` removes it on a reused
   self-hosted workspace. It lives inside the repo deliberately: under Git
   Bash, MSYS rewrites POSIX-looking paths before native binaries see them, so
   bash's `/tmp` and the CLI's view of the same string resolve differently.
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
4. **Every `SECURITY DEFINER` function in `public` pins `search_path`.**
   Promoted from evidence on 2026-07-27, once a real run established that the
   allowlist is empty: 34 definer functions, zero offenders. A definer
   function without a pinned `search_path` runs privileged code against
   caller-controlled schema resolution, so there is no allowlist mechanism
   here on purpose. A new exemption is a design discussion, not a config line.
   Cross-check new definer functions against
   `security-definer-function-register.md`.

**Recorded as evidence.** Raised as notices, not exceptions.

5. Installed extensions.
6. Tables in `public` without RLS enabled.
7. `anon` and `authenticated` write privileges on `public` tables.
8. Oldest and newest applied versions.

Checks 6 and 7 are security invariants and should become blocking. They are
not blocking yet because **their offender lists are not empty**, and promoting
them today would report a known control gap as a code failure on every
unrelated change:

- Check 6 finds one table, `membership_id_sequences`. Production has RLS on
  it; a database rebuilt from the chain does not. That is recovery drift, and
  it is tracked in **#76**. Promote after that forward migration lands. Do not
  promote by allowlisting the offender, which would bless the drift.
- Check 7 finds `anon` and `authenticated` holding TRUNCATE through default
  privileges. Tracked in **#75**. Promote after that forward migration lands.

### The replay understates production

Read-only production inspection on 2026-07-27 found both roles holding the
full write set (DELETE, INSERT, UPDATE, TRUNCATE) across 36-38 tables, from
default ACLs owned by **both** `postgres` and `supabase_admin`. The replay
only surfaced TRUNCATE.

A database built purely from migrations receives fewer inherited grants than
one that has accumulated platform defaults over its life. **Treat replay
privilege evidence as a floor, never a ceiling.** Verify production
separately, read-only, before drawing conclusions about it.

No assertion or notice emits a connection string, project ref, key, or PII. The
only log surfaced on failure is local container output.

### Evidence from the Linux run on 2026-07-27

The first execution of this harness inside GitHub Actions, on a self-hosted
Linux runner. Previously it had only ever run once, locally, on Windows.

```
ENFORCED 1 passed: 96 migrations replayed and recorded.
ENFORCED 2 passed: bootstrap dependency public.rls_auto_enable() present.
ENFORCED 3 passed. tables=68 views=2 functions=66 policies=142 triggers=51 constraints=413 extensions=8
ENFORCED 4 passed: all 34 SECURITY DEFINER functions in public pin search_path.
```

96 = 95 repository migrations plus the verification-only bootstrap helper.

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

**Strict mode is wired into CI as of 2026-07-27.** The verify-then-promote
condition was met: a Linux run reported `Inspected 95 migrations.` followed by
`Migration ordering and dependency check: no findings.` The
`migration_dependencies` job now runs `--strict` and is in the `Required CI`
`needs` list, so a new finding exits 2 and blocks the merge. The fixture tests
in `scripts/check-migration-dependencies.test.mjs` prove the checker detects
every failure class it claims to, and three subprocess tests prove the CLI
actually exits non-zero when it finds something.

### Known limitation

The checker treats `function` as a DDL object keyword, so
`for each row execute function public.f()` is **not** counted as an
invocation. Twenty-two migrations use that pattern. There is no live defect
today, because every trigger function in the chain is defined before first
use, but a trigger function referenced before creation would not be caught.
`CREATE TRIGGER` fails immediately when the function is absent, so this is a
real gap in the same failure class the checker exists for. Tracked as
follow-up from the PR #74 review.

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

## 7. The replay gate is required

`migration_bootstrap_replay`, named `Clean migration replay` in the checks
list, is in the `Required CI` `needs` list in
`.github/workflows/quality-gate.yml` and has its own result assertion. The
aggregate job echoes every shard result before asserting, so a future no-log
failure stays diagnosable.

It was promoted on 2026-07-27 in the order this section previously prescribed:

1. The chain was replayed and all enforced assertions passed. ✅
2. The job ran green on a pull request. ✅
3. It was added to the `Required CI` `needs` list and its result assertions. ✅
4. It is now release evidence.

**The release checklist may rely on it.** A red `Clean migration replay` means
the migration chain does not build from the supported bootstrap point, and
that is a merge blocker, not a flaky job.

### Docker-job isolation on GitHub-hosted runners

`migration_runtime` and `migration_bootstrap_replay` run on separate fresh
GitHub-hosted VMs, so their `supabase_*` container cleanup and fixed local
ports cannot collide. Both jobs retain preflight and post-run cleanup as
defense in depth, but no serialization dependency is required. Historical
self-hosted constraints are recorded in `self-hosted-runners.md` and issue
#78.
## 2026-10-04: enforced SQL-content integrity

`node scripts/check-migration-integrity.mjs` validates the sealed manifest against
raw committed Git blobs at `68d8c3730d599b37b4bacb177bd48c0d28008958`, then protects
every SQL file in the trusted PR base. Historical edits and deletion fail even
when a contributor changes the manifest. New forward migrations are appended
and become protected as soon as they merge. This supersedes the deferred
checksum convention above without rewriting any historical SQL.

CI fetches full history and runs the checker from the trusted base when it
exists, so a same-change checker edit cannot silently reseal history. Workflow
changes themselves still require the normal protected-branch review.

A historical version reconciliation requires a receipt approved on protected
main BEFORE the rename. Put the receipt in
`supabase/migration-reconciliation-receipts.json` with `oldPath`, `newPath`,
`projectId`, `hostedVersion`, `sha256` of the original committed SQL and
`verifiedAt` from plugin verification. Review the actual hosted migration SQL
receipt before accepting that evidence. The replacement SQL must retain the
same Git blob bytes. Receipts introduced by the rename itself do not authorize
it. Reconciliation of a new pending migration's plugin-assigned version before
its first merge does not rewrite historical SQL.

Filename-version/name parity is a separate check. SQL-content integrity proves
repository history identity; it does NOT prove that hosted SQL matches.
Hosted migration statement receipts and effective grants/policies are required
for release evidence. Never reapply the existing verification migrations.

The integrity gate runs before dependency installation. It compares raw blobs and the sealed manifest in the exact candidate Git commit against the immutable anchor and trusted base; working files are checked independently with filters disabled. Lifecycle scripts, clean filters, and working-tree restoration cannot conceal a committed SQL rewrite. The CLI accepts --candidate-ref to pin the tested commit (HEAD by default).