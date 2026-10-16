import "server-only";
import {z}from"zod";
import {requireAdminPermission,hasPermission}from"@/lib/auth/session";
import {loadAdminVerificationActor}from"@/lib/auth/admin-verification/actor";
import {createAdminClient}from"@/lib/supabase/admin";
import {asFlexibleClient}from"@/lib/supabase/flexible";
import {classifyAdminActivity,type AdminActivitySummaryInput}from"./summary";
import type{ActivityItem,ActivityCoverage,ActivityFilterOptions}from"@/components/admin/admin-activity-panel";

const filtersSchema=z.object({page:z.number().int().min(1),pageSize:z.number().int().min(1).max(100),actor:z.uuid().nullable(),action:z.string().max(160).regex(/^[a-zA-Z0-9_.:-]*$/),outcome:z.enum(["","succeeded","failed","denied","unknown"]),from:z.iso.datetime({offset:true}).nullable(),to:z.iso.datetime({offset:true}).nullable()});
export type ActivityQueryInput={page?:number;pageSize?:number;actor?:string;action?:string;outcome?:string;from?:string;to?:string;networkId?:string};
async function currentActor(){
 const result=await loadAdminVerificationActor();
 if(!result.ok||(result.value.enforced&&result.value.currentLevel!=="aal2"))throw new Error("Verified admin session required");
 return result.value;
}
function date(value:string|undefined,end=false){if(!value)return null;const exact=/^\d{4}-\d{2}-\d{2}$/.test(value)?value+(end?"T23:59:59.999+06:00":"T00:00:00+06:00"):value;return exact;}
export async function loadAdminActivity(input:ActivityQueryInput):Promise<{items:ActivityItem[];totalItems:number;page:number;pageSize:number;coverage:ActivityCoverage;filterOptions?:ActivityFilterOptions}>{
 await requireAdminPermission("admin.audit.read",{fallbackPath:"/admin/dashboard"});
 const actor=await currentActor();
 const filters=filtersSchema.safeParse({page:Math.max(1,Math.trunc(input.page||1)),pageSize:Math.max(1,Math.min(100,Math.trunc(input.pageSize||25))),actor:input.actor||null,action:input.action||"",outcome:input.outcome||"",from:date(input.from),to:date(input.to,true)});
 if(!filters.success)throw new Error("Invalid activity filters");
 const networkId=input.networkId?z.uuid().safeParse(input.networkId):null;
 if(input.networkId&&(!networkId?.success||!await hasPermission("admin.security.read")))throw new Error("Network details unavailable");
 const {data,error}=await asFlexibleClient(createAdminClient()).rpc("query_admin_activity",{p_actor:actor,p_filters:filters.data,p_full_network_id:networkId?.success?networkId.data:null});
 if(error||!data||!Array.isArray(data.items))throw new Error("Activity view unavailable");
 return data;
}
/** Own compact summary is self-service; other accounts preserve management and audit visibility. */
export async function loadAdminAccountabilitySummary(targetUserId?:string){
 const actor=await currentActor();const target=targetUserId||actor.userId;
 if(!z.uuid().safeParse(target).success)throw new Error("Account activity unavailable");
 if(target!==actor.userId&&(!await hasPermission("admin.admin_profiles.manage")||!await hasPermission("admin.audit.read")))throw new Error("Account activity unavailable");
 const {data,error}=await asFlexibleClient(createAdminClient()).rpc("get_admin_activity_summary",{p_actor:actor,p_target:target});
 if(error||!data)throw new Error("Account activity unavailable");
 return classifyAdminActivity({...data,now:new Date()}as AdminActivitySummaryInput);
}
/** CSV intentionally contains no network context, email or free-form metadata. */
export function activityItemsToCsv(items:readonly ActivityItem[]){
 const cell=(value:unknown)=>'"'+String(value??"").replace(/^(?=\s*[=+@-])/,"'").replaceAll('"','""')+'"';
 return [["Occurred (UTC)","Recorded (UTC)","Actor","Target","Action","Outcome","Source","Provenance"],...items.map(i=>[i.occurredAt,i.recordedAt,i.actorLabel,i.targetLabel,i.actionLabel,i.outcome,i.sourceLabel,i.provenanceLabel])].map(row=>row.map(cell).join(",")).join("\r\n");
}
