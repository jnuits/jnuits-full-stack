-- Disposable replay only. Synthetic fixtures and every mutation roll back.
begin;
do $membership_contract$
declare
  actor_id uuid;
  role_id uuid;
  person_id uuid;
  unknown_id uuid;
  stale_current_id uuid;
  request_id uuid;
  request_version timestamptz;
  revision bigint;
  result jsonb;
  state text;
  security text;
  event_count integer;
  old_due date;
  expected date;
  year_value integer;
  type_value text;
  next_request_id uuid;
  definition record;
begin
  select id into actor_id from auth.users where email = 'replay-harness@local.invalid';
  if current_database() <> 'postgres' or actor_id is null then
    raise exception 'Refusing lifecycle assertions outside the disposable replay stack.';
  end if;
  if public.membership_anniversary('2024-02-29', 2025) <> date '2025-02-28'
     or public.membership_anniversary('2024-02-29', 2028) <> date '2028-02-29'
     or public.membership_anniversary('2024-12-31', 2025) <> date '2025-12-31' then
    raise exception 'Original joining-day anniversary is not preserved.';
  end if;
  if public.membership_renewal_state('2025-07-01', 'current', '2025-06-30') <> 'paid'
     or public.membership_renewal_state('2025-07-01', 'current', '2025-07-01') <> 'grace'
     or public.membership_renewal_state('2025-07-01', 'current', '2025-12-31') <> 'grace'
     or public.membership_renewal_state('2025-07-01', 'current', '2026-01-01') <> 'former'
     or public.membership_renewal_state(null, 'current', '2026-01-01') <> 'unknown'
     or public.membership_renewal_state('2025-07-01', 'alumni', '2026-01-01') <> 'not_applicable' then
    raise exception 'Exact due/grace boundaries are incorrect.';
  end if;
  if public.membership_renewal_state('2025-08-31', 'current', '2026-02-28') <> 'former' then
    raise exception 'Six-calendar-month end-of-month boundary is incorrect.';
  end if;
  if has_table_privilege('authenticated', 'public.membership_renewals', 'INSERT')
     or has_table_privilege('authenticated', 'public.membership_renewals', 'UPDATE')
     or has_table_privilege('anon', 'public.membership_renewals', 'SELECT')
     or not (select relrowsecurity from pg_class where oid = 'public.membership_renewals'::regclass)
     or has_function_privilege('authenticated', 'public.reconcile_membership_lifecycle(date,integer,uuid)', 'EXECUTE')
     or has_function_privilege('anon', 'public.confirm_membership_renewal(uuid,date,text,text,text,date)', 'EXECUTE') then
    raise exception 'Lifecycle ledger/RPC privileges are unsafe.';
  end if;
  for definition in
    select p.proname, p.prosecdef, p.proconfig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in ('confirm_membership_renewal', 'request_membership_transition', 'review_membership_request', 'reconcile_membership_lifecycle')
  loop
    if not definition.prosecdef or not ('search_path=""' = any(definition.proconfig)) then
      raise exception 'Unsafe function configuration: %.', definition.proname;
    end if;
  end loop;
  if (select count(*) from cron.job where jobname = 'jnuits-membership-anniversary') <> 1 then
    raise exception 'Expected exactly one named renewal Cron job.';
  end if;
  if has_column_privilege('authenticated', 'public.members', 'renewal_due_on', 'UPDATE')
     or has_column_privilege('authenticated', 'public.members', 'current_membership_path_status', 'UPDATE')
     or has_column_privilege('authenticated', 'public.members', 'lifecycle_status', 'UPDATE') then
    raise exception 'Browser table grants bypass authoritative transitions.';
  end if;
  select id into role_id from public.rbac_platform_roles where code = 'admin' and scope = 'admin';
  insert into public.rbac_user_platform_roles (user_id, role_id, scope, note)
  values (actor_id, role_id, 'admin', 'anniversary replay fixture');
  insert into public.admin_profiles (user_id, admin_code, display_name, is_active, status)
  values (actor_id, 'JNUITS-ADMIN-REPLAY-RENEWAL', 'Fictional replay operator', true, 'active')
  on conflict (user_id) do update set is_active = true, status = 'active';
  perform set_config('request.jwt.claim.sub', actor_id::text, true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub', actor_id, 'aal', 'aal2', 'role', 'authenticated')::text, true);
  insert into public.members (jnuits_id, full_name, user_id, joined_on, portal_access_status)
  values ('JNUITS-2099901', 'Fictional Anniversary Member', actor_id, '2024-07-01', 'frozen') returning id into person_id;
  insert into public.members (jnuits_id, full_name) values ('JNUITS-2099902', 'Unknown Joining Date') returning id into unknown_id;
  if (select renewal_due_on from public.members where id = person_id) <> date '2025-07-01'
     or (select renewal_due_on from public.members where id = unknown_id) is not null then
    raise exception 'Initial deadline fabricated or not initialized from joining date.';
  end if;
  for type_value in select unnest(array['workplace_update', 'profile_change', 'email_change', 'jnuits_id_change', 'alumni_conversion', 'account_deletion']) loop
    insert into public.profile_update_requests(member_id, request_type) values (unknown_id, type_value);
  end loop;
  begin
    perform public.reconcile_membership_lifecycle('2026-01-01', 1001, person_id);
    raise exception 'Unbounded reconciliation accepted.';
  exception when sqlstate '22023' then null; end;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', actor_id, 'aal', 'aal1', 'role', 'authenticated')::text, true);
  begin
    perform public.confirm_membership_renewal(person_id, '2025-07-01', 'paid', null, null, '2026-10-01');
    raise exception 'Operator without MFA confirmed renewal.';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claims', jsonb_build_object('sub', actor_id, 'aal', 'aal2', 'role', 'authenticated')::text, true);
  update public.admin_profiles set status = 'frozen' where user_id = actor_id;
  begin
    perform public.confirm_membership_renewal(person_id, '2025-07-01', 'paid', null, null, '2026-10-01');
    raise exception 'Frozen operator confirmed renewal.';
  exception when insufficient_privilege then null; end;
  update public.admin_profiles set status = 'active' where user_id = actor_id;
  perform public.reconcile_membership_lifecycle('2025-12-31', 10, person_id);
  if (select lifecycle_status from public.members where id = person_id) <> 'current' then raise exception 'Grace changed lifecycle prematurely.'; end if;
  perform public.reconcile_membership_lifecycle('2026-01-01', 10, person_id);
  perform public.reconcile_membership_lifecycle('2026-01-01', 10, person_id);
  if (select lifecycle_status from public.members where id = person_id) <> 'former'
     or (select portal_access_status from public.members where id = person_id) <> 'frozen'
     or (select count(*) from public.membership_lifecycle_events where member_id = person_id and event_type = 'membership_expired') <> 1 then
    raise exception 'Reconciliation is not idempotent or changes security.';
  end if;
  result := public.confirm_membership_renewal(person_id, '2025-07-01', 'paid', 'REPLAY-1', 'Synthetic confirmation', '2026-10-01');
  if result ->> 'nextDueOn' <> '2026-07-01' or result ->> 'lifecycleStatus' <> 'former' then raise exception 'One-period catch-up incorrectly reactivated membership.'; end if;
  result := public.confirm_membership_renewal(person_id, '2025-07-01', 'paid', 'REPLAY-1', 'Synthetic confirmation', '2026-10-01');
  if result ->> 'status' <> 'already_confirmed' or (select count(*) from public.membership_renewals where member_id = person_id) <> 1 then raise exception 'Confirmation retry duplicates ledger.'; end if;
  result := public.confirm_membership_renewal(person_id, '2026-07-01', 'waived', null, 'Synthetic waiver', '2026-10-01');
  if result ->> 'nextDueOn' <> '2027-07-01' or result ->> 'lifecycleStatus' <> 'current'
     or (select portal_access_status from public.members where id = person_id) <> 'frozen' then raise exception 'Paid-through reactivation changes security or fails.'; end if;
  begin
    perform public.confirm_membership_renewal(unknown_id, '2025-07-01', 'paid', null, null, '2026-10-01');
    raise exception 'Unknown joining date accepted.';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.confirm_membership_renewal(person_id, '2024-07-01', 'paid', null, null, '2026-10-01');
    raise exception 'Stale due date accepted.';
  exception when sqlstate '40001' then null; end;
  begin
    update public.members set joined_on = '2023-07-01' where id = person_id;
    raise exception 'Joining-date rewrite silently invalidated renewal history.';
  exception when sqlstate '22023' then null; end;
  begin
    insert into public.membership_renewals(member_id, due_on, confirmed_on, resolution, next_due_on)
    values (person_id, '2025-07-01', '2026-10-01', 'paid', '2026-07-01');
    raise exception 'Duplicate anniversary ledger accepted.';
  exception when unique_violation then null; end;
  select membership_revision into revision from public.members where id = person_id;
  begin
    perform public.request_membership_transition('departure', revision, 'LEAVE JNUITS', null);
    raise exception 'Frozen member created a departure case.';
  exception when insufficient_privilege then null; end;
  -- Confirmation must be safe even if Cron has not yet reconciled a stale
  -- current row. Partial catch-up must not preserve its stale mutable status.
  insert into public.members(jnuits_id, full_name, joined_on)
  values ('JNUITS-2099904', 'Fictional Stale Current Member', '2024-01-01') returning id into stale_current_id;
  result := public.confirm_membership_renewal(stale_current_id, '2025-01-01', 'paid', null, 'Partial catch-up', '2026-10-01');
  if result ->> 'lifecycleStatus' <> 'former' then raise exception 'Partial renewal preserved stale current access.'; end if;
  -- Use a former active identity for departure. Normal members must never confirm payments.
  update public.members set lifecycle_status = 'former', portal_access_status = 'active' where id = person_id;
  delete from public.rbac_user_platform_roles where user_id = actor_id and note = 'anniversary replay fixture';
  begin
    perform public.confirm_membership_renewal(person_id, '2027-07-01', 'paid', null, null, '2026-10-01');
    raise exception 'Unprivileged member confirmed renewal.';
  exception when insufficient_privilege then null; end;
  select membership_revision into revision from public.members where id = person_id;
  begin
    perform public.request_membership_transition('departure', revision, 'YES', null);
    raise exception 'Weak departure confirmation accepted.';
  exception when sqlstate '22023' then null; end;
  begin
    perform public.request_membership_transition('departure', revision - 1, 'LEAVE JNUITS', null);
    raise exception 'Stale member revision accepted.';
  exception when sqlstate '40001' then null; end;
  result := public.request_membership_transition('departure', revision, 'LEAVE JNUITS', 'Synthetic departure');
  request_id := (result ->> 'requestId')::uuid;
  if (select current_membership_path_status from public.members where id = person_id) <> 'departure_requested' then raise exception 'Departure request did not lock current path.'; end if;
  select membership_revision into revision from public.members where id = person_id;
  begin
    perform public.request_membership_transition('renewal', revision, null, null);
    raise exception 'Pending departure allows renewal request.';
  exception when sqlstate '22023' then null; end;
  perform public.request_membership_transition('withdraw_departure', revision, null, null);
  if (select current_membership_path_status from public.members where id = person_id) <> 'open' then raise exception 'Withdrawal did not restore open path.'; end if;
  select membership_revision into revision from public.members where id = person_id;
  result := public.request_membership_transition('departure', revision, 'LEAVE JNUITS', null);
  request_id := (result ->> 'requestId')::uuid;
  select updated_at into request_version from public.profile_update_requests where id = request_id;
  insert into public.rbac_user_platform_roles (user_id, role_id, scope, note) values (actor_id, role_id, 'admin', 'anniversary replay fixture');
  perform public.review_membership_request(request_id, request_version, 'approved', 'Synthetic approval');
  if (select current_membership_path_status from public.members where id = person_id) <> 'closed_appealable' then raise exception 'Approval did not allow one appeal.'; end if;
  begin
    perform public.confirm_membership_renewal(person_id, '2027-07-01', 'paid', null, null, '2026-10-01');
    raise exception 'Closed path accepted renewal.';
  exception when sqlstate '22023' then null; end;
  select membership_revision into revision from public.members where id = person_id;
  result := public.request_membership_transition('appeal', revision, null, 'I selected leave by mistake.');
  request_id := (result ->> 'requestId')::uuid;
  select updated_at into request_version from public.profile_update_requests where id = request_id;
  begin
    perform public.review_membership_request(request_id, request_version - interval '1 second', 'approved', 'Stale approval');
    raise exception 'Stale request version accepted.';
  exception when sqlstate '40001' then null; end;
  perform public.review_membership_request(request_id, request_version, 'rejected', 'Synthetic final decision');
  if (select current_membership_path_status from public.members where id = person_id) <> 'closed_final' then raise exception 'Rejected appeal did not close current path permanently.'; end if;
  select membership_revision into revision from public.members where id = person_id;
  begin
    perform public.request_membership_transition('appeal', revision, null, 'Second appeal');
    raise exception 'Second appeal accepted.';
  exception when sqlstate '22023' then null; end;
  result := public.request_membership_transition('alumni', revision, null, 'Synthetic alumni request');
  request_id := (result ->> 'requestId')::uuid;
  select updated_at into request_version from public.profile_update_requests where id = request_id;
  perform public.review_membership_request(request_id, request_version, 'approved', 'Synthetic alumni approval');
  if (select lifecycle_status from public.members where id = person_id) <> 'alumni'
     or (select current_membership_closure_reason from public.members where id = person_id) <> 'alumni_conversion'
     or (select portal_access_status from public.members where id = person_id) <> 'active' then raise exception 'Final closure removed alumni eligibility or altered security.'; end if;
  -- An accepted appeal restores only the path, not unpaid current membership.
  update public.members set lifecycle_status = 'former', member_type = 'current', current_membership_path_status = 'open',
    current_membership_case_id = null, current_membership_appeal_id = null, current_membership_closure_reason = null where id = person_id;
  select membership_revision into revision from public.members where id = person_id;
  result := public.request_membership_transition('departure', revision, 'LEAVE JNUITS', null);
  next_request_id := (result ->> 'requestId')::uuid;
  select updated_at into request_version from public.profile_update_requests where id = next_request_id;
  perform public.review_membership_request(next_request_id, request_version, 'approved', 'Second synthetic case');
  select membership_revision into revision from public.members where id = person_id;
  result := public.request_membership_transition('appeal', revision, null, 'Accidental departure');
  next_request_id := (result ->> 'requestId')::uuid;
  select updated_at into request_version from public.profile_update_requests where id = next_request_id;
  perform public.review_membership_request(next_request_id, request_version, 'approved', 'Appeal accepted');
  if (select current_membership_path_status from public.members where id = person_id) <> 'open'
     or (select lifecycle_status from public.members where id = person_id) <> 'former' then raise exception 'Appeal approval reactivated unpaid membership.'; end if;
  -- Even a legacy service action cannot reactivate security during conversion.
  update public.members set portal_access_status = 'suspended' where id = person_id;
  update public.members set lifecycle_status = 'alumni', member_type = 'alumni', portal_access_status = 'active' where id = person_id;
  if (select portal_access_status from public.members where id = person_id) <> 'suspended' then raise exception 'Alumni approval bypassed security.'; end if;
  -- Original leap joining date must be recovered after several non-leap renewals.
  insert into public.members (jnuits_id, full_name, joined_on) values ('JNUITS-2099903', 'Fictional Leap Member', '2024-02-29') returning id into unknown_id;
  for year_value in 2025..2027 loop
    old_due := make_date(year_value, 2, 28);
    result := public.confirm_membership_renewal(unknown_id, old_due, 'waived', null, 'Leap fixture', '2026-10-01');
  end loop;
  if result ->> 'nextDueOn' <> '2028-02-29' then raise exception 'Leap anniversary was lost during renewal advancement.'; end if;
  select count(*) into event_count from public.membership_lifecycle_events where member_id = person_id;
  perform public.reconcile_membership_lifecycle('2026-10-01', 10, person_id);
  if (select count(*) from public.membership_lifecycle_events where member_id = person_id) <> event_count then raise exception 'Alumni was reconciled again.'; end if;
  raise notice 'MEMBERSHIP ANNIVERSARY CONTRACTS PASSED';
end
$membership_contract$;
rollback;
