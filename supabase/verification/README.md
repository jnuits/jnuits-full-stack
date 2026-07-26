# Migration verification

Runtime evidence for migrations that CI cannot produce. Static SQL tests prove a
file *says* the right thing; only execution proves PostgreSQL *does* the right
thing. Supabase Preview is skipped on this repository, so this gap is filled
manually.

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

Against a local Supabase stack:

```bash
supabase db reset --local --version 20260723233000
psql "$(supabase status -o env | grep DB_URL | cut -d= -f2- | tr -d '\"')" \
  -v ON_ERROR_STOP=1 \
  -v scratch_ack=DISPOSABLE_SCRATCH \
  -v expected_database=postgres \
  -f supabase/verification/verify-unapplied-migrations.sql
```

The reset must stop at `20260723233000_form_upload_sessions.sql`, the last
migration applied to production. Running an unbounded reset would install both
migrations under test before the recovery snapshot is captured. Never add
`--linked` or `--db-url`; this workflow is local-only.

## Reading the result

Every check raises a notice. A failed assertion aborts the run with
`ON_ERROR_STOP=1`, so **any** non-zero exit means the migration is not safe to
apply. Success ends with `VERIFICATION COMPLETE`; fixtures roll back, while the migrations remain applied only to the disposable scratch database.

Capture the full output. The `pg_get_functiondef` blocks at the top are the
recovery snapshot for the two functions being replaced; store them with the
release record before applying anything to production, because git history is
otherwise the only rollback path.

## Boundary check

Scope 3 is the one that matters most. Against the **pre-migration**
`purge_retention_job` it fails, because that version filters only on the
resource id and redacts every submission regardless of age. That failure is the
regression the migration fixes, so seeing scope 3 pass on a database where the
migration has been applied — and fail where it has not — is the evidence.
