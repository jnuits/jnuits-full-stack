-- Disposable replay only: fictional users, rollback-only mutations.
begin;
do $contract$
declare
  u uuid; sid uuid:=extensions.gen_random_uuid(); v bigint; rid uuid;
  mid uuid; req uuid; stamp timestamptz; result jsonb;
  actor jsonb; payload jsonb; prepared jsonb; proof_id uuid; challenge_id uuid:=extensions.gen_random_uuid();
  token text:=repeat('x',43); proof text; digest text;
begin
  select id into u from auth.users where email='replay-harness@local.invalid';
  if u is null then raise exception 'Disposable replay identity required'; end if;
  update public.security_settings set admin_totp_enforced=false where id;
  select id into rid from public.rbac_platform_roles where scope='admin' and code='admin';
  insert into public.rbac_user_platform_roles(user_id,role_id,scope,note) values(u,rid,'admin','Operation fixture') on conflict do nothing;
  insert into public.admin_profiles(user_id,admin_code,display_name,status,is_active)
    values(u,'JNUITS-ADMIN-OP-FIXTURE','Fictional operator','active',true)
    on conflict(user_id) do update set status='active',is_active=true;
  select version into v from public.rbac_user_claim_versions where user_id=u;
  insert into auth.sessions(id,user_id,aal,created_at,updated_at) values(sid,u,'aal1',now(),now());
  perform set_config('request.jwt.claim.sub',u::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','aal','aal1','session_id',sid,'jnuits_role_version',v)::text,true);
  insert into public.members(jnuits_id,full_name,joined_on,lifecycle_status,portal_access_status)
    values('JNUITS-2099980','Fictional request member',date '2023-01-01','former','frozen') returning id into mid;
  insert into public.profile_update_requests(member_id,request_type,payload,status)
    values(mid,'alumni_conversion','{}','pending') returning id,updated_at into req,stamp;
  execute 'set local role authenticated';
  result:=public.review_membership_request(req,stamp,'approved','Fictional reviewed request');
  execute 'reset role';
  if result->>'status'<>'approved' or (select lifecycle_status from public.members where id=mid)<>'alumni'
    or (select portal_access_status from public.members where id=mid)<>'frozen' then
    raise exception 'Routine AAL1 review failed or changed independent freeze: %',result;
  end if;
  -- Mandatory entry policy remains effective even for routine review.
  update public.security_settings set admin_totp_enforced=true where id;
  begin
    perform public.review_membership_request(req,stamp,'approved','Fictional retry');
    raise exception 'Mandatory-on AAL1 routine review succeeded';
  exception when insufficient_privilege then null; end;
  -- A developed email challenge grants only its exact one-time renewal.
  update public.security_settings set admin_totp_enforced=false where id;
  update auth.users set created_at=clock_timestamp(),email_confirmed_at=now() where id=u;
  perform public.admin_verification_record_enrollment(jsonb_build_object('userId',u,'evidence','trusted_never_history'));
  actor:=(public.admin_verification_context(jsonb_build_object('userId',u,'sessionId',sid,'roleVersion',v,'currentLevel','aal1')))->'value';
  insert into public.members(jnuits_id,full_name,joined_on,lifecycle_status,portal_access_status)
    values('JNUITS-2099981','Fictional renewal member',date '2024-01-01','former','frozen') returning id into mid;
  payload:=jsonb_build_object('memberId',mid,'expectedDueOn','2025-01-01','resolution','paid','reference','',
    'note','Fictional receipt','confirmation','CONFIRM');
  prepared:=public.admin_verification_prepare(jsonb_build_object('actor',actor,'intent',jsonb_build_object('operation','membership.renewal.confirm','payload',payload)));
  result:=public.admin_verification_begin_email(jsonb_build_object('prepared',prepared->'value','challengeId',challenge_id,
    'codeMac',repeat('a',64),'keyId','fixture','ipHash',repeat('b',64)));
  if not (result->>'ok')::boolean then raise exception 'Email fixture failed: %',result; end if;
  perform public.admin_verification_mark_email_delivery(jsonb_build_object('challengeId',challenge_id,'delivered',true));
  digest:=encode(extensions.digest(convert_to(token,'UTF8'),'sha256'),'hex');
  result:=public.admin_verification_redeem_email(jsonb_build_object('actor',actor,'challengeId',challenge_id,
    'candidateMacs',jsonb_build_array(repeat('a',64)),'tokenHash',digest,'ipHash',repeat('b',64)));
  proof_id:=(result#>>'{value,proofId}')::uuid; proof:=proof_id::text||'.'||token;
  if proof_id is null then raise exception 'Email proof missing: %',result; end if;
  for result in select public.admin_verification_check_write(jsonb_build_object('actor',actor,
    'intent',jsonb_build_object('operation','membership.renewal.confirm','payload',payload),'proofId',proof_id,'tokenHash',digest)) from generate_series(1,2) loop
    if not (result->>'ok')::boolean then raise exception 'Mutation preflight failed or consumed proof: %',result; end if;
  end loop;
  begin
    perform public.confirm_membership_renewal(mid,date '2025-01-01','waived',null,'Fictional receipt',p_proof=>proof);
    raise exception 'Changed resolution reused proof';
  exception when insufficient_privilege then null; end;
  execute 'set local role authenticated';
  result:=public.confirm_membership_renewal(mid,date '2025-01-01','paid',null,'Fictional receipt',p_proof=>proof);
  execute 'reset role';
  if result->>'status'<>'confirmed' or (select portal_access_status from public.members where id=mid)<>'frozen'
    or (select count(*) from public.membership_renewals where member_id=mid)<>1 then
    raise exception 'Verified renewal was not atomic or lifted freeze: %',result;
  end if;
  begin
    perform public.confirm_membership_renewal(mid,date '2025-01-01','paid',null,'Fictional receipt',p_proof=>proof);
    raise exception 'Consumed proof reused on an idempotent retry';
  exception when insufficient_privilege then null; end;
  if (select count(*) from public.membership_renewals where member_id=mid)<>1 then raise exception 'Retry advanced twice'; end if;
  update public.security_settings set admin_totp_enforced=false where id;
  begin
    perform public.confirm_membership_renewal(mid,date '2024-01-01','paid',null,'Fictional receipt');
    raise exception 'AAL1 payment without proof succeeded';
  exception when insufficient_privilege then null; end;
  update public.admin_profiles set is_active=false,status='frozen' where user_id=u;
  begin
    perform public.review_membership_request(req,stamp,'approved','Fictional retry');
    raise exception 'Inactive admin reviewed';
  exception when insufficient_privilege then null; end;
  update public.admin_profiles set is_active=true,status='active' where user_id=u;
  update public.rbac_user_platform_roles set revoked_at=now() where user_id=u and scope='admin';
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','aal','aal1','session_id',sid,'jnuits_role_version',(select version from public.rbac_user_claim_versions where user_id=u))::text,true);
  begin
    perform public.review_membership_request(req,stamp,'approved','Fictional retry');
    raise exception 'Normal member reviewed';
  exception when insufficient_privilege then null; end;
end;
$contract$;
rollback;
