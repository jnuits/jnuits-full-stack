-- Run only inside the supported disposable bootstrap replay. Everything rolls back.
begin;
do $contract$
declare owner_id uuid := extensions.gen_random_uuid(); reviewer_id uuid; person_id uuid;
  request_id uuid; result jsonb; before_row jsonb;
begin
  select id into reviewer_id from auth.users where email = 'replay-harness@local.invalid';
  if reviewer_id is null then raise exception 'Disposable replay identity is required'; end if;
  insert into public.rbac_user_platform_roles(user_id,role_id,scope,note)
    select reviewer_id,id,'admin','Synthetic profile review fixture' from public.rbac_platform_roles where code='admin' and scope='admin' on conflict do nothing;
  insert into public.admin_profiles(user_id,admin_code,display_name,is_active,status)
    values(reviewer_id,'JNUITS-PROFILE-REVIEW-FIXTURE','Fictional profile reviewer',true,'active') on conflict(user_id) do update set is_active=true,status='active';
  if to_regprocedure('public.apply_member_self_profile_update(uuid,jsonb)') is null then
    raise exception 'Password-unlocked routine profile update contract is absent';
  end if;
  insert into auth.users(id,email) values(owner_id,'self-profile-contract@local.invalid');
  insert into public.members(jnuits_id,full_name,user_id,member_type,lifecycle_status,portal_access_status,phone,current_organization)
    values('JnUITS-2099962','Fictional Self-service Alumni',owner_id,'alumni','alumni','active','old','Original Workplace') returning id into person_id;
  foreach result in array array['{"fullName":"Forged"}'::jsonb, '{"departmentCode":"cse"}', '{"studentId":"1"}', '{"batchNo":1}', '{"graduationYear":2027}', '{"email":"forged@local.invalid"}', '{"jnuitsId":"JnUITS-2099963"}', '{"portalAccessStatus":"active"}'] loop
    begin
      perform public.apply_member_self_profile_update(owner_id,result || '{"phone":"new"}'::jsonb);
      raise exception 'Protected key was accepted';
    exception when invalid_parameter_value then null; end;
  end loop;
  insert into public.profile_update_requests(member_id,request_type,status,payload,metadata,requested_at)
    values(person_id,'workplace_update','pending','{"currentOrganization":"Older Requested Workplace"}','[]',clock_timestamp()+interval '10 years') returning id into request_id;
  result := public.apply_member_self_profile_update(owner_id,'{"currentOrganization":"New Direct Workplace","phone":""}');
  if result->>'id' <> person_id::text or (select phone is not null or current_organization <> 'New Direct Workplace' or full_name <> 'Fictional Self-service Alumni' from public.members where id=person_id) then
    raise exception 'Routine update changed identity or failed to clear/persist fields';
  end if;
  begin
    perform public.review_member_profile_update(request_id,reviewer_id,'approved','');
    raise exception 'Stale review overwrote the newer direct edit';
  exception when sqlstate 'PT409' then null; end;
  if (select status from public.profile_update_requests where id=request_id) <> 'pending' then raise exception 'Stale request was automatically decided'; end if;
  perform public.review_member_profile_update(request_id,reviewer_id,'rejected','Superseded by direct edit');
  if (select status from public.profile_update_requests where id=request_id) <> 'rejected' then raise exception 'Old request cannot be rejected'; end if;
  insert into public.profile_update_requests(member_id,request_type,status,payload,requested_at)
    values(person_id,'profile_change','pending','{"fullName":"Approved Academic Identity","studentId":"ST-123","batchNo":18,"graduationYear":2027,"phone":"","websiteUrl":null}',clock_timestamp()) returning id into request_id;
  begin
    perform public.review_member_profile_update(request_id,owner_id,'approved','');
    raise exception 'Ordinary member could review a request';
  exception when insufficient_privilege then null; end;
  perform public.review_member_profile_update(request_id,reviewer_id,'approved','Verified academic identity');
  if not exists(select 1 from public.members where id=person_id and full_name='Approved Academic Identity' and student_id='ST-123' and batch_no=18 and graduation_year=2027 and current_organization='New Direct Workplace') then raise exception 'Academic approval failed or overwrote routine data'; end if;
  begin
    perform public.review_member_profile_update(request_id,reviewer_id,'rejected','Second decision');
    raise exception 'Already reviewed request accepted a second decision';
  exception when invalid_parameter_value then null; end;
  foreach result in array array['{"fullName":"Reviewed Name","batchNo":"18"}'::jsonb, '{"graduationYear":"2027"}', '{"fullName":123}', '{"batchNo":18.5}', '{"graduationYear":2200}'] loop
    insert into public.profile_update_requests(member_id,request_type,status,payload) values(person_id,'profile_change','pending',result) returning id into request_id;
    begin
      perform public.review_member_profile_update(request_id,reviewer_id,'approved','');
      raise exception 'Hidden or out-of-range academic data was approved';
    exception when invalid_parameter_value then null; end;
    perform public.review_member_profile_update(request_id,reviewer_id,'rejected','Invalid stored payload');
  end loop;
  insert into public.profile_update_requests(member_id,request_type,status,payload) values(person_id,'workplace_update','pending','{"designation":"Cancelled fixture"}') returning id into request_id;
  begin
    perform public.cancel_member_workplace_update(request_id,reviewer_id);
    raise exception 'Another user could cancel the request';
  exception when insufficient_privilege then null; end;
  perform public.cancel_member_workplace_update(request_id,owner_id);
  begin
    perform public.review_member_profile_update(request_id,reviewer_id,'approved','');
    raise exception 'Cancelled request could be approved';
  exception when invalid_parameter_value then null; end;
  insert into public.profile_update_requests(member_id,request_type,status,payload) values(person_id,'workplace_update','pending','{"designation":"Approved fixture"}') returning id into request_id;
  perform public.review_member_profile_update(request_id,reviewer_id,'approved','');
  begin
    perform public.cancel_member_workplace_update(request_id,owner_id);
    raise exception 'Approved request could be cancelled';
  exception when invalid_parameter_value then null; end;
  update public.members set portal_access_status='frozen' where id=person_id;
  select to_jsonb(m) into before_row from public.members m where id=person_id;
  begin
    perform public.apply_member_self_profile_update(owner_id,'{"phone":"blocked"}');
    raise exception 'Frozen account could self-edit';
  exception when insufficient_privilege then null; end;
  if (select to_jsonb(m) from public.members m where id=person_id) <> before_row then raise exception 'Denied edit mutated the profile'; end if;
  if not exists(select 1 from public.membership_lifecycle_events where member_id=person_id and event_type='profile_direct_edit') then raise exception 'Direct edit lost its audit trail'; end if;
  if has_function_privilege('anon','public.cancel_member_workplace_update(uuid,uuid)','execute') or has_function_privilege('authenticated','public.cancel_member_workplace_update(uuid,uuid)','execute') or not has_function_privilege('service_role','public.cancel_member_workplace_update(uuid,uuid)','execute')
    or has_function_privilege('anon','public.apply_member_self_profile_update(uuid,jsonb)','execute')
    or has_function_privilege('authenticated','public.apply_member_self_profile_update(uuid,jsonb)','execute')
    or has_function_privilege('authenticated','public.review_member_profile_update(uuid,uuid,text,text)','execute')
    or has_function_privilege('anon','public.review_member_profile_update(uuid,uuid,text,text)','execute')
    or not has_function_privilege('service_role','public.apply_member_self_profile_update(uuid,jsonb)','execute')
    or not has_function_privilege('service_role','public.review_member_profile_update(uuid,uuid,text,text)','execute') then raise exception 'Profile RPC execution privileges are unsafe'; end if;
end;
$contract$;
rollback;
