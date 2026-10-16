import "server-only";
import {randomUUID} from "node:crypto";
import type {AdminVerificationActor} from "@/lib/auth/admin-verification/types";
import {appendTrustedAdminActivity} from "./store";
import {resolveAuditRequestContext} from "./request-context";
import type {AdminActivityEvent} from "./model";

function eligiblePage(actor:AdminVerificationActor,headers:Headers){
 const path=headers.get("x-jnuits-return-to")?.split("?")[0]??"";
 return (!actor.enforced||actor.currentLevel==="aal2")
  &&(path==="/admin"||path.startsWith("/admin/"))
  &&!/^\/admin\/(mfa|access-pending)(\/|$)/.test(path)
  &&!headers.has("next-router-prefetch")
  &&!/(?:prefetch|prerender)/i.test((headers.get("purpose")??"")+" "+(headers.get("sec-purpose")??""));
}
async function append(actor:AdminVerificationActor,source:AdminActivityEvent["source"],sourceId:string,action:string,now:Date,headers?:Headers){
 const event:AdminActivityEvent={id:randomUUID(),source,sourceId,actorUserId:actor.userId,targetUserId:null,
  action,outcome:"succeeded",occurredAt:now.toISOString(),recordedAt:now.toISOString(),
  context:headers?resolveAuditRequestContext(headers,process.env.VERCEL==="1"?"vercel_edge":"unverified"):null,
  provenance:"Verified native "+(source==="admin_signin"?"admin-destined sign-in":"workspace page receipt")};
 await appendTrustedAdminActivity(event,actor.sessionId);
}
export async function recordAdminWorkspaceEntry(actor:AdminVerificationActor,headers:Headers,now=new Date()){
 if(eligiblePage(actor,headers))await append(actor,"workspace_entry","session:"+actor.sessionId,"workspace.entry",now,headers);
}
export async function recordAdminPageAccess(actor:AdminVerificationActor,headers:Headers,now=new Date()){
 if(eligiblePage(actor,headers))await append(actor,"workspace_access","access:"+actor.userId+":"+now.toISOString().slice(0,10),"workspace.access",now,headers);
}
/** Invoke only after the real admin-destined login validates its assigned role. */
export async function recordAdminSignIn(actor:AdminVerificationActor,now=new Date()){
 await append(actor,"admin_signin","signin:"+actor.sessionId,"admin.signin",now);
}
