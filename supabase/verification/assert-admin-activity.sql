-- Disposable private activity receipts; never run against linked data.
begin;
do $test$
declare uid uuid:=extensions.gen_random_uuid(); sid uuid:=extensions.gen_random_uuid(); eid uuid:=extensions.gen_random_uuid(); e jsonb; before_count bigint; result text;
begin
 if to_regclass('private.admin_activity_events') is null then raise exception 'Activity foundation is not implemented';end if;
 if has_function_privilege('anon','public.append_admin_activity(jsonb,uuid)','execute')
  or has_function_privilege('authenticated','public.append_admin_activity(jsonb,uuid)','execute') then raise exception 'Browser can forge activity receipts';end if;
 if not has_function_privilege('service_role','public.append_admin_activity(jsonb,uuid)','execute') then raise exception 'Service receipt unavailable';end if;
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='private' and c.relname like 'admin_activity_%' and c.relkind='r' and not c.relrowsecurity) then raise exception 'Activity table lacks RLS';end if;
 insert into auth.users(id,email)values(uid,'activity-fixture@local.invalid');
 insert into public.admin_profiles(user_id,admin_code,display_name,is_active,status)values(uid,'JN-ADM-209991','Activity Fixture',true,'active');
 insert into public.rbac_user_platform_roles(user_id,role_id,scope)select uid,id,'admin' from public.rbac_platform_roles where code='content_admin' and scope='admin';
 insert into auth.sessions(id,user_id,aal,created_at,updated_at)values(sid,uid,'aal1',now(),now());
 update public.security_settings set admin_totp_enforced=false;
 e:=jsonb_build_object('id',eid,'source','workspace_entry','sourceId','session:'||sid,'actorUserId',uid,'targetUserId',null,'action','workspace.entry','outcome','succeeded','occurredAt',clock_timestamp(),'recordedAt',clock_timestamp(),'context',null,'provenance','Verified native workspace entry');
 result:=public.append_admin_activity(e,sid);
 if result is distinct from 'stored' then raise exception 'Valid receipt not stored';end if;
 if public.append_admin_activity(e,sid) is distinct from 'duplicate' then raise exception 'Replay not deduplicated';end if;
 select count(*)into before_count from private.admin_activity_events;
 begin perform public.append_admin_activity(e||'{"outcome":"failed"}',sid);raise exception 'Forged outcome accepted';exception when invalid_parameter_value then null;end;
 begin perform public.append_admin_activity(e||'{"password":"secret"}',sid);raise exception 'Secret field accepted';exception when invalid_parameter_value then null;end;
 begin perform public.append_admin_activity(e,extensions.gen_random_uuid());raise exception 'Invalid session accepted';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claims','{"role":"authenticated"}',true);
 insert into public.audit_events(actor_user_id,action,entity_type)values(uid,'member.profile_updated','member');
 if(select count(*)from private.admin_activity_events)<>before_count then raise exception 'Legacy client audit forged completed work';end if;
 perform set_config('request.jwt.claims','{"role":"service_role"}',true);
 insert into public.audit_events(actor_user_id,action,entity_type)values(uid,'member.profile_updated','member');
 if(select count(*)from private.admin_activity_events)<>before_count+1 then raise exception 'Trusted committed receipt missing';end if;
 insert into public.audit_events(actor_user_id,action,entity_type)values(uid,'content.notice_created','notice');
 if not exists(select 1 from private.admin_activity_events where action='content.notice_created'and outcome='succeeded'and is_completed_work)then raise exception 'Committed notice creation was not classified';end if;
 insert into public.audit_events(actor_user_id,action,entity_type)values(uid,'content.cloudinary_upload_signature_issued','media');
 if not exists(select 1 from private.admin_activity_events where action='content.cloudinary_upload_signature_issued'and outcome='succeeded'and not is_completed_work)then raise exception 'Access receipt mistaken for completed work or unknown outcome';end if;
 insert into public.audit_events(actor_user_id,action,entity_type)values(uid,'unknown.future_action','fixture');
 if not exists(select 1 from private.admin_activity_events where action='unknown.future_action'and outcome='unknown'and not is_completed_work)then raise exception 'Uncatalogued action invented successful work';end if;
 if(select last_workspace_access_at from private.admin_activity_summaries where user_id=uid)is null then raise exception 'Summary not retained';end if;
 if not exists(select 1 from private.admin_activity_receipts where source='workspace_entry' and source_id='session:'||sid)then raise exception 'Durable replay key missing';end if;
 update public.security_settings set admin_totp_enforced=true;
 begin perform public.append_admin_activity(e,sid);raise exception 'AAL1 bypassed enforced policy';exception when insufficient_privilege then null;end;
end $test$;
do $query_test$
declare uid uuid;sid uuid;actor jsonb;result jsonb;next_page jsonb;lease uuid;native_id uuid:=extensions.gen_random_uuid();old_id uuid:=extensions.gen_random_uuid();event jsonb;work_before bigint;native_rows bigint;cursor_seen text;
begin
 if to_regprocedure('public.query_admin_activity(jsonb,jsonb,uuid)')is null then raise exception 'Bounded activity reader is not implemented';end if;
 if to_regprocedure('public.collect_admin_auth_activity(integer,boolean,uuid)')is null then raise exception 'Native collection is not implemented';end if;
 select user_id into uid from public.admin_profiles where admin_code='JN-ADM-209991';
 select id into sid from auth.sessions where user_id=uid limit 1;
 update public.security_settings set admin_totp_enforced=false;
 actor:=jsonb_build_object('userId',uid,'sessionId',sid,'roleVersion',(select version from public.rbac_user_claim_versions where user_id=uid),'currentLevel','aal1');
 begin perform public.query_admin_activity(actor,'{}');raise exception 'Content role read audit without permission';exception when insufficient_privilege then null;end;
 update public.rbac_user_platform_roles set role_id=(select id from public.rbac_platform_roles where code='super_admin'and scope='admin')where user_id=uid and scope='admin'and revoked_at is null;
 actor:=jsonb_set(actor,'{roleVersion}',to_jsonb((select version from public.rbac_user_claim_versions where user_id=uid)));
 for i in 1..125 loop
  perform private.admin_activity_append(jsonb_build_object('id',extensions.gen_random_uuid(),'source','application_commit','sourceId','bounded:'||i,'actorUserId',uid,'targetUserId',null,'action','fixture.work','outcome','succeeded','occurredAt',transaction_timestamp(),'recordedAt',clock_timestamp(),'context',jsonb_build_object('observedIp','198.51.100.10','clientIp',null,'countryCode',null,'browser','Chrome 140','os','Windows','deviceClass','desktop','networkSource','vercel_edge'),'provenance','Disposable committed receipt'),true);
 end loop;
 result:=public.query_admin_activity(actor,'{"page":1,"pageSize":1000}');next_page:=public.query_admin_activity(actor,'{"page":2,"pageSize":100}');
 if jsonb_array_length(result->'items')<>100 or(result->>'pageSize')::integer<>100 then raise exception 'Activity page is not bounded';end if;
 if jsonb_array_length(result->'filterOptions'->'actors')<>1 or result#>>'{filterOptions,actors,0,value}'is distinct from uid::text then raise exception 'Bounded actor filter options missing';end if;
 if exists(select 1 from jsonb_array_elements(result->'items')a join jsonb_array_elements(next_page->'items')b on a->>'id'=b->>'id')then raise exception 'Equal-time pagination duplicates';end if;
 if result::text like '%198.51.100.10%'then raise exception 'Default view exposed full network';end if;
 if result::text not like '%Vercel-observed edge (masked): 198.51.x.x%'then raise exception 'Default view falsely discarded known masked network evidence';end if;
 if private.admin_activity_mask_ip('2001:db8:1:2:3:4:5:6')is distinct from '2001:db8:…'then raise exception 'IPv6 display exposed full network';end if;
 if public.query_admin_activity(actor,'{"page":999,"pageSize":100}')->>'page' is distinct from '2'then raise exception 'Out-of-range page not clamped';end if;
 result:=public.query_admin_activity(actor,'{"action":"fixture.work"}',(select id from private.admin_activity_events where action='fixture.work'order by id desc limit 1));
 if result::text not like '%Vercel-observed edge:%'then raise exception 'Explicit authorized network context absent';end if;
 -- Audit-only ordinary admins can see masked context, never explicit full network.
 update public.rbac_user_platform_roles set role_id=(select id from public.rbac_platform_roles where code='admin'and scope='admin')where user_id=uid and scope='admin'and revoked_at is null;
 delete from public.rbac_role_permissions where role_id=(select id from public.rbac_platform_roles where code='admin'and scope='admin')and permission_code='admin.security.read';
 actor:=jsonb_set(actor,'{roleVersion}',to_jsonb((select version from public.rbac_user_claim_versions where user_id=uid)));
 result:=public.query_admin_activity(actor,'{"action":"fixture.work"}');
 if result::text like '%198.51.100.10%'or result::text not like '%Vercel-observed edge (masked)%'then raise exception 'Audit-only reader network scope incorrect';end if;
 begin perform public.query_admin_activity(actor,'{}',(select id from private.admin_activity_events where action='fixture.work'limit 1));raise exception 'Audit-only reader got full network';exception when insufficient_privilege then null;end;
 update public.admin_profiles set is_active=false where user_id=uid;
 begin perform public.query_admin_activity(actor,'{}');raise exception 'Disabled reader retained access';exception when insufficient_privilege then null;end;
 update public.admin_profiles set is_active=true where user_id=uid;
 insert into public.rbac_role_permissions(role_id,permission_code)select id,'admin.security.read'from public.rbac_platform_roles where code='admin'and scope='admin';
 update public.rbac_user_platform_roles set role_id=(select id from public.rbac_platform_roles where code='super_admin'and scope='admin')where user_id=uid and scope='admin'and revoked_at is null;
 actor:=jsonb_set(actor,'{roleVersion}',to_jsonb((select version from public.rbac_user_claim_versions where user_id=uid)));
 work_before:=(select completed_work_count from private.admin_activity_summaries where user_id=uid);
 insert into auth.audit_log_entries(id,payload,created_at,ip_address)values(native_id,jsonb_build_object('actor_id',uid,'actor_username','private@local.invalid','action','user_updated_password','traits',jsonb_build_object('token','forbidden')),clock_timestamp(),'198.51.100.2');
 lease:=(public.claim_admin_accountability_job()->>'leaseId')::uuid;
 if(public.claim_admin_accountability_job()->>'claimed')::boolean then raise exception 'Concurrent lease acquired';end if;
 result:=public.collect_admin_auth_activity(500,true,lease);
 if(result->>'read')::integer<>1 or(result->>'stored')::integer<>0 then raise exception 'Native dry run mutated or lost event';end if;
 result:=public.collect_admin_auth_activity(500,false,lease);
 if(result->>'stored')::integer<>1 then raise exception 'Native committed password not collected';end if;
 if exists(select 1 from private.admin_activity_events where source='native_auth'and context::text like '%forbidden%')then raise exception 'Raw provider payload leaked';end if;
 if(select completed_work_count from private.admin_activity_summaries where user_id=uid)<>work_before then raise exception 'Auth counted as work';end if;
 if(public.collect_admin_auth_activity(500,false,lease)->>'stored')::integer<>0 then raise exception 'Native replay duplicated';end if;
 perform public.release_admin_accountability_job(lease,true);
 if(select state from private.admin_activity_ingestion_state where name='native_auth')is distinct from 'delayed'then raise exception 'Job failure health not recorded';end if;
 begin perform public.collect_admin_auth_activity(500,false,lease);raise exception 'Expired lease accepted';exception when insufficient_privilege then null;end;
 event:=jsonb_build_object('id',old_id,'source','application_commit','sourceId','expired:fixture','actorUserId',uid,'targetUserId',null,'action','fixture.old','outcome','succeeded','occurredAt',clock_timestamp()-interval '4 months','recordedAt',clock_timestamp(),'context',null,'provenance','Disposable old receipt');
 perform private.admin_activity_append(event,true);
 if(public.preview_admin_activity_retention()->>'eligible')::integer<>0 then raise exception 'Late event expired at ingestion';end if;
 update private.admin_activity_events set recorded_at=clock_timestamp()-interval '4 months'where id=old_id;
 begin perform public.purge_expired_admin_activity(1);raise exception 'Unactivated purge ran';exception when insufficient_privilege then null;end;
 update private.admin_activity_summaries set incident_hold=true where user_id=uid;
 if(public.preview_admin_activity_retention()->>'eligible')::integer<>0 then raise exception 'Incident hold not respected';end if;
 update private.admin_activity_summaries set incident_hold=false where user_id=uid;
 update private.admin_activity_ingestion_state set purge_enabled=true where name='application';
 select count(*)into native_rows from auth.audit_log_entries;
 if(public.purge_expired_admin_activity(1)->>'deleted')::integer<>1 then raise exception 'Eligible projection not purged';end if;
 if not exists(select 1 from private.admin_activity_receipts where source_id='expired:fixture')then raise exception 'Replay key purged';end if;
 if private.admin_activity_append(event,true)is distinct from 'duplicate'then raise exception 'Purged event resurrected';end if;
 if(select count(*)from auth.audit_log_entries)<>native_rows then raise exception 'Provider history modified by projection retention';end if;
 if not exists(select 1 from private.admin_activity_summaries where user_id=uid)then raise exception 'Lifetime summary lost';end if;
 -- Summary cleanup requires actual permanent removal, grace and no incident hold.
 update private.admin_activity_summaries set permanently_removed_at=clock_timestamp()-interval '4 months'where user_id=uid;
 perform public.purge_expired_admin_activity(500);
 if not exists(select 1 from private.admin_activity_summaries where user_id=uid)then raise exception 'Active identity summary purged';end if;
 update public.admin_profiles set status='removed',is_active=false where user_id=uid;
 update private.admin_activity_summaries set permanently_removed_at=clock_timestamp()-interval '4 months',incident_hold=true where user_id=uid;
 perform public.purge_expired_admin_activity(500);
 if not exists(select 1 from private.admin_activity_summaries where user_id=uid)then raise exception 'Held summary purged';end if;
 update private.admin_activity_summaries set incident_hold=false where user_id=uid;
 perform public.purge_expired_admin_activity(500);
 if exists(select 1 from private.admin_activity_summaries where user_id=uid)then raise exception 'Permanent-removal summary grace cleanup missing';end if;
 if not exists(select 1 from private.admin_activity_receipts where source_id='expired:fixture')then raise exception 'Summary cleanup lost replay protection';end if;
 if has_function_privilege('authenticated','public.query_admin_activity(jsonb,jsonb,uuid)','execute')or has_function_privilege('anon','public.collect_admin_auth_activity(integer,boolean,uuid)','execute')then raise exception 'Activity reader/collector exposed to browser roles';end if;
end $query_test$;

do $routine_test$
declare uid uuid:=extensions.gen_random_uuid();refresh_id uuid:=extensions.gen_random_uuid();password_id uuid:=extensions.gen_random_uuid();unknown_id uuid:=extensions.gen_random_uuid();result jsonb;
begin
 if to_regprocedure('public.preview_routine_auth_retention()')is null then raise exception 'Routine Auth retention policy missing';end if;
 update private.admin_activity_ingestion_state set cutover_at=clock_timestamp()-interval '2 months'where name='routine_auth_retention';
 insert into auth.audit_log_entries(id,payload,created_at,ip_address)values
 (refresh_id,jsonb_build_object('actor_id',uid,'action','token_refreshed'),clock_timestamp()-interval '31 days',''),
 (password_id,jsonb_build_object('actor_id',uid,'action','user_updated_password'),clock_timestamp()-interval '4 months',''),
 (unknown_id,jsonb_build_object('actor_id',uid,'action','unknown_future_action'),clock_timestamp()-interval '4 months','');
 if(public.preview_routine_auth_retention()->>'eligible')::integer<>1 then raise exception 'Refresh-only 30day preview incorrect';end if;
 begin perform public.purge_routine_auth_retention(500);raise exception 'Unactivated raw cleanup ran';exception when insufficient_privilege then null;end;
 insert into private.admin_activity_summaries(user_id,incident_hold)values(uid,true);
 if(public.preview_routine_auth_retention()->>'eligible')::integer<>0 then raise exception 'Raw Auth cleanup ignored incident hold';end if;
 update private.admin_activity_summaries set incident_hold=false where user_id=uid;
 update private.admin_activity_ingestion_state set purge_enabled=true where name='routine_auth_retention';
 result:=public.purge_routine_auth_retention(1);
 if(result->>'deleted')::integer<>1 or exists(select 1 from auth.audit_log_entries where id=refresh_id)then raise exception 'Bounded old refresh cleanup failed';end if;
 if(select count(*)from auth.audit_log_entries where id in(password_id,unknown_id))<>2 then raise exception 'Important or unknown Auth evidence purged';end if;
 if has_function_privilege('authenticated','public.purge_routine_auth_retention(integer)','execute')or has_function_privilege('anon','public.preview_routine_auth_retention()','execute')then raise exception 'Raw retention exposed to browser';end if;
end $routine_test$;

do $invitation_test$
declare uid uuid;profile public.admin_profiles%rowtype;iid uuid:=extensions.gen_random_uuid();before_work bigint;
begin
 update public.admin_profiles set status='active',is_active=true where admin_code='JN-ADM-209991';
 select *into profile from public.admin_profiles where admin_code='JN-ADM-209991';uid:=profile.user_id;
 perform set_config('request.jwt.claims','{"role":"authenticated"}',true);
 before_work:=(select coalesce(completed_work_count,0)from private.admin_activity_summaries where user_id=uid);
 insert into public.audit_events(actor_user_id,action,entity_type,metadata)values(uid,'admin_invitation.accepted','admin_profile',jsonb_build_object('invitationId',iid));
 if exists(select 1 from private.admin_activity_events where source_id='invitation:'||iid||':accepted')then raise exception 'Browser audit forged invitation acceptance';end if;
 perform private.record_verified_admin_account_event(uid,profile,'admin_invitation.accepted',jsonb_build_object('invitationId',iid),'warning');
 if not exists(select 1 from private.admin_activity_events where source_id='invitation:'||iid||':accepted'and outcome='succeeded'and target_user_id=uid and not is_completed_work)then raise exception 'Committed native invitation acceptance receipt missing';end if;
 perform private.record_verified_admin_account_event(uid,profile,'admin_invitation.accepted',jsonb_build_object('invitationId',iid),'warning');
 if(select count(*)from private.admin_activity_events where source_id='invitation:'||iid||':accepted')<>1 then raise exception 'Invitation acceptance replay duplicated';end if;
end $invitation_test$;

do $committed_membership$
declare
 u uuid:=extensions.gen_random_uuid();sid uuid:=extensions.gen_random_uuid();fid uuid:=extensions.gen_random_uuid();
 mid uuid;req uuid;stamp timestamptz;result jsonb;first_work bigint;last_work timestamptz;failures text[]:='{}';
begin
 insert into auth.users(id,email,email_confirmed_at)values(u,'activity-guard-fixture@local.invalid',now());
 insert into public.admin_profiles(user_id,admin_code,display_name,status,is_active)values(u,'JN-ADM-209992','Activity guard fixture','active',true);
 insert into public.rbac_user_platform_roles(user_id,role_id,scope)select u,id,'admin'from public.rbac_platform_roles where code='super_admin'and scope='admin';
 insert into auth.mfa_factors(id,user_id,factor_type,status,created_at,updated_at)values(fid,u,'totp','verified',now(),now());
 insert into auth.sessions(id,user_id,aal,factor_id,created_at,updated_at)values(sid,u,'aal2',fid,now(),now());
 update public.security_settings set admin_totp_enforced=false;
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated','aal','aal2','session_id',sid,'jnuits_role_version',(select version from public.rbac_user_claim_versions where user_id=u))::text,true);
 insert into public.members(jnuits_id,full_name,joined_on,lifecycle_status,portal_access_status)values('JnUITS-2099944','Activity review fixture','2023-01-01','former','frozen')returning id into mid;
 insert into public.profile_update_requests(member_id,request_type,payload,status)values(mid,'alumni_conversion','{}','pending')returning id,updated_at into req,stamp;
 execute 'set local role authenticated';
 result:=public.review_membership_request(req,stamp,'approved','Fictional activity review');
 result:=public.review_membership_request(req,stamp,'approved','Fictional activity retry');
 execute 'reset role';
 if result->>'status'<>'already_reviewed' or(select count(*)from private.admin_activity_events where source_id='membership-request:'||req and is_completed_work)<>1 then
  failures:=array_append(failures,'Real routine review needs one request-bound work receipt; already_reviewed must not duplicate');
 end if;
 insert into public.members(jnuits_id,full_name,joined_on,lifecycle_status,portal_access_status)values('JnUITS-2099943','Activity renewal fixture','2024-01-01','former','frozen')returning id into mid;
 execute 'set local role authenticated';
 result:=public.confirm_membership_renewal(mid,'2025-01-01','paid',null,'Fictional activity renewal');
 execute 'reset role';
 select completed_work_count,last_completed_work_at into first_work,last_work from private.admin_activity_summaries where user_id=u;
 execute 'set local role authenticated';
 result:=public.confirm_membership_renewal(mid,'2025-01-01','paid',null,'Fictional activity renewal');
 execute 'reset role';
 if result->>'status'<>'already_confirmed' or(select completed_work_count from private.admin_activity_summaries where user_id=u)<>first_work
  or(select last_completed_work_at from private.admin_activity_summaries where user_id=u)is distinct from last_work then
  failures:=array_append(failures,'Renewal no-op manufactured completed work');
 end if;
 if(select count(*)from private.admin_verification_attempts a join private.admin_verification_intents i on i.id=a.intent_id where i.user_id=u and i.operation='membership.renewal.confirm'and a.status='completed')<>2 then raise exception 'Renewal attempt completion changed';end if;
 if cardinality(failures)>0 then raise exception '%',array_to_string(failures,'; ');end if;
end $committed_membership$;

do $plans$
declare plan jsonb;
begin
 insert into private.admin_activity_events(id,source,source_id,actor_user_id,action,outcome,occurred_at,recorded_at,provenance)
 select extensions.gen_random_uuid(),'application_commit','plan-fixture:'||g,md5('actor:'||(g%50))::uuid,'fixture.plan','succeeded',
  clock_timestamp()-g*interval '1 second',clock_timestamp(),'Disposable performance fixture'from generate_series(1,10000)g;
 analyze private.admin_activity_events;
 execute 'explain(analyze,buffers,format json)select id,occurred_at,action from private.admin_activity_events order by occurred_at desc,id desc limit 25'into plan;
 raise notice 'ACTIVITY GLOBAL PLAN %',plan;
 if plan#>>'{0,Plan,Node Type}'<>'Limit'or plan#>>'{0,Plan,Plans,0,Node Type}'not in('Index Scan','Index Only Scan')then raise exception 'Archive reads sort unbounded event history';end if;
 execute format('explain(analyze,buffers,format json)select id,occurred_at,action from private.admin_activity_events where actor_user_id=%L::uuid order by occurred_at desc,id desc limit 25',md5('actor:1')::uuid)into plan;
 raise notice 'ACTIVITY ACTOR PLAN %',plan;
 if plan#>>'{0,Plan,Node Type}'<>'Limit'or plan#>>'{0,Plan,Plans,0,Node Type}'not in('Index Scan','Index Only Scan')then raise exception 'Actor reads do not use bounded ordered index';end if;
end $plans$;
rollback;
