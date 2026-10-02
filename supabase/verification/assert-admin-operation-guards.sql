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

do $roles$
declare
  u uuid; sid uuid:=extensions.gen_random_uuid(); fid uuid:=extensions.gen_random_uuid(); v bigint;
  target_user uuid:=extensions.gen_random_uuid(); target_profile uuid; rid uuid; result jsonb; actor jsonb;
  payload jsonb; prepared jsonb; proof_id uuid; token text:=repeat('y',43); proof text; digest text;
begin
  if to_regprocedure('public.apply_admin_role_operation(text,jsonb,text)') is null then
    raise exception 'Missing atomic MFA-plus-password role boundary';
  end if;
  select id into u from auth.users where email='replay-harness@local.invalid';
  update public.security_settings set admin_totp_enforced=false where id;
  select id into rid from public.rbac_platform_roles where scope='admin' and code='super_admin';
  insert into public.rbac_user_platform_roles(user_id,role_id,scope,note) values(u,rid,'admin','Role operation fixture');
  insert into public.admin_profiles(user_id,admin_code,display_name,status,is_active)
    values(u,'JNUITS-ADMIN-ROLE-FIXTURE','Fictional role operator','active',true)
    on conflict(user_id) do update set status='active',is_active=true;
  insert into auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at) values(fid,u,'totp','verified',now(),now());
  insert into auth.sessions(id,user_id,aal,factor_id,created_at,updated_at) values(sid,u,'aal2',fid,now(),now());
  select version into v from public.rbac_user_claim_versions where user_id=u;
  perform set_config('request.jwt.claim.sub',u::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','aal','aal2','session_id',sid,'jnuits_role_version',v)::text,true);
  insert into auth.users(id,email,created_at,updated_at) values(target_user,'role-target@local.invalid',now(),now());
  insert into public.admin_profiles(user_id,admin_code,display_name,status,is_active)
    values(target_user,'JNUITS-ADMIN-FROZEN-TARGET','Fictional frozen target','frozen',false) returning id into target_profile;
  insert into public.rbac_user_platform_roles(user_id,role_id,scope,note)
    select target_user,id,'admin','Role target fixture' from public.rbac_platform_roles where scope='admin' and code='content_admin';
  insert into public.rbac_user_platform_roles(user_id,role_id,scope,note)
    select target_user,id,'portal','Independent portal scope' from public.rbac_platform_roles where scope='portal' and code='member';
  payload:=jsonb_build_object('adminProfileId',target_profile,'confirmation','JNUITS-ADMIN-FROZEN-TARGET','roleCode','admin');
  begin
    perform public.apply_admin_role_operation('admin.role.change',payload,null);
    raise exception 'MFA alone changed an admin role';
  exception when insufficient_privilege then null; end;
  begin
    perform public.apply_admin_role_operation('admin.role.change',payload,'profile-cookie');
    raise exception 'Profile edit cookie changed an admin role';
  exception when insufficient_privilege then null; end;
  actor:=(public.admin_verification_context(jsonb_build_object('userId',u,'sessionId',sid,'roleVersion',v,'currentLevel','aal2')))->'value';
  prepared:=public.admin_verification_prepare(jsonb_build_object('actor',actor,'intent',jsonb_build_object('operation','admin.role.change','payload',payload)));
  digest:=encode(extensions.digest(convert_to(token,'UTF8'),'sha256'),'hex');
  -- Deliberately inject a private email-method fixture: the mutation must reject
  -- it even though normal email issuance already denies this operation class.
  insert into private.admin_verification_proofs(intent_id,token_hash,method)
    values((prepared#>>'{value,id}')::uuid,digest,'email') returning id into proof_id;
  begin
    perform public.apply_admin_role_operation('admin.role.change',payload,proof_id::text||'.'||token);
    raise exception 'Email alone changed an admin role';
  exception when insufficient_privilege then null; end;
  result:=public.admin_verification_reserve_password_attempt(jsonb_build_object('prepared',prepared->'value','ipHash',repeat('a',64)));
  if not (result->>'ok')::boolean then raise exception 'Password attempt fixture failed: %',result; end if;
  result:=public.admin_verification_issue_password(jsonb_build_object('prepared',prepared->'value','tokenHash',digest));
  proof_id:=(result#>>'{value,proofId}')::uuid; proof:=proof_id::text||'.'||token;
  if proof_id is null then raise exception 'Password proof fixture failed: %',result; end if;
  begin
    perform public.apply_admin_role_operation('admin.role.change',payload||jsonb_build_object('roleCode','super_admin'),proof);
    raise exception 'Changed role reused password proof';
  exception when insufficient_privilege then null; end;
  execute 'set local role authenticated';
  result:=public.apply_admin_role_operation('admin.role.change',payload,proof);
  execute 'reset role';
  if not coalesce((result->>'ok')::boolean,false) then raise exception 'Verified role change failed: %',result; end if;
  if not exists(select 1 from public.rbac_user_platform_roles g join public.rbac_platform_roles r on r.id=g.role_id
    where g.user_id=target_user and g.scope='admin' and g.revoked_at is null and r.code='admin')
    or (select count(*) from public.rbac_user_platform_roles where user_id=target_user and scope='admin' and revoked_at is null)<>1
    or not exists(select 1 from public.admin_profiles where id=target_profile and status='frozen' and not is_active)
    or not exists(select 1 from public.rbac_user_platform_roles where user_id=target_user and scope='portal' and revoked_at is null) then
    raise exception 'Role change was non-atomic, lifted freeze, or rewrote portal roles';
  end if;
  begin
    perform public.apply_admin_role_operation('admin.role.change',payload,proof);
    raise exception 'Consumed password proof reused';
  exception when insufficient_privilege then null; end;
  if has_function_privilege('anon','public.apply_admin_role_operation(text,jsonb,text)','EXECUTE') then
    raise exception 'Anonymous role mutation granted';
  end if;
end;
$roles$;

do $invitation_contract$
declare u uuid; recipient uuid:=extensions.gen_random_uuid(); sid uuid:=extensions.gen_random_uuid(); invitation uuid; result jsonb;
  issuer_session uuid; actor jsonb; payload jsonb; prepared jsonb; proof_id uuid; attempt_id uuid;
  token text:=repeat('z',43); proof text; digest text;
begin
  if to_regprocedure('public.accept_verified_admin_invitation(uuid)') is null
    or to_regprocedure('public.complete_admin_invitation_operation(uuid,jsonb)') is null then
    raise exception 'Missing immutable invitation authorization boundary';
  end if;
  select id into u from auth.users where email='replay-harness@local.invalid';
  insert into auth.users(id,email,email_confirmed_at,created_at,updated_at)
    values(recipient,'legacy-invite-fixture@local.invalid',now(),now(),now());
  insert into auth.sessions(id,user_id,aal,created_at,updated_at) values(sid,recipient,'aal1',now(),now());
  insert into public.admin_invitations(email,target_user_id,invited_role_code,invited_by_user_id,status)
    values('legacy-invite-fixture@local.invalid',recipient,'content_admin',u,'pending') returning id into invitation;
  perform set_config('request.jwt.claim.sub',recipient::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',recipient,'role','authenticated','aal','aal1','session_id',sid)::text,true);
  execute 'set local role authenticated';
  result:=public.accept_verified_admin_invitation(invitation);
  execute 'reset role';
  if result->>'code' is distinct from 'invitation_reissue_required'
    or exists(select 1 from public.rbac_user_platform_roles where user_id=recipient and scope='admin' and revoked_at is null) then
    raise exception 'Legacy unsigned invitation granted a role: %',result;
  end if;
  if has_function_privilege('authenticated','public.complete_admin_invitation_operation(uuid,jsonb)','EXECUTE')
    or has_function_privilege('anon','public.accept_verified_admin_invitation(uuid)','EXECUTE') then
    raise exception 'Unsafe invitation function ACL';
  end if;
  -- Reissuance must be a fresh dual-verified, immutable authorization.
  update public.admin_invitations set status='revoked' where id=invitation;
  select id into issuer_session from auth.sessions where user_id=u and aal='aal2' order by created_at desc limit 1;
  perform set_config('request.jwt.claim.sub',u::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','aal','aal2','session_id',issuer_session,
    'jnuits_role_version',(select version from public.rbac_user_claim_versions where user_id=u))::text,true);
  actor:=(public.admin_verification_context(jsonb_build_object('userId',u,'sessionId',issuer_session,
    'roleVersion',(select version from public.rbac_user_claim_versions where user_id=u),'currentLevel','aal2')))->'value';
  payload:=jsonb_build_object('displayName','Fictional invitee','email','legacy-invite-fixture@local.invalid','inviteMode','email',
    'memberId','','note','Fictional issuance','roleCode','content_admin','title','');
  prepared:=public.admin_verification_prepare(jsonb_build_object('actor',actor,'intent',jsonb_build_object('operation','admin.role.invite','payload',payload)));
  digest:=encode(extensions.digest(convert_to(token,'UTF8'),'sha256'),'hex');
  result:=public.admin_verification_reserve_password_attempt(jsonb_build_object('prepared',prepared->'value','ipHash',repeat('a',64)));
  if not (result->>'ok')::boolean then raise exception 'Issuance password fixture failed: %',result; end if;
  result:=public.admin_verification_issue_password(jsonb_build_object('prepared',prepared->'value','tokenHash',digest));
  proof_id:=(result#>>'{value,proofId}')::uuid; proof:=proof_id::text||'.'||token;
  result:=public.apply_admin_role_operation('admin.role.invite',payload,proof);
  attempt_id:=(result#>>'{value,attemptId}')::uuid;
  if attempt_id is null or exists(select 1 from public.rbac_user_platform_roles where user_id=recipient and scope='admin' and revoked_at is null) then
    raise exception 'Invitation issuance granted a role or failed: %',result;
  end if;
  begin
    perform public.complete_admin_invitation_operation(attempt_id,jsonb_build_object('targetUserId',u,'claimInvitationId',null));
    raise exception 'Different recipient completed invitation';
  exception when insufficient_privilege then null; end;
  result:=public.complete_admin_invitation_operation(attempt_id,jsonb_build_object('targetUserId',recipient,'claimInvitationId',null));
  invitation:=(result#>>'{value,invitationId}')::uuid;
  if invitation is null or not exists(select 1 from private.admin_invitation_authorizations where invitation_id=invitation and recipient_email='legacy-invite-fixture@local.invalid') then
    raise exception 'Completed invitation has no immutable authorization: %',result;
  end if;
  if not exists(select 1 from private.admin_verification_mfa_history where user_id=recipient and not ever_enrolled and never_confirmed_at is not null) then
    raise exception 'Trusted new-account history was not recorded';
  end if;
  -- Simulate only the developed transport's successful delivery metadata.
  update public.admin_invitations set delivery_status='sent',invited_role_code='super_admin' where id=invitation;
  perform set_config('request.jwt.claim.sub',recipient::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',recipient,'role','authenticated','aal','aal1','session_id',sid)::text,true);
  result:=public.accept_verified_admin_invitation(invitation);
  if result->>'code' is distinct from 'invitation_invalid' or exists(select 1 from public.rbac_user_platform_roles where user_id=recipient and scope='admin' and revoked_at is null) then
    raise exception 'Changed invitation role bypassed issuer authorization: %',result;
  end if;
  update public.admin_invitations set invited_role_code='content_admin' where id=invitation;
  execute 'set local role authenticated';
  result:=public.accept_verified_admin_invitation(invitation);
  execute 'reset role';
  if not coalesce((result->>'ok')::boolean,false)
    or (select count(*) from public.rbac_user_platform_roles where user_id=recipient and scope='admin' and revoked_at is null)<>1
    or not exists(select 1 from public.admin_profiles where user_id=recipient and status='active' and is_active) then
    raise exception 'Authorized invitation did not atomically activate its recipient: %',result;
  end if;
  result:=public.accept_verified_admin_invitation(invitation);
  if coalesce((result->>'ok')::boolean,false) then raise exception 'Accepted invitation was replayed'; end if;
end;
$invitation_contract$;
do $banned_actor$
declare u uuid; sid uuid; v bigint; result jsonb;
begin
  select id into u from auth.users where email='replay-harness@local.invalid';
  select id into sid from auth.sessions where user_id=u and aal='aal2' order by created_at desc limit 1;
  select version into v from public.rbac_user_claim_versions where user_id=u;
  update auth.users set banned_until=clock_timestamp()+interval '1 hour' where id=u;
  result:=public.admin_verification_context(jsonb_build_object('userId',u,'sessionId',sid,'roleVersion',v,'currentLevel','aal2'));
  if coalesce((result->>'ok')::boolean,false) then raise exception 'Auth-banned administrator obtained verification context'; end if;
  update auth.users set banned_until=null where id=u;
end;
$banned_actor$;

do $lifecycle_contract$
declare u uuid; sid uuid; v bigint; actor jsonb; payload jsonb; result jsonb; attempt_id uuid;
  target_user uuid:=extensions.gen_random_uuid(); target_profile uuid; target_sid uuid:=extensions.gen_random_uuid(); target_actor jsonb;
begin
  if to_regprocedure('public.complete_admin_lifecycle_operation(uuid,jsonb)') is null
    or to_regprocedure('public.revoke_admin_invitation_verified(jsonb,text)') is null then
    raise exception 'Missing reserved lifecycle or atomic invitation-revocation boundary';
  end if;
  select id into u from auth.users where email='replay-harness@local.invalid';
  select id into sid from auth.sessions where user_id=u and aal='aal2' order by created_at desc limit 1;
  select version into v from public.rbac_user_claim_versions where user_id=u;
  actor:=(public.admin_verification_context(jsonb_build_object('userId',u,'sessionId',sid,'roleVersion',v,'currentLevel','aal2')))->'value';
  insert into auth.users(id,email,email_confirmed_at,created_at,updated_at) values(target_user,'lifecycle-target@local.invalid',now(),now(),now());
  insert into public.admin_profiles(user_id,admin_code,email,display_name,status,is_active)
    values(target_user,'JNUITS-ADMIN-LIFECYCLE-TARGET','lifecycle-target@local.invalid','Fictional lifecycle target','active',true) returning id into target_profile;
  insert into public.rbac_user_platform_roles(user_id,role_id,scope)
    select target_user,id,'admin' from public.rbac_platform_roles where scope='admin' and code='super_admin';
  insert into auth.sessions(id,user_id,aal,created_at,updated_at) values(target_sid,target_user,'aal1',now(),now());
  payload:=jsonb_build_object('adminProfileId',target_profile,'confirmation','JNUITS-ADMIN-LIFECYCLE-TARGET');
  result:=public.admin_verification_reserve(jsonb_build_object('actor',actor,'intent',jsonb_build_object('operation','admin.lifecycle.freeze',
    'payload',payload||jsonb_build_object('confirmation','WRONG'))));
  if coalesce((result->>'ok')::boolean,false) then raise exception 'Wrong target confirmation reserved an external Auth mutation'; end if;
  result:=public.admin_verification_reserve(jsonb_build_object('actor',actor,'intent',jsonb_build_object('operation','admin.lifecycle.freeze','payload',payload)));
  attempt_id:=(result#>>'{value,attemptId}')::uuid;
  if attempt_id is null or not exists(select 1 from private.admin_verification_attempts where id=attempt_id and reserved_actor is not null) then
    raise exception 'Lifecycle did not reserve its actor before external mutation: %',result;
  end if;
  target_actor:=jsonb_build_object('userId',target_user,'sessionId',target_sid,'roleVersion',
    (select version from public.rbac_user_claim_versions where user_id=target_user),'currentLevel','aal1');
  result:=public.admin_verification_context(target_actor);
  if coalesce((result->>'ok')::boolean,false) then raise exception 'Reserved freeze target could still authorize operations'; end if;
  result:=public.admin_verification_reserve(jsonb_build_object('actor',actor,'intent',jsonb_build_object('operation','admin.lifecycle.freeze','payload',payload)));
  if coalesce((result->>'ok')::boolean,false) then raise exception 'Competing lifecycle mutation reserved the same account'; end if;
  begin
    perform public.complete_admin_lifecycle_operation(attempt_id,payload);
    raise exception 'Profile frozen before external Auth ban was observed';
  exception when insufficient_privilege then null; end;
  update auth.users set banned_until=clock_timestamp()+interval '1 year' where id=target_user;
  begin
    perform public.complete_admin_lifecycle_operation(attempt_id,payload||jsonb_build_object('confirmation','WRONG'));
    raise exception 'Changed lifecycle payload completed reserved operation';
  exception when insufficient_privilege then null; end;
  result:=public.complete_admin_lifecycle_operation(attempt_id,payload);
  if not coalesce((result->>'ok')::boolean,false) or not exists(select 1 from public.admin_profiles where id=target_profile and status='frozen' and not is_active)
    or not exists(select 1 from public.audit_events where entity_id=target_profile::text and action='admin_account.frozen') then
    raise exception 'Verified lifecycle did not atomically finalize profile and audit: %',result;
  end if;
  begin
    perform public.complete_admin_lifecycle_operation(attempt_id,payload);
    raise exception 'Completed lifecycle attempt reused';
  exception when insufficient_privilege then null; end;
  result:=public.admin_verification_reserve(jsonb_build_object('actor',actor,'intent',jsonb_build_object('operation','admin.lifecycle.unfreeze','payload',payload)));
  attempt_id:=(result#>>'{value,attemptId}')::uuid;
  if attempt_id is null then raise exception 'Unfreeze reservation failed: %',result; end if;
  begin
    perform public.complete_admin_lifecycle_operation(attempt_id,payload);
    raise exception 'Profile unfrozen while Auth remained banned';
  exception when insufficient_privilege then null; end;
  update auth.users set banned_until=null where id=target_user;
  result:=public.complete_admin_lifecycle_operation(attempt_id,payload);
  if not coalesce((result->>'ok')::boolean,false) or not exists(select 1 from public.admin_profiles where id=target_profile and status='active' and is_active) then
    raise exception 'Verified unfreeze failed: %',result;
  end if;
  if has_function_privilege('authenticated','public.complete_admin_lifecycle_operation(uuid,jsonb)','EXECUTE')
    or has_function_privilege('anon','public.revoke_admin_invitation_verified(jsonb,text)','EXECUTE') then raise exception 'Unsafe lifecycle ACL'; end if;
end;
$lifecycle_contract$;

do $protected_settings_and_revoke$
declare u uuid; sid uuid; v bigint; invitation uuid; recipient uuid:=extensions.gen_random_uuid(); profile_id uuid; result jsonb;
begin
  select id into u from auth.users where email='replay-harness@local.invalid';
  select id into sid from auth.sessions where user_id=u and aal='aal2' order by created_at desc limit 1;
  select version into v from public.rbac_user_claim_versions where user_id=u;
  perform set_config('request.jwt.claim.sub',u::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','aal','aal2','session_id',sid,'jnuits_role_version',v)::text,true);
  insert into auth.users(id,email,created_at,updated_at) values(recipient,'cancelled-invite@local.invalid',now(),now());
  insert into public.admin_profiles(user_id,admin_code,email,display_name,status,is_active)
    values(recipient,'JNUITS-ADMIN-CANCELLED-QA','cancelled-invite@local.invalid','Fictional pending account','pending_invite',false) returning id into profile_id;
  insert into public.admin_invitations(email,target_user_id,target_admin_profile_id,invited_role_code,invited_by_user_id,status)
    values('cancelled-invite@local.invalid',recipient,profile_id,'content_admin',u,'pending') returning id into invitation;
  begin
    perform public.revoke_admin_invitation_verified(jsonb_build_object('invitationId',invitation,'confirmation','WRONG'),null);
    raise exception 'Wrong email cancelled invitation';
  exception when insufficient_privilege then null; end;
  execute 'set local role authenticated';
  result:=public.revoke_admin_invitation_verified(jsonb_build_object('invitationId',invitation,'confirmation','cancelled-invite@local.invalid'),null);
  execute 'reset role';
  if not coalesce((result->>'ok')::boolean,false)
    or not exists(select 1 from public.admin_invitations where id=invitation and status='revoked')
    or not exists(select 1 from public.admin_profiles where id=profile_id and status='removed' and not is_active)
    or not exists(select 1 from public.audit_events where entity_id=invitation::text and action='admin_invitation.revoked') then
    raise exception 'Cancellation profile/invitation/audit was not atomic: %',result;
  end if;
  select id into invitation from public.admin_invitations where status='accepted' limit 1;
  begin
    perform public.revoke_admin_invitation_verified(jsonb_build_object('invitationId',invitation,'confirmation','legacy-invite-fixture@local.invalid'),null);
    raise exception 'Cancellation altered an accepted admin account';
  exception when insufficient_privilege then null; end;
  execute 'set local role authenticated';
  result:=public.update_admin_security_verified('{"adminTotpEnforced":true}',null);
  execute 'reset role';
  if not coalesce((result->>'ok')::boolean,false) or not (select admin_totp_enforced from public.security_settings where id) then
    raise exception 'Actual voluntary MFA could not update policy: %',result;
  end if;
  -- An AAL1 session cannot exploit the toggle being disabled.
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','aal','aal1','session_id',sid,'jnuits_role_version',v)::text,true);
  begin
    perform public.update_admin_security_verified('{"adminTotpEnforced":false}',null);
    raise exception 'Unverified policy change succeeded';
  exception when insufficient_privilege then null; end;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','aal','aal2','session_id',sid,'jnuits_role_version',v)::text,true);
  result:=public.update_admin_security_verified('{"adminTotpEnforced":false}',null);
  if not coalesce((result->>'ok')::boolean,false) then raise exception 'Verified super admin could not disable policy: %',result; end if;
end;
$protected_settings_and_revoke$;
do $retention_contract$
declare u uuid; sid uuid; actor jsonb; result jsonb; attempt_id uuid; form_id uuid; job_id uuid; intent jsonb; manifest jsonb;
  version_id uuid; old_submission uuid; recent_submission uuid;
begin
  if to_regprocedure('public.complete_admin_retention_operation(uuid,jsonb)') is null then
    raise exception 'Missing reserved retention completion boundary';
  end if;
  select id into u from auth.users where email='replay-harness@local.invalid';
  select id into sid from auth.sessions where user_id=u and aal='aal2' order by created_at desc limit 1;
  actor:=(public.admin_verification_context(jsonb_build_object('userId',u,'sessionId',sid,'roleVersion',
    (select version from public.rbac_user_claim_versions where user_id=u),'currentLevel','aal2')))->'value';
  insert into public.form_definitions(kind,slug,title,owner_user_id) values('membership_application','retention-verification-qa','Fictional retention form',u) returning id into form_id;
  insert into public.form_archive_jobs(form_definition_id,requested_by_user_id,retention_eligible_at,status)
    values(form_id,u,clock_timestamp()-interval '1 year','candidate') returning id into job_id;
  intent:=jsonb_build_object('jobId',job_id,'scope','form');
  result:=public.admin_verification_reserve(jsonb_build_object('actor',actor,'intent',jsonb_build_object('operation','admin.retention.archive','payload',intent)));
  attempt_id:=(result#>>'{value,attemptId}')::uuid;
  if attempt_id is null then raise exception 'Retention reservation failed: %',result; end if;
  begin
    perform public.complete_admin_retention_operation(attempt_id,jsonb_build_object('intent',intent||jsonb_build_object('jobId',extensions.gen_random_uuid()),'stage','archive_start','boundary','2023-01-01T00:00:00Z'));
    raise exception 'Changed retention target completed a reserved operation';
  exception when insufficient_privilege then null; end;
  result:=public.complete_admin_retention_operation(attempt_id,jsonb_build_object('intent',intent,'stage','archive_start','boundary','2023-01-01T00:00:00Z'));
  if not coalesce((result->>'ok')::boolean,false) or not exists(select 1 from public.form_archive_jobs where id=job_id and status='archive_requested') then
    raise exception 'Reserved archive did not claim its exact job: %',result;
  end if;
  -- Synthetic service-side archive evidence: no files are uploaded in SQL QA.
  manifest:=jsonb_build_object('algorithm','HMAC-SHA256','signature',repeat('a',64),'manifest',jsonb_build_object(
    'schemaVersion',2,'scope','form','resourceId',form_id,'boundary','2023-01-01T00:00:00Z','rowCount',0,'files','[]'::jsonb));
  result:=public.complete_admin_retention_operation(attempt_id,jsonb_build_object('intent',intent,'stage','archive_complete','boundary','2023-01-01T00:00:00Z',
    'rowCount',0,'reusedFiles',0,'bundle',jsonb_build_object('checksum',repeat('b',64),'manifest',manifest,'manifestFileId','fictional-drive-file')));
  if not coalesce((result->>'ok')::boolean,false) or not exists(select 1 from public.form_archive_jobs where id=job_id and status='archived')
    or not exists(select 1 from public.audit_events where action='retention.archive_completed' and metadata->>'job_id'=job_id::text)
    or not exists(select 1 from private.admin_verification_attempts where id=attempt_id and status='completed') then
    raise exception 'Archive evidence/state/audit/attempt completion was not atomic: %',result;
  end if;
  begin
    perform public.complete_admin_retention_operation(attempt_id,jsonb_build_object('intent',intent,'stage','archive_failed'));
    raise exception 'Completed archive demoted or authorization reused';
  exception when insufficient_privilege then null; end;
  result:=public.admin_verification_reserve(jsonb_build_object('actor',actor,'intent',jsonb_build_object('operation','admin.retention.approve_purge','payload',intent)));
  attempt_id:=(result#>>'{value,attemptId}')::uuid;
  begin
    perform public.complete_admin_retention_operation(attempt_id,jsonb_build_object('intent',intent,'stage','approve_purge','archiveChecksum',repeat('c',64),'archiveManifest',manifest));
    raise exception 'Changed archive evidence approved for purge';
  exception when serialization_failure then null; end;
  result:=public.complete_admin_retention_operation(attempt_id,jsonb_build_object('intent',intent,'stage','approve_purge','archiveChecksum',repeat('b',64),'archiveManifest',manifest));
  if not coalesce((result->>'ok')::boolean,false) or not exists(select 1 from public.form_archive_jobs where id=job_id and status='purge_approved' and approved_by_user_id=u) then
    raise exception 'Verified archive approval failed: %',result;
  end if;
  insert into public.form_versions(form_definition_id,version_number,lifecycle,field_schema,created_by_user_id,published_at,published_by_user_id)
    values(form_id,1,'published','{"fields":[],"payment":{"enabled":false}}',u,now(),u) returning id into version_id;
  update public.form_definitions set lifecycle='published',current_published_version_id=version_id,published_at=now(),published_by_user_id=u where id=form_id;
  insert into public.form_submissions(form_definition_id,form_version_id,submitter_email,answers,created_at)
    values(form_id,version_id,'fictional-old@local.invalid','{"name":"Old fictional respondent"}','2022-01-01') returning id into old_submission;
  insert into public.form_submissions(form_definition_id,form_version_id,submitter_email,answers,created_at)
    values(form_id,version_id,'fictional-recent@local.invalid','{"name":"Recent fictional respondent"}',clock_timestamp()) returning id into recent_submission;
  intent:=intent||jsonb_build_object('confirmation','PURGE');
  result:=public.admin_verification_reserve(jsonb_build_object('actor',actor,'intent',jsonb_build_object('operation','admin.retention.purge','payload',intent)));
  attempt_id:=(result#>>'{value,attemptId}')::uuid;
  result:=public.complete_admin_retention_operation(attempt_id,jsonb_build_object('intent',intent,'stage','purge','archiveChecksum',repeat('b',64),'archiveManifest',manifest));
  if not coalesce((result->>'ok')::boolean,false) or result#>>'{value,purgedRows}'<>'1'
    or not exists(select 1 from public.form_submissions where id=old_submission and answers='{}'::jsonb and submitter_email is null)
    or not exists(select 1 from public.form_submissions where id=recent_submission and answers->>'name'='Recent fictional respondent' and submitter_email='fictional-recent@local.invalid')
    or not exists(select 1 from public.form_archive_jobs where id=job_id and status='purged') then
    raise exception 'Verified purge widened the signed cutoff or failed its atomic state update: %',result;
  end if;
  if private.retention_calendar_shift('2028-02-29T12:00:00Z',-3)<>'2025-03-01T12:00:00Z'::timestamptz then
    raise exception 'Retention calendar policy changed for leap-day overflow';
  end if;
  result:=public.admin_verification_reserve(jsonb_build_object('actor',actor,'intent',jsonb_build_object('operation','admin.retention.discover','payload','{}'::jsonb)));
  attempt_id:=(result#>>'{value,attemptId}')::uuid;
  result:=public.complete_admin_retention_operation(attempt_id,jsonb_build_object('intent','{}'::jsonb,'stage','discover','boundary','2023-01-01T00:00:00Z',
    'formCandidates',jsonb_build_array(jsonb_build_object('resourceId',form_id,'eligibleAt','2025-01-01T00:00:00Z')),'eventCandidates','[]'::jsonb));
  if not coalesce((result->>'ok')::boolean,false) or result#>>'{value,formCreated}'<>'1'
    or not exists(select 1 from public.audit_events where action='retention.discovery_completed' and actor_user_id=u) then
    raise exception 'Verified discovery did not atomically insert and audit its eligible candidate: %',result;
  end if;
  result:=public.admin_verification_reserve(jsonb_build_object('actor',actor,'intent',jsonb_build_object('operation','admin.retention.discover','payload','{}'::jsonb)));
  attempt_id:=(result#>>'{value,attemptId}')::uuid;
  delete from auth.sessions where id=sid;
  begin
    perform public.complete_admin_retention_operation(attempt_id,jsonb_build_object('intent','{}'::jsonb,'stage','discover','boundary','2023-01-01T00:00:00Z','formCandidates','[]'::jsonb,'eventCandidates','[]'::jsonb));
    raise exception 'Logged-out operator completed retention writes';
  exception when insufficient_privilege then null; end;
  if has_function_privilege('authenticated','public.complete_admin_retention_operation(uuid,jsonb)','EXECUTE')
    or has_function_privilege('service_role','public.purge_retention_job(text,uuid,uuid)','EXECUTE') then
    raise exception 'Retention grants bypass its verified boundary';
  end if;
end;
$retention_contract$;
do $email_external_contract$
declare
  u uuid:=extensions.gen_random_uuid(); sid uuid:=extensions.gen_random_uuid(); v bigint;
  target_user uuid:=extensions.gen_random_uuid(); target_profile uuid; actor jsonb; intent jsonb; prepared jsonb;
  result jsonb; challenge_id uuid:=extensions.gen_random_uuid(); proof_id uuid; attempt_id uuid;
  token text:=repeat('e',43); digest text;
begin
  -- A new, confirmed, known-never-enrolled admin uses the developed email
  -- proof path, not a synthetic AAL2 JWT or a private proof-table injection.
  update public.security_settings set admin_totp_enforced=false where id;
  insert into auth.users(id,email,email_confirmed_at,created_at,updated_at)
    values(u,'email-operator@local.invalid',now(),clock_timestamp(),now());
  insert into public.admin_profiles(user_id,admin_code,display_name,status,is_active)
    values(u,'JNUITS-ADMIN-EMAIL-QA','Fictional email operator','active',true);
  insert into public.rbac_user_platform_roles(user_id,role_id,scope,note)
    select u,id,'admin','Email operation fixture' from public.rbac_platform_roles where scope='admin' and code='super_admin';
  select version into v from public.rbac_user_claim_versions where user_id=u;
  insert into auth.sessions(id,user_id,aal,created_at,updated_at) values(sid,u,'aal1',now(),now());
  perform public.admin_verification_record_enrollment(jsonb_build_object('userId',u,'evidence','trusted_never_history'));
  actor:=(public.admin_verification_context(jsonb_build_object('userId',u,'sessionId',sid,'roleVersion',v,'currentLevel','aal1')))->'value';
  if actor->>'enrollment'<>'never' then raise exception 'Known-never-enrolled email fixture failed: %',actor; end if;
  insert into auth.users(id,email,created_at,updated_at) values(target_user,'email-freeze-target@local.invalid',now(),now());
  insert into public.admin_profiles(user_id,admin_code,display_name,status,is_active)
    values(target_user,'JNUITS-ADMIN-EMAIL-TARGET','Fictional email target','active',true) returning id into target_profile;
  insert into public.rbac_user_platform_roles(user_id,role_id,scope,note)
    select target_user,id,'admin','Email target fixture' from public.rbac_platform_roles where scope='admin' and code='content_admin';
  intent:=jsonb_build_object('operation','admin.lifecycle.freeze','payload',jsonb_build_object('adminProfileId',target_profile,'confirmation','JNUITS-ADMIN-EMAIL-TARGET'));
  result:=public.admin_verification_reserve(jsonb_build_object('actor',actor,'intent',intent));
  if coalesce((result->>'ok')::boolean,false) then raise exception 'AAL1 lifecycle reserved without proof'; end if;
  prepared:=public.admin_verification_prepare(jsonb_build_object('actor',actor,'intent',intent));
  result:=public.admin_verification_begin_email(jsonb_build_object('prepared',prepared->'value','challengeId',challenge_id,'codeMac',repeat('d',64),'keyId','fixture','ipHash',repeat('e',64)));
  if not coalesce((result->>'ok')::boolean,false) then raise exception 'External-operation email challenge failed: %',result; end if;
  perform public.admin_verification_mark_email_delivery(jsonb_build_object('challengeId',challenge_id,'delivered',true));
  digest:=encode(extensions.digest(convert_to(token,'UTF8'),'sha256'),'hex');
  result:=public.admin_verification_redeem_email(jsonb_build_object('actor',actor,'challengeId',challenge_id,'candidateMacs',jsonb_build_array(repeat('d',64)),'tokenHash',digest,'ipHash',repeat('e',64)));
  proof_id:=(result#>>'{value,proofId}')::uuid;
  if proof_id is null then raise exception 'External-operation email proof failed: %',result; end if;
  result:=public.admin_verification_reserve(jsonb_build_object('actor',actor,'intent',intent,'proofId',proof_id,'tokenHash',digest));
  attempt_id:=(result#>>'{value,attemptId}')::uuid;
  if attempt_id is null then raise exception 'Email proof did not reserve the exact external operation: %',result; end if;
  result:=public.admin_verification_reserve(jsonb_build_object('actor',actor,'intent',intent,'proofId',proof_id,'tokenHash',digest));
  if coalesce((result->>'ok')::boolean,false) then raise exception 'Consumed email proof reserved twice'; end if;
  update auth.users set banned_until=clock_timestamp()+interval '1 day' where id=target_user;
  result:=public.complete_admin_lifecycle_operation(attempt_id,intent->'payload');
  if not coalesce((result->>'ok')::boolean,false)
    or not exists(select 1 from public.admin_profiles where id=target_profile and status='frozen' and not is_active)
    or not exists(select 1 from public.audit_events where actor_user_id=u and action='admin_account.frozen')
    or not exists(select 1 from private.admin_verification_attempts where id=attempt_id and status='completed') then
    raise exception 'Email-bound Auth/profile/audit completion failed: %',result;
  end if;
end;
$email_external_contract$;
rollback;
