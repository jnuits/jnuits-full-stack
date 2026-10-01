-- Synthetic disposable replay only; no production/member data is persisted.
begin;
do $snapshot_contract$
declare actor_id uuid; person_id uuid; result jsonb;
begin
  select id into actor_id from auth.users where email = 'replay-harness@local.invalid';
  if actor_id is null or current_database() <> 'postgres' then
    raise exception 'Refusing membership snapshot assertions outside disposable replay.';
  end if;
  insert into public.members(jnuits_id, full_name, joined_on, current_organization)
  values ('JNUITS-2099961', 'Fictional Snapshot Member', '2024-08-31', 'PRIVATE WORKPLACE') returning id into person_id;
  result := public.get_member_membership_state(person_id);
  if result ->> 'renewalDueOn' <> '2025-08-31' or result ->> 'graceEndsOn' <> '2026-02-28'
     or result ->> 'memberId' <> person_id::text or result ->> 'currentMembershipPathStatus' <> 'open'
     or result ->> 'renewalState' <> public.membership_renewal_state('2025-08-31', 'current', (now() at time zone 'Asia/Dhaka')::date) then
    raise exception 'Snapshot does not use authoritative PostgreSQL dates and state.';
  end if;
  if result ?| array['email', 'phone', 'student_id', 'verification_code_hash', 'current_organization', 'review_note', 'reference']
     or result::text like '%PRIVATE WORKPLACE%' then raise exception 'Snapshot exposes unrelated private fields.'; end if;
  if has_function_privilege('authenticated', 'public.get_member_membership_state(uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.get_member_membership_state(uuid)', 'EXECUTE')
     or not has_function_privilege('service_role', 'public.get_member_membership_state(uuid)', 'EXECUTE') then
    raise exception 'Snapshot is not restricted to the server service role.';
  end if;
  if public.get_member_membership_state(extensions.gen_random_uuid()) is not null then
    raise exception 'Missing identity fabricated a snapshot.';
  end if;
end;
$snapshot_contract$;
rollback;
