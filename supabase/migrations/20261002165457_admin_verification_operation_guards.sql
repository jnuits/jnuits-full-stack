-- Forward-only operation guards. Hosted settings and identities are unchanged.
begin;
set local lock_timeout='5s';

alter table private.admin_verification_attempts add column reserved_actor jsonb;
create table private.admin_invitation_authorizations (
  attempt_id uuid primary key references private.admin_verification_attempts(id) on delete cascade,
  invitation_id uuid unique references public.admin_invitations(id) on delete cascade,
  recipient_email text not null, member_id uuid references public.members(id) on delete cascade,
  role_code text not null check(role_code in ('super_admin','admin','content_admin')),
  display_name text not null, title text not null, note text not null,
  issued_at timestamptz not null default clock_timestamp(), expires_at timestamptz not null default(clock_timestamp()+interval '7 days')
);
create index admin_invitation_authorizations_recipient_idx on private.admin_invitation_authorizations(recipient_email);
create index admin_invitation_authorizations_member_idx on private.admin_invitation_authorizations(member_id) where member_id is not null;
alter table private.admin_invitation_authorizations enable row level security;
revoke all on private.admin_invitation_authorizations from public,anon,authenticated,service_role;

-- JWT fields come from the verified request, never from the mutation payload.
create function private.admin_verification_jwt_actor() returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare ctx jsonb;
begin
  if auth.uid() is null or auth.jwt()->>'role' is distinct from 'authenticated'
    or auth.jwt()->>'session_id' is null or auth.jwt()->>'jnuits_role_version' is null then
    raise exception 'A live administrator session is required.' using errcode='42501';
  end if;
  if exists(select 1 from auth.users where id=auth.uid() and banned_until>clock_timestamp()) then
    raise exception 'This account is restricted.' using errcode='42501';
  end if;
  ctx:=private.admin_verification_actor_context(jsonb_build_object('userId',auth.uid(),
    'sessionId',auth.jwt()->>'session_id','roleVersion',auth.jwt()->>'jnuits_role_version','currentLevel',auth.jwt()->>'aal'));
  if not coalesce((ctx->>'ok')::boolean,false) then
    raise exception 'Administrator session or verification is invalid.' using errcode='42501';
  end if;
  return ctx->'value';
exception when invalid_text_representation then
  raise exception 'Administrator session is invalid.' using errcode='42501';
end;
$fn$;

create function private.admin_verification_check_write(p_input jsonb) returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare
  proof private.admin_verification_proofs%rowtype; intent private.admin_verification_intents%rowtype;
  operation private.admin_verification_operations%rowtype; ctx jsonb; actor jsonb;
begin
  select * into proof from private.admin_verification_proofs where id=(p_input->>'proofId')::uuid for update;
  if not found or proof.consumed_at is not null or proof.expires_at<=clock_timestamp()
    or proof.token_hash is distinct from p_input->>'tokenHash' then
    return jsonb_build_object('ok',false,'code','verification_invalid');
  end if;
  select * into intent from private.admin_verification_intents where id=proof.intent_id;
  if intent.operation is distinct from p_input#>>'{intent,operation}' or intent.payload is distinct from p_input#>'{intent,payload}' then
    return jsonb_build_object('ok',false,'code','verification_invalid');
  end if;
  ctx:=private.admin_verification_intent_check(intent,p_input->'actor');
  if not coalesce((ctx->>'ok')::boolean,false) then return ctx; end if;
  actor:=ctx->'value';
  if exists(select 1 from auth.users where id=intent.user_id and banned_until>clock_timestamp()) then
    return jsonb_build_object('ok',false,'code','permission_denied');
  end if;
  select o.* into operation from private.admin_verification_operations o where o.operation=intent.operation;
  if (operation.kind='admin_role' and proof.method='password' and actor->>'currentLevel'='aal2')
    or (operation.kind='protected_mutation' and proof.method='email' and not (actor->>'enforced')::boolean
      and actor->>'enrollment'='never' and (actor->>'emailConfirmed')::boolean) then
    return jsonb_build_object('ok',true,'value',null);
  end if;
  return jsonb_build_object('ok',false,'code','verification_invalid');
end;
$fn$;
create function public.admin_verification_check_write(p_input jsonb) returns jsonb
language sql security definer set search_path='' as $fn$
  select private.admin_verification_check_write(p_input)
$fn$;
revoke all on function public.admin_verification_check_write(jsonb) from public,anon,authenticated;
grant execute on function public.admin_verification_check_write(jsonb) to service_role;

create function private.reserve_admin_mutation(p_operation text,p_payload jsonb,p_proof text) returns uuid
language plpgsql security definer set search_path='' as $fn$
declare input jsonb; result jsonb;
begin
  input:=jsonb_build_object('actor',private.admin_verification_jwt_actor(),
    'intent',jsonb_build_object('operation',p_operation,'payload',p_payload));
  if p_proof is not null then
    if p_proof !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\.[A-Za-z0-9_-]{43}$' then
      raise exception 'Verification is invalid.' using errcode='42501';
    end if;
    input:=input||jsonb_build_object('proofId',split_part(p_proof,'.',1),
      'tokenHash',encode(extensions.digest(convert_to(split_part(p_proof,'.',2),'UTF8'),'sha256'),'hex'));
  end if;
  result:=private.admin_verification_handle('reserve',input);
  if not coalesce((result->>'ok')::boolean,false) then
    raise exception 'Operation verification is required or invalid.' using errcode='42501';
  end if;
  update private.admin_verification_attempts set reserved_actor=input->'actor' where id=(result#>>'{value,attemptId}')::uuid;
  return (result#>>'{value,attemptId}')::uuid;
end;
$fn$;

create function private.complete_admin_mutation(p_attempt_id uuid) returns void
language plpgsql security definer set search_path='' as $fn$
begin
  update private.admin_verification_attempts set status='completed',completed_at=clock_timestamp()
    where id=p_attempt_id and status='reserved';
  if not found then raise exception 'Operation attempt is no longer reserved.' using errcode='40001'; end if;
  insert into private.admin_verification_audit(user_id,operation,event,outcome)
    select i.user_id,i.operation,'mutation_completed','success' from private.admin_verification_intents i
      join private.admin_verification_attempts a on a.intent_id=i.id where a.id=p_attempt_id;
end;
$fn$;

-- Routine reviews retain their existing transaction, stale-state and audit rules.
create or replace function private.require_membership_operator() returns uuid
language plpgsql security definer set search_path='' as $fn$
declare actor jsonb:=private.admin_verification_jwt_actor();
begin
  if not private.admin_verification_has_permission((actor->>'userId')::uuid,'admin.membership.manage')
    or ((actor->>'enforced')::boolean and actor->>'currentLevel'<>'aal2') then
    raise exception 'Membership administration and required verification are needed.' using errcode='42501';
  end if;
  return (actor->>'userId')::uuid;
end;
$fn$;

-- Keep the proven renewal implementation private behind one public overload.
alter function public.confirm_membership_renewal(uuid,date,text,text,text,date) set schema private;
alter function private.confirm_membership_renewal(uuid,date,text,text,text,date) rename to confirm_membership_renewal_core;
revoke all on function private.confirm_membership_renewal_core(uuid,date,text,text,text,date) from public,anon,authenticated,service_role;
create function public.confirm_membership_renewal(
  p_member_id uuid,p_expected_due_on date,p_resolution text,p_reference text default null,p_note text default null,
  p_effective_date date default (now() at time zone 'Asia/Dhaka')::date,p_proof text default null
) returns jsonb language plpgsql security definer set search_path='' as $fn$
declare attempt_id uuid; result jsonb;
begin
  -- Legacy historical receipts remain available to genuinely verified MFA.
  -- An email proof is bound to the current-day operation the UI actually shows.
  if p_proof is not null and p_effective_date is distinct from (now() at time zone 'Asia/Dhaka')::date then
    raise exception 'Historical receipt confirmation requires authenticator verification.' using errcode='42501';
  end if;
  attempt_id:=private.reserve_admin_mutation('membership.renewal.confirm',jsonb_build_object(
    'memberId',p_member_id,'expectedDueOn',p_expected_due_on,'resolution',p_resolution,'reference',coalesce(btrim(p_reference),''),
    'note',coalesce(btrim(p_note),''),'confirmation','CONFIRM'),p_proof);
  result:=private.confirm_membership_renewal_core(p_member_id,p_expected_due_on,p_resolution,p_reference,p_note,p_effective_date);
  perform private.complete_admin_mutation(attempt_id);
  return result;
end;
$fn$;
revoke all on function public.confirm_membership_renewal(uuid,date,text,text,text,date,text) from public,anon,service_role;
grant execute on function public.confirm_membership_renewal(uuid,date,text,text,text,date,text) to authenticated;

create function private.admin_role_rank(p_user_id uuid) returns integer
language sql security definer set search_path='' as $fn$
  select coalesce(max(case r.code when 'super_admin' then 3 when 'admin' then 2 when 'content_admin' then 1 else 0 end),0)
    from public.rbac_user_platform_roles g join public.rbac_platform_roles r on r.id=g.role_id
    where g.user_id=p_user_id and g.scope='admin' and r.scope='admin' and g.revoked_at is null
$fn$;

create function private.require_admin_account_target(p_actor uuid,p_operation text,p_payload jsonb)
returns public.admin_profiles language plpgsql security definer set search_path='' as $fn$
declare target public.admin_profiles%rowtype; actor_rank integer; target_rank integer; confirmation text;
begin
  if jsonb_typeof(p_payload) is distinct from 'object' or p_payload->>'adminProfileId' is null
    or p_payload->>'confirmation' is null then raise exception 'Invalid account target.' using errcode='22023'; end if;
  select * into target from public.admin_profiles where id=(p_payload->>'adminProfileId')::uuid for update;
  if not found then raise exception 'Admin profile was not found.' using errcode='P0002'; end if;
  actor_rank:=private.admin_role_rank(p_actor); target_rank:=private.admin_role_rank(target.user_id);
  confirmation:=lower(btrim(p_payload->>'confirmation'));
  if p_actor=target.user_id or target_rank=0 or not (actor_rank=3 or (actor_rank=2 and target_rank=1))
    or not private.admin_verification_has_permission(p_actor,'admin.roles.manage_admin')
    or (confirmation is distinct from lower(target.admin_code::text) and confirmation is distinct from lower(target.email::text)) then
    raise exception 'This account operation is not permitted.' using errcode='42501';
  end if;
  if (p_operation='admin.role.change' and (actor_rank<>3 or actor_rank<=target_rank or target.status='removed'))
    or (p_operation='admin.role.remove' and target.status='removed')
    or (p_operation='admin.lifecycle.freeze' and target.status<>'active')
    or (p_operation='admin.lifecycle.unfreeze' and target.status<>'frozen')
    or p_operation not in ('admin.role.change','admin.role.remove','admin.lifecycle.freeze','admin.lifecycle.unfreeze') then
    raise exception 'This account transition is not permitted.' using errcode='42501';
  end if;
  return target;
end;
$fn$;

create function private.require_other_active_super_admin(p_target uuid) returns void
language plpgsql security definer set search_path='' as $fn$
begin
  if private.admin_role_rank(p_target)<>3 then return; end if;
  if not exists(select 1 from public.admin_profiles p join auth.users u on u.id=p.user_id
    where p.user_id<>p_target and p.is_active and p.status='active' and private.admin_role_rank(p.user_id)=3
      and (u.banned_until is null or u.banned_until<=clock_timestamp())
      -- A pending/uncertain external freeze must not count as a safe survivor,
      -- even after the attempt deadline. Never restore an uncertain proof.
      and not exists(select 1 from private.admin_verification_attempts a
        join private.admin_verification_intents i on i.id=a.intent_id
        where a.status='reserved' and i.operation in ('admin.lifecycle.freeze','admin.role.remove')
          and i.payload->>'adminProfileId'=p.id::text)) then
    raise exception 'The last active super admin cannot be changed, frozen, or removed.' using errcode='42501';
  end if;
end;
$fn$;

create function private.record_verified_admin_account_event(p_actor uuid,p_target public.admin_profiles,p_action text,p_metadata jsonb,p_severity text)
returns void language plpgsql security definer set search_path='' as $fn$
begin
  insert into public.audit_events(action,actor_user_id,entity_id,entity_type,metadata)
    values(p_action,p_actor,p_target.id,'admin_profile',jsonb_build_object('adminCode',p_target.admin_code,'targetUserId',p_target.user_id)||p_metadata);
  insert into public.security_events(actor_user_id,target_user_id,event_type,severity,payload)
    values(p_actor,p_target.user_id,p_action,p_severity,jsonb_build_object('adminProfileId',p_target.id,'adminCode',p_target.admin_code)||p_metadata);
end;
$fn$;

create function public.apply_admin_role_operation(p_operation text,p_payload jsonb,p_proof text) returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare actor uuid; attempt_id uuid; target public.admin_profiles%rowtype; rid uuid; previous_rank integer;
begin
  -- Acquired BEFORE actor/target row locks for every role/lifecycle writer.
  perform pg_advisory_xact_lock(hashtextextended('jnuits:admin-role-management',0));
  if p_operation not in ('admin.role.change','admin.role.remove','admin.role.invite') or p_operation is null then
    raise exception 'Unsupported role operation.' using errcode='22023';
  end if;
  attempt_id:=private.reserve_admin_mutation(p_operation,p_payload,p_proof);
  if p_operation='admin.role.invite' then return private.authorize_admin_invitation(attempt_id,p_payload); end if;
  actor:=auth.uid(); target:=private.require_admin_account_target(actor,p_operation,p_payload);
  previous_rank:=private.admin_role_rank(target.user_id);
  if p_operation='admin.role.change' then
    if p_payload->>'roleCode' is null or p_payload->>'roleCode' not in ('super_admin','admin','content_admin')
      or (select count(*) from jsonb_object_keys(p_payload))<>3 then
      raise exception 'Invalid target role.' using errcode='22023';
    end if;
    select id into rid from public.rbac_platform_roles where scope='admin' and code=p_payload->>'roleCode';
    if rid is null then raise exception 'Target role is unavailable.' using errcode='22023'; end if;
    if exists(select 1 from public.rbac_user_platform_roles where user_id=target.user_id and scope='admin' and role_id=rid and revoked_at is null) then
      raise exception 'This account already has that role.' using errcode='40001';
    end if;
    if p_payload->>'roleCode'<>'super_admin' then perform private.require_other_active_super_admin(target.user_id); end if;
  else
    if (select count(*) from jsonb_object_keys(p_payload))<>2 then raise exception 'Invalid target payload.' using errcode='22023'; end if;
    perform private.require_other_active_super_admin(target.user_id);
  end if;
  update public.rbac_user_platform_roles set revoked_at=clock_timestamp(),revoked_by_user_id=actor,
    revocation_reason='Verified admin account operation.',note='Replaced by verified admin account operation.'
    where user_id=target.user_id and scope='admin' and revoked_at is null;
  if p_operation='admin.role.change' then
    insert into public.rbac_user_platform_roles(user_id,role_id,scope,granted_by,note)
      values(target.user_id,rid,'admin',actor,'Granted through verified admin account console.');
    -- Role assignment does not unfreeze or reactivate a restricted account.
    perform private.record_verified_admin_account_event(actor,target,'admin_account.role_changed',
      jsonb_build_object('previousRoleRank',previous_rank,'roleCode',p_payload->>'roleCode'),
      case when previous_rank=3 or p_payload->>'roleCode'='super_admin' then 'critical' else 'warning' end);
  else
    update public.admin_profiles set status='removed',is_active=false,status_reason='Admin role removed; Auth user and member profile preserved.',
      status_updated_by_user_id=actor,status_updated_at=clock_timestamp() where id=target.id;
    perform private.record_verified_admin_account_event(actor,target,'admin_account.removed','{}','critical');
  end if;
  perform private.complete_admin_mutation(attempt_id);
  return jsonb_build_object('ok',true,'value',jsonb_build_object('targetUserId',target.user_id,'adminProfileId',target.id));
end;
$fn$;
revoke all on function public.apply_admin_role_operation(text,jsonb,text) from public,anon,service_role;
grant execute on function public.apply_admin_role_operation(text,jsonb,text) to authenticated;

create function public.update_admin_security_verified(p_payload jsonb,p_proof text) returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare attempt_id uuid; enforced boolean;
begin
  if jsonb_typeof(p_payload) is distinct from 'object' or jsonb_typeof(p_payload->'adminTotpEnforced') is distinct from 'boolean'
    or (select count(*) from jsonb_object_keys(p_payload))<>1 then raise exception 'Invalid security setting.' using errcode='22023'; end if;
  -- Serialize policy changes before taking actor/settings SHARE locks.
  perform pg_advisory_xact_lock(hashtextextended('jnuits:admin-security-policy',0));
  attempt_id:=private.reserve_admin_mutation('admin.security.update',p_payload,p_proof);
  enforced:=(p_payload->>'adminTotpEnforced')::boolean;
  if not enforced and private.admin_role_rank(auth.uid())<>3 then
    raise exception 'Only a super admin can disable mandatory MFA.' using errcode='42501';
  end if;
  update public.security_settings set admin_totp_enforced=enforced,updated_by_user_id=auth.uid() where id;
  if not found then raise exception 'Security settings are unavailable.' using errcode='P0002'; end if;
  insert into public.audit_events(action,actor_user_id,entity_type,metadata)
    values('admin_security.updated',auth.uid(),'security_settings',jsonb_build_object('adminTotpEnforced',enforced));
  perform private.complete_admin_mutation(attempt_id);
  return jsonb_build_object('ok',true,'value',null);
end;
$fn$;
revoke all on function public.update_admin_security_verified(jsonb,text) from public,anon,service_role;
grant execute on function public.update_admin_security_verified(jsonb,text) to authenticated;

create function private.load_reserved_admin_intent(p_attempt_id uuid) returns private.admin_verification_intents
language plpgsql security definer set search_path='' as $fn$
declare attempt private.admin_verification_attempts%rowtype; intent private.admin_verification_intents%rowtype; ctx jsonb; kind text;
begin
  select * into attempt from private.admin_verification_attempts where id=p_attempt_id for update;
  if not found or attempt.status<>'reserved' or attempt.expires_at<=clock_timestamp() or attempt.reserved_actor is null then
    raise exception 'Operation attempt is invalid or expired.' using errcode='42501';
  end if;
  select * into intent from private.admin_verification_intents where id=attempt.intent_id;
  ctx:=private.admin_verification_intent_check(intent,attempt.reserved_actor);
  if not coalesce((ctx->>'ok')::boolean,false)
    or exists(select 1 from auth.users where id=intent.user_id and banned_until>clock_timestamp()) then
    raise exception 'Operation session, permissions or policy changed.' using errcode='42501';
  end if;
  select o.kind into kind from private.admin_verification_operations o where o.operation=intent.operation;
  if attempt.proof_id is not null and exists(select 1 from private.admin_verification_proofs where id=attempt.proof_id and method='email')
    and ((ctx#>>'{value,enforced}')::boolean or ctx#>>'{value,enrollment}'<>'never' or not (ctx#>>'{value,emailConfirmed}')::boolean) then
    raise exception 'Email verification is no longer eligible.' using errcode='42501';
  end if;
  if kind='admin_role' and (ctx#>>'{value,currentLevel}'<>'aal2' or not exists(
    select 1 from private.admin_verification_proofs where id=attempt.proof_id and method='password' and consumed_at is not null)) then
    raise exception 'Dual verification is required.' using errcode='42501';
  end if;
  return intent;
end;
$fn$;

create function private.authorize_admin_invitation(p_attempt_id uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare intent private.admin_verification_intents%rowtype; member public.members%rowtype; recipient text; member_id uuid; name text; actor_rank integer;
begin
  intent:=private.load_reserved_admin_intent(p_attempt_id);
  if intent.operation<>'admin.role.invite' or intent.payload is distinct from p_payload
    or (select count(*) from jsonb_object_keys(p_payload))<>7 or p_payload->>'inviteMode' not in ('member','email')
    or p_payload->>'inviteMode' is null or p_payload->>'roleCode' not in ('super_admin','admin','content_admin') or p_payload->>'roleCode' is null
    or length(p_payload->>'displayName')>160 or length(p_payload->>'title')>120 or length(p_payload->>'note')>500 then
    raise exception 'Invalid invitation authorization.' using errcode='22023';
  end if;
  actor_rank:=private.admin_role_rank(intent.user_id);
  if not (actor_rank=3 or (actor_rank=2 and p_payload->>'roleCode'='content_admin')) then
    raise exception 'The invited role is not permitted.' using errcode='42501';
  end if;
  if p_payload->>'inviteMode'='member' then
    select * into member from public.members where id=(p_payload->>'memberId')::uuid for update;
    if not found then raise exception 'Selected member was not found.' using errcode='P0002'; end if;
    member_id:=member.id; recipient:=lower(btrim(member.email::text));
    name:=coalesce(nullif(p_payload->>'displayName',''),member.full_name,recipient);
    if exists(select 1 from public.admin_profiles where linked_member_id=member.id and status<>'removed') then
      raise exception 'This member already has an admin identity.' using errcode='22023';
    end if;
  else
    recipient:=lower(btrim(p_payload->>'email')); name:=coalesce(nullif(p_payload->>'displayName',''),recipient);
    if exists(select 1 from public.members where lower(email::text)=recipient) then
      raise exception 'Link the existing member instead of an email-only identity.' using errcode='22023';
    end if;
  end if;
  if recipient is null or length(recipient)>254 or recipient !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
    raise exception 'A valid invitation email is required.' using errcode='22023';
  end if;
  if exists(select 1 from auth.users where lower(email)=recipient and private.admin_role_rank(id)>0)
    or exists(select 1 from public.admin_invitations where lower(email::text)=recipient and status='pending' and expires_at>clock_timestamp())
    or exists(select 1 from private.admin_invitation_authorizations x join private.admin_verification_attempts a on a.id=x.attempt_id
      where x.recipient_email=recipient and a.status='reserved' and a.expires_at>clock_timestamp()) then
    raise exception 'This recipient already has admin access or a pending invitation.' using errcode='40001';
  end if;
  insert into private.admin_invitation_authorizations(attempt_id,recipient_email,member_id,role_code,display_name,title,note)
    values(p_attempt_id,recipient,member_id,p_payload->>'roleCode',name,coalesce(p_payload->>'title',''),coalesce(p_payload->>'note',''));
  return jsonb_build_object('ok',true,'value',jsonb_build_object('attemptId',p_attempt_id,
    'recipientEmail',recipient,'displayName',name,'linkedMemberId',member_id));
end;
$fn$;

create function public.complete_admin_invitation_operation(p_attempt_id uuid,p_payload jsonb) returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare intent private.admin_verification_intents%rowtype; auth_record private.admin_invitation_authorizations%rowtype;
  recipient auth.users%rowtype; profile public.admin_profiles%rowtype; member public.members%rowtype; created_invitation_id uuid; claim_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('jnuits:admin-role-management',0));
  intent:=private.load_reserved_admin_intent(p_attempt_id);
  select * into auth_record from private.admin_invitation_authorizations where attempt_id=p_attempt_id for update;
  if intent.operation<>'admin.role.invite' or not found or auth_record.invitation_id is not null
    or jsonb_typeof(p_payload) is distinct from 'object' or (select count(*) from jsonb_object_keys(p_payload))<>2 then
    raise exception 'Invitation completion does not match its auth_record.' using errcode='42501';
  end if;
  select * into recipient from auth.users where id=(p_payload->>'targetUserId')::uuid for share;
  if not found or lower(recipient.email) is distinct from auth_record.recipient_email
    or private.admin_role_rank(recipient.id)>0 or recipient.banned_until>clock_timestamp() then
    raise exception 'Invitation recipient does not match its auth_record.' using errcode='42501';
  end if;
  claim_id:=nullif(p_payload->>'claimInvitationId','')::uuid;
  if auth_record.member_id is not null then
    select * into member from public.members where id=auth_record.member_id for share;
    if not found or lower(member.email::text) is distinct from auth_record.recipient_email
      or (member.user_id is not null and member.user_id<>recipient.id) then
      raise exception 'Linked member changed during invitation.' using errcode='40001';
    end if;
    if (not member.is_profile_claimed or member.user_id is distinct from recipient.id) and
      (claim_id is null or not exists(select 1 from public.member_invitations where id=claim_id and member_id=member.id and expires_at>clock_timestamp())) then
      raise exception 'A valid linked-member claim invitation is required.' using errcode='42501';
    end if;
  elsif claim_id is not null then raise exception 'Email-only invitation cannot link a claim.' using errcode='22023'; end if;
  if exists(select 1 from public.admin_profiles where (user_id=recipient.id or linked_member_id=auth_record.member_id) and status<>'removed') then
    raise exception 'Recipient already has a pending or active identity.' using errcode='40001';
  end if;
  if (select count(*) from public.admin_profiles where user_id=recipient.id or linked_member_id=auth_record.member_id)>1 then
    raise exception 'User and member belong to different admin identities.' using errcode='40001';
  end if;
  select * into profile from public.admin_profiles where user_id=recipient.id or linked_member_id=auth_record.member_id for update;
  if profile.id is null then
    insert into public.admin_profiles(user_id,linked_member_id,admin_code,display_name,email,title,is_active,status,created_by_user_id,status_updated_by_user_id,status_reason)
      values(recipient.id,auth_record.member_id,'JNUITS-ADMIN-'||upper(substr(replace(recipient.id::text,'-',''),1,8)),
        auth_record.display_name,auth_record.recipient_email,nullif(auth_record.title,''),false,'pending_invite',intent.user_id,intent.user_id,'Verified admin invitation.')
      returning * into profile;
  else
    update public.admin_profiles set user_id=recipient.id,linked_member_id=auth_record.member_id,display_name=auth_record.display_name,
      email=auth_record.recipient_email,title=nullif(auth_record.title,''),is_active=false,status='pending_invite',
      status_updated_at=clock_timestamp(),status_updated_by_user_id=intent.user_id,status_reason='Verified admin invitation.'
      where id=profile.id returning * into profile;
  end if;
  insert into public.admin_invitations(email,target_user_id,target_admin_profile_id,invited_role_code,invited_by_user_id,note,claim_invitation_id,expires_at)
    values(auth_record.recipient_email,recipient.id,profile.id,auth_record.role_code,intent.user_id,nullif(auth_record.note,''),claim_id,auth_record.expires_at)
    returning id into created_invitation_id;
  update private.admin_invitation_authorizations set invitation_id=created_invitation_id where attempt_id=p_attempt_id;
  -- Trusted evidence for genuinely new accounts only; legacy history stays unknown.
  if recipient.created_at >= (select initialized_at from private.admin_verification_config where id)
    and not exists(select 1 from auth.mfa_factors where user_id=recipient.id)
    and not exists(select 1 from auth.audit_log_entries where payload->>'actor_id'=recipient.id::text and payload->>'action' like 'mfa%') then
    perform private.admin_verification_handle('record_enrollment',jsonb_build_object('userId',recipient.id,'evidence','trusted_never_history'));
  end if;
  insert into public.audit_events(action,actor_user_id,entity_id,entity_type,metadata)
    values('admin_invitation.created',intent.user_id,created_invitation_id,'admin_invitation',jsonb_build_object('roleCode',auth_record.role_code,'linkedMemberId',auth_record.member_id,'targetUserId',recipient.id));
  perform private.complete_admin_mutation(p_attempt_id);
  return jsonb_build_object('ok',true,'value',jsonb_build_object('invitationId',created_invitation_id,'adminProfileId',profile.id));
end;
$fn$;
revoke all on function public.complete_admin_invitation_operation(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.complete_admin_invitation_operation(uuid,jsonb) to service_role;

create function public.accept_verified_admin_invitation(p_invitation_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare recipient auth.users%rowtype; session auth.sessions%rowtype; invitation public.admin_invitations%rowtype;
  auth_record private.admin_invitation_authorizations%rowtype; profile public.admin_profiles%rowtype; member public.members%rowtype; rid uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('jnuits:admin-role-management',0));
  if auth.uid() is null or auth.jwt()->>'role' is distinct from 'authenticated' then
    return jsonb_build_object('ok',false,'code','session_invalid');
  end if;
  select * into recipient from auth.users where id=auth.uid() for share;
  select * into session from auth.sessions where id=(auth.jwt()->>'session_id')::uuid and user_id=recipient.id for share;
  if recipient.id is null or recipient.email_confirmed_at is null or recipient.banned_until>clock_timestamp()
    or session.id is null or session.not_after<=clock_timestamp() then return jsonb_build_object('ok',false,'code','session_invalid'); end if;
  select * into invitation from public.admin_invitations where id=p_invitation_id for update;
  if not found or invitation.target_user_id is distinct from recipient.id or lower(invitation.email::text) is distinct from lower(recipient.email) then
    return jsonb_build_object('ok',false,'code','invitation_wrong_account');
  end if;
  select * into auth_record from private.admin_invitation_authorizations where invitation_id=invitation.id for update;
  if not found then return jsonb_build_object('ok',false,'code','invitation_reissue_required'); end if;
  if invitation.expires_at<=clock_timestamp() or auth_record.expires_at<=clock_timestamp() then
    return jsonb_build_object('ok',false,'code','invitation_expired');
  end if;
  if invitation.status<>'pending' or invitation.delivery_status<>'sent' then
    return jsonb_build_object('ok',false,'code','invitation_not_pending');
  end if;
  if invitation.invited_role_code is distinct from auth_record.role_code
    or lower(invitation.email::text) is distinct from auth_record.recipient_email
    or invitation.invited_by_user_id is distinct from (select i.user_id from private.admin_verification_intents i join private.admin_verification_attempts a on a.intent_id=i.id where a.id=auth_record.attempt_id and a.status='completed') then
    return jsonb_build_object('ok',false,'code','invitation_invalid');
  end if;
  select * into profile from public.admin_profiles where id=invitation.target_admin_profile_id for update;
  if not found or profile.user_id is distinct from recipient.id or profile.status<>'pending_invite' or profile.is_active
    or profile.linked_member_id is distinct from auth_record.member_id or private.admin_role_rank(recipient.id)>0 then
    return jsonb_build_object('ok',false,'code','invitation_invalid');
  end if;
  if auth_record.member_id is not null then
    select * into member from public.members where id=auth_record.member_id for share;
    if not found or not member.is_profile_claimed or member.user_id is distinct from recipient.id then
      return jsonb_build_object('ok',false,'code','invitation_claim_required');
    end if;
  end if;
  select id into rid from public.rbac_platform_roles where scope='admin' and code=auth_record.role_code;
  if rid is null then return jsonb_build_object('ok',false,'code','invitation_invalid'); end if;
  insert into public.rbac_user_platform_roles(user_id,role_id,scope,granted_by,note)
    values(recipient.id,rid,'admin',invitation.invited_by_user_id,'Redeemed immutable, dual-verified admin invitation.');
  update public.admin_profiles set status='active',is_active=true,status_updated_at=clock_timestamp(),
    status_updated_by_user_id=recipient.id,status_reason='Verified invitation accepted.' where id=profile.id;
  update public.admin_invitations set status='accepted',accepted_at=clock_timestamp(),accepted_by_user_id=recipient.id where id=invitation.id;
  perform private.record_verified_admin_account_event(recipient.id,profile,'admin_invitation.accepted',jsonb_build_object('invitationId',invitation.id,'roleCode',auth_record.role_code),
    case when auth_record.role_code='super_admin' then 'critical' else 'warning' end);
  return jsonb_build_object('ok',true,'value',null);
exception when invalid_text_representation then return jsonb_build_object('ok',false,'code','session_invalid');
end;
$fn$;
revoke all on function public.accept_verified_admin_invitation(uuid) from public,anon,service_role;
grant execute on function public.accept_verified_admin_invitation(uuid) to authenticated;

do $acl$
declare f record;
begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private' and (p.proname like 'admin_verification_%' or p.proname in ('reserve_admin_mutation','complete_admin_mutation','require_membership_operator','admin_role_rank','require_admin_account_target','require_other_active_super_admin','record_verified_admin_account_event','load_reserved_admin_intent','authorize_admin_invitation')) loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
  end loop;
end;
$acl$;
commit;
