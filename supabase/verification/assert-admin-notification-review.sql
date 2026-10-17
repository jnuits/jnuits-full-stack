begin;
do $test$
declare uid uuid:=extensions.gen_random_uuid();peer uuid:=extensions.gen_random_uuid();eid uuid;did uuid;fresh uuid;other_delivery uuid;claim jsonb;ids jsonb;lease uuid;payload jsonb;issues text[]:='{}';i integer;month_key text:=to_char(clock_timestamp()at time zone 'Asia/Dhaka','YYYY-MM');
begin
 insert into auth.users(id,email,email_confirmed_at)values(uid,'review-notice@local.invalid',clock_timestamp()),(peer,'review-peer@local.invalid',clock_timestamp());
 insert into public.admin_profiles(user_id,admin_code,display_name,is_active,status)values(uid,'JN-ADM-209951','Review Owner',true,'active'),(peer,'JN-ADM-209952','Review Peer',true,'active');
 insert into public.rbac_user_platform_roles(user_id,role_id,scope)select subject,r.id,'admin'from unnest(array[uid,peer])subject cross join public.rbac_platform_roles r where r.code='admin'and r.scope='admin';
 insert into public.portal_user_settings(user_id,admin_security_email_opt_in,admin_recommendation_email_opt_in)values(uid,true,true),(peer,true,true);
 update private.admin_notification_controls set delivery_enabled=true,delivery_cutover=clock_timestamp()-interval '2 days'where singleton;
 lease:=(public.claim_admin_accountability_job()->>'leaseId')::uuid;
 payload:=jsonb_build_object('from','JnUITS <no-reply@jnuits.org.bd>','replyTo','no-reply@jnuits.org.bd','to','review-notice@local.invalid','subject','Review fixture','html','<p>Fixture</p>','text','Fixture');
 begin
  for i in 1..11 loop
   eid:=extensions.gen_random_uuid();
   perform private.admin_activity_append(jsonb_build_object('id',eid,'source','application_commit','sourceId','operation:'||eid,'actorUserId',uid,'targetUserId',peer,'action','admin.role.change','outcome','succeeded','occurredAt',clock_timestamp(),'context',null,'provenance','Disposable delivery progress regression'),false);
   select id into did from private.admin_security_notices where recipient_user_id=uid and event_key='application_commit:operation:'||eid;
   did:=public.queue_admin_notice_email(did,payload);if did is null then raise exception 'Review candidate setup missing';end if;
   if i<=10 then update private.admin_notification_deliveries set state=case when i%2=0 then 'failed'else 'uncertain'end,last_failure_kind=case when i%2=0 then 'rate_limited'else 'uncertain'end,has_uncertain_outcome=true,first_attempt_at=clock_timestamp()-interval '25 hours',created_at=clock_timestamp()-interval '26 hours'where id=did;
   else fresh:=did;end if;
  end loop;
  ids:=public.list_admin_notification_deliveries(lease,10);
  if not ids?fresh::text then raise exception 'Expired uncertainty starves fresh pending delivery';end if;
  if jsonb_array_length(ids)<>1 or public.claim_admin_notification_delivery(fresh,lease)is null then raise exception 'Reconciliation-only rows remain retry candidates';end if;
 exception when raise_exception then issues:=array_append(issues,sqlerrm);
 end;
 begin
  if not private.admin_verification_has_permission(uid,'admin.membership.manage')then raise exception 'Review permission setup missing';end if;
  did:=public.queue_admin_recommendation_email(uid,month_key,payload,1,array['queue-applications']);
  other_delivery:=public.queue_admin_recommendation_email(peer,month_key,payload||'{"to":"review-peer@local.invalid"}',1,array['queue-profile_requests']);
  claim:=public.claim_admin_notification_delivery(did,lease);if claim is null or other_delivery is null then raise exception 'Review digest setup missing';end if;
  update public.rbac_user_platform_roles set revoked_at=clock_timestamp()where user_id in(uid,peer)and scope='admin'and revoked_at is null;
  insert into public.rbac_user_platform_roles(user_id,role_id,scope)select subject,r.id,'admin'from unnest(array[uid,peer])subject cross join public.rbac_platform_roles r where r.code='content_admin'and r.scope='admin';
  if not private.admin_activity_eligible(uid)or private.admin_verification_has_permission(uid,'admin.membership.manage')then raise exception 'Review permission-only revocation setup missing';end if;
  if public.validate_admin_notification_delivery(did,(claim->>'claimToken')::uuid,lease)or public.claim_admin_notification_delivery(other_delivery,lease)is not null then raise exception 'Frozen digest retains revoked queue permission';end if;
 exception when raise_exception then issues:=array_append(issues,sqlerrm);
 end;
 perform public.release_admin_accountability_job(lease,false);
 if cardinality(issues)>0 then raise exception 'Review regressions: %',array_to_string(issues,'; ');end if;
end $test$;
rollback;
