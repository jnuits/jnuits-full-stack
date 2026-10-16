-- New optional email channels are opt-in. Existing preference defaults are preserved.
begin;
alter table public.portal_user_settings
 add column admin_security_email_opt_in boolean not null default false,
 add column admin_recommendation_email_opt_in boolean not null default false;

create table private.admin_notification_controls(
 singleton boolean primary key default true check(singleton),
 notice_cutover timestamptz not null default clock_timestamp(),
 delivery_enabled boolean not null default false,
 delivery_cutover timestamptz,
 native_password_email_owner text not null default 'supabase' check(native_password_email_owner='supabase')
);
insert into private.admin_notification_controls(singleton)values(true);
create table private.admin_notice_receipts(
 event_key text not null,recipient_user_id uuid not null,created_at timestamptz not null default clock_timestamp(),
 primary key(event_key,recipient_user_id)
);
create table private.admin_security_notices(
 id uuid primary key default extensions.gen_random_uuid(),event_key text not null,recipient_user_id uuid not null,
 kind text not null,title text not null,summary text not null,severity text not null check(severity in('info','warning','critical')),
 actor_user_id uuid not null,affected_user_id uuid,occurred_at timestamptz not null,recorded_at timestamptz not null default clock_timestamp(),
 href text not null,read_at timestamptz,unique(event_key,recipient_user_id)
);
create index admin_notice_recipient_time on private.admin_security_notices(recipient_user_id,occurred_at desc,id desc);
create index admin_notice_recipient_unread on private.admin_security_notices(recipient_user_id)where read_at is null;
create table private.admin_notice_event_receipts(event_id uuid primary key,processed_at timestamptz not null default clock_timestamp());
create function private.admin_notice_reader(p_user uuid)returns boolean language sql stable security definer set search_path='' as $fn$
 select private.admin_activity_eligible(p_user)and private.admin_verification_has_permission(p_user,'admin.audit.read')
$fn$;

-- Only canonical persisted activity may create a notice; callers cannot supply copy or recipients.
create function public.enqueue_admin_security_notice(p_event_id uuid)returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare e private.admin_activity_events%rowtype;cutover timestamptz;k text;t text;s text;severity_value text:='info';affected uuid;event_key_value text;created_count integer:=0;
begin
 select * into e from private.admin_activity_events where id=p_event_id;
 select notice_cutover into cutover from private.admin_notification_controls where singleton;
 if not found or e.id is null or e.actor_user_id is null or e.outcome<>'succeeded'or e.occurred_at<cutover or e.recorded_at<cutover or e.occurred_at>clock_timestamp()then return '{"created":0,"skipped":1}'::jsonb;end if;
 affected:=e.target_user_id;
 if e.source='native_auth'and e.source_id=e.id::text and(e.target_user_id is null or e.target_user_id=e.actor_user_id)then
  affected:=e.actor_user_id;
  case e.action
   when 'auth.user_updated_password'then k:='password_changed';t:='Admin account password changed';s:='A native account password change was recorded.';severity_value:='warning';
   when 'auth.mfa_factor_enrolled'then k:='mfa_changed';t:='Admin verification method added';s:='The native provider recorded an added verification method.';
   when 'auth.mfa_factor_unenrolled'then k:='mfa_changed';t:='Admin verification method removed';s:='The native provider recorded a removed verification method.';severity_value:='warning';
   else return '{"created":0,"skipped":1}'::jsonb;
  end case;
 elsif e.source='application_commit'then
  case e.action
   when 'admin.role.invite'then k:='invitation_created';t:='Admin invitation created';s:='A verified administrator created an admin invitation.';
   when 'admin_invitation.accepted'then k:='invitation_accepted';t:='Admin invitation accepted';s:='The recipient accepted an admin invitation through its verified account.';
   when 'admin.invitation.revoke'then k:='invitation_revoked';t:='Admin invitation revoked';s:='A verified administrator revoked an admin invitation.';severity_value:='warning';
   when 'admin.role.change'then k:='access_changed';t:='Admin role changed';s:='An admin account''s assigned role changed.';severity_value:='warning';
   when 'admin.lifecycle.freeze'then k:='access_changed';t:='Admin access frozen';s:='An admin account''s access was frozen.';severity_value:='warning';
   when 'admin.lifecycle.unfreeze'then k:='access_changed';t:='Admin access restored';s:='An admin account''s access was restored.';
   when 'admin.role.remove'then k:='access_removed';t:='Admin access removed';s:='An admin account''s access was removed.';severity_value:='critical';
   else return '{"created":0,"skipped":1}'::jsonb;
  end case;
  if k in('access_changed','access_removed')and affected is null then return '{"created":0,"skipped":1}'::jsonb;end if;
 else return '{"created":0,"skipped":1}'::jsonb;
 end if;
 event_key_value:=e.source||':'||e.source_id;
 with eligible as(select user_id from public.admin_profiles where private.admin_notice_reader(user_id)),
 receipts as(insert into private.admin_notice_receipts(event_key,recipient_user_id)select event_key_value,user_id from eligible on conflict do nothing returning recipient_user_id)
 insert into private.admin_security_notices(event_key,recipient_user_id,kind,title,summary,severity,actor_user_id,affected_user_id,occurred_at,href)
 select event_key_value,recipient_user_id,k,t,s,severity_value,e.actor_user_id,affected,e.occurred_at,
 '/admin/audit?view=activity&action='||e.action||'&actor='||e.actor_user_id from receipts;
 get diagnostics created_count=row_count;
 return jsonb_build_object('created',created_count,'skipped',case when created_count=0 then 1 else 0 end);
end $fn$;

create function public.collect_admin_security_notices(p_limit integer,p_dry_run boolean,p_lease_id uuid)returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare row record;read_count integer:=0;created_count integer:=0;backlog boolean;
begin
 if not exists(select 1 from private.admin_activity_ingestion_state where name='job'and lease_id=p_lease_id and lease_until>clock_timestamp())then raise insufficient_privilege using message='Active collection lease required';end if;
 if p_limit is null or p_limit<1 or p_limit>500 or p_dry_run is null then raise invalid_parameter_value;end if;
 for row in select e.id from private.admin_activity_events e cross join private.admin_notification_controls c
  where c.singleton and e.occurred_at>=c.notice_cutover and e.recorded_at>=c.notice_cutover
   and not exists(select 1 from private.admin_notice_event_receipts r where r.event_id=e.id)
  order by e.recorded_at,e.id limit p_limit loop
  read_count:=read_count+1;
  if not p_dry_run then
   created_count:=created_count+(public.enqueue_admin_security_notice(row.id)->>'created')::integer;
   insert into private.admin_notice_event_receipts(event_id)values(row.id)on conflict do nothing;
  end if;
 end loop;
 select exists(select 1 from private.admin_activity_events e cross join private.admin_notification_controls c
  where c.singleton and e.occurred_at>=c.notice_cutover and e.recorded_at>=c.notice_cutover and not exists(select 1 from private.admin_notice_event_receipts r where r.event_id=e.id)
  offset case when p_dry_run then p_limit else 0 end limit 1)into backlog;
 return jsonb_build_object('read',read_count,'created',created_count,'backlog',backlog);
end $fn$;

create function public.query_own_admin_notices(p_actor jsonb,p_page integer default 1,p_page_size integer default 25)returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare uid uuid;total bigint;unread bigint;size integer:=greatest(1,least(100,coalesce(p_page_size,25)));page_no integer;items jsonb;
begin
 uid:=private.admin_activity_assert_reader(p_actor,'admin.audit.read');
 select count(*),count(*)filter(where read_at is null)into total,unread from private.admin_security_notices where recipient_user_id=uid;
 page_no:=greatest(1,least(coalesce(p_page,1),greatest(1,ceil(total::numeric/size)::integer)));
 select coalesce(jsonb_agg(row_data order by occurred_at desc,id desc),'[]'::jsonb)into items from(
  select n.id,n.occurred_at,jsonb_build_object('id',n.id,'title',n.title,'summary',n.summary,'severity',n.severity,'occurredAt',n.occurred_at,'readAt',n.read_at,'href',n.href,'actorLabel',coalesce(nullif(left(p.display_name,200),''),'Admin account'))
   ||case when d.id is null then '{}'::jsonb else jsonb_build_object('deliveryStatus',case when d.state='sending'then 'pending'else d.state end)end row_data
  from private.admin_security_notices n left join public.admin_profiles p on p.user_id=n.actor_user_id
   left join private.admin_notification_deliveries d on d.notice_id=n.id and d.channel='security'
  where n.recipient_user_id=uid order by n.occurred_at desc,n.id desc limit size offset((page_no-1)::bigint*size)
 )page_rows;
 return jsonb_build_object('items',items,'totalItems',total,'unreadCount',unread,'page',page_no,'pageSize',size);
end $fn$;

create function public.mark_own_admin_notice_read(p_actor jsonb,p_notice_id uuid default null)returns boolean
language plpgsql security definer set search_path='' as $fn$
declare uid uuid;
begin
 uid:=private.admin_activity_assert_reader(p_actor,'admin.audit.read');
 if p_notice_id is not null and not exists(select 1 from private.admin_security_notices where id=p_notice_id and recipient_user_id=uid)then return false;end if;
 update private.admin_security_notices set read_at=coalesce(read_at,clock_timestamp())where recipient_user_id=uid and(p_notice_id is null or id=p_notice_id)and read_at is null;
 return true;
end $fn$;

create function public.own_admin_email_preferences(p_actor jsonb,p_preferences jsonb default null)returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare uid uuid;result jsonb;
begin
 uid:=private.admin_activity_assert_reader(p_actor);
 if p_preferences is not null then
  if jsonb_typeof(p_preferences)<>'object'or(select count(*)from jsonb_object_keys(p_preferences))<>2
   or jsonb_typeof(p_preferences->'admin_security_email_opt_in')is distinct from 'boolean'
   or jsonb_typeof(p_preferences->'admin_recommendation_email_opt_in')is distinct from 'boolean'then raise invalid_parameter_value using message='Invalid optional preferences';end if;
  insert into public.portal_user_settings(user_id,admin_security_email_opt_in,admin_recommendation_email_opt_in)
  values(uid,(p_preferences->>'admin_security_email_opt_in')::boolean,(p_preferences->>'admin_recommendation_email_opt_in')::boolean)
  on conflict(user_id)do update set admin_security_email_opt_in=excluded.admin_security_email_opt_in,admin_recommendation_email_opt_in=excluded.admin_recommendation_email_opt_in;
 end if;
 select jsonb_build_object('admin_security_email_opt_in',admin_security_email_opt_in,'admin_recommendation_email_opt_in',admin_recommendation_email_opt_in)into result from public.portal_user_settings where user_id=uid;
 return coalesce(result,'{"admin_security_email_opt_in":false,"admin_recommendation_email_opt_in":false}'::jsonb);
end $fn$;

-- Server-only account-level inputs; no browser AAL/session is manufactured by the job.
create function public.get_admin_recommendation_inputs(p_subject uuid,p_require_opt_in boolean default true)returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare p public.admin_profiles%rowtype;m public.members%rowtype;verified boolean;member_data jsonb;department_known boolean;enrollment_value text;queues jsonb;
begin
 if p_require_opt_in is null or not private.admin_activity_eligible(p_subject)then return null;end if;
 if p_require_opt_in and not exists(select 1 from public.portal_user_settings where user_id=p_subject and admin_recommendation_email_opt_in)then return null;end if;
 select * into p from public.admin_profiles where user_id=p_subject;
 select email is not null and email_confirmed_at is not null into verified from auth.users where id=p_subject and deleted_at is null;
 if not found then return null;end if;
 enrollment_value:=case when exists(select 1 from auth.mfa_factors where user_id=p_subject and status='verified')then 'configured'else 'needs_setup'end;
 select * into m from public.members where user_id=p_subject and portal_access_status='active'
  and(lifecycle_status='alumni'or(lifecycle_status='current'and current_membership_path_status='open'and(renewal_due_on is null or renewal_due_on+interval '6 months'>(clock_timestamp()at time zone 'Asia/Dhaka')::date)))
  and exists(select 1 from public.rbac_user_platform_roles g join public.rbac_platform_roles r on r.id=g.role_id where g.user_id=p_subject and g.scope='portal'and g.revoked_at is null and r.code in('member','alumni'));
 if found then
  member_data:=jsonb_build_object('full_name',m.full_name,'jnuits_id',m.jnuits_id,'member_type',m.member_type,'lifecycle_status',m.lifecycle_status,'department_code',m.department_code,'batch_no',m.batch_no,'student_id',m.student_id,'avatar_secure_url',m.avatar_secure_url,'phone',m.phone,'current_organization',m.current_organization,'designation',m.designation,'work_location',m.work_location,'workplace_applicability',m.workplace_applicability);
  department_known:=exists(select 1 from public.departments where code=m.department_code);
 end if;
 queues:=jsonb_build_array(
  jsonb_build_object('key','applications','permitted',private.admin_verification_has_permission(p_subject,'admin.membership.manage'),'count',case when private.admin_verification_has_permission(p_subject,'admin.membership.manage')then(select count(*)from public.membership_applications where status='pending')else null end),
  jsonb_build_object('key','profile_requests','permitted',private.admin_verification_has_permission(p_subject,'admin.membership.manage'),'count',case when private.admin_verification_has_permission(p_subject,'admin.membership.manage')then(select count(*)from public.profile_update_requests where status='pending'and request_type in('profile_change','email_change','jnuits_id_change'))else null end),
  jsonb_build_object('key','blogs','permitted',private.admin_verification_has_permission(p_subject,'cms.blogs.review'),'count',case when private.admin_verification_has_permission(p_subject,'cms.blogs.review')then(select count(*)from public.content_posts where content_type='blog'and status='pending_review')else null end)
 );
 return jsonb_build_object('admin',jsonb_build_object('display_name',p.display_name,'avatar_secure_url',p.avatar_secure_url),'emailVerified',verified,'member',member_data,'departmentRecognized',department_known,'enrollment',enrollment_value,'queues',queues);
end $fn$;

create table private.admin_notification_deliveries(
 id uuid primary key,delivery_key text not null unique,channel text not null check(channel in('security','recommendation')),
 recipient_user_id uuid not null,notice_id uuid,month_key text,rubric_version integer,recommendation_ids text[] not null default '{}',
 state text not null default 'pending'check(state in('pending','sending','accepted','delivered','suppressed','failed','uncertain')),
 payload jsonb not null,payload_hash text not null,idempotency_key text not null unique,
 first_attempt_at timestamptz,last_attempt_at timestamptz,attempt_count integer not null default 0,
 claim_token uuid,lease_until timestamptz,job_lease_id uuid,has_uncertain_outcome boolean not null default false,
 last_failure_kind text check(last_failure_kind in('configuration','rejected','rate_limited','uncertain')),
 provider_message_id text unique,accepted_at timestamptz,delivered_at timestamptz,
 created_at timestamptz not null default clock_timestamp(),updated_at timestamptz not null default clock_timestamp(),incident_hold boolean not null default false
);
create index admin_notification_delivery_pending on private.admin_notification_deliveries(channel,created_at,id)where provider_message_id is null and state in('pending','sending','failed','uncertain');
create unique index admin_notification_delivery_notice on private.admin_notification_deliveries(notice_id)where notice_id is not null;
create table private.admin_notification_suppressions(email_hash text primary key,reason text not null,recorded_at timestamptz not null default clock_timestamp());
create table private.admin_notification_webhook_receipts(event_id text primary key,provider_message_id text not null,event_type text not null,occurred_at timestamptz not null,recorded_at timestamptz not null default clock_timestamp());

create function private.admin_notification_payload_valid(p_payload jsonb)returns boolean
language sql immutable set search_path='' as $fn$
 select coalesce(jsonb_typeof(p_payload)='object'and octet_length(p_payload::text)<=65536
  and(select count(*)from jsonb_object_keys(p_payload))=6
  and not exists(select 1 from jsonb_each(p_payload)e where e.key not in('from','replyTo','to','subject','html','text')or jsonb_typeof(e.value)<>'string')
  and p_payload->>'from'='JnUITS <no-reply@jnuits.org.bd>'
  and length(p_payload->>'to')between 3 and 320 and length(p_payload->>'replyTo')between 3 and 320
  and length(p_payload->>'subject')between 1 and 200
  and p_payload->>'to'!~E'[\r\n]'and p_payload->>'replyTo'!~E'[\r\n]'and p_payload->>'subject'!~E'[\r\n]',false)
$fn$;

create function private.admin_notification_recipient_eligible(p_user uuid,p_channel text,p_payload jsonb,p_notice_id uuid default null,p_recommendation_ids text[] default null)returns boolean
language sql stable security definer set search_path='' as $fn$
 select private.admin_activity_eligible(p_user)
 and exists(select 1 from auth.users u where u.id=p_user and u.deleted_at is null and u.email_confirmed_at is not null and lower(u.email)=lower(p_payload->>'to'))
 and not exists(select 1 from private.admin_notification_suppressions where email_hash=encode(extensions.digest(lower(p_payload->>'to'),'sha256'),'hex'))
 and exists(select 1 from public.portal_user_settings s where s.user_id=p_user
  and case when p_channel='security'then s.admin_security_email_opt_in when p_channel='recommendation'then s.admin_recommendation_email_opt_in else false end)
 and(p_channel<>'recommendation'or p_recommendation_ids is null or(cardinality(p_recommendation_ids)between 1 and 3
  and not exists(select 1 from unnest(p_recommendation_ids)i where i is null or case i
   when 'account-protection'then false when 'own-profile'then false
   when 'queue-applications'then not private.admin_verification_has_permission(p_user,'admin.membership.manage')
   when 'queue-profile_requests'then not private.admin_verification_has_permission(p_user,'admin.membership.manage')
   when 'queue-blogs'then not private.admin_verification_has_permission(p_user,'cms.blogs.review')else true end)))
 and(p_channel='recommendation'or(p_channel='security'and private.admin_notice_reader(p_user)
  and exists(select 1 from private.admin_security_notices n where n.id=p_notice_id and n.recipient_user_id=p_user
   and not(n.kind in('password_changed','mfa_changed')and n.affected_user_id=p_user))))
$fn$;

create function private.admin_notification_queue(p_key text,p_user uuid,p_channel text,p_payload jsonb,p_notice uuid,p_month text,p_rubric integer,p_recommendation_ids text[] default null)returns uuid
language plpgsql security definer set search_path='' as $fn$
declare did uuid:=extensions.gen_random_uuid();
begin
 if not private.admin_notification_payload_valid(p_payload)then raise invalid_parameter_value using message='Invalid frozen email';end if;
 if not private.admin_notification_recipient_eligible(p_user,p_channel,p_payload,p_notice,p_recommendation_ids)then return null;end if;
 insert into private.admin_notification_deliveries(id,delivery_key,channel,recipient_user_id,notice_id,month_key,rubric_version,recommendation_ids,payload,payload_hash,idempotency_key)
 values(did,p_key,p_channel,p_user,p_notice,p_month,p_rubric,coalesce(p_recommendation_ids,'{}'),p_payload,encode(extensions.digest(p_payload::text,'sha256'),'hex'),'jnuits-admin/'||did)
 on conflict(delivery_key)do nothing;
 select id into did from private.admin_notification_deliveries where delivery_key=p_key;
 return did;
end $fn$;

create function public.queue_admin_notice_email(p_notice_id uuid,p_payload jsonb)returns uuid
language plpgsql security definer set search_path='' as $fn$
declare n private.admin_security_notices%rowtype;cutover timestamptz;
begin
 select delivery_cutover into cutover from private.admin_notification_controls where singleton and delivery_enabled;
 if not found or cutover is null then return null;end if;
 select * into n from private.admin_security_notices where id=p_notice_id;
 if not found or n.occurred_at<cutover or n.recorded_at<cutover then return null;end if;
 return private.admin_notification_queue('security:'||n.event_key||':'||n.recipient_user_id,n.recipient_user_id,'security',p_payload,n.id,null,null);
end $fn$;

create function public.queue_admin_recommendation_email(p_subject uuid,p_month text,p_payload jsonb,p_rubric integer,p_recommendation_ids text[])returns uuid
language plpgsql security definer set search_path='' as $fn$
begin
 if not exists(select 1 from private.admin_notification_controls where singleton and delivery_enabled and delivery_cutover is not null)
  or p_month is distinct from to_char(clock_timestamp()at time zone 'Asia/Dhaka','YYYY-MM')
  or coalesce(cardinality(p_recommendation_ids),0)not between 1 and 3 then return null;end if;
 if p_rubric is null or p_rubric<1 or exists(select 1 from unnest(p_recommendation_ids)i where i is null or i not in('account-protection','own-profile','queue-applications','queue-profile_requests','queue-blogs'))then raise invalid_parameter_value;end if;
 return private.admin_notification_queue('recommendation:'||p_subject||':'||p_month,p_subject,'recommendation',p_payload,null,p_month,p_rubric,p_recommendation_ids);
end $fn$;

create function public.list_admin_notification_deliveries(p_lease_id uuid,p_limit integer default 10,p_channel text default null)returns jsonb
language plpgsql security definer set search_path='' as $fn$
begin
 if not exists(select 1 from private.admin_activity_ingestion_state where name='job'and lease_id=p_lease_id and lease_until>clock_timestamp())then raise insufficient_privilege;end if;
 if not exists(select 1 from private.admin_notification_controls where singleton and delivery_enabled and delivery_cutover is not null)then return '[]'::jsonb;end if;
 return(select coalesce(jsonb_agg(id order by priority,created_at,id),'[]'::jsonb)from(
  select d.id,case when channel='security'then 0 else 1 end priority,d.created_at
  from private.admin_notification_deliveries d cross join private.admin_notification_controls c
  where c.singleton and d.created_at>=c.delivery_cutover and provider_message_id is null and(state in('pending','uncertain')or(state='failed'and last_failure_kind in('configuration','rate_limited'))or(state='sending'and lease_until<=clock_timestamp()))
   and(p_channel is null or d.channel=p_channel)
   and(not(d.has_uncertain_outcome or d.state in('uncertain','sending'))or(d.first_attempt_at<=clock_timestamp()and d.first_attempt_at>clock_timestamp()-interval '23 hours 59 minutes'))
  order by priority,d.created_at,d.id limit greatest(0,least(10,coalesce(p_limit,10)))
 )candidates);
end $fn$;

create function public.claim_admin_notification_delivery(p_id uuid,p_lease_id uuid)returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare d private.admin_notification_deliveries%rowtype;uncertain boolean;token uuid:=extensions.gen_random_uuid();ts timestamptz:=clock_timestamp();
begin
 if not exists(select 1 from private.admin_activity_ingestion_state where name='job'and lease_id=p_lease_id and lease_until>ts)then raise insufficient_privilege;end if;
 if not exists(select 1 from private.admin_notification_controls where singleton and delivery_enabled and delivery_cutover is not null)then return null;end if;
 select * into d from private.admin_notification_deliveries where id=p_id for update skip locked;
 if not found or d.provider_message_id is not null or d.state in('accepted','delivered','suppressed')or(d.state='sending'and d.lease_until>ts)
  or(d.state='failed'and coalesce(d.last_failure_kind,'')not in('configuration','rate_limited'))then return null;end if;
 if d.payload_hash is distinct from encode(extensions.digest(d.payload::text,'sha256'),'hex')or not private.admin_notification_payload_valid(d.payload)then return null;end if;
 if not private.admin_notification_recipient_eligible(d.recipient_user_id,d.channel,d.payload,d.notice_id,d.recommendation_ids)then
  update private.admin_notification_deliveries set state='suppressed',updated_at=ts where id=p_id;return null;
 end if;
 uncertain:=d.has_uncertain_outcome or d.state in('uncertain','sending');
 if uncertain and(d.first_attempt_at is null or d.first_attempt_at>ts or ts-d.first_attempt_at>=interval '23 hours 59 minutes')then return null;end if;
 update private.admin_notification_deliveries set state='sending',first_attempt_at=coalesce(first_attempt_at,ts),last_attempt_at=ts,attempt_count=attempt_count+1,
  claim_token=token,lease_until=ts+interval '30 seconds',job_lease_id=p_lease_id,has_uncertain_outcome=uncertain,updated_at=ts where id=p_id;
 return jsonb_build_object('id',d.id,'claimToken',token,'idempotencyKey',d.idempotency_key,'payload',d.payload);
end $fn$;

create function public.validate_admin_notification_delivery(p_id uuid,p_claim_token uuid,p_lease_id uuid)returns boolean
language sql stable security definer set search_path='' as $fn$
 select exists(select 1 from private.admin_notification_deliveries d cross join private.admin_notification_controls c
  where c.singleton and c.delivery_enabled and d.id=p_id and d.state='sending'and d.claim_token=p_claim_token and d.job_lease_id=p_lease_id
  and d.lease_until>clock_timestamp()and d.payload_hash=encode(extensions.digest(d.payload::text,'sha256'),'hex')
  and exists(select 1 from private.admin_activity_ingestion_state where name='job'and lease_id=p_lease_id and lease_until>clock_timestamp())
  and private.admin_notification_recipient_eligible(d.recipient_user_id,d.channel,d.payload,d.notice_id,d.recommendation_ids))
$fn$;

create function public.finish_admin_notification_delivery(p_id uuid,p_claim_token uuid,p_state text,p_message_id text default null,p_failure_kind text default null)returns boolean
language plpgsql security definer set search_path='' as $fn$
begin
 if p_state not in('accepted','suppressed','failed','uncertain')or(p_state='accepted'and(length(coalesce(p_message_id,''))not between 1 and 200))
  or(p_state in('failed','uncertain')and coalesce(p_failure_kind,'')not in('configuration','rejected','rate_limited','uncertain'))then raise invalid_parameter_value;end if;
 update private.admin_notification_deliveries set state=p_state,provider_message_id=case when p_state='accepted'then p_message_id else provider_message_id end,
  accepted_at=case when p_state='accepted'then clock_timestamp()else accepted_at end,
  last_failure_kind=p_failure_kind,has_uncertain_outcome=has_uncertain_outcome or p_state='uncertain',lease_until=null,updated_at=clock_timestamp()
 where id=p_id and claim_token=p_claim_token and state='sending';
 return found;
end $fn$;

create function public.record_admin_notification_webhook_event(p_provider_event_id text,p_provider_message_id text,p_event_type text,p_occurred_at timestamptz)returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare d private.admin_notification_deliveries%rowtype;next_state text;
begin
 if p_provider_event_id is null or length(p_provider_event_id)not between 1 and 200 or p_provider_message_id is null or length(p_provider_message_id)not between 1 and 200
  or p_occurred_at is null or p_event_type not in('email.sent','email.delivered','email.bounced','email.complained','email.failed','email.delivery_delayed','email.suppressed')then raise invalid_parameter_value;end if;
 select * into d from private.admin_notification_deliveries where provider_message_id=p_provider_message_id for update;
 if not found then return '{"tracked":false,"duplicate":false}'::jsonb;end if;
 insert into private.admin_notification_webhook_receipts(event_id,provider_message_id,event_type,occurred_at)values(p_provider_event_id,p_provider_message_id,p_event_type,p_occurred_at)on conflict do nothing;
 if not found then return '{"tracked":true,"duplicate":true}'::jsonb;end if;
 next_state:=case when p_event_type in('email.bounced','email.complained','email.suppressed')then 'suppressed'
  when d.state='suppressed'then 'suppressed'when p_event_type='email.delivered'then 'delivered'
  when d.state='delivered'then 'delivered'when p_event_type='email.failed'then 'failed'else d.state end;
 update private.admin_notification_deliveries set state=next_state,delivered_at=case when p_event_type='email.delivered'then coalesce(delivered_at,p_occurred_at)else delivered_at end,
  last_failure_kind=case when p_event_type='email.failed'then 'rejected'else last_failure_kind end,updated_at=clock_timestamp()where id=d.id;
 if p_event_type in('email.bounced','email.complained','email.suppressed')then
  insert into private.admin_notification_suppressions(email_hash,reason)values(encode(extensions.digest(lower(d.payload->>'to'),'sha256'),'hex'),p_event_type)on conflict do nothing;
 end if;
 return '{"tracked":true,"duplicate":false}'::jsonb;
end $fn$;

alter table private.admin_notification_controls add column digest_cursor uuid,add column digest_month text;

create function public.get_admin_notification_batch(p_lease_id uuid,p_month text,p_account_limit integer default 100,p_notice_limit integer default 500)returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare c private.admin_notification_controls%rowtype;subjects jsonb;notices jsonb;has_more boolean;account_limit integer:=greatest(1,least(100,coalesce(p_account_limit,100)));
begin
 if not exists(select 1 from private.admin_activity_ingestion_state where name='job'and lease_id=p_lease_id and lease_until>clock_timestamp())then raise insufficient_privilege;end if;
 select * into c from private.admin_notification_controls where singleton for update;
 if not c.delivery_enabled or c.delivery_cutover is null or p_month is distinct from to_char(clock_timestamp()at time zone 'Asia/Dhaka','YYYY-MM')then return '{"enabled":false,"notices":[],"subjects":[],"digestEnd":true}'::jsonb;end if;
 if c.digest_month is distinct from p_month then
  update private.admin_notification_controls set digest_month=p_month,digest_cursor=null where singleton;
  c.digest_cursor:=null;
 end if;
 select coalesce(jsonb_agg(item order by occurred_at,id),'[]'::jsonb)into notices from(
  select n.id,n.occurred_at,jsonb_build_object('id',n.id,'recipientUserId',n.recipient_user_id,'email',u.email,'title',n.title,'summary',n.summary,'actorLabel',coalesce(nullif(left(p.display_name,200),''),'Admin account'),'occurredAt',n.occurred_at)item
  from private.admin_security_notices n join auth.users u on u.id=n.recipient_user_id left join public.admin_profiles p on p.user_id=n.actor_user_id
  where n.occurred_at>=c.delivery_cutover and n.recorded_at>=c.delivery_cutover
   and private.admin_notification_recipient_eligible(n.recipient_user_id,'security',jsonb_build_object('to',u.email),n.id)
   and not exists(select 1 from private.admin_notification_deliveries d where d.delivery_key='security:'||n.event_key||':'||n.recipient_user_id)
  order by n.occurred_at,n.id limit greatest(0,least(500,coalesce(p_notice_limit,500)))
 )rows;
 select coalesce(jsonb_agg(item order by user_id),'[]'::jsonb)into subjects from(
  select p.user_id,jsonb_build_object('userId',p.user_id,'email',u.email)item
  from public.admin_profiles p join auth.users u on u.id=p.user_id
  where(c.digest_cursor is null or p.user_id>c.digest_cursor)
   and private.admin_notification_recipient_eligible(p.user_id,'recommendation',jsonb_build_object('to',u.email))
   and not exists(select 1 from private.admin_notification_deliveries d where d.delivery_key='recommendation:'||p.user_id||':'||p_month)
  order by p.user_id limit account_limit
 )rows;
 select exists(select 1 from public.admin_profiles p join auth.users u on u.id=p.user_id
  where(c.digest_cursor is null or p.user_id>c.digest_cursor)
   and private.admin_notification_recipient_eligible(p.user_id,'recommendation',jsonb_build_object('to',u.email))
   and not exists(select 1 from private.admin_notification_deliveries d where d.delivery_key='recommendation:'||p.user_id||':'||p_month)
  order by p.user_id offset account_limit limit 1)into has_more;
 return jsonb_build_object('enabled',true,'notices',notices,'subjects',subjects,'digestEnd',not has_more);
end $fn$;

create function public.advance_admin_digest_cursor(p_lease_id uuid,p_month text,p_subject uuid,p_reset boolean default false)returns boolean
language plpgsql security definer set search_path='' as $fn$
begin
 if not exists(select 1 from private.admin_activity_ingestion_state where name='job'and lease_id=p_lease_id and lease_until>clock_timestamp())then raise insufficient_privilege;end if;
 if p_subject is null or p_reset is null or p_month is distinct from to_char(clock_timestamp()at time zone 'Asia/Dhaka','YYYY-MM')then return false;end if;
 update private.admin_notification_controls set digest_cursor=case when p_reset then null else p_subject end,digest_month=p_month
 where singleton and delivery_enabled and(digest_cursor is null or p_subject>=digest_cursor);
 return found;
end $fn$;

-- Keep exact native factor/source identities; never treat setup or routine verification as a new factor.
create table private.admin_notification_mfa_receipts(
 user_id uuid not null,factor_id uuid not null,first_verification_id uuid not null unique,recorded_at timestamptz not null default clock_timestamp(),primary key(user_id,factor_id)
);
create function private.admin_notification_native_action(p_row auth.audit_log_entries,p_dry_run boolean)returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare act text:=p_row.payload->>'action';fid uuid;uid uuid;first_id uuid;setup_id uuid;setup_at timestamptz;cutover timestamptz;
begin
 if act in('verification_attempted','factor_unenrolled')and coalesce(p_row.payload#>>'{traits,factor_id}','')~'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'then
  fid:=(p_row.payload#>>'{traits,factor_id}')::uuid;uid:=(p_row.payload->>'actor_id')::uuid;
  if act='factor_unenrolled'and p_row.payload#>>'{traits,factor_status}'='verified'then return '{"action":"auth.mfa_factor_unenrolled","outcome":"succeeded"}'::jsonb;end if;
  if act='verification_attempted'then
   select first_verification_id into first_id from private.admin_notification_mfa_receipts where user_id=uid and factor_id=fid;
   if first_id is null then
    select notice_cutover into cutover from private.admin_notification_controls where singleton;
    select a.id,a.created_at into setup_id,setup_at from auth.audit_log_entries a
     where a.payload->>'actor_id'=uid::text and a.payload->>'action'='factor_in_progress'and a.payload#>>'{traits,factor_id}'=fid::text
      and a.created_at>=cutover and(a.created_at,a.id)<=(p_row.created_at,p_row.id)
      and exists(select 1 from private.admin_activity_identity_periods h where h.user_id=uid and a.created_at>=h.active_from and(h.active_until is null or a.created_at<h.active_until))
     order by a.created_at,a.id limit 1;
    if setup_id is not null then
     select a.id into first_id from auth.audit_log_entries a where a.payload->>'actor_id'=uid::text and a.payload->>'action'='verification_attempted'
      and a.payload#>>'{traits,factor_id}'=fid::text and(a.created_at,a.id)>=(setup_at,setup_id)order by a.created_at,a.id limit 1;
     if first_id=p_row.id and not p_dry_run then
      insert into private.admin_notification_mfa_receipts(user_id,factor_id,first_verification_id)values(uid,fid,first_id)on conflict do nothing;
      select first_verification_id into first_id from private.admin_notification_mfa_receipts where user_id=uid and factor_id=fid;
     end if;
    end if;
   end if;
   if first_id=p_row.id then return '{"action":"auth.mfa_factor_enrolled","outcome":"succeeded"}'::jsonb;end if;
  end if;
 end if;
 if act is null or act!~'^[a-z_]{1,80}$'then act:='unknown';end if;
 return jsonb_build_object('action','auth.'||act,'outcome',case when act in('login','user_updated_password')then 'succeeded'else 'unknown'end);
end $fn$;

create or replace function public.collect_admin_auth_activity(p_limit integer,p_dry_run boolean,p_lease_id uuid)returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare row auth.audit_log_entries%rowtype;c private.admin_activity_ingestion_state%rowtype;read_count integer:=0;stored integer:=0;v_backlog boolean:=false;act text;ip text;result text;first_native timestamptz;unknown_shape boolean:=false;normalized jsonb;
begin
 if not exists(select 1 from private.admin_activity_ingestion_state where name='job'and lease_id=p_lease_id and lease_until>clock_timestamp())then raise insufficient_privilege using message='Current job lease required';end if;
 if p_limit is null or p_limit<1 or p_limit>500 or p_dry_run is null then raise invalid_parameter_value using message='Bounded batch required';end if;
 select *into c from private.admin_activity_ingestion_state where name='native_auth'for update;
 select min(created_at)into first_native from auth.audit_log_entries where created_at>=c.cutover_at;
 for row in select a.*from auth.audit_log_entries a where a.created_at>=c.cutover_at and a.created_at<=clock_timestamp()
  and exists(select 1 from private.admin_activity_identity_periods h where h.user_id::text=a.payload->>'actor_id'and a.created_at>=h.active_from and(h.active_until is null or a.created_at<h.active_until))
  and not exists(select 1 from private.admin_activity_receipts r where r.source='native_auth'and r.source_id=a.id::text)
  order by a.created_at,a.id limit p_limit+1 loop
  if read_count=p_limit then v_backlog:=true;exit;end if;
  read_count:=read_count+1;act:=row.payload->>'action';
  if act is null or act!~'^[a-z_]{1,80}$'then unknown_shape:=true;end if;
  normalized:=private.admin_notification_native_action(row,p_dry_run);
  ip:=nullif(row.ip_address,'');begin if ip is not null then perform ip::inet;end if;exception when invalid_text_representation then ip:=null;end;
  if not p_dry_run then
   result:=private.admin_activity_append(jsonb_build_object('id',row.id,'source','native_auth','sourceId',row.id,'actorUserId',row.payload->>'actor_id','targetUserId',null,'action',normalized->>'action','outcome',normalized->>'outcome','occurredAt',row.created_at,'recordedAt',clock_timestamp(),
    'context',jsonb_build_object('observedIp',ip,'clientIp',null,'countryCode',null,'browser',null,'os',null,'deviceClass',null,'networkSource','native_provider'),'provenance','Native Auth provider row; event-time admin interval; exact factor receipt for completed MFA changes'),false);
   if result='stored'then stored:=stored+1;end if;
  end if;
 end loop;
 if not p_dry_run then
  update private.admin_activity_ingestion_state set last_collected_at=clock_timestamp(),observed_since=least(observed_since,first_native),backlog=v_backlog,
   state=case when first_native is null then 'unavailable'else 'partial'end,
   error_code=case when unknown_shape then 'unknown_source_shape'when first_native is null then 'native_storage_not_observed'else null end where name='native_auth';
 end if;
 return jsonb_build_object('read',read_count,'stored',stored,'backlog',v_backlog,'coverage',jsonb_build_object('state',case when first_native is null then 'unavailable'else 'partial'end,'observedSince',coalesce(c.observed_since,first_native),'continuousSince',c.continuous_since,'lastCollectedAt',case when p_dry_run then c.last_collected_at else clock_timestamp()end));
end $fn$;

-- Immediate committed application notices; recovery remains in the daily job.
-- A notice projection failure must not block the completed business mutation.
create function private.admin_notification_on_activity()returns trigger language plpgsql security definer set search_path='' as $fn$
begin
 if new.source='application_commit' then
  begin perform public.enqueue_admin_security_notice(new.id);exception when others then null;end;
 end if;
 return new;
end $fn$;
create trigger admin_notification_committed_activity after insert on private.admin_activity_events for each row execute function private.admin_notification_on_activity();

create table private.admin_accountability_health(
 singleton boolean primary key default true check(singleton),last_finished_at timestamptz,last_successful_at timestamptz,
 errors jsonb not null default '[]',backlog boolean not null default false
);
insert into private.admin_accountability_health(singleton)values(true);
create function public.record_admin_accountability_health(p_lease_id uuid,p_result jsonb)returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare pending boolean;
begin
 if not exists(select 1 from private.admin_activity_ingestion_state where name='job'and lease_id=p_lease_id and lease_until>clock_timestamp())then raise insufficient_privilege;end if;
 if jsonb_typeof(p_result)is distinct from 'object'or jsonb_typeof(p_result->'errors')is distinct from 'array'
  or jsonb_typeof(p_result->'backlog')is distinct from 'boolean'or jsonb_array_length(p_result->'errors')>20
  or exists(select 1 from jsonb_array_elements(p_result->'errors')v where jsonb_typeof(v)<>'string'or v#>>'{}'not in(
   'deadline_reached','collection_unavailable','notification_deadline_reached','notification_work_unavailable',
   'recommendation_inputs_unavailable','receipt_unavailable','delivery_unavailable'))then raise invalid_parameter_value;end if;
 pending:=(p_result->>'backlog')::boolean
  or exists(select 1 from private.admin_notification_deliveries where state in('pending','sending','uncertain')or(state='failed'and last_failure_kind in('configuration','rate_limited')))
  or exists(select 1 from private.admin_security_notices n join auth.users u on u.id=n.recipient_user_id cross join private.admin_notification_controls c
   where c.singleton and c.delivery_enabled and n.occurred_at>=c.delivery_cutover and n.recorded_at>=c.delivery_cutover
    and private.admin_notification_recipient_eligible(n.recipient_user_id,'security',jsonb_build_object('to',u.email),n.id)
    and not exists(select 1 from private.admin_notification_deliveries d where d.delivery_key='security:'||n.event_key||':'||n.recipient_user_id));
 update private.admin_accountability_health set last_finished_at=clock_timestamp(),
  last_successful_at=case when jsonb_array_length(p_result->'errors')=0 then clock_timestamp()else last_successful_at end,
  errors=p_result->'errors',backlog=pending where singleton;
 return jsonb_build_object('backlog',pending);
end $fn$;
create function public.query_admin_accountability_health(p_actor jsonb)returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare h private.admin_accountability_health%rowtype;attention bigint;
begin
 perform private.admin_activity_assert_reader(p_actor,'admin.audit.read');
 select * into h from private.admin_accountability_health where singleton;
 select count(*)into attention from private.admin_notification_deliveries where state='uncertain'or(state='sending'and lease_until<clock_timestamp())
  or(state in('pending','failed')and has_uncertain_outcome and(first_attempt_at is null or first_attempt_at<=clock_timestamp()-interval '23 hours 59 minutes'));
 return jsonb_build_object('state',case when h.last_finished_at is null then 'unavailable'when jsonb_array_length(h.errors)>0 or attention>0 then 'attention'when h.last_successful_at<clock_timestamp()-interval '48 hours'then 'delayed'else 'current'end,
  'lastFinishedAt',h.last_finished_at,'lastSuccessfulAt',h.last_successful_at,'backlog',h.backlog,'operatorAttentionCount',attention);
end $fn$;

do $acl$
declare t text;f record;
begin
 foreach t in array array['admin_notification_controls','admin_notice_receipts','admin_notice_event_receipts','admin_security_notices','admin_notification_deliveries','admin_notification_suppressions','admin_notification_webhook_receipts','admin_notification_mfa_receipts','admin_accountability_health']loop
  execute format('alter table private.%I enable row level security',t);
  execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);
 end loop;
 for f in select p.oid::regprocedure signature,n.nspname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where(n.nspname='private'and(p.proname='admin_notice_reader'or p.proname like 'admin_notification_%'))or(n.nspname='public'and p.proname in('enqueue_admin_security_notice','collect_admin_security_notices','query_own_admin_notices','mark_own_admin_notice_read','own_admin_email_preferences','get_admin_recommendation_inputs','queue_admin_notice_email','queue_admin_recommendation_email','list_admin_notification_deliveries','claim_admin_notification_delivery','validate_admin_notification_delivery','finish_admin_notification_delivery','record_admin_notification_webhook_event','get_admin_notification_batch','advance_admin_digest_cursor','record_admin_accountability_health','query_admin_accountability_health'))loop
  execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
  if f.nspname='public'then execute format('grant execute on function %s to service_role',f.signature);end if;
 end loop;
end $acl$;
commit;
