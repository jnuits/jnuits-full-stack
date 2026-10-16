import "server-only";
import {isIP} from "node:net";
import {z} from "zod";
import type {AdminActivityEvent} from "./model";
import {createAdminClient} from "@/lib/supabase/admin";

const sourceRow=z.object({id:z.uuid(),created_at:z.iso.datetime({offset:true}),ip_address:z.string().nullish(),
 payload:z.object({actor_id:z.uuid(),action:z.string().regex(/^[a-z_]{1,80}$/)})});
export type VerifiedAdminInterval={userId:string;activeFrom:string;activeUntil:string|null};
/** Provider shape from Supabase Auth models/audit_log_entry.go; raw traits never leave here. */
export function normalizeNativeAuthEvent(input:unknown,interval:VerifiedAdminInterval|null,now:Date):AdminActivityEvent|null{
 const parsed=sourceRow.safeParse(input);if(!parsed.success||!interval)return null;
 const row=parsed.data,time=Date.parse(row.created_at),start=Date.parse(interval.activeFrom),end=interval.activeUntil?Date.parse(interval.activeUntil):Infinity;
 if(row.payload.actor_id!==interval.userId||!Number.isFinite(start)||time<start||time>=end||time>now.getTime())return null;
 const ip=row.ip_address&&row.ip_address.length<=45&&isIP(row.ip_address)?row.ip_address:null;
 return {id:row.id,source:"native_auth",sourceId:row.id,actorUserId:interval.userId,targetUserId:null,
  action:"auth."+row.payload.action,outcome:["login","user_updated_password"].includes(row.payload.action)?"succeeded":"unknown",
  occurredAt:row.created_at,recordedAt:now.toISOString(),provenance:"Native Auth provider row; event-time admin interval",
  context:{observedIp:ip,clientIp:null,countryCode:null,browser:null,os:null,deviceClass:null,networkSource:"native_provider"}};
}
export async function ingestAdminAuthEvents({limit=500,dryRun=false,leaseId,signal}:{limit?:number;dryRun?:boolean;leaseId:string;signal?:AbortSignal}){
 if(!Number.isFinite(limit)||!z.uuid().safeParse(leaseId).success)throw new Error("Native activity collection unavailable");
 let request=createAdminClient().rpc("collect_admin_auth_activity",{p_limit:Math.max(1,Math.min(500,Math.trunc(limit))),p_dry_run:dryRun,p_lease_id:leaseId});
 if(signal)request=request.abortSignal(signal);
 const {data,error}=await request;
 const timestamp=z.iso.datetime({offset:true}).nullable();
 const parsed=z.object({read:z.number().int().min(0).max(500),stored:z.number().int().min(0).max(500),backlog:z.boolean(),coverage:z.object({state:z.enum(["current","delayed","partial","unavailable"]),observedSince:timestamp,continuousSince:timestamp,lastCollectedAt:timestamp})}).refine(value=>value.stored<=value.read).safeParse(data);
 if(error||!parsed.success)throw new Error("Native activity collection unavailable");
 return parsed.data;
}
