# Supabase Migration Operations Notes

## Member Invitation Claim Timestamp Reconciliation

Production migration history is authoritative for applied Supabase migrations.
The member invitation claim hardening migration is recorded remotely as
`20260525033833_harden_member_invitation_claims.sql`, while a later local draft
used `20260525093000_harden_member_invitation_claims.sql`.

Keep the local filename at `20260525033833_harden_member_invitation_claims.sql`
so `npm run migration:check` compares against the remote history without false
drift. Do not run broad `supabase db push --include-all` while local and remote
history differ. Apply only reviewed pending migrations after explicit live-DB
approval, then reload PostgREST with `NOTIFY pgrst, 'reload schema'` and run
read-only verification.

## MCP And Live Supabase Verification

MCP is operator tooling only. The production app must not depend on an MCP
client, server, transcript, or local agent configuration at runtime.

For live Supabase verification from Codex, use the Supabase plugin in read-only
mode and run metadata queries only through `execute_sql`. Do not use
`apply_migration` or any DDL/DML command unless live-DB mutation has been
explicitly approved for that task.

Store read-only evidence dumps under `artifacts/reports/` using a filename like
`supabase-live-dump-YYYYMMDD.md`. Before committing a dump, confirm it contains
only metadata needed for verification and no Supabase secret keys, PATs, JWTs,
SMTP credentials, or user PII. If a project ref is not already known from safe
configuration, request it directly instead of reading env files.

The current audit dump should cover:

- migration history;
- `event_registrations` policies and grants;
- rate-limit objects;
- `certificates` and `public_certificates` policies;
- public certificate columns;
- anon/authenticated/public grants for high-risk public tables.

## Certificate Full-Name Migration Gate

The app code expects `certificates.full_name` and the public-safe `public_certificates.full_name` view shape. Production must apply these reviewed migrations in order before removing any remaining compatibility code. As of July 5, 2026, these have been applied to `jnuits.org.bd`:

1. `20260703020515_certificate_full_name.sql`
2. `20260703040706_cleanup_certificate_legacy_names.sql`
3. `20260705013614_tighten_certificate_public_access.sql`
4. `20260705013928_public_certificate_view_access.sql`
5. `20260705020732_public_certificate_security_invoker_view.sql`
6. `20260705022356_revoke_anon_admin_totp_helper.sql`

After approval and application, reload PostgREST with `NOTIFY pgrst, 'reload schema'`, then verify:

- `certificates.full_name` exists and is populated;
- `public_certificates` exposes `full_name` and does not expose split names or source IDs;
- raw `certificates` is not publicly readable;
- `/certificates?q=24007`, `/api/certificates/batch`, and `/api/certificates/view/<id>` return the public-safe shape.

## Supabase CLI Parity Notes

Use the supported CLI path for migration parity:

```bash
SUPABASE_CLI_COMMAND="npx --yes supabase" npm run migration:check
```

On Windows the script resolves npm-family shims such as `npx`, `npm`, and `supabase` to `.cmd` automatically. If the CLI reports that no token is available, sign in with `supabase login` or set `SUPABASE_ACCESS_TOKEN`/`SUPABASE_PAT` in the execution environment. Never print token values in logs or reports.




