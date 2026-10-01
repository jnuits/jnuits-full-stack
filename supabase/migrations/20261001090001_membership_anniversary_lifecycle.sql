begin;
set local lock_timeout = '5s';

create schema if not exists private;

alter table public.members
  add column renewal_due_on date,
  add column current_membership_path_status text not null default 'open'
    check (current_membership_path_status in ('open', 'departure_requested', 'closed_appealable', 'closed_final')),
  add column current_membership_case_id uuid references public.profile_update_requests(id) on delete restrict,
  add column current_membership_closed_on date,
  add column current_membership_closed_by_user_id uuid references auth.users(id) on delete set null,
  add column current_membership_closure_reason text,
  add column current_membership_appeal_id uuid references public.profile_update_requests(id) on delete restrict,
  add column membership_revision bigint not null default 0 check (membership_revision >= 0);

create table public.membership_renewals (
  id uuid primary key default extensions.gen_random_uuid(),
  member_id uuid not null references public.members(id) on delete restrict,
  due_on date not null,
  confirmed_on date not null,
  resolution text not null check (resolution in ('paid', 'waived')),
  next_due_on date not null check (next_due_on > due_on),
  reference text check (reference is null or (length(reference) between 1 and 96 and reference ~ '^[A-Za-z0-9._/-]+$')),
  note text check (note is null or length(note) <= 500),
  confirmed_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (member_id, due_on)
);
alter table public.membership_renewals enable row level security;
revoke all on public.membership_renewals from public, anon, authenticated, service_role;
grant select on public.membership_renewals to authenticated, service_role;
create policy "membership admins read renewal ledger" on public.membership_renewals
  for select to authenticated using ((select public.has_permission('admin.membership.manage')));
create index membership_renewals_actor_idx on public.membership_renewals(confirmed_by_user_id);
create index members_renewal_queue_idx on public.members(renewal_due_on, id)
  where lifecycle_status = 'current' and current_membership_path_status = 'open' and renewal_due_on is not null;
create index members_unknown_joined_queue_idx on public.members(id)
  where joined_on is null and lifecycle_status in ('current', 'former');
create index members_membership_path_queue_idx on public.members(current_membership_path_status, id)
  where lifecycle_status = 'former';
create index members_departure_case_idx on public.members(current_membership_case_id) where current_membership_case_id is not null;
create index members_departure_appeal_idx on public.members(current_membership_appeal_id) where current_membership_appeal_id is not null;
create index members_closure_actor_idx on public.members(current_membership_closed_by_user_id) where current_membership_closed_by_user_id is not null;
create index membership_request_queue_idx on public.profile_update_requests(request_type, requested_at, id)
  where status = 'pending';

alter table public.profile_update_requests drop constraint profile_update_requests_request_type_check;
alter table public.profile_update_requests add constraint profile_update_requests_request_type_check
  check (request_type in ('workplace_update', 'profile_change', 'email_change', 'jnuits_id_change',
    'alumni_conversion', 'account_deletion', 'membership_renewal', 'membership_departure', 'membership_departure_appeal'));

-- Ordinary inserts cannot manufacture a membership decision or a departure case.
drop policy if exists "profile update request own insert" on public.profile_update_requests;
create policy "profile update request own insert" on public.profile_update_requests for insert to authenticated
with check (
  request_type not in ('membership_renewal', 'membership_departure', 'membership_departure_appeal')
  and status = 'pending' and reviewed_at is null and reviewed_by_user_id is null
  and exists (select 1 from public.members m where m.id = member_id and m.user_id = (select auth.uid()) and m.portal_access_status = 'active')
);
drop policy if exists "profile update request membership admin update" on public.profile_update_requests;
create policy "profile update request membership admin update" on public.profile_update_requests for update to authenticated
using (request_type not in ('membership_renewal', 'membership_departure', 'membership_departure_appeal') and (select public.has_permission('admin.membership.manage')))
with check (request_type not in ('membership_renewal', 'membership_departure', 'membership_departure_appeal') and (select public.has_permission('admin.membership.manage')));

-- Pure date policy. The original joining day is used for EVERY anniversary,
-- including recovery of February 29 after one or more non-leap years.
create function public.membership_anniversary(p_joined_on date, p_year integer)
returns date language plpgsql immutable strict security invoker set search_path = ''
as $function$
declare first_day date;
begin
  if p_year not between 1 and 9999 then raise exception 'Anniversary year is out of range.' using errcode = '22023'; end if;
  first_day := make_date(p_year, extract(month from p_joined_on)::integer, 1);
  return first_day + (least(extract(day from p_joined_on)::integer,
    extract(day from first_day + interval '1 month - 1 day')::integer) - 1);
end;
$function$;
revoke all on function public.membership_anniversary(date, integer) from public, anon, authenticated;
grant execute on function public.membership_anniversary(date, integer) to service_role;

create function public.membership_renewal_state(p_due_on date, p_lifecycle_status text, p_effective_date date)
returns text language sql immutable security invoker set search_path = ''
as $function$
  select case
    when p_lifecycle_status = 'alumni' then 'not_applicable'
    when p_due_on is null or p_effective_date is null then 'unknown'
    when p_lifecycle_status = 'former' then 'former'
    when p_effective_date < p_due_on then 'paid'
    when p_effective_date < (p_due_on + interval '6 months')::date then 'grace'
    else 'former' end;
$function$;
revoke all on function public.membership_renewal_state(date, text, date) from public, anon, authenticated;
grant execute on function public.membership_renewal_state(date, text, date) to service_role;

-- Not exposed through PostgREST; human transition actors always come from the
-- verified session, never user_metadata or an actor ID supplied in the payload.
create function private.require_membership_operator()
returns uuid language plpgsql stable security definer set search_path = ''
as $function$
declare actor_id uuid := auth.uid();
begin
  if actor_id is null or not public.has_permission('admin.membership.manage')
     or coalesce(auth.jwt() ->> 'aal', '') <> 'aal2'
     or not exists (select 1 from public.admin_profiles where user_id = actor_id and is_active and status = 'active') then
    raise exception 'An active membership administrator with MFA is required.' using errcode = '42501';
  end if;
  return actor_id;
end;
$function$;
revoke all on function private.require_membership_operator() from public, anon, authenticated, service_role;

create function private.record_membership_transition(p_member_id uuid, p_event text, p_metadata jsonb)
returns void language plpgsql security definer set search_path = ''
as $function$
begin
  insert into public.membership_lifecycle_events(member_id, event_type, summary, metadata, created_by_user_id)
  values (p_member_id, p_event, 'Membership renewal or current-membership path updated.', p_metadata, auth.uid());
  insert into public.audit_events(action, actor_user_id, entity_id, entity_type, metadata)
  values ('membership.' || p_event, auth.uid(), p_member_id::text, 'member', p_metadata);
end;
$function$;
revoke all on function private.record_membership_transition(uuid, text, jsonb) from public, anon, authenticated, service_role;

create function private.initialize_member_anniversary()
returns trigger language plpgsql security definer set search_path = ''
as $function$
begin
  if tg_op = 'INSERT' or new.joined_on is distinct from old.joined_on then
    if new.joined_on > (now() at time zone 'Asia/Dhaka')::date then
      raise exception 'Joining date cannot be in the future.' using errcode = '22023';
    end if;
    if tg_op = 'UPDATE' and exists (select 1 from public.membership_renewals where member_id = old.id) then
      raise exception 'A joining date with renewal history requires an audited correction.' using errcode = '22023';
    end if;
    new.renewal_due_on := case when new.joined_on is null then null
      else public.membership_anniversary(new.joined_on, extract(year from new.joined_on)::integer + 1) end;
  end if;
  if tg_op = 'INSERT' or new.lifecycle_status is distinct from old.lifecycle_status then
    if new.lifecycle_status = 'alumni' then
      new.current_membership_path_status := 'closed_final';
      new.current_membership_closure_reason := 'alumni_conversion';
      new.current_membership_closed_on := coalesce(new.alumni_since, (now() at time zone 'Asia/Dhaka')::date);
      new.current_membership_closed_by_user_id := auth.uid();
      if tg_op = 'UPDATE' then new.portal_access_status := old.portal_access_status; end if;
    elsif tg_op = 'UPDATE' and new.lifecycle_status = 'current' and new.current_membership_path_status <> 'open' then
      raise exception 'Closed current membership cannot be reactivated directly.' using errcode = '22023';
    end if;
  end if;
  if tg_op = 'UPDATE' and (
    new.joined_on is distinct from old.joined_on or new.renewal_due_on is distinct from old.renewal_due_on
    or new.lifecycle_status is distinct from old.lifecycle_status or new.portal_access_status is distinct from old.portal_access_status
    or new.current_membership_path_status is distinct from old.current_membership_path_status
    or new.current_membership_case_id is distinct from old.current_membership_case_id
    or new.current_membership_appeal_id is distinct from old.current_membership_appeal_id
  ) then new.membership_revision := old.membership_revision + 1; end if;
  return new;
end;
$function$;
revoke all on function private.initialize_member_anniversary() from public, anon, authenticated, service_role;
create trigger members_initialize_anniversary before insert or update on public.members
for each row execute function private.initialize_member_anniversary();

update public.members set renewal_due_on = public.membership_anniversary(joined_on, extract(year from joined_on)::integer + 1)
where joined_on is not null;
update public.members set current_membership_path_status = 'closed_final', current_membership_closure_reason = 'alumni_conversion',
  current_membership_closed_on = alumni_since where lifecycle_status = 'alumni';

-- Authenticated table-level UPDATE grants otherwise include newly added fields.
-- Keep all previously writable columns except the authoritative lifecycle/path
-- columns; existing service-only administrative routes remain compatible.
revoke update on public.members from authenticated;
do $column_grants$
declare columns_to_grant text;
begin
  select string_agg(quote_ident(column_name), ', ' order by ordinal_position) into columns_to_grant
  from information_schema.columns where table_schema = 'public' and table_name = 'members'
    and column_name not in ('renewal_due_on', 'current_membership_path_status', 'current_membership_case_id',
      'current_membership_closed_on', 'current_membership_closed_by_user_id', 'current_membership_closure_reason',
      'current_membership_appeal_id', 'membership_revision', 'lifecycle_status', 'member_type');
  execute 'grant update (' || columns_to_grant || ') on public.members to authenticated';
end;
$column_grants$;

create function public.reconcile_membership_lifecycle(
  p_effective_date date default (now() at time zone 'Asia/Dhaka')::date,
  p_batch_size integer default 500,
  p_member_id uuid default null
)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare person public.members%rowtype; transitioned integer := 0;
begin
  if p_effective_date is null or p_batch_size is null or p_batch_size not between 1 and 1000 then
    raise exception 'An effective date and batch size from 1 to 1000 are required.' using errcode = '22023';
  end if;
  for person in select * from public.members
    where lifecycle_status = 'current' and current_membership_path_status = 'open'
      and renewal_due_on is not null and joined_on is not null
      and (renewal_due_on + interval '6 months')::date <= p_effective_date
      and (p_member_id is null or id = p_member_id)
    order by renewal_due_on, id limit p_batch_size for update skip locked
  loop
    update public.members set lifecycle_status = 'former', lifecycle_changed_at = now(),
      lifecycle_changed_by_user_id = null, lifecycle_note = 'Annual renewal grace period ended.' where id = person.id;
    perform private.record_membership_transition(person.id, 'membership_expired', jsonb_build_object(
      'previousLifecycleStatus', person.lifecycle_status, 'lifecycleStatus', 'former',
      'dueOn', person.renewal_due_on, 'effectiveDate', p_effective_date, 'portalAccessStatus', person.portal_access_status));
    transitioned := transitioned + 1;
  end loop;
  return jsonb_build_object('status', 'reconciled', 'transitioned', transitioned);
end;
$function$;
revoke all on function public.reconcile_membership_lifecycle(date, integer, uuid) from public, anon, authenticated;
grant execute on function public.reconcile_membership_lifecycle(date, integer, uuid) to service_role;

create function public.confirm_membership_renewal(
  p_member_id uuid, p_expected_due_on date, p_resolution text,
  p_reference text default null, p_note text default null,
  p_effective_date date default (now() at time zone 'Asia/Dhaka')::date
)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  actor_id uuid := private.require_membership_operator();
  person public.members%rowtype; confirmed public.membership_renewals%rowtype;
  next_due date; next_lifecycle text;
begin
  if p_resolution is null or p_resolution not in ('paid', 'waived') or p_effective_date is null
    or p_effective_date > (now() at time zone 'Asia/Dhaka')::date
    or length(coalesce(p_note, '')) > 500 or length(coalesce(p_reference, '')) > 96
    or (nullif(btrim(p_reference), '') is not null and p_reference !~ '^[A-Za-z0-9._/-]+$') then
    raise exception 'Invalid confirmation date, resolution, safe reference, or note.' using errcode = '22023';
  end if;
  select * into person from public.members where id = p_member_id for update;
  if not found then raise exception 'Member not found.' using errcode = 'P0002'; end if;
  select * into confirmed from public.membership_renewals where member_id = person.id and due_on = p_expected_due_on;
  if found then
    if confirmed.resolution <> p_resolution then raise exception 'A different confirmation already exists.' using errcode = '40001'; end if;
    return jsonb_build_object('status', 'already_confirmed', 'nextDueOn', confirmed.next_due_on, 'lifecycleStatus', person.lifecycle_status);
  end if;
  if person.joined_on is null or person.renewal_due_on is null
     or person.current_membership_path_status <> 'open' or person.lifecycle_status not in ('current', 'former')
     or p_effective_date < person.joined_on then
    raise exception 'Membership is not eligible for renewal confirmation.' using errcode = '22023';
  end if;
  if person.renewal_due_on is distinct from p_expected_due_on then raise exception 'Renewal state changed; refresh before confirming.' using errcode = '40001'; end if;
  next_due := public.membership_anniversary(person.joined_on, extract(year from person.renewal_due_on)::integer + 1);
  next_lifecycle := case
    when next_due > p_effective_date then 'current'
    when person.lifecycle_status = 'former'
      or (person.renewal_due_on + interval '6 months')::date <= p_effective_date then 'former'
    else 'current' end;
  insert into public.membership_renewals(member_id, due_on, confirmed_on, resolution, next_due_on, reference, note, confirmed_by_user_id)
  values (person.id, person.renewal_due_on, p_effective_date, p_resolution, next_due, nullif(btrim(p_reference), ''), nullif(btrim(p_note), ''), actor_id);
  update public.members set renewal_due_on = next_due, lifecycle_status = next_lifecycle, member_type = 'current',
    lifecycle_changed_at = now(), lifecycle_changed_by_user_id = actor_id, lifecycle_note = 'Annual renewal confirmed.' where id = person.id;
  update public.profile_update_requests set status = 'approved', reviewed_at = now(), reviewed_by_user_id = actor_id,
    review_note = 'Administrator confirmed this anniversary.'
    where member_id = person.id and request_type = 'membership_renewal' and status = 'pending' and payload ->> 'dueOn' = person.renewal_due_on::text;
  perform private.record_membership_transition(person.id, 'renewal_confirmed', jsonb_build_object(
    'previousLifecycleStatus', person.lifecycle_status, 'lifecycleStatus', next_lifecycle, 'dueOn', person.renewal_due_on,
    'nextDueOn', next_due, 'resolution', p_resolution, 'effectiveDate', p_effective_date));
  return jsonb_build_object('status', 'confirmed', 'nextDueOn', next_due, 'lifecycleStatus', next_lifecycle);
end;
$function$;
revoke all on function public.confirm_membership_renewal(uuid, date, text, text, text, date) from public, anon, service_role;
grant execute on function public.confirm_membership_renewal(uuid, date, text, text, text, date) to authenticated;

create function public.request_membership_transition(
  p_action text, p_expected_revision bigint, p_confirmation text default null, p_note text default null
)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  actor_id uuid := auth.uid(); person public.members%rowtype;
  request public.profile_update_requests%rowtype; request_kind text; case_id uuid;
begin
  if actor_id is null then raise exception 'Authentication is required.' using errcode = '42501'; end if;
  if p_action is null or p_action not in ('renewal', 'departure', 'withdraw_departure', 'appeal', 'alumni')
    or length(coalesce(p_note, '')) > 500 then raise exception 'Invalid request or note.' using errcode = '22023'; end if;
  select * into person from public.members where user_id = actor_id for update;
  if not found or person.portal_access_status <> 'active' or person.lifecycle_status not in ('current', 'former') then
    raise exception 'Membership identity is not eligible.' using errcode = '42501';
  end if;
  if person.membership_revision is distinct from p_expected_revision then raise exception 'Membership state changed; refresh first.' using errcode = '40001'; end if;
  if p_action = 'withdraw_departure' then
    select * into request from public.profile_update_requests where id = person.current_membership_case_id and member_id = person.id for update;
    if person.current_membership_path_status <> 'departure_requested' or request.status is distinct from 'pending' then
      raise exception 'Only a pending departure can be withdrawn.' using errcode = '22023';
    end if;
    update public.profile_update_requests set status = 'rejected', review_note = 'Withdrawn by member.', reviewed_at = now(), reviewed_by_user_id = actor_id,
      payload = payload || jsonb_build_object('withdrawn', true) where id = request.id;
    update public.members set current_membership_path_status = 'open', current_membership_case_id = null where id = person.id;
    perform private.record_membership_transition(person.id, 'departure_withdrawn', jsonb_build_object('requestId', request.id, 'previousPathStatus', 'departure_requested', 'pathStatus', 'open'));
    return jsonb_build_object('status', 'withdrawn', 'requestId', request.id);
  end if;
  if p_action = 'renewal' then
    if person.current_membership_path_status <> 'open' or person.renewal_due_on is null then
      raise exception 'Renewal requests require an open membership path and a known joining date.' using errcode = '22023';
    end if;
    request_kind := 'membership_renewal';
  elsif p_action = 'departure' then
    if person.lifecycle_status <> 'former' or person.current_membership_path_status <> 'open' or p_confirmation is distinct from 'LEAVE JNUITS' then
      raise exception 'Confirm LEAVE JNUITS for an open former membership.' using errcode = '22023';
    end if;
    request_kind := 'membership_departure';
  elsif p_action = 'appeal' then
    if person.lifecycle_status <> 'former' or person.current_membership_path_status <> 'closed_appealable'
      or person.current_membership_case_id is null or person.current_membership_appeal_id is not null
      or nullif(btrim(p_note), '') is null then raise exception 'Only one reasoned appeal is allowed for this departure case.' using errcode = '22023'; end if;
    request_kind := 'membership_departure_appeal';
  else
    if person.lifecycle_status <> 'former' then raise exception 'This alumni request is for former members.' using errcode = '22023'; end if;
    request_kind := 'alumni_conversion';
  end if;
  select * into request from public.profile_update_requests where member_id = person.id and request_type = request_kind and status = 'pending'
    order by requested_at, id limit 1 for update;
  if found then return jsonb_build_object('status', 'already_requested', 'requestId', request.id); end if;
  case_id := person.current_membership_case_id;
  insert into public.profile_update_requests(member_id, request_type, payload)
  values (person.id, request_kind, jsonb_build_object('dueOn', person.renewal_due_on, 'caseId', case_id, 'note', nullif(btrim(p_note), ''), 'memberRevision', person.membership_revision)) returning * into request;
  if p_action = 'departure' then
    update public.members set current_membership_path_status = 'departure_requested', current_membership_case_id = request.id,
      current_membership_appeal_id = null where id = person.id;
  elsif p_action = 'appeal' then
    update public.members set current_membership_appeal_id = request.id where id = person.id;
  end if;
  perform private.record_membership_transition(person.id, 'membership_request_created', jsonb_build_object(
    'requestId', request.id, 'requestType', request_kind, 'caseId', case_id, 'previousPathStatus', person.current_membership_path_status));
  return jsonb_build_object('status', 'requested', 'requestId', request.id);
end;
$function$;
revoke all on function public.request_membership_transition(text, bigint, text, text) from public, anon, service_role;
grant execute on function public.request_membership_transition(text, bigint, text, text) to authenticated;

create function public.review_membership_request(
  p_request_id uuid, p_expected_updated_at timestamptz, p_decision text, p_note text
)
returns jsonb language plpgsql security definer set search_path = ''
as $function$
declare
  actor_id uuid := private.require_membership_operator(); person public.members%rowtype;
  request public.profile_update_requests%rowtype; target_member uuid; next_path text;
begin
  if p_decision is null or p_decision not in ('approved', 'rejected') or nullif(btrim(p_note), '') is null or length(p_note) > 500 then
    raise exception 'A decision and reason of at most 500 characters are required.' using errcode = '22023';
  end if;
  select member_id into target_member from public.profile_update_requests where id = p_request_id;
  if not found then raise exception 'Request not found.' using errcode = 'P0002'; end if;
  -- Same member-first order as request/confirmation avoids cross-flow deadlocks.
  select * into person from public.members where id = target_member for update;
  select * into request from public.profile_update_requests where id = p_request_id and member_id = person.id for update;
  if request.status <> 'pending' then
    if request.status = p_decision and not coalesce((request.payload ->> 'withdrawn')::boolean, false) then
      return jsonb_build_object('status', 'already_reviewed', 'requestId', request.id);
    end if;
    raise exception 'Request was already resolved.' using errcode = '40001';
  end if;
  if request.updated_at is distinct from p_expected_updated_at then raise exception 'Request changed; refresh before reviewing.' using errcode = '40001'; end if;
  next_path := person.current_membership_path_status;
  if request.request_type = 'membership_departure' then
    if person.current_membership_path_status <> 'departure_requested' or person.current_membership_case_id is distinct from request.id
      or person.lifecycle_status <> 'former' then raise exception 'Departure case is no longer pending.' using errcode = '22023'; end if;
    next_path := case when p_decision = 'approved' then 'closed_appealable' else 'open' end;
    update public.members set current_membership_path_status = next_path,
      current_membership_closed_on = case when p_decision = 'approved' then (now() at time zone 'Asia/Dhaka')::date else null end,
      current_membership_closed_by_user_id = case when p_decision = 'approved' then actor_id else null end,
      current_membership_closure_reason = case when p_decision = 'approved' then 'voluntary_departure' else null end where id = person.id;
  elsif request.request_type = 'membership_departure_appeal' then
    if person.current_membership_path_status <> 'closed_appealable' or person.current_membership_appeal_id is distinct from request.id
      or request.payload ->> 'caseId' is distinct from person.current_membership_case_id::text
      or person.lifecycle_status <> 'former' then raise exception 'Appeal does not match the open departure case.' using errcode = '22023'; end if;
    next_path := case when p_decision = 'approved' then 'open' else 'closed_final' end;
    update public.members set current_membership_path_status = next_path,
      current_membership_closure_reason = case when p_decision = 'approved' then null else 'departure_appeal_rejected' end,
      current_membership_closed_on = case when p_decision = 'approved' then null else (now() at time zone 'Asia/Dhaka')::date end,
      current_membership_closed_by_user_id = case when p_decision = 'approved' then null else actor_id end where id = person.id;
  elsif request.request_type = 'alumni_conversion' then
    if person.lifecycle_status <> 'former' then raise exception 'Former membership is required for this alumni transition.' using errcode = '22023'; end if;
    if p_decision = 'approved' then
      update public.members set lifecycle_status = 'alumni', member_type = 'alumni',
        alumni_since = coalesce(alumni_since, (now() at time zone 'Asia/Dhaka')::date),
        lifecycle_changed_at = now(), lifecycle_changed_by_user_id = actor_id where id = person.id;
      next_path := 'closed_final';
    end if;
  else raise exception 'This request type needs its dedicated review workflow.' using errcode = '22023';
  end if;
  update public.profile_update_requests set status = p_decision, reviewed_at = now(), review_note = btrim(p_note), reviewed_by_user_id = actor_id where id = request.id;
  perform private.record_membership_transition(person.id, 'membership_request_reviewed', jsonb_build_object(
    'requestId', request.id, 'requestType', request.request_type, 'decision', p_decision, 'reason', btrim(p_note),
    'previousPathStatus', person.current_membership_path_status, 'pathStatus', next_path, 'portalAccessStatus', person.portal_access_status));
  return jsonb_build_object('status', p_decision, 'requestId', request.id, 'pathStatus', next_path);
end;
$function$;
revoke all on function public.review_membership_request(uuid, timestamptz, text, text) from public, anon, service_role;
grant execute on function public.review_membership_request(uuid, timestamptz, text, text) to authenticated;

-- Supabase Cron runs in UTC. 18:05 UTC is 00:05 on the following Dhaka date.
create extension if not exists pg_cron;
do $schedule$
declare existing_job bigint;
begin
  for existing_job in select jobid from cron.job where jobname = 'jnuits-membership-anniversary' loop
    perform cron.unschedule(existing_job);
  end loop;
  perform cron.schedule('jnuits-membership-anniversary', '5 18 * * *',
    $job$select public.reconcile_membership_lifecycle((now() at time zone 'Asia/Dhaka')::date, 500, null);$job$);
end;
$schedule$;
commit;
