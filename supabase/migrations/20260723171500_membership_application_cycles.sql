-- Local-only until explicit migration approval. Bind every confirmed membership
-- application to one open annual cycle and reject duplicate intake atomically.

begin;

alter table public.membership_applications
  add column if not exists membership_cycle_id uuid
    references public.membership_cycles(id) on delete restrict;

alter table public.membership_applications
  drop constraint if exists membership_applications_status_check;

alter table public.membership_applications
  add constraint membership_applications_status_check
  check (status in ('pending', 'needs_review', 'approved', 'rejected'));

create unique index if not exists membership_cycles_one_active_idx
  on public.membership_cycles ((status))
  where status = 'active';

create index if not exists membership_applications_cycle_created_idx
  on public.membership_applications (membership_cycle_id, created_at desc)
  where membership_cycle_id is not null;

create unique index if not exists membership_applications_cycle_email_active_idx
  on public.membership_applications (
    membership_cycle_id,
    lower(trim(email::text))
  )
  where membership_cycle_id is not null
    and status in ('pending', 'needs_review', 'approved');

create unique index if not exists membership_applications_cycle_student_active_idx
  on public.membership_applications (
    membership_cycle_id,
    lower(trim(student_id))
  )
  where membership_cycle_id is not null
    and nullif(trim(student_id), '') is not null
    and status in ('pending', 'needs_review', 'approved');

create or replace function public.bind_membership_application_cycle()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  cycle public.membership_cycles%rowtype;
  today date := (clock_timestamp() at time zone 'Asia/Dhaka')::date;
begin
  if new.membership_cycle_id is not null then
    select * into cycle
    from public.membership_cycles
    where id = new.membership_cycle_id
    for key share;
  else
    select * into cycle
    from public.membership_cycles
    where status = 'active'
      and starts_on <= today
      and (ends_on is null or ends_on >= today)
    order by starts_on desc
    limit 1
    for key share;
  end if;

  if not found
    or cycle.status <> 'active'
    or cycle.starts_on > today
    or (cycle.ends_on is not null and cycle.ends_on < today)
  then
    raise exception 'Membership intake is closed.' using errcode = 'P0001';
  end if;

  new.membership_cycle_id := cycle.id;
  new.email := lower(trim(new.email::text));
  new.student_id := nullif(lower(trim(coalesce(new.student_id, ''))), '');
  return new;
end;
$function$;

drop trigger if exists membership_applications_bind_cycle
  on public.membership_applications;
create trigger membership_applications_bind_cycle
before insert on public.membership_applications
for each row execute function public.bind_membership_application_cycle();

create or replace function public.transition_membership_cycle(
  p_cycle_id uuid,
  p_target_status text,
  p_actor_user_id uuid
)
returns table (cycle_id uuid, cycle_status text)
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  cycle public.membership_cycles%rowtype;
  active_cycle_id uuid;
begin
  if p_actor_user_id is null
    or p_target_status not in ('draft', 'active', 'closed', 'archived')
  then
    raise exception 'Invalid membership cycle transition.' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended('membership-cycle-transition', 0));

  select * into cycle
  from public.membership_cycles
  where id = p_cycle_id
  for update;

  if not found then
    raise exception 'Membership cycle not found.' using errcode = 'P0002';
  end if;

  if cycle.status = 'archived' and p_target_status <> 'archived' then
    raise exception 'Archived membership cycles are terminal.' using errcode = '22023';
  end if;

  if p_target_status = 'active' then
    select id into active_cycle_id
    from public.membership_cycles
    where status = 'active'
      and id <> cycle.id
    limit 1
    for update;

    if active_cycle_id is not null then
      raise exception 'Another membership intake cycle is already active.'
        using errcode = '23505';
    end if;
  end if;

  update public.membership_cycles
  set status = p_target_status,
      updated_at = now()
  where id = cycle.id;

  insert into public.audit_events (
    action,
    actor_user_id,
    entity_id,
    entity_type,
    metadata
  )
  values (
    'membership.cycle_' || p_target_status,
    p_actor_user_id,
    cycle.id,
    'membership_cycle',
    jsonb_build_object('from', cycle.status, 'to', p_target_status)
  );

  return query select cycle.id, p_target_status;
end;
$function$;

revoke all on function public.transition_membership_cycle(uuid, text, uuid)
  from public, anon, authenticated;
grant execute on function public.transition_membership_cycle(uuid, text, uuid)
  to service_role;

commit;
