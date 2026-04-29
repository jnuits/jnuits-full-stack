-- Keep membership_id_sequences aligned when admins manually assign a valid
-- JNUITS-YYYYSSS ID outside the allocator RPC.

create or replace function public.sync_membership_id_sequence_from_member()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_id text := upper(new.jnuits_id::text);
  parsed_year text;
  parsed_serial integer;
begin
  if normalized_id !~ '^JNUITS-[0-9]{7}$' then
    return new;
  end if;

  parsed_year := substring(normalized_id from '^JNUITS-([0-9]{4})[0-9]{3}$');
  parsed_serial := substring(normalized_id from '^JNUITS-[0-9]{4}([0-9]{3})$')::integer;

  insert into public.membership_id_sequences (year_block, last_serial)
  values (parsed_year, parsed_serial)
  on conflict (year_block) do update
  set last_serial = greatest(public.membership_id_sequences.last_serial, excluded.last_serial);

  return new;
end;
$$;

drop trigger if exists members_sync_membership_id_sequence on public.members;
create trigger members_sync_membership_id_sequence
after insert or update of jnuits_id on public.members
for each row execute function public.sync_membership_id_sequence_from_member();

revoke all on function public.sync_membership_id_sequence_from_member() from public;
