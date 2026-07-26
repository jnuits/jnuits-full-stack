# Migration verification

Static SQL tests prove a file *says* the right thing; only execution proves
PostgreSQL *does* the right thing. The same disposable runtime harness runs
locally and as a required GitHub Actions quality shard.

## What needs verifying

Two migrations are currently **unapplied**:

| Migration | Repairs |
| --- | --- |
| `20260724140000_form_publication_and_upload_session_hardening.sql` | PL/pgSQL `42702` ambiguity that broke draft publication in production |
| `20260726020000_retention_purge_boundary_enforcement.sql` | Purge destroying PII outside the three-year retention boundary |

## Running the harness

**Never point this at production.** The harness requires both an explicit
`DISPOSABLE_SCRATCH` acknowledgement and an exact `current_database()` name
match. The two migrations contain their own `COMMIT` statements and therefore
remain installed in the scratch database. Only the synthetic verification
fixtures are rolled back. Delete or reset the scratch database after capturing
the evidence.

With Docker running and Supabase CLI `2.109.1` available:

```bash
bash supabase/verification/run-unapplied-migrations.sh
```

Set `SUPABASE_BIN=/path/to/supabase` when the CLI is not on `PATH`.

The runner creates a uniquely named temporary project, copies production
migrations only through `20260723233000_form_upload_sessions.sql`, inserts the
verification-only `rls_auto_enable()` baseline helper, starts a local stack,
seeds one disposable `auth.users` row only when needed, executes the harness,
and destroys the stack and its data volume on exit.

The helper reconstructs a function that existed when an old production
migration ran but is missing from the local chain. It is copied verbatim from
`supabase/schema.sql` and deliberately lives outside `supabase/migrations`.
Never move it into production migrations.

Running an unbounded reset would install both migrations under test before the
recovery snapshot is captured. Never add `--linked` or `--db-url`; this
workflow is local-only.

## Reading the result

Every check raises a notice. A failed assertion aborts the run with
`ON_ERROR_STOP=1`, so **any** non-zero exit means the migration is not safe to
apply. Success ends with `VERIFICATION COMPLETE`; fixtures roll back, while the migrations remain applied only to the disposable scratch database.

Capture the full output. GitHub Actions uploads it as the
`unapplied-migration-verification` artifact. The `pg_get_functiondef` blocks at
the top are the recovery snapshot for the two functions being replaced; store
them with the release record before applying anything to production, because
git history is otherwise the only rollback path.

## Boundary check

Scope 3 is the one that matters most. Against the **pre-migration**
`purge_retention_job` it fails, because that version filters only on the
resource id and redacts every submission regardless of age. That failure is the
regression the migration fixes, so seeing scope 3 pass on a database where the
migration has been applied — and fail where it has not — is the evidence.
