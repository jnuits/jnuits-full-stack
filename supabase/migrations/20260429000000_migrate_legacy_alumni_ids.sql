-- Migrate legacy alumni-only membership IDs into the canonical legacy block.
-- JNUITS-ALUMNI-* is retired; pre-2023 alumni/former members use JNUITS-0000SSS.

do $$
declare
  existing_legacy_max integer;
  legacy_alumni_count integer;
begin
  select coalesce(max(substring(upper(jnuits_id::text) from '^JNUITS-0000([0-9]{3})$')::integer), 0)
    into existing_legacy_max
  from public.members
  where upper(jnuits_id::text) ~ '^JNUITS-0000[0-9]{3}$';

  select count(*)
    into legacy_alumni_count
  from public.members
  where upper(jnuits_id::text) like 'JNUITS-ALUMNI-%';

  if existing_legacy_max + legacy_alumni_count > 999 then
    raise exception 'Cannot migrate % legacy alumni IDs into JNUITS-0000SSS block; % IDs already exist.',
      legacy_alumni_count,
      existing_legacy_max;
  end if;

  with ranked_legacy_alumni as (
    select
      id,
      row_number() over (order by created_at nulls first, id) as sequence_offset
    from public.members
    where upper(jnuits_id::text) like 'JNUITS-ALUMNI-%'
  )
  update public.members as members
  set
    jnuits_id = (
      'JNUITS-0000' ||
      lpad((existing_legacy_max + ranked_legacy_alumni.sequence_offset)::text, 3, '0')
    )::extensions.citext,
    updated_at = timezone('utc', now())
  from ranked_legacy_alumni
  where members.id = ranked_legacy_alumni.id;

  insert into public.membership_id_sequences (year_block, last_serial)
  values ('0000', existing_legacy_max + legacy_alumni_count)
  on conflict (year_block) do update
  set last_serial = greatest(
    public.membership_id_sequences.last_serial,
    excluded.last_serial
  );
end $$;
