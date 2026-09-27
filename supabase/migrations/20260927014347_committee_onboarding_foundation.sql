begin;

do $preflight$
begin
  if exists (
    select 1
    from public.committee_terms
    where term_kind = 'executive'
      and is_public
      and term_number is not null
    group by term_number
    having count(*) > 1
  ) then
    raise exception 'At most one public executive term is allowed per term number.';
  end if;

  if exists (
    select 1
    from public.committee_assignments
    where member_id is not null
    group by term_id, role_id, member_id
    having count(*) > 1
  ) then
    raise exception 'Duplicate linked committee appointments must be resolved.';
  end if;
end
$preflight$;

create table public.committee_term_positions (
  id uuid primary key default extensions.gen_random_uuid(),
  term_id uuid not null references public.committee_terms(id) on delete cascade,
  role_id uuid not null references public.committee_roles(id) on delete restrict,
  public_label text not null,
  public_label_bn text,
  role_group text not null default 'executive',
  priority integer not null default 100,
  is_public boolean not null default true,
  min_slots integer not null default 0,
  max_slots integer not null default 1,
  target_slots integer not null default 1,
  created_by_user_id uuid references auth.users(id) on delete set null,
  updated_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint committee_term_positions_term_role_unique unique (term_id, role_id),
  constraint committee_term_positions_public_label_check check (btrim(public_label) <> ''),
  constraint committee_term_positions_role_group_check check (
    role_group = any (array['executive', 'advisor', 'sub_executive'])
  ),
  constraint committee_term_positions_priority_check check (priority between 0 and 9999),
  constraint committee_term_positions_slot_range_check check (
    min_slots between 0 and 60
    and max_slots between min_slots and 60
    and target_slots between min_slots and max_slots
  )
);

create index committee_term_positions_public_order_idx
  on public.committee_term_positions (term_id, is_public, priority, role_id);
create index committee_term_positions_role_idx
  on public.committee_term_positions (role_id);
create index committee_term_positions_created_by_idx
  on public.committee_term_positions (created_by_user_id)
  where created_by_user_id is not null;
create index committee_term_positions_updated_by_idx
  on public.committee_term_positions (updated_by_user_id)
  where updated_by_user_id is not null;

create trigger committee_term_positions_set_updated_at
before update on public.committee_term_positions
for each row execute function public.set_current_timestamp_updated_at();

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
select distinct
  assignments.term_id,
  assignments.role_id,
  roles.title,
  roles.title_bn,
  roles.role_group,
  roles.sort_order,
  roles.is_public,
  roles.min_slots,
  roles.max_slots,
  roles.default_slots
from public.committee_assignments as assignments
join public.committee_roles as roles on roles.id = assignments.role_id
on conflict (term_id, role_id) do nothing;

create unique index committee_terms_one_public_executive_number_idx
  on public.committee_terms (term_number)
  where term_kind = 'executive'
    and is_public
    and term_number is not null;

create unique index committee_assignments_linked_appointment_unique_idx
  on public.committee_assignments (term_id, role_id, member_id)
  where member_id is not null;

alter table public.bulk_operations
  add column if not exists source_kind text,
  add column if not exists source_sha256 text,
  add column if not exists target_term_id uuid references public.committee_terms(id) on delete restrict,
  add column if not exists draft_revision integer not null default 1,
  add column if not exists validated_revision integer,
  add column if not exists validated_at timestamptz;

alter table public.bulk_operations
  drop constraint if exists bulk_operations_operation_type_check,
  add constraint bulk_operations_operation_type_check check (
    operation_type = any (array[
      'legacy_member_import',
      'member_invite',
      'alumni_invite',
      'lifecycle_update',
      'role_update',
      'alumni_conversion',
      'account_deletion_review',
      'committee_roster_import',
      'member_profile_import'
    ])
  ),
  add constraint bulk_operations_source_kind_check check (
    source_kind is null
    or source_kind = any (array['manual', 'csv', 'xlsx', 'pasted_tsv'])
  ),
  add constraint bulk_operations_source_sha256_check check (
    source_sha256 is null
    or source_sha256 ~ '^[a-f0-9]{64}$'
  ),
  add constraint bulk_operations_new_import_source_check check (
    operation_type <> all (array['committee_roster_import', 'member_profile_import'])
    or source_kind is not null
  ),
  add constraint bulk_operations_digest_required_check check (
    source_kind is null
    or source_kind = 'manual'
    or source_sha256 is not null
  ),
  add constraint bulk_operations_target_term_check check (
    (operation_type = 'committee_roster_import' and target_term_id is not null)
    or (operation_type <> 'committee_roster_import' and target_term_id is null)
  ),
  add constraint bulk_operations_revision_check check (
    draft_revision > 0
    and (
      validated_revision is null
      or (validated_revision > 0 and validated_revision <= draft_revision)
    )
  );

create index bulk_operations_type_status_created_idx
  on public.bulk_operations (operation_type, status, created_at desc);
create index bulk_operations_target_term_status_idx
  on public.bulk_operations (target_term_id, status, created_at desc)
  where target_term_id is not null;

alter table public.bulk_operation_rows
  add column if not exists is_excluded boolean not null default false,
  add column if not exists excluded_at timestamptz,
  add column if not exists excluded_by_user_id uuid references auth.users(id) on delete set null,
  add column if not exists exclusion_reason text;

alter table public.bulk_operation_rows
  add constraint bulk_operation_rows_exclusion_state_check check (
    (
      not is_excluded
      and excluded_at is null
      and excluded_by_user_id is null
      and exclusion_reason is null
    )
    or (
      is_excluded
      and excluded_at is not null
      and excluded_by_user_id is not null
      and btrim(coalesce(exclusion_reason, '')) <> ''
    )
  );

create index bulk_operation_rows_excluded_by_idx
  on public.bulk_operation_rows (excluded_by_user_id)
  where excluded_by_user_id is not null;

create or replace function public.can_manage_bulk_operation_type(
  target_operation_type text
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select case
    when target_operation_type = 'committee_roster_import'
      then (select public.has_permission('admin.committee.manage'))
    when target_operation_type = 'member_profile_import'
      then (select public.has_permission('admin.membership.manage'))
    else (select public.has_permission('admin.bulk.manage'))
  end;
$$;

revoke all on function public.can_manage_bulk_operation_type(text)
  from public, anon, authenticated;
grant execute on function public.can_manage_bulk_operation_type(text)
  to authenticated, service_role;

alter table public.committee_term_positions enable row level security;

create policy "committee term positions scoped manage"
on public.committee_term_positions
for all
to authenticated
using ((select public.has_permission('admin.committee.manage')))
with check ((select public.has_permission('admin.committee.manage')));

drop policy if exists "bulk operations membership admins"
  on public.bulk_operations;
create policy "bulk operations scoped manage"
on public.bulk_operations
for all
to authenticated
using ((select public.can_manage_bulk_operation_type(operation_type)))
with check ((select public.can_manage_bulk_operation_type(operation_type)));

drop policy if exists "bulk operation rows membership admins"
  on public.bulk_operation_rows;
create policy "bulk operation rows scoped manage"
on public.bulk_operation_rows
for all
to authenticated
using (
  exists (
    select 1
    from public.bulk_operations as operation
    where operation.id = bulk_operation_rows.operation_id
      and public.can_manage_bulk_operation_type(operation.operation_type)
  )
)
with check (
  exists (
    select 1
    from public.bulk_operations as operation
    where operation.id = bulk_operation_rows.operation_id
      and public.can_manage_bulk_operation_type(operation.operation_type)
  )
);

revoke all privileges on table public.committee_term_positions
  from public, anon, authenticated;
grant select, insert, update, delete on table public.committee_term_positions
  to authenticated;
grant all privileges on table public.committee_term_positions
  to service_role;

notify pgrst, 'reload schema';
commit;
