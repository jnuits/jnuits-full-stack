-- Harden admin invitation member search and persist linked member claim invitations.
-- This migration is additive and safe to apply after the admin account lifecycle migration.

alter table public.admin_invitations
  add column if not exists claim_invitation_id uuid references public.invitations(id) on delete set null;

create index if not exists admin_invitations_claim_invitation_idx
  on public.admin_invitations (claim_invitation_id)
  where claim_invitation_id is not null;

-- Supabase projects allow pg_trgm, but local/non-Supabase Postgres may not.
-- Keep the migration non-blocking there; the app remains correct, only search speed is affected.
do $$
begin
  create schema if not exists extensions;
exception
  when insufficient_privilege then
    raise notice 'Skipping extensions schema creation; current role lacks privilege.';
end $$;

do $$
begin
  create extension if not exists pg_trgm with schema extensions;
exception
  when insufficient_privilege then
    raise notice 'Skipping pg_trgm extension creation; current role lacks privilege.';
  when undefined_schema then
    begin
      create extension if not exists pg_trgm;
    exception
      when insufficient_privilege then
        raise notice 'Skipping pg_trgm extension creation; current role lacks privilege.';
    end;
end $$;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_trgm') then
    perform set_config('search_path', 'public, extensions', true);

    execute 'create index if not exists members_admin_invite_full_name_trgm_idx
      on public.members using gin ((full_name::text) gin_trgm_ops)
      where full_name is not null';

    execute 'create index if not exists members_admin_invite_email_trgm_idx
      on public.members using gin ((email::text) gin_trgm_ops)
      where email is not null';

    execute 'create index if not exists members_admin_invite_jnuits_id_trgm_idx
      on public.members using gin ((jnuits_id::text) gin_trgm_ops)
      where jnuits_id is not null';

    execute 'create index if not exists members_admin_invite_member_type_trgm_idx
      on public.members using gin ((member_type::text) gin_trgm_ops)
      where member_type is not null';
  else
    raise notice 'pg_trgm extension is unavailable; skipping admin member invite trigram indexes.';
  end if;
end $$;
