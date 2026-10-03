-- Disposable replay only. Real per-row review transactions, no batch-only
-- lifecycle writer, no fee confirmation and no security-access mutation.
begin;
do $bulk$
declare
  actor_id uuid; role_id uuid; sid uuid:=extensions.gen_random_uuid(); person_id uuid;
  people uuid[]:='{}'; requests uuid[]:='{}'; snapshots timestamptz[]:='{}';
  request_id uuid; snapshot timestamptz; result jsonb; i integer; audit_count integer;
  fee_request uuid; case_id uuid; appeal_id uuid;
begin
  select id into actor_id from auth.users where email='replay-harness@local.invalid';
  if actor_id is null then raise exception 'Disposable identity required'; end if;
  update public.security_settings set admin_totp_enforced=false where id;
  select id into role_id from public.rbac_platform_roles where code='admin' and scope='admin';
  insert into public.rbac_user_platform_roles(user_id,role_id,scope,note)
    values(actor_id,role_id,'admin','Bulk review fixture');
  insert into public.admin_profiles(user_id,admin_code,display_name,is_active,status)
    values(actor_id,'JNUITS-ADMIN-BULK-FIXTURE','Fictional operator',true,'active')
    on conflict(user_id) do update set is_active=true,status='active';
  insert into auth.sessions(id,user_id,aal,created_at,updated_at) values(sid,actor_id,'aal1',now(),now());
  perform set_config('request.jwt.claim.sub',actor_id::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',actor_id,'role','authenticated','aal','aal1',
    'session_id',sid,'jnuits_role_version',(select version from public.rbac_user_claim_versions where user_id=actor_id))::text,true);
  for i in 1..6 loop
    insert into public.members(jnuits_id,full_name,joined_on,lifecycle_status,portal_access_status)
      values('JNUITS-209986'||i,'Fictional bulk member '||i,'2023-01-01','former','frozen') returning id into person_id;
    people:=array_append(people,person_id);
    insert into public.profile_update_requests(member_id,request_type,payload,updated_at)
      values(person_id,'alumni_conversion','{}',now()-interval '1 day') returning id,updated_at into request_id,snapshot;
    requests:=array_append(requests,request_id); snapshots:=array_append(snapshots,snapshot);
  end loop;
  -- A type changed after the application's authoritative preflight must still
  -- fail the exact timestamp check, not enter a different transition.
  update public.profile_update_requests set request_type='membership_renewal' where id=requests[2];
  update public.profile_update_requests set status='rejected',payload='{"withdrawn":true}' where id=requests[4];
  insert into public.profile_update_requests(member_id,request_type,payload)
    values(people[1],'membership_renewal','{"dueOn":"2024-01-01"}') returning id into fee_request;
  execute 'set local role authenticated';
  result:=public.review_membership_request(requests[1],snapshots[1],'approved','Eligibility reviewed.');
  if result->>'status'<>'approved' then raise exception 'First approval failed'; end if;
  begin
    perform public.review_membership_request(requests[2],snapshots[2],'approved','Eligibility reviewed.');
    raise exception 'Changed request was approved';
  exception when sqlstate '40001' then null; end;
  result:=public.review_membership_request(requests[3],snapshots[3],'approved','Eligibility reviewed.');
  if result->>'status'<>'approved' then raise exception 'Valid later row lost to partial failure'; end if;
  begin
    perform public.review_membership_request(requests[4],snapshots[4],'approved','Eligibility reviewed.');
    raise exception 'Withdrawn/rejected request inverted';
  exception when sqlstate '40001' then null; end;
  begin
    perform public.review_membership_request(requests[5],snapshots[5],'approved',' ');
    raise exception 'Empty review note accepted';
  exception when sqlstate '22023' then null; end;
  execute 'reset role';
  select count(*) into audit_count from public.audit_events where action='membership.membership_request_reviewed'
    and metadata->>'requestId' in (requests[1]::text,requests[3]::text);
  if audit_count<>2 or (select count(*) from public.membership_lifecycle_events where event_type='membership_request_reviewed'
      and member_id=any(people))<>2 then raise exception 'Approvals did not have separate audit records'; end if;
  execute 'set local role authenticated';
  result:=public.review_membership_request(requests[1],snapshots[1],'approved','Retry after interrupted response.');
  if result->>'status'<>'already_reviewed' then raise exception 'Retry not idempotent'; end if;
  execute 'reset role';
  if (select count(*) from public.audit_events where action='membership.membership_request_reviewed'
      and metadata->>'requestId' in (requests[1]::text,requests[3]::text))<>audit_count then raise exception 'Retry duplicated audit/transition'; end if;
  if (select status from public.profile_update_requests where id=fee_request)<>'pending'
    or exists(select 1 from public.membership_renewals where member_id=any(people))
    or exists(select 1 from public.members where id=any(people) and portal_access_status<>'frozen') then
    raise exception 'Bulk reviews confirmed fees or lifted security freeze';
  end if;
  -- Both remaining supported queues still use the same reviewed transitions.
  update public.profile_update_requests set request_type='membership_departure' where id=requests[5];
  update public.members set current_membership_path_status='departure_requested',current_membership_case_id=requests[5] where id=people[5];
  select updated_at into snapshot from public.profile_update_requests where id=requests[5];
  execute 'set local role authenticated';
  perform public.review_membership_request(requests[5],snapshot,'approved','Departure reviewed.');
  execute 'reset role';
  update public.profile_update_requests set status='approved',request_type='membership_departure' where id=requests[6];
  case_id:=requests[6];
  insert into public.profile_update_requests(member_id,request_type,payload)
    values(people[6],'membership_departure_appeal',jsonb_build_object('caseId',case_id)) returning id,updated_at into appeal_id,snapshot;
  update public.members set current_membership_path_status='closed_appealable',current_membership_case_id=case_id,current_membership_appeal_id=appeal_id where id=people[6];
  execute 'set local role authenticated';
  perform public.review_membership_request(appeal_id,snapshot,'approved','Appeal reviewed.');
  execute 'reset role';
  if (select current_membership_path_status from public.members where id=people[5])<>'closed_appealable'
    or (select current_membership_path_status from public.members where id=people[6])<>'open'
    or exists(select 1 from public.members where id=any(people) and portal_access_status<>'frozen')
    or exists(select 1 from public.membership_renewals where member_id=any(people)) then raise exception 'Departure/appeal changed fees or independent restrictions'; end if;
  -- Mandatory policy and live administrator eligibility are not bypassed by
  -- routine/bulk entry points, even with an existing AAL1 access token.
  select updated_at into snapshot from public.profile_update_requests where id=requests[2];
  update public.security_settings set admin_totp_enforced=true where id;
  execute 'set local role authenticated';
  begin
    perform public.review_membership_request(requests[2],snapshot,'approved','Mandatory MFA denial.');
    raise exception 'Mandatory policy bypassed';
  exception when insufficient_privilege then null; end;
  execute 'reset role';
  update public.security_settings set admin_totp_enforced=false where id;
  update public.admin_profiles set is_active=false where user_id=actor_id;
  execute 'set local role authenticated';
  begin
    perform public.review_membership_request(requests[2],snapshot,'approved','Inactive actor denial.');
    raise exception 'Inactive administrator approved';
  exception when insufficient_privilege then null; end;
  execute 'reset role';
  raise notice 'MEMBERSHIP BULK REVIEW ASSERTIONS PASSED';
end
$bulk$;
rollback;
