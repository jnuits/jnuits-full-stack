import {adminOperationRegistry} from "@/lib/auth/admin-verification/operations";
import type {AdminOperationIntent,AdminVerificationActor} from "@/lib/auth/admin-verification/types";
export type AdminSecurityGuidance={state:"setup"|"verify"|"verified"|"unknown";title:string;description:string;capabilities:readonly {operation:string;label:string;requirements:readonly string[]}[];href:string|null};
export function buildAdminSecurityGuidance({actor,permittedOperations}:{actor:AdminVerificationActor;permittedOperations:AdminOperationIntent["operation"][]}):AdminSecurityGuidance{
 const valid=["aal1","aal2"].includes(actor.currentLevel)&&["never","enrolled","unknown"].includes(actor.enrollment)&&typeof actor.enforced==="boolean";
 const state=!valid?"unknown":actor.currentLevel==="aal2"?"verified":actor.enrollment==="enrolled"?"verify":actor.enrollment==="never"?"setup":"unknown";
 const copy={
  setup:["Set up account protection","Add an authenticator, then verify it to establish a native AAL2 session.","/admin/mfa/setup"],
  verify:["Verify your authenticator session","Your authenticator is configured. Verify it when an action requires native AAL2.","/admin/mfa/challenge"],
  verified:["Authenticator session verified","This session has native AAL2. Role changes still require current password and the exact operation proof.","/admin/settings/security"],
  unknown:["Check account protection","Enrollment history could not be established. Check your authenticator; missing evidence does not mean never enrolled.","/admin/mfa/setup"],
 }[state];
 return {state,title:copy[0],description:copy[1],href:copy[2],capabilities:!valid?[]:[...new Set(permittedOperations)].filter(operation=>Object.hasOwn(adminOperationRegistry,operation)).map(operation=>{
  const definition=adminOperationRegistry[operation];
  const requirements=["Existing role permission"];
  if(definition.kind==="admin_role") requirements.push("Native AAL2 session","Current password","Exact session/intent-bound proof");
  else if(actor.enforced || actor.currentLevel==="aal2" || actor.enrollment!=="never" || !actor.emailConfirmed){
   if(definition.kind!=="routine"||actor.enforced)requirements.push("Native AAL2 session");
  }else if(definition.kind!=="routine")requirements.push("Authenticator verification or scoped operation email confirmation");
  if(definition.kind!=="routine" && definition.kind!=="admin_role")requirements.push("Required operation proof");
  return {operation,label:definition.label,requirements};
 })};
}
