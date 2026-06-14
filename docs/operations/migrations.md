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
