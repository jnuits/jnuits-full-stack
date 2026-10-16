-- Service-owned, replay-safe admin activity. Existing history retained by default.
begin;
create table private.admin_activity_events(
 id uuid primary key, source text not null check(source in('application_commit','native_auth','workspace_entry','workspace_access','admin_signin')),
 source_id text not null check(length(source_id) between 1 and 512),actor_user_id uuid,target_user_id uuid,
 action text not null check(length(action) between 1 and 160),outcome text not null check(outcome in('succeeded','failed','denied','unknown')),
 occurred_at timestamptz not null,recorded_at timestamptz not null default clock_timestamp(),context jsonb,
 provenance text not null check(length(provenance) between 1 and 200),is_completed_work boolean not null default false,
 unique(source,source_id)
);
create index admin_activity_actor_time on private.admin_activity_events(actor_user_id,occurred_at desc,id desc);
create index admin_activity_target_time on private.admin_activity_events(target_user_id,occurred_at desc,id desc);
create index admin_activity_action_time on private.admin_activity_events(action,occurred_at desc,id desc);
create index admin_activity_time on private.admin_activity_events(occurred_at desc,id desc);
create index admin_activity_retention on private.admin_activity_events(recorded_at,occurred_at);
create table private.admin_activity_receipts(
 source text not null,source_id text not null,actor_user_id uuid,action text not null,outcome text not null,recorded_at timestamptz not null default clock_timestamp(),
 primary key(source,source_id)
);
create table private.admin_activity_summaries(
 user_id uuid primary key,access_activated_at timestamptz,first_entry_at timestamptz,last_sign_in_at timestamptz,
 last_workspace_access_at timestamptz,last_completed_work_at timestamptz,completed_work_count bigint not null default 0,
 permanently_removed_at timestamptz,incident_hold boolean not null default false,updated_at timestamptz not null default clock_timestamp()
);
create table private.admin_activity_identity_periods(
 user_id uuid not null,active_from timestamptz not null,active_until timestamptz,primary key(user_id,active_from),
 check(active_until is null or active_until>=active_from)
);
create unique index admin_activity_identity_open on private.admin_activity_identity_periods(user_id)where active_until is null;
create table private.admin_activity_ingestion_state(
 name text primary key,cutover_at timestamptz not null default clock_timestamp(),observed_since timestamptz,continuous_since timestamptz,
 last_collected_at timestamptz,cursor jsonb,backlog boolean not null default false,state text not null default 'unavailable' check(state in('current','delayed','partial','unavailable')),
 lease_id uuid,lease_until timestamptz,purge_enabled boolean not null default false,error_code text
);
insert into private.admin_activity_ingestion_state(name)values('native_auth'),('workspace'),('application');
do $acl$
declare t text;
begin
 foreach t in array array['events','receipts','summaries','identity_periods','ingestion_state']loop
  execute format('alter table private.admin_activity_%I enable row level security',t);
  execute format('revoke all on private.admin_activity_%I from public,anon,authenticated,service_role',t);
 end loop;
end $acl$;

create function private.admin_activity_eligible(p_user uuid)returns boolean language sql stable security definer set search_path='' as $fn$
 select exists(select 1 from public.admin_profiles p where p.user_id=p_user and p.is_active and p.status='active'
  and exists(select 1 from public.rbac_user_platform_roles g join public.rbac_platform_roles r on r.id=g.role_id
    where g.user_id=p_user and g.revoked_at is null and g.scope='admin' and r.code in('super_admin','admin','content_admin')))
$fn$;

-- Identities are observation intervals from deployment onward, not invented pre-cutover history.
insert into private.admin_activity_identity_periods(user_id,active_from)
 select p.user_id,clock_timestamp()from public.admin_profiles p where private.admin_activity_eligible(p.user_id);
insert into private.admin_activity_summaries(user_id)select user_id from private.admin_activity_identity_periods;
create function private.admin_activity_sync_identity()returns trigger language plpgsql security definer set search_path='' as $fn$
declare uid uuid:=coalesce((to_jsonb(new)->>'user_id')::uuid,(to_jsonb(old)->>'user_id')::uuid); ts timestamptz:=clock_timestamp(); eligible boolean;
begin
 eligible:=private.admin_activity_eligible(uid);
 if eligible then
  insert into private.admin_activity_identity_periods(user_id,active_from)values(uid,ts)on conflict(user_id)where active_until is null do nothing;
  insert into private.admin_activity_summaries(user_id,access_activated_at)values(uid,ts)on conflict(user_id)do update set permanently_removed_at=null,updated_at=ts;
 else
  update private.admin_activity_identity_periods set active_until=ts where user_id=uid and active_until is null;
  if tg_table_name='admin_profiles'and(tg_op='DELETE'or to_jsonb(new)->>'status'='removed')then
   update private.admin_activity_summaries set permanently_removed_at=coalesce(permanently_removed_at,ts),updated_at=ts where user_id=uid;
  end if;
 end if;
 return null;
end $fn$;
create trigger admin_activity_identity_role after insert or update or delete on public.rbac_user_platform_roles for each row execute function private.admin_activity_sync_identity();
create trigger admin_activity_identity_profile after insert or update or delete on public.admin_profiles for each row execute function private.admin_activity_sync_identity();

create function private.admin_activity_append(p_event jsonb,p_work boolean default false)returns text language plpgsql security definer set search_path='' as $fn$
declare uid uuid:=(p_event->>'actorUserId')::uuid;src text:=p_event->>'source';sid text:=p_event->>'sourceId';act text:=p_event->>'action';outcome_value text:=p_event->>'outcome';occurred timestamptz:=(p_event->>'occurredAt')::timestamptz;ctx jsonb:=nullif(p_event->'context','null'::jsonb);receipt private.admin_activity_receipts%rowtype;ts timestamptz:=clock_timestamp();field text;
begin
 if jsonb_typeof(p_event)<>'object'or exists(select 1 from jsonb_object_keys(p_event)k where k not in('id','source','sourceId','actorUserId','targetUserId','action','outcome','occurredAt','recordedAt','context','provenance'))then raise invalid_parameter_value using message='Invalid activity envelope';end if;
 if ctx is not null then
  if jsonb_typeof(ctx)<>'object'or octet_length(ctx::text)>1024
   or exists(select 1 from jsonb_object_keys(ctx)k where k not in('observedIp','clientIp','countryCode','browser','os','deviceClass','networkSource'))
   or nullif(ctx->>'clientIp','')is not null or nullif(ctx->>'countryCode','')is not null
   or length(coalesce(ctx->>'browser',''))>40 or length(coalesce(ctx->>'os',''))>24
   or coalesce(ctx->>'networkSource','')not in('vercel_edge','unverified','native_provider')
   or coalesce(ctx->>'deviceClass','')not in('','desktop','mobile','tablet') then raise invalid_parameter_value using message='Invalid audit context';end if;
  if nullif(ctx->>'observedIp','')is not null then perform(ctx->>'observedIp')::inet;end if;
 end if;
 if occurred>ts+interval '30 seconds'then raise invalid_parameter_value using message='Future activity receipt';end if;
 insert into private.admin_activity_receipts(source,source_id,actor_user_id,action,outcome)values(src,sid,uid,act,outcome_value)on conflict do nothing;
 if not found then
  select * into receipt from private.admin_activity_receipts where source=src and source_id=sid;
  if receipt.actor_user_id is distinct from uid or receipt.action is distinct from act or receipt.outcome is distinct from outcome_value then raise invalid_parameter_value using message='Activity source conflict';end if;
  return 'duplicate';
 end if;
 insert into private.admin_activity_events(id,source,source_id,actor_user_id,target_user_id,action,outcome,occurred_at,recorded_at,context,provenance,is_completed_work)
 values((p_event->>'id')::uuid,src,sid,uid,(p_event->>'targetUserId')::uuid,act,outcome_value,occurred,ts,ctx,p_event->>'provenance',p_work and outcome_value='succeeded');
 if uid is not null then
  -- Late provider evidence must not recreate a summary past permanent-removal cleanup.
  if exists(select 1 from public.admin_profiles where user_id=uid and status<>'removed')then
   insert into private.admin_activity_summaries(user_id)values(uid)on conflict do nothing;
  end if;
  update private.admin_activity_summaries set
   first_entry_at=case when src='workspace_entry'then least(first_entry_at,occurred)else first_entry_at end,
   last_sign_in_at=case when src='admin_signin'then greatest(last_sign_in_at,occurred)else last_sign_in_at end,
   last_workspace_access_at=case when src in('workspace_entry','workspace_access')then greatest(last_workspace_access_at,occurred)else last_workspace_access_at end,
   last_completed_work_at=case when p_work and outcome_value='succeeded'then greatest(last_completed_work_at,occurred)else last_completed_work_at end,
   completed_work_count=completed_work_count+case when p_work and outcome_value='succeeded'then 1 else 0 end,updated_at=ts where user_id=uid;
 end if;
 return 'stored';
end $fn$;

create function public.append_admin_activity(p_event jsonb,p_session_id uuid)returns text language plpgsql security definer set search_path='' as $fn$
declare uid uuid:=(p_event->>'actorUserId')::uuid;s auth.sessions%rowtype;v bigint;actor jsonb;result jsonb;src text:=p_event->>'source';expected_action text;expected_source text;ts timestamptz:=clock_timestamp();
begin
 if src not in('workspace_entry','workspace_access','admin_signin')or src is null then raise invalid_parameter_value using message='Source requires its committed receipt';end if;
 select * into s from auth.sessions where id=p_session_id and user_id=uid;
 if not found then raise insufficient_privilege using message='Native session required';end if;
 select version into v from public.rbac_user_claim_versions where user_id=uid;
 actor:=jsonb_build_object('userId',uid,'sessionId',s.id,'roleVersion',v,'currentLevel',s.aal);
 result:=private.admin_verification_actor_context(actor);
 if result->>'ok'is distinct from 'true'or(src<>'admin_signin'and(result->'value'->>'enforced')::boolean and s.aal::text<>'aal2')then raise insufficient_privilege using message='Verified workspace access required';end if;
 expected_action:=case src when 'workspace_entry'then 'workspace.entry'when 'workspace_access'then 'workspace.access'else 'admin.signin'end;
 expected_source:=case src when 'workspace_entry'then 'session:'||s.id when 'workspace_access'then 'access:'||uid||':'||(ts at time zone 'UTC')::date else 'signin:'||s.id end;
 if p_event->>'action'is distinct from expected_action or p_event->>'outcome'is distinct from 'succeeded'
  or p_event->>'sourceId'is distinct from expected_source or(p_event->>'targetUserId')is not null
  or abs(extract(epoch from(ts-(p_event->>'occurredAt')::timestamptz)))>60 then raise invalid_parameter_value using message='Invalid native receipt binding';end if;
 return private.admin_activity_append(p_event,false);
end $fn$;

-- Only new service-authored post-success audit receipts qualify; legacy/browser inserts do not.
create function private.admin_activity_project_committed_audit()returns trigger language plpgsql security definer set search_path='' as $fn$
declare work boolean;outcome_value text;
begin
 if auth.role()is distinct from 'service_role'or not private.admin_activity_eligible(new.actor_user_id)then return null;end if;
 if new.action~'^(admin_account|admin_invitation)\.'then return null;end if;
 work:=new.action=any(array[
  'admin_profile.updated','committee.advisor_archived','committee.advisor_auth_linked','committee.advisor_created',
  'committee.advisor_updated','committee.assignment_created','committee.assignment_removed','committee.assignment_updated',
  'committee.assignments_bulk_updated','committee.import_advisors_committed','committee.import_executive_roster_committed','committee.import_sub_executive_committed',
  'committee.term_created','committee.term_position_created','committee.term_position_updated','committee.term_rolled_over',
  'committee.term_set_current','committee.term_updated','content.developer_profile_created','content.developer_profile_updated',
  'content.media_asset_created','content.media_asset_moved_to_trash','content.media_asset_restored_from_trash','content.media_asset_updated',
  'content.member_blog_change_requested','content.member_blog_published','content.notice_archived','content.notice_created',
  'content.notice_deleted','content.notice_published','content.notice_updated','content.page_saved',
  'content.post_created','content.post_updated','content.project_created','content.project_deleted',
  'content.project_updated','events.event_created','events.event_deleted','events.event_updated',
  'gallery.album_created','gallery.album_item_updated','gallery.album_items_reordered','gallery.album_items_uploaded',
  'gallery.album_updated','member.email_change_request_approved','member.invitation_generated','member.invitation_revoked',
  'member.jnuits_id_change_request_approved','member.portal_role_updated','member.profile_change_request_rejected','member.profile_updated',
  'member.workplace_admin_corrected','member.workplace_update_requests_bulk_reviewed','membership.application_rejected','membership.invitation_batch_created',
  'membership.invitation_batch_issued','membership.invitation_batch_status_updated','membership.invitation_batch_synced','membership.invitation_bulk_revoked',
  'membership.invitation_csv_committed','membership.invitation_direct_issued','membership.invitation_reissued','membership.invitation_revoked',
  'membership.member_created_for_invite'
 ]);
 outcome_value:=case when work or new.action=any(array['content.cloudinary_upload_signature_issued','event.registrations_exported','form.submissions_exported','form.upload_downloaded','operator.report_generated','observability.sentry_verification_triggered','event.registration_notice_resent'])then 'succeeded'else 'unknown'end;
 perform private.admin_activity_append(jsonb_build_object('id',extensions.gen_random_uuid(),'source','application_commit','sourceId',new.id,'actorUserId',new.actor_user_id,'targetUserId',null,'action',new.action,'outcome',outcome_value,'occurredAt',new.created_at,'recordedAt',clock_timestamp(),'context',null,'provenance','New service-authored audit receipt; catalogued outcomes only'),work);
 return null;
end $fn$;
create trigger admin_activity_committed_audit after insert on public.audit_events for each row execute function private.admin_activity_project_committed_audit();

-- Routine reviews and renewals already have a private committing boundary.
-- Canonical request/renewal IDs count actual transitions, never retry attempts.
create or replace function private.record_membership_transition(p_member_id uuid,p_event text,p_metadata jsonb)
returns void language plpgsql security definer set search_path='' as $fn$
declare receipt_id uuid;source_key text;activity_action text;target_user uuid;
begin
 insert into public.membership_lifecycle_events(member_id,event_type,summary,metadata,created_by_user_id)
 values(p_member_id,p_event,'Membership renewal or current-membership path updated.',p_metadata,auth.uid());
 insert into public.audit_events(action,actor_user_id,entity_id,entity_type,metadata)
 values('membership.'||p_event,auth.uid(),p_member_id::text,'member',p_metadata);
 if p_event='membership_request_reviewed' then
  select id into receipt_id from public.profile_update_requests where id=(p_metadata->>'requestId')::uuid
   and member_id=p_member_id and reviewed_by_user_id=auth.uid() and status=p_metadata->>'decision';
  source_key:='membership-request:'||receipt_id;activity_action:='membership.request.review';
 elsif p_event='renewal_confirmed' then
  select id into receipt_id from public.membership_renewals where member_id=p_member_id
   and due_on=(p_metadata->>'dueOn')::date and confirmed_by_user_id=auth.uid();
  source_key:='membership-renewal:'||receipt_id;activity_action:='membership.renewal.confirm';
 end if;
 if receipt_id is not null then
  select user_id into target_user from public.members where id=p_member_id;
  perform private.admin_activity_append(jsonb_build_object('id',extensions.gen_random_uuid(),'source','application_commit',
   'sourceId',source_key,'actorUserId',auth.uid(),'targetUserId',target_user,'action',activity_action,'outcome','succeeded',
   'occurredAt',clock_timestamp(),'recordedAt',clock_timestamp(),'context',null,'provenance','Committed membership transition; canonical request or renewal receipt'),true);
 end if;
end $fn$;

-- Preserve the original proof/state transition; append only in its committing transaction.
-- The exact attempt ID is authoritative; no timestamp-window matching or browser metadata.
create or replace function private.complete_admin_mutation(p_attempt_id uuid)returns void
language plpgsql security definer set search_path='' as $fn$
declare intent_id uuid;i private.admin_verification_intents%rowtype;target_user uuid;work boolean;
begin
 update private.admin_verification_attempts set status='completed',completed_at=clock_timestamp()
  where id=p_attempt_id and status='reserved'returning admin_verification_attempts.intent_id into intent_id;
 if not found then raise exception 'Operation attempt is no longer reserved.'using errcode='40001';end if;
 select *into i from private.admin_verification_intents where id=intent_id;
 insert into private.admin_verification_audit(user_id,operation,event,outcome)values(i.user_id,i.operation,'mutation_completed','success');
 -- Preserve attempt/proof completion even for an idempotent no-op. Actual
 -- membership work is projected by its private transition boundary above.
 if i.operation in('membership.request.review','membership.renewal.confirm')then return;end if;
 if(i.payload->>'adminProfileId')~'^[0-9a-fA-F-]{36}$'then select user_id into target_user from public.admin_profiles where id=(i.payload->>'adminProfileId')::uuid;end if;
 if i.operation='admin.role.invite'then
  select v.target_user_id into target_user from private.admin_invitation_authorizations a join public.admin_invitations v on v.id=a.invitation_id where a.attempt_id=p_attempt_id;
 elsif i.operation='admin.invitation.revoke'then
  select target_user_id into target_user from public.admin_invitations where id=(i.payload->>'invitationId')::uuid;
 end if;
 work:=i.operation in('admin.role.change','admin.role.invite','admin.role.remove','admin.lifecycle.freeze','admin.lifecycle.unfreeze','admin.invitation.revoke','admin.security.update','admin.retention.archive','admin.retention.approve_purge','admin.retention.purge');
 perform private.admin_activity_append(jsonb_build_object('id',extensions.gen_random_uuid(),'source','application_commit','sourceId','operation:'||p_attempt_id,'actorUserId',i.user_id,'targetUserId',target_user,
  'action',i.operation,'outcome','succeeded','occurredAt',clock_timestamp(),'recordedAt',clock_timestamp(),'context',null,'provenance','Committed governed operation; exact native-session intent proof'),work);
end $fn$;

-- Acceptance has no initiating admin mutation attempt. Reuse its trusted private
-- committing helper, not an authenticated caller's insertable legacy audit row.
create or replace function private.record_verified_admin_account_event(p_actor uuid,p_target public.admin_profiles,p_action text,p_metadata jsonb,p_severity text)
returns void language plpgsql security definer set search_path='' as $fn$
begin
 insert into public.audit_events(action,actor_user_id,entity_id,entity_type,metadata)
  values(p_action,p_actor,p_target.id,'admin_profile',jsonb_build_object('adminCode',p_target.admin_code,'targetUserId',p_target.user_id)||p_metadata);
 insert into public.security_events(actor_user_id,target_user_id,event_type,severity,payload)
  values(p_actor,p_target.user_id,p_action,p_severity,jsonb_build_object('adminProfileId',p_target.id,'adminCode',p_target.admin_code)||p_metadata);
 if p_action='admin_invitation.accepted'and p_actor=p_target.user_id and private.admin_activity_eligible(p_actor)then
  perform private.admin_activity_append(jsonb_build_object('id',extensions.gen_random_uuid(),'source','application_commit','sourceId','invitation:'||(p_metadata->>'invitationId')::uuid||':accepted',
   'actorUserId',p_actor,'targetUserId',p_target.user_id,'action',p_action,'outcome','succeeded','occurredAt',clock_timestamp(),'recordedAt',clock_timestamp(),'context',null,'provenance','Committed native-session invitation acceptance'),false);
 end if;
end $fn$;

do $grants$
declare f record;
begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'and p.proname like 'admin_activity_%'loop execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);end loop;
end $grants$;
revoke all on function public.append_admin_activity(jsonb,uuid)from public,anon,authenticated;
grant execute on function public.append_admin_activity(jsonb,uuid)to service_role;

create function private.admin_activity_assert_reader(p_actor jsonb,p_permission text default null)returns uuid
language plpgsql security definer set search_path='' as $fn$
declare result jsonb;uid uuid:=(p_actor->>'userId')::uuid;
begin
 result:=private.admin_verification_actor_context(p_actor);
 if result->>'ok'is distinct from 'true'or((result->'value'->>'enforced')::boolean and p_actor->>'currentLevel'<>'aal2')then raise insufficient_privilege using message='Verified admin session required';end if;
 if p_permission is not null and not private.admin_verification_has_permission(uid,p_permission)then raise insufficient_privilege using message='Activity permission required';end if;
 return uid;
end $fn$;

create function private.admin_activity_coverage()returns jsonb language sql stable security definer set search_path='' as $fn$
 select jsonb_build_object('state',case when last_collected_at<clock_timestamp()-interval '48 hours'then 'delayed'else state end,
 'observedSince',observed_since,'lastCollectedAt',last_collected_at,'message',case
 when last_collected_at<clock_timestamp()-interval '48 hours'then 'Collection is delayed; absence of activity is not evidence of inactivity.'
 when state='delayed'then 'The last collection failed; absence of activity is not evidence of inactivity.'
 when state='unavailable'then 'Native Auth collection has not yet been verified. Historical gaps remain unknown.'
 else 'Verified source receipts since cutover; continuous historical coverage has not been established. Device labels are client-reported, network locations are unavailable.'end)
 from private.admin_activity_ingestion_state where name='native_auth'
$fn$;

create function private.admin_activity_mask_ip(p_ip text)returns text
language sql immutable strict set search_path='' as $fn$
 select case when family(p_ip::inet)=4 then split_part(host(p_ip::inet),'.',1)||'.'||split_part(host(p_ip::inet),'.',2)||'.x.x'
  else split_part(host(p_ip::inet),':',1)||':'||split_part(host(p_ip::inet),':',2)||':…'end
$fn$;

create function public.query_admin_activity(p_actor jsonb,p_filters jsonb,p_full_network_id uuid default null)returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare viewer uuid;full_allowed boolean;total bigint;page_no integer:=greatest(1,coalesce((p_filters->>'page')::integer,1));size integer:=least(100,greatest(1,coalesce((p_filters->>'pageSize')::integer,25)));items jsonb;actor_options jsonb;
begin
 viewer:=private.admin_activity_assert_reader(p_actor,'admin.audit.read');
 full_allowed:=private.admin_verification_has_permission(viewer,'admin.security.read');
 if p_full_network_id is not null and not full_allowed then raise insufficient_privilege using message='Network details unavailable';end if;
 select count(*)into total from private.admin_activity_events e where
  (nullif(p_filters->>'actor','')is null or e.actor_user_id=(p_filters->>'actor')::uuid)
  and(nullif(p_filters->>'action','')is null or e.action=p_filters->>'action')
  and(nullif(p_filters->>'outcome','')is null or e.outcome=p_filters->>'outcome')
  and(nullif(p_filters->>'from','')is null or e.occurred_at>=(p_filters->>'from')::timestamptz)
  and(nullif(p_filters->>'to','')is null or e.occurred_at<=(p_filters->>'to')::timestamptz);
 page_no:=least(page_no,greatest(1,ceil(total::numeric/size)::integer));
 select coalesce(jsonb_agg(item order by occurred_at desc,id desc),'[]'::jsonb)into items from(
  select e.occurred_at,e.id,jsonb_build_object('id',e.id,'actionLabel',e.action,'sourceLabel',e.source,'provenanceLabel',e.provenance,'occurredAt',e.occurred_at,'recordedAt',e.recorded_at,
   'actorLabel',coalesce(nullif(p.display_name,''),left(e.actor_user_id::text,8),'Unknown actor'),'targetLabel',coalesce(nullif(t.display_name,''),left(e.target_user_id::text,8),'Not recorded'),'outcome',e.outcome,
   'canRequestFullNetwork',full_allowed and nullif(e.context->>'observedIp','')is not null,'href',null,
   'context',case when e.context is null then null else jsonb_build_object('browser',e.context->>'browser','os',e.context->>'os','deviceClass',e.context->>'deviceClass','countryDisplay',null,
    'ipDisplay',case when nullif(e.context->>'observedIp','')is null then null
     when full_allowed and e.id=p_full_network_id then (case e.context->>'networkSource'when 'vercel_edge'then 'Vercel-observed edge: 'when 'native_provider'then 'Provider-observed: 'else 'Unverified: 'end)||(e.context->>'observedIp')
     else(case e.context->>'networkSource'when 'vercel_edge'then 'Vercel-observed edge (masked): 'when 'native_provider'then 'Provider-observed (masked): 'else 'Unverified (masked): 'end)||private.admin_activity_mask_ip(e.context->>'observedIp')end)end)item
  from private.admin_activity_events e left join public.admin_profiles p on p.user_id=e.actor_user_id left join public.admin_profiles t on t.user_id=e.target_user_id where
   (nullif(p_filters->>'actor','')is null or e.actor_user_id=(p_filters->>'actor')::uuid)
   and(nullif(p_filters->>'action','')is null or e.action=p_filters->>'action')
   and(nullif(p_filters->>'outcome','')is null or e.outcome=p_filters->>'outcome')
   and(nullif(p_filters->>'from','')is null or e.occurred_at>=(p_filters->>'from')::timestamptz)
   and(nullif(p_filters->>'to','')is null or e.occurred_at<=(p_filters->>'to')::timestamptz)
  order by e.occurred_at desc,e.id desc limit size offset(page_no-1)*size
 )bounded;
 select coalesce(jsonb_agg(jsonb_build_object('value',a.user_id,'label',a.label)order by a.label,a.user_id),'[]'::jsonb)into actor_options from(
  select distinct e.actor_user_id user_id,coalesce(nullif(p.display_name,''),left(e.actor_user_id::text,8))label
  from private.admin_activity_events e left join public.admin_profiles p on p.user_id=e.actor_user_id
  where e.actor_user_id is not null order by label,user_id limit 100
 )a;
 return jsonb_build_object('items',items,'totalItems',total,'page',page_no,'pageSize',size,'coverage',private.admin_activity_coverage(),'filterOptions',jsonb_build_object('actors',actor_options));
end $fn$;

create function public.get_admin_activity_summary(p_actor jsonb,p_target uuid)returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare viewer uuid;s private.admin_activity_summaries%rowtype;c private.admin_activity_ingestion_state%rowtype;invitation text;
begin
 viewer:=private.admin_activity_assert_reader(p_actor);
 if viewer<>p_target and(not private.admin_verification_has_permission(viewer,'admin.audit.read')or not private.admin_verification_has_permission(viewer,'admin.admin_profiles.manage'))then raise insufficient_privilege using message='Account activity unavailable';end if;
 if not exists(select 1 from public.admin_profiles where user_id=p_target)then raise insufficient_privilege using message='Account activity unavailable';end if;
 select *into s from private.admin_activity_summaries where user_id=p_target;
 select *into c from private.admin_activity_ingestion_state where name='native_auth';
 select case when p.status='removed'then 'revoked'when p.status='pending_invite'then 'pending'else 'accepted'end into invitation from public.admin_profiles p where p.user_id=p_target;
 return jsonb_build_object('accessActivatedAt',s.access_activated_at,'invitationStatus',invitation,'firstEntryAt',s.first_entry_at,'lastSignInAt',s.last_sign_in_at,'lastWorkspaceAccessAt',s.last_workspace_access_at,'lastCompletedWorkAt',s.last_completed_work_at,
  'completedWorkCount',s.completed_work_count,'periodLabel',case when s.user_id is not null then 'Since verified application collection began'end,
  'coverage',jsonb_build_object('state',case when c.last_collected_at<clock_timestamp()-interval '48 hours'then 'delayed'else c.state end,'observedSince',c.observed_since,'continuousSince',c.continuous_since,'lastCollectedAt',c.last_collected_at));
end $fn$;

insert into private.admin_activity_ingestion_state(name)values('job');
create function public.claim_admin_accountability_job()returns jsonb language plpgsql security definer set search_path='' as $fn$
declare lease uuid:=extensions.gen_random_uuid();
begin
 update private.admin_activity_ingestion_state set lease_id=lease,lease_until=clock_timestamp()+interval '30 seconds'where name='job'and(lease_until is null or lease_until<clock_timestamp());
 return case when found then jsonb_build_object('claimed',true,'leaseId',lease)else jsonb_build_object('claimed',false)end;
end $fn$;
create function public.release_admin_accountability_job(p_lease_id uuid,p_failed boolean default false)returns void language plpgsql security definer set search_path='' as $fn$
begin
 update private.admin_activity_ingestion_state set lease_id=null,lease_until=null where name='job'and lease_id=p_lease_id;
 if found and p_failed then update private.admin_activity_ingestion_state set state='delayed',error_code='collection_failed'where name='native_auth';end if;
end
$fn$;

create function public.collect_admin_auth_activity(p_limit integer,p_dry_run boolean,p_lease_id uuid)returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare row auth.audit_log_entries%rowtype;c private.admin_activity_ingestion_state%rowtype;read_count integer:=0;stored integer:=0;v_backlog boolean:=false;act text;ip text;outcome_value text;result text;first_native timestamptz;unknown_shape boolean:=false;
begin
 if not exists(select 1 from private.admin_activity_ingestion_state where name='job'and lease_id=p_lease_id and lease_until>clock_timestamp())then raise insufficient_privilege using message='Current job lease required';end if;
 if p_limit is null or p_limit<1 or p_limit>500 then raise invalid_parameter_value using message='Bounded batch required';end if;
 select *into c from private.admin_activity_ingestion_state where name='native_auth'for update;
 select min(created_at)into first_native from auth.audit_log_entries where created_at>=c.cutover_at;
 for row in select a.*from auth.audit_log_entries a where a.created_at>=c.cutover_at and a.created_at<=clock_timestamp()
  and exists(select 1 from private.admin_activity_identity_periods h where h.user_id::text=a.payload->>'actor_id'and a.created_at>=h.active_from and(h.active_until is null or a.created_at<h.active_until))
  and not exists(select 1 from private.admin_activity_receipts r where r.source='native_auth'and r.source_id=a.id::text)
  order by a.created_at,a.id limit p_limit+1
 loop
  if read_count=p_limit then v_backlog:=true;exit;end if;
  read_count:=read_count+1;
  act:=row.payload->>'action';
  if act is null or act!~'^[a-z_]{1,80}$'then act:='unknown';unknown_shape:=true;end if;
  outcome_value:=case when act in('login','user_updated_password')then 'succeeded'else 'unknown'end;
  ip:=nullif(row.ip_address,'');
  begin if ip is not null then perform ip::inet;end if;exception when invalid_text_representation then ip:=null;end;
  if not p_dry_run then
   result:=private.admin_activity_append(jsonb_build_object('id',row.id,'source','native_auth','sourceId',row.id,'actorUserId',row.payload->>'actor_id','targetUserId',null,'action','auth.'||act,'outcome',outcome_value,'occurredAt',row.created_at,'recordedAt',clock_timestamp(),
    'context',jsonb_build_object('observedIp',ip,'clientIp',null,'countryCode',null,'browser',null,'os',null,'deviceClass',null,'networkSource','native_provider'),'provenance','Native Auth provider row; event-time admin interval'),false);
   if result='stored'then stored:=stored+1;end if;
  end if;
 end loop;
 if not p_dry_run then
  update private.admin_activity_ingestion_state set last_collected_at=clock_timestamp(),observed_since=least(observed_since,first_native),backlog=v_backlog,
   state=case when first_native is null then 'unavailable'else 'partial'end,
   error_code=case when unknown_shape then 'unknown_source_shape'when first_native is null then 'native_storage_not_observed'else null end
   where name='native_auth';
 end if;
 return jsonb_build_object('read',read_count,'stored',stored,'backlog',v_backlog,'coverage',jsonb_build_object('state',case when first_native is null then 'unavailable'else 'partial'end,'observedSince',coalesce(c.observed_since,first_native),'continuousSince',c.continuous_since,'lastCollectedAt',case when p_dry_run then c.last_collected_at else clock_timestamp()end));
end $fn$;

-- New projections only. First production dry run must be reviewed before activation.
create function public.preview_admin_activity_retention()returns jsonb language sql security definer set search_path='' as $fn$
 select jsonb_build_object('cutoff',((clock_timestamp()at time zone 'Asia/Dhaka')-interval '3 months')at time zone 'Asia/Dhaka',
 'eligible',(select count(*)from private.admin_activity_events e where e.occurred_at<((clock_timestamp()at time zone 'Asia/Dhaka')-interval '3 months')at time zone 'Asia/Dhaka'
 and e.recorded_at<((clock_timestamp()at time zone 'Asia/Dhaka')-interval '3 months')at time zone 'Asia/Dhaka'
 and not exists(select 1 from private.admin_activity_summaries s where s.incident_hold and s.user_id in(e.actor_user_id,e.target_user_id))),
 'enabled',(select purge_enabled from private.admin_activity_ingestion_state where name='application'))
$fn$;
create function public.purge_expired_admin_activity(p_limit integer default 500)returns jsonb language plpgsql security definer set search_path='' as $fn$
declare cutoff timestamptz:=((clock_timestamp()at time zone 'Asia/Dhaka')-interval '3 months')at time zone 'Asia/Dhaka';deleted integer;summaries_deleted integer;
begin
 if not(select purge_enabled from private.admin_activity_ingestion_state where name='application')then raise insufficient_privilege using message='Retention activation requires reviewed dry run';end if;
 if p_limit is null or p_limit<1 or p_limit>500 then raise invalid_parameter_value;end if;
 with expired as(select e.id from private.admin_activity_events e where e.occurred_at<cutoff and e.recorded_at<cutoff
 and not exists(select 1 from private.admin_activity_summaries s where s.incident_hold and s.user_id in(e.actor_user_id,e.target_user_id))order by e.recorded_at,e.id limit p_limit for update skip locked)
 delete from private.admin_activity_events where id in(select id from expired);
 get diagnostics deleted=row_count;
 -- Lifetime summaries survive detail expiry; only permanent-removal grace can expire them.
 with expired_summaries as(select s.user_id from private.admin_activity_summaries s
  where s.permanently_removed_at<cutoff and not s.incident_hold
  and not exists(select 1 from public.admin_profiles p where p.user_id=s.user_id and p.status<>'removed')
  order by s.permanently_removed_at,s.user_id limit p_limit for update skip locked)
 delete from private.admin_activity_summaries where user_id in(select user_id from expired_summaries);
 get diagnostics summaries_deleted=row_count;
 -- Durable receipts and identity/checkpoint evidence survive both cleanup paths.
 return jsonb_build_object('deleted',deleted,'summariesDeleted',summaries_deleted,'remaining',(public.preview_admin_activity_retention()->>'eligible')::bigint);
end $fn$;

-- Owner-selected 30-day policy is restricted to routine refresh rows. Unknown,
-- login, password, identity and MFA evidence are retained. No Auth-table DDL.
-- An admin source row must first have its durable normalized receipt.
insert into private.admin_activity_ingestion_state(name)values('routine_auth_retention');
create function private.admin_activity_routine_auth_candidates(p_limit integer)returns table(id uuid,created_at timestamptz)
language sql stable security definer set search_path='' as $fn$
 select a.id,a.created_at from auth.audit_log_entries a
 where a.payload->>'action'='token_refreshed'
  and a.payload->>'actor_id'~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
  and a.created_at<clock_timestamp()-interval '30 days'
  and a.created_at>=(select cutover_at from private.admin_activity_ingestion_state where name='routine_auth_retention')
  and not exists(select 1 from private.admin_activity_summaries s where s.user_id::text=a.payload->>'actor_id'and s.incident_hold)
  and((not exists(select 1 from public.admin_profiles p where p.user_id::text=a.payload->>'actor_id')
    and not exists(select 1 from private.admin_activity_identity_periods h where h.user_id::text=a.payload->>'actor_id'))
   or exists(select 1 from private.admin_activity_receipts r where r.source='native_auth'and r.source_id=a.id::text))
 order by a.created_at,a.id limit least(501,greatest(1,p_limit))
$fn$;
create function public.preview_routine_auth_retention()returns jsonb language sql security definer set search_path='' as $fn$
 select jsonb_build_object('cutoff',clock_timestamp()-interval '30 days','eligible',(select count(*)from private.admin_activity_routine_auth_candidates(501)),
  'previewLimit',501,'enabled',(select purge_enabled from private.admin_activity_ingestion_state where name='routine_auth_retention'))
$fn$;
create function public.purge_routine_auth_retention(p_limit integer default 500)returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare deleted integer;
begin
 if not(select purge_enabled from private.admin_activity_ingestion_state where name='routine_auth_retention')then raise insufficient_privilege using message='Routine retention requires reviewed dry run';end if;
 if p_limit is null or p_limit<1 or p_limit>500 then raise invalid_parameter_value;end if;
 with expired as(select a.id from auth.audit_log_entries a join private.admin_activity_routine_auth_candidates(p_limit)c on c.id=a.id order by c.created_at,c.id for update of a skip locked)
 delete from auth.audit_log_entries where id in(select id from expired);
 get diagnostics deleted=row_count;
 return jsonb_build_object('deleted',deleted,'remainingPreview',(public.preview_routine_auth_retention()->>'eligible')::integer);
end $fn$;

do $grants$
declare f record;
begin
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where(n.nspname='private'and p.proname like 'admin_activity_%')or(n.nspname='public'and p.proname in('query_admin_activity','get_admin_activity_summary','claim_admin_accountability_job','release_admin_accountability_job','collect_admin_auth_activity','preview_admin_activity_retention','purge_expired_admin_activity','preview_routine_auth_retention','purge_routine_auth_retention'))loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
  if f.signature::text not like 'private.%'then execute format('grant execute on function %s to service_role',f.signature);end if;
 end loop;
end $grants$;
commit;
