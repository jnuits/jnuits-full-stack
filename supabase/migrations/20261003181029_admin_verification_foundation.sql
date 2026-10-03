-- Server-owned verification. No browser table access or Auth-schema changes.
create table private.admin_verification_config (id boolean primary key default true check(id), initialized_at timestamptz not null default now());
insert into private.admin_verification_config(id) values(true);
create table private.admin_verification_operations (
  operation text primary key, kind text not null check(kind in ('routine','protected_read','protected_mutation','admin_role')), permission text not null
);
insert into private.admin_verification_operations values
 ('membership.request.review','routine','admin.membership.manage'),
 ('membership.renewal.confirm','protected_mutation','admin.membership.manage'),
 ('admin.role.change','admin_role','admin.roles.manage_admin'),('admin.role.invite','admin_role','admin.roles.manage_admin'),('admin.role.remove','admin_role','admin.roles.manage_admin'),
 ('admin.lifecycle.freeze','protected_mutation','admin.roles.manage_admin'),('admin.lifecycle.unfreeze','protected_mutation','admin.roles.manage_admin'),('admin.invitation.revoke','protected_mutation','admin.roles.manage_admin'),
 ('admin.security.update','protected_mutation','admin.security.write'),('admin.security.read','protected_read','admin.security.read'),('admin.system_health.read','protected_read','admin.security.read'),
 ('admin.retention.read','protected_read','admin.retention.manage'),('admin.retention.discover','protected_mutation','admin.retention.manage'),('admin.retention.archive','protected_mutation','admin.retention.manage'),
 ('admin.retention.approve_purge','protected_mutation','admin.retention.manage'),('admin.retention.purge','protected_mutation','admin.retention.manage');
create table private.admin_verification_mfa_history (
  user_id uuid primary key references auth.users(id) on delete cascade,
  ever_enrolled boolean not null default false, never_confirmed_at timestamptz, updated_at timestamptz not null default now()
);
-- Absence of current factors alone is NOT evidence of never having enabled MFA.
insert into private.admin_verification_mfa_history(user_id,ever_enrolled)
  select distinct user_id,true from auth.mfa_factors where status='verified';
create table private.admin_verification_intents (
  id uuid primary key default extensions.gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null, operation text not null references private.admin_verification_operations(operation), payload jsonb not null,
  target_ref text not null, payload_digest text not null, role_version bigint not null, email_hash text not null,
  policy_revision text not null, expires_at timestamptz not null default(now()+interval '5 minutes'),
  password_attempt_at timestamptz, created_at timestamptz not null default now()
);
create index admin_verification_intents_actor_idx on private.admin_verification_intents(user_id,session_id,operation);
create table private.admin_verification_challenges (
  id uuid primary key, intent_id uuid not null references private.admin_verification_intents(id) on delete cascade,
  code_mac text not null check(code_mac ~ '^[a-f0-9]{64}$'), key_id text not null,
  delivery text not null default 'pending' check(delivery in ('pending','sent','failed')),
  failed_attempts integer not null default 0 check(failed_attempts between 0 and 5),
  consumed_at timestamptz, expires_at timestamptz not null default(now()+interval '5 minutes'), created_at timestamptz not null default now()
);
create index admin_verification_challenges_intent_idx on private.admin_verification_challenges(intent_id);
create table private.admin_verification_proofs (
  id uuid primary key default extensions.gen_random_uuid(), intent_id uuid not null references private.admin_verification_intents(id) on delete cascade,
  token_hash text not null check(token_hash ~ '^[a-f0-9]{64}$'), method text not null check(method in ('email','password')),
  expires_at timestamptz not null default(now()+interval '5 minutes'), consumed_at timestamptz, created_at timestamptz not null default now()
);
create index admin_verification_proofs_intent_idx on private.admin_verification_proofs(intent_id);
create table private.admin_verification_attempts (
  id uuid primary key default extensions.gen_random_uuid(), intent_id uuid not null references private.admin_verification_intents(id) on delete cascade,
  proof_id uuid references private.admin_verification_proofs(id),
  status text not null default 'reserved' check(status in ('reserved','completed','failed')),
  expires_at timestamptz not null default(now()+interval '5 minutes'), created_at timestamptz not null default now(), completed_at timestamptz
);
create index admin_verification_attempts_intent_idx on private.admin_verification_attempts(intent_id);
create index admin_verification_attempts_proof_idx on private.admin_verification_attempts(proof_id);
create table private.admin_verification_rate_events (kind text not null, subject_hash text not null, occurred_at timestamptz not null default clock_timestamp());
create index admin_verification_rate_events_lookup_idx on private.admin_verification_rate_events(kind,subject_hash,occurred_at);
create table private.admin_verification_audit (
  id bigint generated always as identity primary key, user_id uuid references auth.users(id) on delete set null,
  operation text, event text not null, outcome text not null, created_at timestamptz not null default now()
);
create index admin_verification_audit_user_idx on private.admin_verification_audit(user_id);
revoke all on sequence private.admin_verification_audit_id_seq from public,anon,authenticated,service_role;
create table private.admin_verification_preferences (user_id uuid primary key references auth.users(id) on delete cascade, snoozed_until timestamptz);

do $acl$
declare t text;
begin
  foreach t in array array['config','operations','mfa_history','intents','challenges','proofs','attempts','rate_events','audit','preferences'] loop
    execute format('alter table private.admin_verification_%I enable row level security',t);
    execute format('revoke all on private.admin_verification_%I from public,anon,authenticated,service_role',t);
  end loop;
end;
$acl$;

create function private.admin_verification_actor_context(p_actor jsonb) returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare
  u auth.users%rowtype; s auth.sessions%rowtype; profile public.admin_profiles%rowtype;
  history private.admin_verification_mfa_history%rowtype; settings public.security_settings%rowtype;
  v bigint; enrollment text; level text := p_actor->>'currentLevel';
begin
  select * into u from auth.users where id=(p_actor->>'userId')::uuid for share;
  if not found then return jsonb_build_object('ok',false,'code','session_invalid'); end if;
  select * into s from auth.sessions where id=(p_actor->>'sessionId')::uuid and user_id=u.id for share;
  if not found or (s.not_after is not null and s.not_after<=clock_timestamp()) or level not in ('aal1','aal2') or level is null then
    return jsonb_build_object('ok',false,'code','session_invalid');
  end if;
  if level='aal2' and (s.aal is distinct from 'aal2' or not exists(
    select 1 from auth.mfa_factors f where f.id=s.factor_id and f.user_id=u.id and f.status='verified' and f.factor_type='totp')) then
    return jsonb_build_object('ok',false,'code','verification_required');
  end if;
  select * into profile from public.admin_profiles where user_id=u.id for share;
  if not found or not profile.is_active or profile.status is distinct from 'active'
    or not exists(select 1 from public.rbac_user_platform_roles g join public.rbac_platform_roles r on r.id=g.role_id
      where g.user_id=u.id and g.revoked_at is null and g.scope='admin' and r.code in ('super_admin','admin','content_admin')) then
    return jsonb_build_object('ok',false,'code','permission_denied');
  end if;
  select version into v from public.rbac_user_claim_versions where user_id=u.id for share;
  if v is null or v is distinct from (p_actor->>'roleVersion')::bigint then return jsonb_build_object('ok',false,'code','role_version_stale'); end if;
  select * into settings from public.security_settings where id for share;
  if not found then return jsonb_build_object('ok',false,'code','verification_unavailable'); end if;
  if exists(select 1 from auth.mfa_factors where user_id=u.id and status='verified')
    or exists(select 1 from auth.sessions where user_id=u.id and aal='aal2')
    or exists(select 1 from auth.audit_log_entries where payload->>'actor_id'=u.id::text
      and payload->>'action' in ('mfa_factor_verified','mfa_factor_unenrolled','mfa_factor_deleted')) then
    insert into private.admin_verification_mfa_history(user_id,ever_enrolled) values(u.id,true)
      on conflict(user_id) do update set ever_enrolled=true,updated_at=clock_timestamp();
  end if;
  select * into history from private.admin_verification_mfa_history where user_id=u.id;
  enrollment := case when history.ever_enrolled then 'enrolled' when history.never_confirmed_at is not null then 'never' else 'unknown' end;
  return jsonb_build_object('ok',true,'value',jsonb_build_object('userId',u.id,'sessionId',s.id,'email',coalesce(u.email,''),
    'emailConfirmed',u.email_confirmed_at is not null,'roleVersion',v,'currentLevel',level,'enforced',settings.admin_totp_enforced,'enrollment',enrollment));
end;
$fn$;

create function private.admin_verification_has_permission(p_user uuid,p_permission text) returns boolean
language sql security definer set search_path='' as $fn$
 select exists(select 1 from public.rbac_user_platform_roles g join public.rbac_platform_roles r on r.id=g.role_id
  where g.user_id=p_user and g.scope='admin' and g.revoked_at is null and (r.code='super_admin' or exists(
    select 1 from public.rbac_role_permissions rp where rp.role_id=g.role_id and rp.permission_code=p_permission)))
$fn$;

create function private.admin_verification_rate_hit(p_kind text,p_key text,p_limit integer,p_seconds integer,p_cooldown integer default 0) returns boolean
language plpgsql security definer set search_path='' as $fn$
begin
  perform pg_advisory_xact_lock(hashtextextended('admin-verification:'||p_kind||':'||p_key,0));
  if (select count(*) from private.admin_verification_rate_events where kind=p_kind and subject_hash=p_key and occurred_at>clock_timestamp()-make_interval(secs=>p_seconds))>=p_limit
    or (p_cooldown>0 and exists(select 1 from private.admin_verification_rate_events where kind=p_kind and subject_hash=p_key and occurred_at>clock_timestamp()-make_interval(secs=>p_cooldown))) then return false; end if;
  insert into private.admin_verification_rate_events(kind,subject_hash) values(p_kind,p_key);
  return true;
end;
$fn$;

create function private.admin_verification_intent_check(p_intent private.admin_verification_intents,p_actor jsonb) returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare ctx jsonb; actor jsonb; permission text; revision text;
begin
  ctx := private.admin_verification_actor_context(p_actor);
  if not (ctx->>'ok')::boolean then return ctx; end if;
  actor := ctx->'value';
  select updated_at::text into revision from public.security_settings where id;
  select o.permission into permission from private.admin_verification_operations o where operation=p_intent.operation;
  if p_intent.user_id is distinct from (actor->>'userId')::uuid or p_intent.session_id is distinct from (actor->>'sessionId')::uuid
    or p_intent.role_version is distinct from (actor->>'roleVersion')::bigint or p_intent.policy_revision is distinct from revision
    or p_intent.email_hash is distinct from encode(extensions.digest(convert_to(actor->>'email','UTF8'),'sha256'),'hex')
    or not private.admin_verification_has_permission(p_intent.user_id,permission) then return jsonb_build_object('ok',false,'code','verification_invalid'); end if;
  return ctx;
end;
$fn$;

create function private.admin_verification_prepared(p_intent private.admin_verification_intents,p_actor jsonb) returns jsonb
language sql security definer set search_path='' as $fn$
 select jsonb_build_object('id',p_intent.id,'actor',p_actor,'intent',jsonb_build_object('operation',p_intent.operation,'payload',p_intent.payload),
  'targetRef',p_intent.target_ref,'payloadDigest',p_intent.payload_digest,'policyRevision',p_intent.policy_revision)
$fn$;

create function private.admin_verification_command(p_command text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare
  ctx jsonb; actor jsonb; intent private.admin_verification_intents%rowtype;
  challenge private.admin_verification_challenges%rowtype; proof private.admin_verification_proofs%rowtype;
  operation private.admin_verification_operations%rowtype; payload jsonb; aid uuid; evidence_user_id uuid;
  revision text; can_email boolean; ip text:=p_input->>'ipHash';
begin
  if p_command='context' then return private.admin_verification_actor_context(p_input); end if;
  if p_command='record_enrollment' then
    evidence_user_id := (p_input->>'userId')::uuid;
    if p_input->>'evidence'='confirmed_factor' and exists(select 1 from auth.mfa_factors f where f.user_id=evidence_user_id and f.status='verified') then
      insert into private.admin_verification_mfa_history(user_id,ever_enrolled) values(evidence_user_id,true)
        on conflict(user_id) do update set ever_enrolled=true,updated_at=clock_timestamp();
    elsif p_input->>'evidence'='trusted_never_history' and exists(select 1 from auth.users u cross join private.admin_verification_config c
      where u.id=evidence_user_id and u.created_at>=c.initialized_at) and not exists(select 1 from auth.mfa_factors f where f.user_id=evidence_user_id)
      and not exists(select 1 from auth.audit_log_entries a where a.payload->>'actor_id'=evidence_user_id::text and a.payload->>'action' like 'mfa%') then
      insert into private.admin_verification_mfa_history(user_id,never_confirmed_at) values(evidence_user_id,clock_timestamp())
        on conflict(user_id) do update set never_confirmed_at=excluded.never_confirmed_at where not private.admin_verification_mfa_history.ever_enrolled;
    else return jsonb_build_object('ok',false,'code','enrollment_evidence_invalid'); end if;
    return jsonb_build_object('ok',true,'value',null);
  end if;
  if p_command='mark_email_delivery' then
    update private.admin_verification_challenges set delivery=case when (p_input->>'delivered')::boolean then 'sent' else 'failed' end
      where id=(p_input->>'challengeId')::uuid and delivery='pending' and consumed_at is null;
    return jsonb_build_object('ok',true,'value',null);
  end if;
  if p_command in ('begin_email','reserve_password_attempt','issue_password') then
    select * into intent from private.admin_verification_intents where id=(p_input#>>'{prepared,id}')::uuid for update;
    actor := p_input#>'{prepared,actor}';
  elsif p_command in ('load_email_challenge','redeem_email') then
    select * into challenge from private.admin_verification_challenges where id=(p_input->>'challengeId')::uuid for update;
    if not found then return jsonb_build_object('ok',false,'code','verification_invalid'); end if;
    select * into intent from private.admin_verification_intents where id=challenge.intent_id;
    actor := p_input->'actor';
  elsif p_command in ('check_read','reserve') and p_input->>'proofId' is not null then
    select * into proof from private.admin_verification_proofs where id=(p_input->>'proofId')::uuid for update;
    if not found or proof.consumed_at is not null or proof.expires_at<=clock_timestamp() or proof.token_hash is distinct from p_input->>'tokenHash' then
      return jsonb_build_object('ok',false,'code','verification_invalid'); end if;
    select * into intent from private.admin_verification_intents where id=proof.intent_id;
    actor := p_input->'actor';
    if intent.operation is distinct from p_input#>>'{intent,operation}' or intent.payload is distinct from p_input#>'{intent,payload}' then
      return jsonb_build_object('ok',false,'code','verification_invalid'); end if;
  elsif p_command in ('prepare','reserve') then
    actor := p_input->'actor';
  else return jsonb_build_object('ok',false,'code','operation_invalid'); end if;
  if intent.id is not null then
    ctx := private.admin_verification_intent_check(intent,actor);
  else ctx := private.admin_verification_actor_context(actor); end if;
  if not coalesce((ctx->>'ok')::boolean,false) then return ctx; end if;
  actor := ctx->'value';
  if intent.id is null then
    select o.* into operation from private.admin_verification_operations o where o.operation=p_input#>>'{intent,operation}';
    if not found then return jsonb_build_object('ok',false,'code','operation_invalid'); end if;
    payload := p_input#>'{intent,payload}';
    if jsonb_typeof(payload) is distinct from 'object' then return jsonb_build_object('ok',false,'code','invalid_input'); end if;
    if not private.admin_verification_has_permission((actor->>'userId')::uuid,operation.permission) then return jsonb_build_object('ok',false,'code','permission_denied'); end if;
    select updated_at::text into revision from public.security_settings where id;
    insert into private.admin_verification_intents(user_id,session_id,operation,payload,target_ref,payload_digest,role_version,email_hash,policy_revision)
      values((actor->>'userId')::uuid,(actor->>'sessionId')::uuid,operation.operation,payload,
        coalesce(payload->>'adminProfileId',payload->>'memberId',payload->>'requestId',payload->>'invitationId',payload->>'jobId',payload->>'email',operation.operation),
        encode(extensions.digest(convert_to(payload::text,'UTF8'),'sha256'),'hex'),(actor->>'roleVersion')::bigint,
        encode(extensions.digest(convert_to(actor->>'email','UTF8'),'sha256'),'hex'),revision) returning * into intent;
  else select o.* into operation from private.admin_verification_operations o where o.operation=intent.operation; end if;
  can_email := operation.kind in ('protected_read','protected_mutation') and not (actor->>'enforced')::boolean
    and actor->>'enrollment'='never' and (actor->>'emailConfirmed')::boolean;
  if p_command='prepare' then return jsonb_build_object('ok',true,'value',private.admin_verification_prepared(intent,actor)); end if;
  if p_command in ('begin_email','load_email_challenge','redeem_email','reserve_password_attempt','issue_password') and intent.expires_at<=clock_timestamp() then
    return jsonb_build_object('ok',false,'code','verification_expired'); end if;
  if p_command in ('begin_email','load_email_challenge','redeem_email') and not can_email then return jsonb_build_object('ok',false,'code','verification_invalid'); end if;
  if p_command='begin_email' then
    if ip !~ '^[a-f0-9]{64}$' or ip is null then return jsonb_build_object('ok',false,'code','verification_unavailable'); end if;
    if not private.admin_verification_rate_hit('email_send_account',intent.user_id::text,3,900,60)
      or not private.admin_verification_rate_hit('email_send_ip',ip,10,900) then return jsonb_build_object('ok',false,'code','rate_limited'); end if;
    update private.admin_verification_challenges c set consumed_at=clock_timestamp() from private.admin_verification_intents i
      where c.intent_id=i.id and i.user_id=intent.user_id and i.session_id=intent.session_id and i.operation=intent.operation and c.consumed_at is null;
    insert into private.admin_verification_challenges(id,intent_id,code_mac,key_id)
      values((p_input->>'challengeId')::uuid,intent.id,p_input->>'codeMac',p_input->>'keyId') returning * into challenge;
    return jsonb_build_object('ok',true,'value',jsonb_build_object('challengeId',challenge.id,'expiresAt',challenge.expires_at));
  end if;
  if p_command in ('load_email_challenge','redeem_email') then
    if challenge.consumed_at is not null or challenge.expires_at<=clock_timestamp() or challenge.failed_attempts>=5 then return jsonb_build_object('ok',false,'code','verification_invalid'); end if;
    if challenge.delivery<>'sent' then return jsonb_build_object('ok',false,'code','delivery_failed'); end if;
    if p_command='load_email_challenge' then return jsonb_build_object('ok',true,'value',private.admin_verification_prepared(intent,actor)); end if;
    if ip is null or ip !~ '^[a-f0-9]{64}$' then return jsonb_build_object('ok',false,'code','verification_unavailable'); end if;
    if not private.admin_verification_rate_hit('email_verify_ip',ip,30,600) then return jsonb_build_object('ok',false,'code','rate_limited'); end if;
    if not coalesce(p_input->'candidateMacs' ? challenge.code_mac,false) then
      update private.admin_verification_challenges set failed_attempts=failed_attempts+1 where id=challenge.id;
      return jsonb_build_object('ok',false,'code','code_invalid');
    end if;
    update private.admin_verification_challenges set consumed_at=clock_timestamp() where id=challenge.id;
    insert into private.admin_verification_proofs(intent_id,token_hash,method) values(intent.id,p_input->>'tokenHash','email') returning * into proof;
    return jsonb_build_object('ok',true,'value',jsonb_build_object('proofId',proof.id,'expiresAt',proof.expires_at));
  end if;
  if p_command in ('reserve_password_attempt','issue_password') then
    if operation.kind<>'admin_role' or actor->>'currentLevel'<>'aal2' then return jsonb_build_object('ok',false,'code','verification_required'); end if;
    if p_command='reserve_password_attempt' then
      if ip is null or ip !~ '^[a-f0-9]{64}$' then return jsonb_build_object('ok',false,'code','verification_unavailable'); end if;
      if not private.admin_verification_rate_hit('password_account',intent.user_id::text,3,600)
        or not private.admin_verification_rate_hit('password_ip',ip,10,600) then return jsonb_build_object('ok',false,'code','rate_limited'); end if;
      update private.admin_verification_intents set password_attempt_at=clock_timestamp() where id=intent.id;
      return jsonb_build_object('ok',true,'value',null);
    end if;
    if intent.password_attempt_at is null then return jsonb_build_object('ok',false,'code','verification_invalid'); end if;
    update private.admin_verification_intents set password_attempt_at=null where id=intent.id;
    insert into private.admin_verification_proofs(intent_id,token_hash,method) values(intent.id,p_input->>'tokenHash','password') returning * into proof;
    return jsonb_build_object('ok',true,'value',jsonb_build_object('proofId',proof.id,'expiresAt',proof.expires_at));
  end if;
  if p_command='check_read' then
    if operation.kind<>'protected_read' or proof.method<>'email' or not can_email then return jsonb_build_object('ok',false,'code','verification_invalid'); end if;
    return jsonb_build_object('ok',true,'value',null);
  end if;
  if p_command='reserve' then
    if operation.kind in ('routine','protected_read') then return jsonb_build_object('ok',false,'code','operation_invalid'); end if;
    if operation.kind='admin_role' then
      if actor->>'currentLevel'<>'aal2' or proof.id is null or proof.method<>'password' then return jsonb_build_object('ok',false,'code','verification_required'); end if;
    elsif proof.id is not null then
      if proof.method<>'email' or not can_email then return jsonb_build_object('ok',false,'code','verification_invalid'); end if;
    elsif actor->>'currentLevel'<>'aal2' then return jsonb_build_object('ok',false,'code','verification_required'); end if;
    if proof.id is not null then update private.admin_verification_proofs set consumed_at=clock_timestamp() where id=proof.id; end if;
    insert into private.admin_verification_attempts(intent_id,proof_id) values(intent.id,proof.id) returning id into aid;
    return jsonb_build_object('ok',true,'value',jsonb_build_object('attemptId',aid));
  end if;
  return jsonb_build_object('ok',false,'code','operation_invalid');
end;
$fn$;

create function private.admin_verification_handle(p_command text,p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare result jsonb; actor_id uuid; event_operation text;
begin
  result := private.admin_verification_command(p_command,p_input);
  actor_id := coalesce(p_input->>'userId',p_input#>>'{actor,userId}',p_input#>>'{prepared,actor,userId}')::uuid;
  event_operation := coalesce(p_input#>>'{intent,operation}',p_input#>>'{prepared,intent,operation}');
  if p_input->>'challengeId' is not null then
    select coalesce(actor_id,i.user_id),coalesce(event_operation,i.operation) into actor_id,event_operation
      from private.admin_verification_challenges c join private.admin_verification_intents i on i.id=c.intent_id
      where c.id=(p_input->>'challengeId')::uuid;
  end if;
  if actor_id is not null and exists(select 1 from auth.users where id=actor_id) then
    insert into private.admin_verification_audit(user_id,operation,event,outcome) values(actor_id,
      event_operation,p_command,
      case when p_command='mark_email_delivery' and p_input->>'delivered'='false' then 'delivery_failed'
        when (result->>'ok')::boolean then 'success' else coalesce(result->>'code','denied') end);
  end if;
  return result;
end;
$fn$;

-- Narrow, service-only RPC wrappers; no browser-controlled actor enters here.
do $wrappers$
declare cmd text; f record;
begin
  foreach cmd in array array['context','prepare','begin_email','mark_email_delivery','load_email_challenge','redeem_email','reserve_password_attempt','issue_password','reserve','check_read','record_enrollment'] loop
    execute format('create function public.%I(p_input jsonb) returns jsonb language sql security definer set search_path='''' as %L',
      'admin_verification_'||cmd,format('select private.admin_verification_handle(%L,p_input)',cmd));
    execute format('revoke all on function public.%I(jsonb) from public,anon,authenticated','admin_verification_'||cmd);
    execute format('grant execute on function public.%I(jsonb) to service_role','admin_verification_'||cmd);
  end loop;
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private' and p.proname like 'admin_verification_%' loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
  end loop;
end;
$wrappers$;
