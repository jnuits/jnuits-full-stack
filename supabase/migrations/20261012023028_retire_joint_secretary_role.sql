-- Joint Secretary is not a JnUITS committee position. Keep the valid
-- Assistant General Secretary role and all appointments/member records.
-- Historical seed migrations are immutable; retire their obsolete data here.
begin;
set local lock_timeout = '5s';
set local statement_timeout = '30s';

lock table public.committee_roles, public.committee_term_positions,
  public.committee_assignments in share row exclusive mode;

do $retire$
declare
  removed_positions jsonb;
  removed_roles jsonb;
  cleaned_aliases integer;
begin
  -- A future environment with an actual appointment must be reviewed rather
  -- than silently deleting or relabeling someone's historical position.
  if exists (
    select 1 from public.committee_assignments a
    join public.committee_roles r on r.id = a.role_id
    where regexp_replace(lower(r.code), '[^a-z0-9]', '', 'g') = 'jointsecretary'
      or regexp_replace(lower(r.title), '[^a-z0-9]', '', 'g') = 'jointsecretary'
  ) then
    raise exception 'Cannot retire Joint Secretary while appointments reference it.';
  end if;

  with removed as (
    delete from public.committee_term_positions p
    using public.committee_roles r
    where p.role_id = r.id and (
      regexp_replace(lower(r.code), '[^a-z0-9]', '', 'g') = 'jointsecretary'
      or regexp_replace(lower(r.title), '[^a-z0-9]', '', 'g') = 'jointsecretary'
    )
    returning p.*
  )
  select jsonb_agg(to_jsonb(removed)) into removed_positions from removed;

  update public.committee_roles r
  set aliases = array(
    select a.alias from unnest(r.aliases) with ordinality as a(alias, ordinal)
    where regexp_replace(lower(a.alias), '[^a-z0-9]', '', 'g') <> 'jointsecretary'
    order by a.ordinal
  )
  where exists (
    select 1 from unnest(r.aliases) as a(alias)
    where regexp_replace(lower(a.alias), '[^a-z0-9]', '', 'g') = 'jointsecretary'
  );
  get diagnostics cleaned_aliases = row_count;

  with removed as (
    delete from public.committee_roles r
    where regexp_replace(lower(r.code), '[^a-z0-9]', '', 'g') = 'jointsecretary'
      or regexp_replace(lower(r.title), '[^a-z0-9]', '', 'g') = 'jointsecretary'
    returning r.*
  )
  select jsonb_agg(to_jsonb(removed)) into removed_roles from removed;

  if removed_roles is not null or removed_positions is not null or cleaned_aliases > 0 then
    insert into public.audit_events (actor_user_id, action, entity_type, metadata)
    values (
      null,
      'committee.joint_secretary.retired',
      'committee_role',
      jsonb_build_object(
        'reason', 'Owner confirmed Joint Secretary is not a JnUITS position.',
        'source', 'reviewed forward migration',
        'removed_roles', coalesce(removed_roles, '[]'::jsonb),
        'removed_positions', coalesce(removed_positions, '[]'::jsonb),
        'alias_records_cleaned', cleaned_aliases,
        'appointments_changed', 0,
        'members_changed', 0
      )
    );
  end if;
end
$retire$;

-- Keep legacy imports or future catalog writes from recreating the retired
-- position, including aliases. Other roles remain configurable.
alter table public.committee_roles
  add constraint committee_roles_retired_joint_secretary_check check (
    regexp_replace(lower(code), '[^a-z0-9]', '', 'g') <> 'jointsecretary'
    and regexp_replace(lower(title), '[^a-z0-9]', '', 'g') <> 'jointsecretary'
    and coalesce(array_to_string(aliases, ','), '')
      !~* '(^|,)[[:space:]]*joint[[:space:]_-]*secretary[[:space:]]*(,|$)'
  );

commit;
