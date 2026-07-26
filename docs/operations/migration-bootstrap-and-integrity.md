# Migration Bootstrap, Clean Replay, and Applied-Migration Integrity

Covers issues #18 and #19. Read this before rebuilding a database, before
adding a migration, and during a schema incident.

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
   `supabase_migraions.schema_migrations`, with no extras and matching counts.
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

## 5. Applied-migration integrity manifest

```bash
npm run migration:manifest        # verify
npm run migration:manifest:write  # regenerate after adding a migration
```

### Identity is logical, never positional

Supabase assigns its own version at application time, so the remote record and
the local filename disagree:

| Logical name | Local file | Remote record |
| --- | --- | --- |
| `form_publication_and_upload_session_hardening` | `20260724140000_...sql` | `20260726105745_...` |
| `retention_purge_boundary_enforcement` | `20260726020000_...sql` | `20260726105843_...` |

The manifest keys on the logical name and stores `localVersion` and
`remoteAppliedVersion` as separate fields. It never claims they are equal.
Remote evidence lives in `supabase/migration-remote-evidence.json` so the
reconciliation is reviewable on its own.

### Manifest format

`supabase/migration-manifest.json`:

```json
{
  "manifestVersion": 1,
  "checksumAlgorithm": "sha256",
  "checksumScope": "raw file bytes, no newline normalisation",
  "migrations": [
    {
      "logicalName": "retention_purge_boundary_enforcement",
      "localFilename": "20260726020000_retention_purge_boundary_enforcement.sql",
      "localVersion": "20260726020000",
      "remoteAppliedVersion": "20260726105843",
      "sha256": "<64 hex characters>",
      "state": "applied"
    }
  ]
}
```

### Checksum policy

- Digests cover **raw bytes**. Normalising line endings before hashing would
  let a CRLF rewrite hide a real SQL edit, so it is not done.
- Cross-platform determinism comes from `.gitattributes` marking
  `supabase/migrations/*.sql` as `-text`, so Git performs no EOL translation on
  Windows or Linux. A newline-only rewrite is a *detected modification*, not a
  tolerated one.
- The manifest is scanned on every read and write for connection strings,
  `sb_secret_`/`sb_publishable_` keys, JWTs, `service_role`, and
  `.supabase.co` hosts. A match aborts.

### Failure modes

| Result | Meaning | Remedy |
| --- | --- | --- |
| `modified` | An applied migration's bytes changed | **Revert and ship a corrective forward migration.** Never regenerate the manifest to silence this. |
| `unregistered` | A new migration has no entry | Expected for a forward migration. Regenerate, review the diff, commit. |
| `missingFromDisk` | A recorded migration is gone | Investigate before doing anything else. |
| `renamed` | Same logical name, different filename, identical bytes | Legitimate only as documented legacy reconciliation. |
| exit 3 | Manifest absent | Generate it. See below. |

### Adding a migration

1. Add the `.sql` file.
2. Run `npm run migration:manifest:write`.
3. Review the diff. Exactly one new entry should appear. **A digest change on
   an existing entry means you edited an applied migration.**
4. Commit the migration and the manifest together in the same PR.

## 6. Current blocker: the manifest does not exist yet

`npm run migration:manifest` exits 3 until the manifest is generated. That is
correct behaviour: an integrity gate with no trusted baseline must not report
success.

The digests cannot be produced from a GitHub-only workstream. The GitHub API
exposes Git blob SHA-1, not content SHA-256. Committing placeholder digests
would make the gate lie about what it is protecting.

**Required local step:**

```bash
git switch fix/migration-integrity-18-19
git pull
npm run migration:manifest:write
npm run migration:manifest      # must now exit 0
git add supabase/migration-manifest.json
git commit -m "chore(db): register applied migration checksums"
git push
```

Confirm before committing that the two entries in §5's table carry their
`remoteAppliedVersion` values and `"state": "applied"`.

## 7. Promoting the gates to required

Both new CI jobs run but are deliberately absent from the `Required CI` `needs`
list in `.github/workflows/quality-gate.yml`.

The full chain has never been replayed and the manifest does not exist, so
requiring them today would report a control gap as a code failure and block
every unrelated change. Promote in this order:

1. Run `npm run db:replay-bootstrap` locally. If the chain fails, that failure
   is the answer #18 was asking for; fix it forward before promoting.
2. Generate and commit the manifest per §6.
3. Confirm both jobs are green on a pull request.
4. Add `migration_bootstrap_replay` and `migration_manifest` to the
   `Required CI` `needs` list and to its result assertions.
5. Only then rely on either as release evidence.

Until step 4 lands, neither job is a release gate, and the release checklist
must not claim otherwise.
