-- Forward-only operation guards. Hosted settings and identities are unchanged.
begin;
set local lock_timeout='5s';

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

do $acl$
declare f record;
begin
  for f in select p.oid::regprocedure as signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='private' and (p.proname like 'admin_verification_%' or p.proname in ('reserve_admin_mutation','complete_admin_mutation','require_membership_operator')) loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',f.signature);
  end loop;
end;
$acl$;
commit;
