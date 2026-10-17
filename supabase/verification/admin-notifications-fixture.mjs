import assert from "node:assert/strict";
import {createHash,createHmac,randomBytes,randomUUID} from "node:crypto";

/** Reachable only from the unlinked disposable runner's private loopback bridge. */
export function createAdminNotificationsFixture({dbContainer,appBaseUrl,accounts,sql,jsonSql,uuid,totp,cronSecret,webhookSecret,fetcher=fetch}) {
  assert.match(dbContainer,/^supabase_db_jnuits-admin-qa-[a-f0-9]+$/);
  assert.equal(appBaseUrl,"http://127.0.0.1:3127");
  const messages=new Map(),suppressed=new Set();
  let fault="none",requests=0;
  const account=name=>{const value=accounts.get(name);assert.ok(value);uuid(value.userId);return value;};
  const app=async(path,options={})=>{
    const response=await fetcher(appBaseUrl+path,{...options,redirect:"error",signal:AbortSignal.timeout(25000)});
    return {status:response.status,value:await response.json()};
  };
  const collect=()=>app("/api/cron/admin-accountability",{headers:{Authorization:"Bearer "+cronSecret}});
  const refresh=async value=>{
    assert.ok(!(await value.session.auth.signInWithPassword({email:value.email,password:value.password})).error,"Synthetic session renewal failed");
    const result=await value.session.auth.getClaims();assert.equal(result.data?.claims?.role,"authenticated");value.sessionId=uuid(result.data.claims.session_id);
  };
  return {async handle(action,body={}) {
    if(action==="notice_transport") {
      assert.ok([...accounts.values()].some(value=>value.email===body.to));
      assert.match(body.idempotencyKey,/^jnuits-admin\//);
      requests++;
      if(fault==="reject")return {status:422,value:{message:"Synthetic permanent rejection"}};
      const signature=createHash("sha256").update(JSON.stringify([body.to,body.from,body.replyTo,body.subject,body.html,body.text])).digest("hex");
      let message=messages.get(body.idempotencyKey);
      if(message)assert.equal(message.signature,signature,"Frozen synthetic payload changed");
      else {message={id:randomUUID(),signature,subject:body.subject};messages.set(body.idempotencyKey,message);}
      if(fault==="accepted_lost"){fault="none";return {status:500,value:{message:"Synthetic lost acceptance response"}};}
      return {value:{id:message.id}};
    }
    if(action==="notice_suppression") {
      assert.ok([...accounts.values()].some(value=>value.email===body.to));return {value:{blocked:suppressed.has(body.to)}};
    }
    if(action==="notice_reset") {
      messages.clear();suppressed.clear();requests=0;fault="none";
      sql(`delete from public.security_rate_limits;delete from private.admin_verification_rate_events;update public.security_settings set admin_totp_enforced=false;
        delete from private.admin_notification_webhook_receipts;delete from private.admin_notification_deliveries;delete from private.admin_notification_suppressions;
        delete from private.admin_security_notices;delete from private.admin_notice_receipts;delete from private.admin_notice_event_receipts;
        update private.admin_notification_controls set delivery_enabled=false,delivery_cutover=null,notice_cutover=clock_timestamp(),digest_cursor=null,digest_month=null where singleton;
        update public.portal_user_settings set admin_security_email_opt_in=false,admin_recommendation_email_opt_in=false;
        update private.admin_activity_ingestion_state set lease_id=null,lease_until=null,purge_enabled=false;
        update public.admin_profiles set is_active=true,status='active';`);
      // Earlier portal acceptance changes its disposable password deliberately.
      // Refresh only admin identities consumed here; do not reuse portal secrets.
      for(const name of ["never","super","setup","activityreader","completionadmin","noticeactor"])await refresh(account(name));
      return {value:{ok:true}};
    }
    if(action==="notice_enable") {
      const target=account(body.name||"activityreader");
      assert.ok(["none","accepted_lost","reject"].includes(body.fault||"none"));fault=body.fault||"none";
      if(body.suppressed)suppressed.add(target.email);
      sql(`insert into public.portal_user_settings(user_id,admin_security_email_opt_in,admin_recommendation_email_opt_in)values('${uuid(target.userId)}',true,${body.recommendations===true})on conflict(user_id)do update set admin_security_email_opt_in=true,admin_recommendation_email_opt_in=excluded.admin_recommendation_email_opt_in;
        update private.admin_notification_controls set delivery_enabled=true,delivery_cutover=clock_timestamp()where singleton;`);
      return {value:{ok:true}};
    }
    if(action==="notice_seed") {
      assert.ok(Number.isInteger(body.count)&&body.count>=1&&body.count<=40);
      const actor=account("never"),target=account("setup");
      sql(`do $fixture$ declare eid uuid;begin for i in 1..${body.count} loop eid:=extensions.gen_random_uuid();
        perform private.admin_activity_append(jsonb_build_object('id',eid,'source','application_commit','sourceId','operation:'||eid,'actorUserId','${uuid(actor.userId)}','targetUserId','${uuid(target.userId)}','action','admin.role.change','outcome','succeeded','occurredAt',clock_timestamp(),'context',null,'provenance','Disposable presentation fixture'),false);
        perform public.enqueue_admin_security_notice(eid);end loop;end $fixture$;`);
      return {value:{ok:true}};
    }
    if(action==="notice_job") {
      const result=body.concurrent===true?await Promise.all([collect(),collect()]):[await collect()];return {value:{responses:result}};
    }
    if(action==="notice_revoke") {
      const target=account(body.name||"activityreader");sql(`update public.admin_profiles set is_active=false where user_id='${uuid(target.userId)}';`);return {value:{ok:true}};
    }
    if(action==="notice_prepare_invitation") {
      // Same native AAL2 fixture seeding as the existing runner. Never forge claims.
      const target=account("super");assert.ok(target.factorId&&target.secret);
      const challenge=await target.session.auth.mfa.challenge({factorId:target.factorId});assert.ok(!challenge.error);
      assert.ok(!(await target.session.auth.mfa.verify({factorId:target.factorId,challengeId:challenge.data.id,code:totp(target.secret)})).error);
      const claims=await target.session.auth.getClaims();assert.equal(claims.data?.claims?.aal,"aal2");target.sessionId=uuid(claims.data.claims.session_id);
      return {value:{ok:true}};
    }
    if(action==="notice_state") {
      const target=account(body.name||"activityreader");
      const state=jsonSql(`select json_build_object('noticeIds',(select coalesce(json_agg(id order by id),'[]')from private.admin_security_notices where recipient_user_id='${uuid(target.userId)}'),
        'unread',(select count(*)from private.admin_security_notices where recipient_user_id='${uuid(target.userId)}'and read_at is null),
        'deliveryStates',(select coalesce(json_agg(state order by created_at,id),'[]')from private.admin_notification_deliveries where recipient_user_id='${uuid(target.userId)}'),
        'nativeEnrollIds',(select coalesce(json_agg(source_id order by source_id),'[]')from private.admin_activity_events where actor_user_id='${uuid(account("noticeactor").userId)}'and action='auth.mfa_factor_enrolled'),
        'nativeRemovalIds',(select coalesce(json_agg(source_id order by source_id),'[]')from private.admin_activity_events where actor_user_id='${uuid(account("noticeactor").userId)}'and action='auth.mfa_factor_unenrolled'));`);
      return {value:{...state,accepted:messages.size,requests,providerMessageIds:[...messages.values()].map(value=>value.id),subjects:[...messages.values()].map(value=>value.subject)}};
    }
    if(action==="notice_native_password") {
      const target=account("noticeactor");
      const count=()=>Number(sql(`select count(*)from auth.audit_log_entries where payload->>'actor_id'='${uuid(target.userId)}'and payload->>'action'='user_updated_password';`));
      const before=count();assert.ok((await target.session.auth.updateUser({password:"x"})).error,"Weak synthetic password unexpectedly accepted");assert.equal(count(),before);
      const password="Qa!"+randomBytes(18).toString("base64url");assert.ok(!(await target.session.auth.updateUser({password})).error,"Native synthetic password change failed");target.password=password;await refresh(target);
      const ids=jsonSql(`select coalesce(json_agg(id order by created_at,id),'[]')from auth.audit_log_entries where payload->>'actor_id'='${uuid(target.userId)}'and payload->>'action'='user_updated_password';`);
      return {value:{failedChangeCreatedEvent:false,passwordId:ids.at(-1)}};
    }
    if(action==="notice_native_mfa") {
      const target=account("noticeactor");
      if(target.factorId){assert.ok(!(await target.session.auth.mfa.unenroll({factorId:target.factorId})).error);target.factorId=null;target.secret=null;await refresh(target);}
      const enrolled=await target.session.auth.mfa.enroll({factorType:"totp",friendlyName:"Disposable notice acceptance"});assert.ok(!enrolled.error&&enrolled.data?.totp?.secret);
      target.factorId=enrolled.data.id;target.secret=enrolled.data.totp.secret;
      const id=uuid(target.factorId);
      const count=()=>Number(sql(`select count(*)from auth.audit_log_entries where payload->>'actor_id'='${uuid(target.userId)}'and payload->>'action'='verification_attempted'and payload#>>'{traits,factor_id}'='${id}';`));
      const challenge=await target.session.auth.mfa.challenge({factorId:id});assert.ok(!challenge.error);
      const code=totp(target.secret),wrong=(Number(code[0])+1)%10+code.slice(1);
      assert.ok((await target.session.auth.mfa.verify({factorId:id,challengeId:challenge.data.id,code:wrong})).error);assert.equal(count(),0);
      assert.ok(!(await target.session.auth.mfa.verify({factorId:id,challengeId:challenge.data.id,code:totp(target.secret)})).error);
      const repeat=await target.session.auth.mfa.challenge({factorId:id});assert.ok(!repeat.error);
      assert.ok(!(await target.session.auth.mfa.verify({factorId:id,challengeId:repeat.data.id,code:totp(target.secret)})).error);
      assert.ok(!(await target.session.auth.mfa.unenroll({factorId:id})).error);target.factorId=null;target.secret=null;await refresh(target);
      const ids=jsonSql(`select json_build_object('verificationIds',(select coalesce(json_agg(id order by created_at,id),'[]')from auth.audit_log_entries where payload->>'actor_id'='${uuid(target.userId)}'and payload->>'action'='verification_attempted'and payload#>>'{traits,factor_id}'='${id}'),
        'removalIds',(select coalesce(json_agg(id order by created_at,id),'[]')from auth.audit_log_entries where payload->>'actor_id'='${uuid(target.userId)}'and payload->>'action'='factor_unenrolled'and payload#>>'{traits,factor_id}'='${id}'));`);
      return {value:{...ids,failedVerificationCreatedEvent:false}};
    }
    if(action==="notice_webhook") {
      assert.ok(["email.delivered","email.complained","email.bounced"].includes(body.type));
      const message=[...messages.values()][0];assert.ok(message);
      const eventId="fixture-"+randomUUID(),timestamp=String(Math.floor(Date.now()/1000));
      const payload=JSON.stringify({type:body.type,created_at:new Date().toISOString(),data:{email_id:message.id}});
      const signature=createHmac("sha256",Buffer.from(webhookSecret.slice(6),"base64")).update(`${eventId}.${timestamp}.${payload}`).digest("base64");
      const send=()=>app("/api/webhooks/resend",{method:"POST",headers:{"Content-Type":"application/json","svix-id":eventId,"svix-timestamp":timestamp,"svix-signature":"v1,"+signature},body:payload});
      return {value:{responses:body.repeat===true?[await send(),await send()]:[await send()]}};
    }
    throw new Error("Unknown disposable notification command");
  }};
}
