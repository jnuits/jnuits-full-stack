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
only metadata needed for verification and no service-role keys, PATs, JWTs,
SMTP credentials, or user PII. If a project ref is not already known from safe
configuration, request it directly instead of reading env files.

The current audit dump should cover:

- migration history;
- `event_registrations` policies and grants;
- rate-limit objects;
- `certificates` and `public_certificates` policies;
- public certificate columns;
- anon/authenticated/public grants for high-risk public tables.
