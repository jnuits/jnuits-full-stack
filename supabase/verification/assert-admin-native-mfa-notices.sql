begin;
do $test$
declare uid uuid:=extensions.gen_random_uuid();fid uuid:=extensions.gen_random_uuid();first_id uuid:=extensions.gen_random_uuid();repeat_id uuid:=extensions.gen_random_uuid();removed_id uuid:=extensions.gen_random_uuid();lease uuid;result jsonb;
begin
 insert into auth.users(id,email,email_confirmed_at)values(uid,'native-mfa@local.invalid',clock_timestamp());
 insert into public.admin_profiles(user_id,admin_code,display_name,is_active,status)values(uid,'JN-ADM-209961','Native MFA Fixture',true,'active');
 insert into public.rbac_user_platform_roles(user_id,role_id,scope)select uid,id,'admin'from public.rbac_platform_roles where code='super_admin'and scope='admin';
 insert into auth.audit_log_entries(id,payload,created_at)values(extensions.gen_random_uuid(),jsonb_build_object('actor_id',uid,'action','factor_in_progress','traits',jsonb_build_object('factor_id',fid)),clock_timestamp());
 insert into auth.audit_log_entries(id,payload,created_at)values(first_id,jsonb_build_object('actor_id',uid,'action','verification_attempted','traits',jsonb_build_object('factor_id',fid,'factor_type','totp','challenge_id',extensions.gen_random_uuid(),'secret','must-never-leave-native-row')),clock_timestamp());
 insert into auth.audit_log_entries(id,payload,created_at)values(repeat_id,jsonb_build_object('actor_id',uid,'action','verification_attempted','traits',jsonb_build_object('factor_id',fid,'factor_type','totp','challenge_id',extensions.gen_random_uuid())),clock_timestamp());
 insert into auth.audit_log_entries(id,payload,created_at)values(removed_id,jsonb_build_object('actor_id',uid,'action','factor_unenrolled','traits',jsonb_build_object('factor_id',fid,'factor_status','verified')),clock_timestamp());
 -- Unknown prior setup or cancellation must never become a completed new enrollment.
 insert into auth.audit_log_entries(id,payload,created_at)values(extensions.gen_random_uuid(),jsonb_build_object('actor_id',uid,'action','verification_attempted','traits',jsonb_build_object('factor_id',extensions.gen_random_uuid())),clock_timestamp());
 insert into auth.audit_log_entries(id,payload,created_at)values(extensions.gen_random_uuid(),jsonb_build_object('actor_id',uid,'action','factor_unenrolled','traits',jsonb_build_object('factor_id',extensions.gen_random_uuid(),'factor_status','unverified')),clock_timestamp());
 lease:=(public.claim_admin_accountability_job()->>'leaseId')::uuid;
 perform public.collect_admin_auth_activity(500,false,lease);
 if not exists(select 1 from private.admin_activity_events where id=first_id and source_id=first_id::text and action='auth.mfa_factor_enrolled'and outcome='succeeded')then raise exception 'Native completed factor enrollment not mapped';end if;
 if exists(select 1 from private.admin_activity_events where id=repeat_id and action='auth.mfa_factor_enrolled')then raise exception 'Routine MFA verification broadcast as added factor';end if;
 if not exists(select 1 from private.admin_activity_events where id=removed_id and action='auth.mfa_factor_unenrolled'and outcome='succeeded')then raise exception 'Native verified factor removal not mapped';end if;
 if(select count(*)from private.admin_activity_events where actor_user_id=uid and action in('auth.mfa_factor_enrolled','auth.mfa_factor_unenrolled'))<>2 then raise exception 'Attempt or unknown history counted as completed MFA change';end if;
 if exists(select 1 from private.admin_activity_events where actor_user_id=uid and context::text like '%must-never%')then raise exception 'Native setup traits leaked';end if;
 result:=public.collect_admin_security_notices(500,false,lease);
 if(result->>'created')::integer<>2 then raise exception 'Native MFA panel notices missing or duplicated';end if;
 if(public.collect_admin_auth_activity(500,false,lease)->>'stored')::integer<>0 or(public.collect_admin_security_notices(500,false,lease)->>'created')::integer<>0 then raise exception 'Native MFA replay duplicated';end if;
 insert into public.portal_user_settings(user_id,admin_security_email_opt_in)values(uid,true);
 update private.admin_notification_controls set delivery_enabled=true,delivery_cutover=clock_timestamp()-interval '1 minute'where singleton;
 if public.queue_admin_notice_email((select id from private.admin_security_notices where recipient_user_id=uid and event_key='native_auth:'||first_id),
  jsonb_build_object('from','JnUITS <no-reply@jnuits.org.bd>','replyTo','no-reply@jnuits.org.bd','to','native-mfa@local.invalid','subject','Fixture','html','<p>Fixture</p>','text','Fixture'))is not null then raise exception 'Provider-owned account-holder MFA email duplicated';end if;
 perform public.release_admin_accountability_job(lease,false);
end $test$;
rollback;
