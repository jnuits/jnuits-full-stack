-- membership_id_sequences RLS hardening (audit DB-002)
--
-- 20260426003000_membership_identity_foundation.sql created this table and
-- granted SELECT to authenticated, and 20260426004000 added an admin-only
-- SELECT policy, but no migration ever issued ENABLE ROW LEVEL SECURITY.
-- On the live project the table is protected only because a production-only
-- event trigger (rls_auto_enable(), present solely in schema.sql and the
-- disposable baseline helper) auto-enabled RLS. A fresh replay of the
-- migration chain would therefore expose the ID allocator counter to
-- anon/authenticated default privileges (full DML), corrupting
-- allocate_membership_id() and enabling duplicate jnuits_ids.
--
-- The application reads this table exclusively through the service-role
-- client (src/app/admin/bulk-operations/actions.ts getCurrentSequence), and
-- allocation happens inside SECURITY DEFINER functions, so revoking browser
-- role privileges breaks nothing. The admin read policy from 20260426004000
-- stays in place (inert while no grant exists, documented for operators).

begin;

alter table public.membership_id_sequences enable row level security;

revoke all on public.membership_id_sequences from anon;
revoke all on public.membership_id_sequences from authenticated;

commit;
