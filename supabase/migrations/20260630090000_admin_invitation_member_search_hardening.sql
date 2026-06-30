-- Harden admin invitation member search and persist linked member claim invitations.
-- This migration is additive and safe to apply after the admin account lifecycle migration.

create extension if not exists pg_trgm with schema extensions;

alter table public.admin_invitations
  add column if not exists claim_invitation_id uuid references public.invitations(id) on delete set null;

create index if not exists admin_invitations_claim_invitation_idx
  on public.admin_invitations (claim_invitation_id)
  where claim_invitation_id is not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.admin_profiles'::regclass
      and conname = 'admin_profiles_user_id_key'
  ) then
    alter table public.admin_profiles
      add constraint admin_profiles_user_id_key unique (user_id);
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.admin_profiles'::regclass
      and conname = 'admin_profiles_linked_member_id_key'
  ) then
    alter table public.admin_profiles
      add constraint admin_profiles_linked_member_id_key unique (linked_member_id);
  end if;
end $$;

create index if not exists members_admin_invite_full_name_trgm_idx
  on public.members using gin ((full_name::text) extensions.gin_trgm_ops)
  where full_name is not null;

create index if not exists members_admin_invite_email_trgm_idx
  on public.members using gin ((email::text) extensions.gin_trgm_ops)
  where email is not null;

create index if not exists members_admin_invite_jnuits_id_trgm_idx
  on public.members using gin ((jnuits_id::text) extensions.gin_trgm_ops)
  where jnuits_id is not null;

create index if not exists members_admin_invite_member_type_trgm_idx
  on public.members using gin ((member_type::text) extensions.gin_trgm_ops)
  where member_type is not null;