import type {AdminActivitySummary} from "@/components/admin/admin-activity-summary";
import {shiftDhakaMonths} from "./retention";
export type SummaryCoverage={state:"current"|"delayed"|"partial"|"unavailable";observedSince:string|null;continuousSince:string|null;lastCollectedAt:string|null};
export type AdminActivitySummaryInput={accessActivatedAt:string|null;invitationStatus:"pending"|"accepted"|"revoked"|null;firstEntryAt:string|null;lastSignInAt:string|null;lastWorkspaceAccessAt:string|null;lastCompletedWorkAt:string|null;completedWorkCount:number|null;periodLabel?:string|null;coverage:SummaryCoverage;now:Date};
function validTime(value:string|null){return value!==null&&Number.isFinite(Date.parse(value))?Date.parse(value):null;}
export function classifyAdminActivity(input:AdminActivitySummaryInput):AdminActivitySummary{
 const {coverage,now}=input;
 const result:AdminActivitySummary={status:"history_unavailable",observedSince:coverage.observedSince,firstWorkspaceEntryAt:input.firstEntryAt,
  lastSignInAt:input.lastSignInAt,lastWorkspaceAccessAt:input.lastWorkspaceAccessAt,lastCompletedWorkAt:input.lastCompletedWorkAt,
  completedWorkCount:input.periodLabel&&input.completedWorkCount!==null&&input.completedWorkCount>=0?input.completedWorkCount:null,periodLabel:input.periodLabel??null,
  label:"History unavailable",explanation:"Available sources do not establish a continuous observation period. Missing history does not mean never used."};
 if(input.invitationStatus==="revoked")return result;
 const observations=[input.firstEntryAt,input.lastSignInAt,input.lastWorkspaceAccessAt,input.lastCompletedWorkAt].map(validTime).filter((time):time is number=>time!==null);
 if(observations.some(time=>time>now.getTime()))return result;
 const latest=observations.length?Math.max(...observations):null;
 const threshold=shiftDhakaMonths(now,-6).getTime();
 if(latest!==null&&latest>threshold)return {...result,status:"seen_recently",label:"Observed recently",explanation:"Verified workspace access, sign-in or completed work was observed within six calendar months. This does not measure attention or duty performance."};
 if(input.invitationStatus==="pending"&&latest===null)return {...result,status:"invitation_pending",label:"Invitation pending",explanation:"The recorded invitation has not yet been accepted."};
 const continuous=validTime(coverage.continuousSince),activated=validTime(input.accessActivatedAt),collected=validTime(coverage.lastCollectedAt);
 const current=coverage.state==="current"&&collected!==null&&collected<=now.getTime()&&now.getTime()-collected<=48*60*60*1000;
 if(!current||continuous===null)return result;
 if(latest===null&&activated!==null&&activated>=continuous&&activated<=now.getTime())
  return {...result,status:"never_used",label:"No workspace use observed since activation",explanation:"Continuous verified coverage since access activation contains no workspace entry or completed work, through the last collection time."};
 if(latest!==null&&latest<=threshold&&continuous<=threshold)
  return {...result,status:"not_seen_six_months",label:"Not observed for six months",explanation:"Verified sources covering the last six calendar months contain no newer workspace activity. This does not automatically change access."};
 return result;
}
