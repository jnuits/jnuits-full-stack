begin;
do $queue_contract$
declare result jsonb; index_no integer; person_id uuid; request_id uuid;
begin
  if not exists(select 1 from auth.users where email = 'replay-harness@local.invalid') then
    raise exception 'Refusing queue assertions outside the disposable replay.';
  end if;
  for index_no in 1..28 loop
    insert into public.members(jnuits_id, full_name) values ('JNUITS-20997' || lpad(index_no::text, 2, '0'), 'Fictional Queue Member') returning id into person_id;
  end loop;
  result := public.get_membership_admin_queue('unknown', 1, 25, '2026-10-01');
  if jsonb_array_length(result -> 'rows') <> 25 or (result ->> 'total')::integer < 28 then raise exception 'Queue is not bounded/paginated.'; end if;
  if result::text like '%verification_code%' or result::text like '%email%' or result::text like '%student_id%' then raise exception 'Queue leaks unrelated member fields.'; end if;
  result := public.get_membership_admin_queue('unknown', 2, 25, '2026-10-01');
  if jsonb_array_length(result -> 'rows') < 3 then raise exception 'Second queue page lost rows.'; end if;
  insert into public.members(jnuits_id, full_name, joined_on, portal_access_status)
    values ('JNUITS-2099791', 'Fictional Due Member', '2024-09-01', 'frozen') returning id into person_id;
  result := public.get_membership_admin_queue('overdue', 1, 25, '2026-10-01');
  if not exists(select 1 from jsonb_array_elements(result -> 'rows') entry where entry ->> 'memberId' = person_id::text
    and entry ->> 'overdueDays' = '395' and entry ->> 'portalAccessStatus' = 'frozen') then raise exception 'Queue overdue/security projection is wrong.'; end if;
  insert into public.profile_update_requests(member_id, request_type, payload)
    values (person_id, 'membership_renewal', jsonb_build_object('dueOn', '2025-09-01', 'note', 'Office verification requested.')) returning id into request_id;
  result := public.get_membership_admin_queue('renewal', 1, 25, '2026-10-01');
  if not exists(select 1 from jsonb_array_elements(result -> 'rows') entry where entry ->> 'requestId' = request_id::text
    and entry ->> 'requestUpdatedAt' is not null and entry ->> 'requestNote' = 'Office verification requested.') then raise exception 'Request queue lacks reviewed revision/note.'; end if;
  update public.profile_update_requests set status = 'approved' where id = request_id;
  result := public.get_membership_admin_queue('renewal', 1, 25, '2026-10-01');
  if exists(select 1 from jsonb_array_elements(result -> 'rows') entry where entry ->> 'requestId' = request_id::text) then raise exception 'Resolved request remained pending.'; end if;
  if has_function_privilege('anon', 'public.get_membership_admin_queue(text,integer,integer,date)', 'EXECUTE')
    or has_function_privilege('authenticated', 'public.get_membership_admin_queue(text,integer,integer,date)', 'EXECUTE')
    or not has_function_privilege('service_role', 'public.get_membership_admin_queue(text,integer,integer,date)', 'EXECUTE') then raise exception 'Queue browser privileges are unsafe.'; end if;
  begin perform public.get_membership_admin_queue('unknown', 0, 25, '2026-10-01'); raise exception 'Invalid page accepted.'; exception when invalid_parameter_value then null; end;
  begin perform public.get_membership_admin_queue('unknown', 1, 1001, '2026-10-01'); raise exception 'Unbounded page accepted.'; exception when invalid_parameter_value then null; end;
end;
$queue_contract$;
rollback;
