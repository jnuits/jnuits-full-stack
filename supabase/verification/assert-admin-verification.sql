-- Disposable replay only. All fixtures are fictional and rolled back.
begin;
do $verify$
declare
  u uuid; sid uuid := extensions.gen_random_uuid(); rid uuid; v bigint; ctx jsonb;
  prepared jsonb; result jsonb; intent_id uuid; challenge_id uuid := extensions.gen_random_uuid(); proof_id uuid;
  actor jsonb; input jsonb; original_settings jsonb; n integer; role_intent jsonb; fixture_factor_id uuid:=extensions.gen_random_uuid();
begin
  select id into u from auth.users where email='replay-harness@local.invalid';
  if u is null then raise exception 'Disposable identity required'; end if;
  select to_jsonb(s) into original_settings from public.security_settings s where id;
  update public.security_settings set admin_totp_enforced=false where id;
  select id into rid from public.rbac_platform_roles where code='admin' and scope='admin';
  insert into public.rbac_user_platform_roles(user_id,role_id,scope,note) values(u,rid,'admin','Verification fixture') on conflict do nothing;
  insert into public.admin_profiles(user_id,admin_code,display_name,is_active,status)
    values(u,'JNUITS-ADMIN-VERIFY-FIXTURE','Fictional verifier',true,'active') on conflict(user_id) do update set is_active=true,status='active';
  select version into v from public.rbac_user_claim_versions where user_id=u;
  update auth.users set email_confirmed_at=now(),created_at=now()-interval '1 day' where id=u;
  insert into auth.sessions(id,user_id,aal,created_at,updated_at) values(sid,u,'aal1',now(),now());
  ctx := public.admin_verification_context(jsonb_build_object('userId',u,'sessionId',sid,'roleVersion',v,'currentLevel','aal1'));
  if not (ctx->>'ok')::boolean or ctx#>>'{value,enrollment}' <> 'unknown' then raise exception 'Unknown enrollment became email eligible: %',ctx; end if;
  result := public.admin_verification_record_enrollment(jsonb_build_object('userId',u,'evidence','trusted_never_history'));
  if (result->>'ok')::boolean then raise exception 'Incomplete legacy enrollment accepted as never'; end if;
  -- Simulate a new account created after the foundation cutover, separately
  -- from the legacy-history denial above. Never infer history from no factors.
  update auth.users set created_at=clock_timestamp() where id=u;
  result := public.admin_verification_record_enrollment(jsonb_build_object('userId',u,'evidence','trusted_never_history'));
  if not (result->>'ok')::boolean then raise exception 'Trusted new account rejected %',result; end if;
  ctx := public.admin_verification_context(jsonb_build_object('userId',u,'sessionId',sid,'roleVersion',v,'currentLevel','aal1'));
  actor := ctx->'value';
  input := jsonb_build_object('actor',actor,'intent',jsonb_build_object('operation','admin.security.read','payload','{}'::jsonb));
  prepared := public.admin_verification_prepare(input);
  if not (prepared->>'ok')::boolean then raise exception 'Preparation failed %',prepared; end if;
  intent_id := (prepared#>>'{value,id}')::uuid;
  result := public.admin_verification_begin_email(jsonb_build_object('prepared',prepared->'value','challengeId',challenge_id,'codeMac',repeat('a',64),'keyId','fixture','ipHash',repeat('b',64)));
  if not (result->>'ok')::boolean then raise exception 'Email begin failed %',result; end if;
  result := public.admin_verification_redeem_email(jsonb_build_object('actor',actor,'challengeId',challenge_id,'candidateMacs',jsonb_build_array(repeat('a',64)),'tokenHash',repeat('c',64),'ipHash',repeat('b',64)));
  if (result->>'ok')::boolean then raise exception 'Undelivered email issued a proof'; end if;
  perform public.admin_verification_mark_email_delivery(jsonb_build_object('challengeId',challenge_id,'delivered',true));
  result := public.admin_verification_redeem_email(jsonb_build_object('actor',actor,'challengeId',challenge_id,'candidateMacs',jsonb_build_array(repeat('a',64)),'tokenHash',repeat('c',64),'ipHash',repeat('b',64)));
  if not (result->>'ok')::boolean then raise exception 'Redeem failed %',result; end if;
  proof_id := (result#>>'{value,proofId}')::uuid;
  result := public.admin_verification_check_read(input || jsonb_build_object('proofId',proof_id,'tokenHash',repeat('c',64)));
  if not (result->>'ok')::boolean then raise exception 'Named read grant failed %',result; end if;
  update auth.users set email='changed-verifier@local.invalid' where id=u;
  result := public.admin_verification_check_read(input || jsonb_build_object('proofId',proof_id,'tokenHash',repeat('c',64)));
  if (result->>'ok')::boolean then raise exception 'Email change kept old grant usable'; end if;
  update auth.users set email='replay-harness@local.invalid' where id=u;
  update public.rbac_user_claim_versions set version=v+1 where user_id=u;
  result := public.admin_verification_check_read(input || jsonb_build_object('proofId',proof_id,'tokenHash',repeat('c',64)));
  if (result->>'ok')::boolean then raise exception 'Role-version change kept old grant usable'; end if;
  update public.rbac_user_claim_versions set version=v where user_id=u;
  update private.admin_verification_proofs set expires_at=clock_timestamp()-interval '1 second' where id=proof_id;
  result := public.admin_verification_check_read(input || jsonb_build_object('proofId',proof_id,'tokenHash',repeat('c',64)));
  if (result->>'ok')::boolean then raise exception 'Expired grant usable'; end if;
  update private.admin_verification_proofs set expires_at=clock_timestamp()+interval '5 minutes' where id=proof_id;
  result := public.admin_verification_reserve(input || jsonb_build_object('proofId',proof_id,'tokenHash',repeat('c',64)));
  if (result->>'ok')::boolean then raise exception 'Read proof became a write reservation'; end if;
  -- Cross-session and changed payload never reuse a read grant.
  result := public.admin_verification_check_read((input || jsonb_build_object('actor',actor || jsonb_build_object('sessionId',extensions.gen_random_uuid()))) || jsonb_build_object('proofId',proof_id,'tokenHash',repeat('c',64)));
  if (result->>'ok')::boolean then raise exception 'Cross-session proof succeeded'; end if;
  result := public.admin_verification_check_read((input || jsonb_build_object('intent',jsonb_build_object('operation','admin.retention.read','payload','{}'::jsonb))) || jsonb_build_object('proofId',proof_id,'tokenHash',repeat('c',64)));
  if (result->>'ok')::boolean then raise exception 'Changed read scope succeeded'; end if;
  update public.security_settings set admin_totp_enforced=true where id;
  result := public.admin_verification_check_read(input || jsonb_build_object('proofId',proof_id,'tokenHash',repeat('c',64)));
  if (result->>'ok')::boolean then raise exception 'Policy change kept old email grant usable'; end if;
  update public.security_settings set admin_totp_enforced=false where id;
  -- Each mutation proof is consumed once; old code cannot issue a second proof.
  delete from private.admin_verification_rate_events where subject_hash in (u::text,repeat('b',64));
  input := jsonb_build_object('actor',actor,'intent',jsonb_build_object('operation','admin.security.update','payload',jsonb_build_object('adminTotpEnforced',true)));
  prepared := public.admin_verification_prepare(input); challenge_id:=extensions.gen_random_uuid();
  result := public.admin_verification_begin_email(jsonb_build_object('prepared',prepared->'value','challengeId',challenge_id,'codeMac',repeat('a',64),'keyId','fixture','ipHash',repeat('b',64)));
  if not (result->>'ok')::boolean then raise exception 'Mutation email begin failed %',result; end if;
  perform public.admin_verification_mark_email_delivery(jsonb_build_object('challengeId',challenge_id,'delivered',true));
  result := public.admin_verification_redeem_email(jsonb_build_object('actor',actor,'challengeId',challenge_id,'candidateMacs',jsonb_build_array(repeat('a',64)),'tokenHash',repeat('c',64),'ipHash',repeat('b',64)));
  proof_id := (result#>>'{value,proofId}')::uuid;
  if proof_id is null then raise exception 'Mutation proof missing %',result; end if;
  result := public.admin_verification_reserve((input || jsonb_build_object('intent',jsonb_build_object('operation','admin.security.update','payload',jsonb_build_object('adminTotpEnforced',false)))) || jsonb_build_object('proofId',proof_id,'tokenHash',repeat('c',64)));
  if (result->>'ok')::boolean then raise exception 'Changed mutation payload accepted'; end if;
  result := public.admin_verification_reserve(input || jsonb_build_object('proofId',proof_id,'tokenHash',repeat('c',64)));
  if not (result->>'ok')::boolean then raise exception 'Exact mutation reservation failed %',result; end if;
  result := public.admin_verification_reserve(input || jsonb_build_object('proofId',proof_id,'tokenHash',repeat('c',64)));
  if (result->>'ok')::boolean then raise exception 'Mutation proof replay succeeded'; end if;
  result := public.admin_verification_redeem_email(jsonb_build_object('actor',actor,'challengeId',challenge_id,'candidateMacs',jsonb_build_array(repeat('a',64)),'tokenHash',repeat('c',64),'ipHash',repeat('b',64)));
  if (result->>'ok')::boolean then raise exception 'Consumed code issued another proof'; end if;
  -- The sixth guess is denied even when correct; a target change cannot reset account limits.
  update private.admin_verification_rate_events set occurred_at=clock_timestamp()-interval '61 seconds' where kind='email_send_account' and subject_hash=u::text;
  prepared := public.admin_verification_prepare(input); challenge_id:=extensions.gen_random_uuid();
  result := public.admin_verification_begin_email(jsonb_build_object('prepared',prepared->'value','challengeId',challenge_id,'codeMac',repeat('a',64),'keyId','fixture','ipHash',repeat('b',64)));
  if not (result->>'ok')::boolean then raise exception 'Attempt fixture creation failed %',result; end if;
  perform public.admin_verification_mark_email_delivery(jsonb_build_object('challengeId',challenge_id,'delivered',true));
  for n in 1..5 loop
    result := public.admin_verification_redeem_email(jsonb_build_object('actor',actor,'challengeId',challenge_id,'candidateMacs',jsonb_build_array(repeat('d',64)),'tokenHash',repeat('c',64),'ipHash',repeat('b',64)));
    if (result->>'ok')::boolean then raise exception 'Incorrect code passed'; end if;
  end loop;
  result := public.admin_verification_redeem_email(jsonb_build_object('actor',actor,'challengeId',challenge_id,'candidateMacs',jsonb_build_array(repeat('a',64)),'tokenHash',repeat('c',64),'ipHash',repeat('b',64)));
  if (result->>'ok')::boolean or (select failed_attempts from private.admin_verification_challenges where id=challenge_id)<>5 then raise exception 'Code attempt bound failed'; end if;
  result := public.admin_verification_begin_email(jsonb_build_object('prepared',prepared->'value','challengeId',extensions.gen_random_uuid(),'codeMac',repeat('a',64),'keyId','fixture','ipHash',repeat('b',64)));
  if result->>'code'<>'rate_limited' then raise exception 'Resend cooldown failed %',result; end if;
  update private.admin_verification_rate_events set occurred_at=clock_timestamp()-interval '61 seconds' where kind='email_send_account' and subject_hash=u::text;
  challenge_id:=extensions.gen_random_uuid();
  result := public.admin_verification_begin_email(jsonb_build_object('prepared',prepared->'value','challengeId',challenge_id,'codeMac',repeat('a',64),'keyId','fixture','ipHash',repeat('b',64)));
  if not (result->>'ok')::boolean then raise exception 'Third send failed %',result; end if;
  perform public.admin_verification_mark_email_delivery(jsonb_build_object('challengeId',challenge_id,'delivered',false));
  if not exists(select 1 from private.admin_verification_audit where user_id=u and event='mark_email_delivery' and outcome='delivery_failed') then raise exception 'Delivery failure audit missing'; end if;
  update private.admin_verification_rate_events set occurred_at=clock_timestamp()-interval '61 seconds' where kind='email_send_account' and subject_hash=u::text;
  prepared := public.admin_verification_prepare(jsonb_build_object('actor',actor,'intent',jsonb_build_object('operation','admin.retention.read','payload','{}'::jsonb)));
  result := public.admin_verification_begin_email(jsonb_build_object('prepared',prepared->'value','challengeId',extensions.gen_random_uuid(),'codeMac',repeat('a',64),'keyId','fixture','ipHash',repeat('b',64)));
  if result->>'code'<>'rate_limited' then raise exception 'Account send limit was reset by another operation %',result; end if;
  -- Real AAL2 still requires an action-bound password proof for admin roles.
  insert into auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at) values(fixture_factor_id,u,'totp','verified',now(),now());
  result := public.admin_verification_record_enrollment(jsonb_build_object('userId',u,'evidence','confirmed_factor'));
  if not (result->>'ok')::boolean then raise exception 'Verified factor evidence rejected %',result; end if;
  update auth.sessions set aal='aal2',factor_id=fixture_factor_id where id=sid;
  update auth.mfa_factors set factor_type='phone',phone='+12025550101' where id=fixture_factor_id;
  ctx := public.admin_verification_context(jsonb_build_object('userId',u,'sessionId',sid,'roleVersion',v,'currentLevel','aal2'));
  if (ctx->>'ok')::boolean then raise exception 'Non-authenticator factor accepted as authenticator verification'; end if;
  update auth.mfa_factors set factor_type='totp',phone=null where id=fixture_factor_id;
  ctx := public.admin_verification_context(jsonb_build_object('userId',u,'sessionId',sid,'roleVersion',v,'currentLevel','aal2')); actor:=ctx->'value';
  if actor->>'enrollment'<>'enrolled' then raise exception 'Confirmed factor not remembered'; end if;
  role_intent := jsonb_build_object('operation','admin.role.change','payload',jsonb_build_object('adminProfileId',u,'roleCode','admin','confirmation','fixture'));
  input := jsonb_build_object('actor',actor,'intent',role_intent);
  result := public.admin_verification_reserve(input);
  if (result->>'ok')::boolean then raise exception 'AAL2 alone authorized a role change'; end if;
  prepared := public.admin_verification_prepare(input);
  result := public.admin_verification_issue_password(jsonb_build_object('prepared',prepared->'value','tokenHash',repeat('c',64)));
  if (result->>'ok')::boolean then raise exception 'Password proof issued without attempt reservation'; end if;
  for n in 1..3 loop
    result := public.admin_verification_reserve_password_attempt(jsonb_build_object('prepared',prepared->'value','ipHash',repeat('b',64)));
    if not (result->>'ok')::boolean then raise exception 'Allowed password attempt failed %',result; end if;
  end loop;
  result := public.admin_verification_reserve_password_attempt(jsonb_build_object('prepared',prepared->'value','ipHash',repeat('b',64)));
  if result->>'code'<>'rate_limited' then raise exception 'Fourth password check not limited'; end if;
  result := public.admin_verification_issue_password(jsonb_build_object('prepared',prepared->'value','tokenHash',repeat('c',64)));
  proof_id := (result#>>'{value,proofId}')::uuid;
  result := public.admin_verification_reserve(input || jsonb_build_object('proofId',proof_id,'tokenHash',repeat('c',64)));
  if not (result->>'ok')::boolean then raise exception 'AAL2 plus password denied %',result; end if;
  result := public.admin_verification_reserve(input || jsonb_build_object('proofId',proof_id,'tokenHash',repeat('c',64)));
  if (result->>'ok')::boolean then raise exception 'Password proof reused'; end if;
  delete from auth.mfa_factors where id=fixture_factor_id;
  update auth.sessions set aal='aal1',factor_id=null where id=sid;
  ctx := public.admin_verification_context(jsonb_build_object('userId',u,'sessionId',sid,'roleVersion',v,'currentLevel','aal1'));
  if ctx#>>'{value,enrollment}'<>'enrolled' then raise exception 'Removing factor created never-enrolled eligibility'; end if;
  -- ACL checks apply even though the function implementation is security definer.
  if has_function_privilege('authenticated','public.admin_verification_prepare(jsonb)','EXECUTE')
    or has_function_privilege('anon','public.admin_verification_issue_password(jsonb)','EXECUTE')
    or has_table_privilege('authenticated','private.admin_verification_proofs','SELECT') then raise exception 'Browser verification ACL leak'; end if;
  delete from auth.sessions where id=sid;
  ctx := public.admin_verification_context(jsonb_build_object('userId',u,'sessionId',sid,'roleVersion',v,'currentLevel','aal1'));
  if (ctx->>'ok')::boolean then raise exception 'Revoked session remained authorized'; end if;
end;
$verify$;
rollback;
