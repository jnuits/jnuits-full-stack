import assert from "node:assert/strict";
import {spawn} from "node:child_process";import {randomUUID} from "node:crypto";
const container=process.argv[2];
if(process.env.SCRATCH_ACK!=="DISPOSABLE_SCRATCH"||!/^supabase_db_replay\.[A-Za-z0-9]+$/.test(container??""))throw new Error("Only an acknowledged disposable replay database is accepted.");
function sql(query,service=true){
 return new Promise((resolve,reject)=>{const child=spawn("docker",["exec",container,"psql","-X","-U","postgres","-d","postgres","-At","-v","ON_ERROR_STOP=1","-c",(service?"set role service_role;":"")+query],{stdio:["ignore","pipe","pipe"]});let out="",err="";child.stdout.on("data",chunk=>out+=chunk);child.stderr.on("data",chunk=>err+=chunk);child.once("error",reject);child.once("exit",code=>code===0?resolve(out.replace(/^SET\r?\n/,"").trim()):reject(new Error(err)));});
}
const email="newsletter-concurrency@local.invalid",tokens=[randomUUID(),randomUUID()],hashes=["d".repeat(64),"e".repeat(64)];
const rpc=(action,payload)=>"select public.newsletter_store('"+action+"','"+JSON.stringify(payload)+"'::jsonb)";
try{
 const outcomes=await Promise.all(tokens.map((id,index)=>sql("begin;"+rpc("subscribe",{email,token_id:id,token_hash:hashes[index]})+"->>'status';select pg_sleep(0.2);commit;")));
 const statuses=outcomes.map(out=>out.split(/\r?\n/).filter(line=>!["BEGIN","COMMIT",""].includes(line)));
 assert.deepEqual(statuses.flat().sort(),["limited","send"]);
 const winner=statuses.findIndex(status=>status.includes("send")),tokenId=tokens[winner];
 await sql(rpc("delivery",{token_id:tokenId,success:true,message_id:"newsletter-concurrency-message"})+";");
 const attempts=[randomUUID(),randomUUID()];
 const reservations=await Promise.all(attempts.map(attempt_id=>sql("begin;"+rpc("prepare",{token_hash:hashes[winner],attempt_id})+"->>'status';select pg_sleep(0.2);commit;")));
 const reserved=reservations.map(out=>out.split(/\r?\n/).filter(line=>!["BEGIN","COMMIT",""].includes(line)));
 assert.deepEqual(reserved.flat().sort(),["newsletter_unavailable","ready"]);
 const attempt_id=attempts[reserved.findIndex(status=>status.includes("ready"))];
 const subscription_id=await sql("select id from private.newsletter_subscriptions where email='"+email+"';",false);
 await Promise.all([
  sql(rpc("finish",{subscription_id,token_id:tokenId,attempt_id,status:"confirmed",contact_id:"fictional-contact"})+";"),
  sql(rpc("webhook",{message_id:"newsletter-concurrency-message",event_id:"newsletter-concurrent-complaint",event_type:"email.complained",delivery_status:"complained",occurred_at:"2026-10-04T00:00:00Z"})+";"),
 ]);
 assert.equal(await sql("select state from private.newsletter_subscriptions where email='"+email+"';",false),"suppressed");
 console.log("Concurrent newsletter signup/confirmation: one winner each; simultaneous complaint always suppresses activation.");
}finally{
 await sql("delete from private.newsletter_subscriptions where email='"+email+"';",false);
}
