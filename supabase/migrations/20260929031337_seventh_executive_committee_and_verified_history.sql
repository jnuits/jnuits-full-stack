begin;

do $preflight$
declare
  target_member_count integer;
begin
  select count(*)
  into target_member_count
  from public.members
  where upper(jnuits_id::text) = upper('JnUITS-2023001');

  if target_member_count > 1 then
    raise exception 'Expected at most one member with JnUITS ID JnUITS-2023001; found %.', target_member_count;
  end if;

  if exists (
    select 1
    from public.committee_terms
    where term_kind = 'executive'
      and term_number = 7
      and slug <> '7th-executive-committee'
  ) then
    raise exception 'An unexpected executive committee record already uses term number 7.';
  end if;

  if exists (
    select 1
    from public.committee_terms
    where slug = '7th-executive-committee'
      and (term_kind <> 'executive' or term_number is distinct from 7)
  ) then
    raise exception 'The 7th Executive Committee slug is already used by a conflicting term.';
  end if;

  if (
    select count(*)
    from public.committee_terms
    where term_kind = 'executive'
      and term_number between 2 and 6
  ) <> 5 then
    raise exception 'Executive committee terms 2 through 6 must exist before applying the verified history.';
  end if;

  if exists (
    select 1
    from (
      values
        ('vice-president'),
        ('it-secretary'),
        ('executive-member')
    ) as expected(code)
    left join public.committee_roles as roles
      on roles.code = expected.code
     and roles.role_group = 'executive'
    where roles.id is null
  ) then
    raise exception 'One or more verified historical committee roles are missing.';
  end if;
end
$preflight$;

-- The 6th EC completed its term on election day; close the term and any
-- still-active appointments before promoting the newly elected committee.
update public.committee_assignments as assignments
set
  starts_on = coalesce(assignments.starts_on, terms.starts_on),
  ends_on = coalesce(assignments.ends_on, date '2026-09-25'),
  status = 'completed',
  updated_at = timezone('utc', now())
from public.committee_terms as terms
where terms.id = assignments.term_id
  and terms.term_kind = 'executive'
  and terms.term_number = 6
  and assignments.status = 'active';

update public.committee_terms
set is_current = false
where term_kind = 'executive'
  and is_current;

update public.committee_terms
set
  ends_on = date '2026-09-25',
  status = 'archived',
  is_current = false,
  date_confidence = 'verified',
  tenure_note = 'The 6th EC formally closed on 25 September 2026 when the 7th EC election was held.',
  updated_at = timezone('utc', now())
where term_kind = 'executive'
  and term_number = 6;

insert into public.committee_terms (
  slug,
  title,
  summary,
  starts_on,
  ends_on,
  status,
  is_public,
  term_number,
  term_kind,
  election_date,
  is_current,
  date_confidence,
  tenure_note,
  target_executive_slots,
  voter_rule_note
)
values (
  '7th-executive-committee',
  '7th Executive Committee',
  'Current executive committee of JnU IT Society.',
  date '2026-09-26',
  null,
  'active',
  true,
  7,
  'executive',
  date '2026-09-25',
  true,
  'verified',
  'Elected on 25 September 2026 and assumed office on 26 September 2026.',
  21,
  'The official 7th EC roster will be published through the reviewed committee onboarding workflow.'
)
on conflict (slug) do update
set
  title = excluded.title,
  summary = excluded.summary,
  starts_on = excluded.starts_on,
  ends_on = excluded.ends_on,
  status = excluded.status,
  is_public = excluded.is_public,
  term_number = excluded.term_number,
  term_kind = excluded.term_kind,
  election_date = excluded.election_date,
  is_current = excluded.is_current,
  date_confidence = excluded.date_confidence,
  tenure_note = excluded.tenure_note,
  target_executive_slots = excluded.target_executive_slots,
  voter_rule_note = excluded.voter_rule_note,
  updated_at = timezone('utc', now());

-- Start the 7th EC with the canonical 21-seat executive position structure.
-- The roster remains empty until its member data is reviewed and published.
insert into public.committee_term_positions (
  term_id,
  role_id,
  public_label,
  public_label_bn,
  role_group,
  priority,
  is_public,
  min_slots,
  max_slots,
  target_slots
)
select
  terms.id,
  roles.id,
  roles.title,
  roles.title_bn,
  roles.role_group,
  roles.sort_order,
  roles.is_public,
  roles.min_slots,
  roles.max_slots,
  roles.default_slots
from public.committee_terms as terms
cross join public.committee_roles as roles
where terms.slug = '7th-executive-committee'
  and terms.term_kind = 'executive'
  and roles.role_group = 'executive'
  and roles.is_public
on conflict (term_id, role_id) do nothing;

-- Historical assignments need a per-term position overlay to be eligible for
-- the public projection. Add only the owner-verified positions here; complete
-- historical structures remain part of the reviewed roster-import process.
with verified_positions (term_number, role_code) as (
  values
    (2, 'executive-member'),
    (3, 'it-secretary'),
    (4, 'vice-president')
)
insert into public.committee_term_positions (
  term_id,
  role_id,
  public_label,
  public_label_bn,
  role_group,
  priority,
  is_public,
  min_slots,
  max_slots,
  target_slots
)
select
  terms.id,
  roles.id,
  roles.title,
  roles.title_bn,
  roles.role_group,
  roles.sort_order,
  true,
  roles.min_slots,
  roles.max_slots,
  roles.default_slots
from verified_positions
join public.committee_terms as terms
  on terms.term_kind = 'executive'
 and terms.term_number = verified_positions.term_number
join public.committee_roles as roles
  on roles.code = verified_positions.role_code
 and roles.role_group = 'executive'
on conflict (term_id, role_id) do nothing;

with verified_assignments (term_number, role_code) as (
  values
    (2, 'executive-member'),
    (3, 'it-secretary'),
    (4, 'vice-president')
), target_member as (
  select id
  from public.members
  where upper(jnuits_id::text) = upper('JnUITS-2023001')
)
insert into public.committee_assignments (
  term_id,
  role_id,
  member_id,
  display_name,
  bio,
  sort_order,
  starts_on,
  ends_on,
  status,
  public_title_override,
  is_public,
  source,
  metadata
)
select
  terms.id,
  roles.id,
  target_member.id,
  null,
  null,
  100,
  terms.starts_on,
  case when terms.ends_on is null then null else terms.ends_on - 1 end,
  'completed',
  null,
  true,
  'system',
  jsonb_build_object(
    'provenance', 'owner-confirmed-history',
    'confirmed_on', '2026-09-29'
  )
from verified_assignments
join public.committee_terms as terms
  on terms.term_kind = 'executive'
 and terms.term_number = verified_assignments.term_number
join public.committee_roles as roles
  on roles.code = verified_assignments.role_code
cross join target_member
on conflict (term_id, role_id, member_id) where member_id is not null do update
set
  display_name = null,
  sort_order = excluded.sort_order,
  starts_on = excluded.starts_on,
  ends_on = excluded.ends_on,
  status = excluded.status,
  public_title_override = null,
  is_public = true,
  metadata = public.committee_assignments.metadata || excluded.metadata,
  updated_at = timezone('utc', now());

do $postflight$
begin
  if (
    select count(*)
    from public.committee_terms
    where term_kind = 'executive'
      and is_current
  ) <> 1 then
    raise exception 'Exactly one executive committee must be current after the transition.';
  end if;

  if not exists (
    select 1
    from public.committee_terms
    where slug = '7th-executive-committee'
      and term_number = 7
      and starts_on = date '2026-09-26'
      and election_date = date '2026-09-25'
      and ends_on is null
      and status = 'active'
      and is_current
      and is_public
      and date_confidence = 'verified'
  ) then
    raise exception 'The 7th Executive Committee transition did not produce the expected current term.';
  end if;

  if not exists (
    select 1
    from public.committee_terms
    where term_kind = 'executive'
      and term_number = 6
      and ends_on = date '2026-09-25'
      and status = 'archived'
      and not is_current
  ) then
    raise exception 'The 6th Executive Committee was not closed as expected.';
  end if;

  if exists (
    select 1
    from public.committee_roles as roles
    where roles.role_group = 'executive'
      and roles.is_public
      and not exists (
        select 1
        from public.committee_term_positions as positions
        join public.committee_terms as terms on terms.id = positions.term_id
        where terms.slug = '7th-executive-committee'
          and positions.role_id = roles.id
          and positions.is_public
      )
  ) then
    raise exception 'The 7th Executive Committee is missing one or more public executive positions.';
  end if;

  if (
    select coalesce(sum(positions.target_slots), 0)
    from public.committee_term_positions as positions
    join public.committee_terms as terms on terms.id = positions.term_id
    where terms.slug = '7th-executive-committee'
      and positions.role_group = 'executive'
      and positions.is_public
  ) <> 21 then
    raise exception 'The 7th Executive Committee position structure must target 21 seats.';
  end if;

  if exists (
    select 1
    from public.members
    where upper(jnuits_id::text) = upper('JnUITS-2023001')
  ) and (
    select count(*)
    from public.committee_assignments as assignments
    join public.committee_terms as terms on terms.id = assignments.term_id
    join public.committee_roles as roles on roles.id = assignments.role_id
    join public.members as members on members.id = assignments.member_id
    where upper(members.jnuits_id::text) = upper('JnUITS-2023001')
      and (terms.term_number, roles.code) in (
        (2, 'executive-member'),
        (3, 'it-secretary'),
        (4, 'vice-president')
      )
      and assignments.is_public
      and assignments.status = 'completed'
  ) <> 3 then
    raise exception 'The three owner-verified historical appointments were not linked correctly.';
  end if;
end
$postflight$;

commit;
