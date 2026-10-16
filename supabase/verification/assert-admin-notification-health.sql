begin;
do $test$
declare uid uuid:=extensions.gen_random_uuid();sid uuid:=extensions.gen_random_uuid();eid uuid:=extensions.gen_random_uuid();actor jsonb;lease uuid;result jsonb;
begin
 if to_regclass('private.admin_accountability_health')is null then raise exception 'Persistent job health missing';end if;
 if has_function_privilege('authenticated','public.record_admin_accountability_health(uuid,jsonb)','execute')then raise exception 'Browser job health write exposed';end if;
 insert into auth.users(id,email,email_confirmed_at)values(uid,'notice-health@local.invalid',clock_timestamp());
 insert into public.admin_profiles(user_id,admin_code,display_name,is_active,status)values(uid,'JN-ADM-209961','Health Fixture',true,'active');
 insert into public.rbac_user_platform_roles(user_id,role_id,scope)select uid,id,'admin'from public.rbac_platform_roles where code='super_admin'and scope='admin';
 insert into auth.sessions(id,user_id,aal,created_at,updated_at)values(sid,uid,'aal1',now(),now());update public.security_settings set admin_totp_enforced=false;
 actor:=jsonb_build_object('userId',uid,'sessionId',sid,'roleVersion',(select version from public.rbac_user_claim_versions where user_id=uid),'currentLevel','aal1');
 perform private.admin_activity_append(jsonb_build_object('id',eid,'source','application_commit','sourceId','operation:'||eid,'actorUserId',uid,'targetUserId',uid,'action','admin.role.invite','outcome','succeeded','occurredAt',clock_timestamp(),'context',null,'provenance','Disposable committed invitation'),false);
 if not exists(select 1 from private.admin_security_notices where event_key='application_commit:operation:'||eid and recipient_user_id=uid)then raise exception 'Committed invitation notice not immediate';end if;
 begin perform public.record_admin_accountability_health(extensions.gen_random_uuid(),'{"errors":[],"backlog":false}');raise exception 'Unleased health write allowed';exception when insufficient_privilege then null;end;
 lease:=(public.claim_admin_accountability_job()->>'leaseId')::uuid;
 perform public.record_admin_accountability_health(lease,'{"read":0,"imported":0,"notices":1,"sends":0,"digests":0,"backlog":false,"coverage":"partial","errors":[]}');
 result:=public.query_admin_accountability_health(actor);
 if result->>'lastSuccessfulAt'is null or result->>'state'<>'current'then raise exception 'Successful job health missing';end if;
 perform public.own_admin_email_preferences(actor,'{"admin_security_email_opt_in":true,"admin_recommendation_email_opt_in":false}');
 update private.admin_notification_controls set delivery_enabled=true,delivery_cutover=clock_timestamp()-interval '1 minute'where singleton;
 perform public.queue_admin_notice_email((select id from private.admin_security_notices where recipient_user_id=uid and event_key='application_commit:operation:'||eid),
  jsonb_build_object('from','JnUITS <no-reply@jnuits.org.bd>','replyTo','no-reply@jnuits.org.bd','to','notice-health@local.invalid','subject','Fixture pending','html','<p>Fixture</p>','text','Fixture'));
 result:=public.record_admin_accountability_health(lease,'{"errors":[],"backlog":false}');
 if result->>'backlog'is distinct from 'true'then raise exception 'Pending delivery not included in job backlog';end if;
 perform public.record_admin_accountability_health(lease,'{"read":0,"imported":0,"notices":0,"sends":0,"digests":0,"backlog":true,"coverage":"partial","errors":["notification_work_unavailable"]}');
 result:=public.query_admin_accountability_health(actor);
 if result->>'state'<>'attention'or result->>'lastSuccessfulAt'is null or result->>'backlog'<>'true'then raise exception 'Mail failure health lost or falsified native coverage';end if;
 begin perform public.record_admin_accountability_health(lease,'{"errors":["secret@example.test"],"backlog":false}');raise exception 'Arbitrary health message accepted';exception when invalid_parameter_value then null;end;
 perform public.release_admin_accountability_job(lease,false);
end $test$;
rollback;
