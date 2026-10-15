import "server-only";
import {cache} from "react";
import {hasMemberPortalAccessRole,requireAdminUser,requirePortalIdentity} from "@/lib/auth/session";
import {getPortalMemberSnapshot} from "@/lib/portal/member";
import {createClient} from "@/lib/supabase/server";
import {createAdminClient} from "@/lib/supabase/admin";
import {asFlexibleClient} from "@/lib/supabase/flexible";
import {evaluateProfileCompletion,unavailableCompletion,type CompletionKind,type CompletionEvidence,type CompletionNextStep} from "./completion";
import {hasProfileText,memberCompletionEvidence} from "./completion-evidence";

const labels:Record<CompletionNextStep["field"],string>={
 name:"Complete your name",jnuitsId:"Check your JnUITS ID",email:"Verify your login email",
 department:"Complete your department",batch:"Complete your batch",studentId:"Complete your university student ID",
 photo:"Add a profile photo",phone:"Complete your phone number",workplace:"Complete workplace details or declare them not applicable",
};
const identityFields=new Set(["name","department","batch","studentId"]);
const pendingKeys:Partial<Record<CompletionNextStep["field"],string>>={name:"fullName",department:"departmentCode",batch:"batchNo",studentId:"studentId",jnuitsId:"jnuitsId",email:"email"};
const focuses:Partial<Record<CompletionNextStep["field"],string>>={phone:"dpe-phone",workplace:"dpe-workplaceApplicability"};

/** Only the currently authenticated identity can produce this DTO. Cache is request-scoped. */
export const getOwnCompletionPresentation=cache(async(kind:CompletionKind)=>{
 if(!["member","alumni","admin"].includes(kind)) return null;
 const auth=kind==="admin"?await requireAdminUser():await requirePortalIdentity();
 if(!auth.user) return null;
 try {
  const ownId=auth.user.id;
  const admin=asFlexibleClient(createAdminClient());
  const native=await (await createClient()).auth.getUser();
  const emailVerified=native.error || !native.data.user || native.data.user.id!==ownId
    ? null : !!native.data.user.email && !!native.data.user.email_confirmed_at;
  if(kind==="admin"){
   const profile=await admin.from("admin_profiles").select("user_id,display_name,avatar_secure_url").eq("user_id",ownId).maybeSingle();
   if(profile.error) return {summary:unavailableCompletion(),nextSteps:[]};
   if(!profile.data || profile.data.user_id!==ownId) return null;
   const evidence={name:hasProfileText(profile.data.display_name),email:emailVerified,photo:hasProfileText(profile.data.avatar_secure_url)} as CompletionEvidence;
   const summary=evaluateProfileCompletion("admin",evidence);
   return {summary,nextSteps:summary.missing.slice(0,3).map(field=>({field,label:labels[field],href:"/admin/settings/profile",mode:"self_edit",state:field==="email"?"needs_verification":"missing"} as CompletionNextStep))};
  }
  const snapshot=await getPortalMemberSnapshot(ownId);
  const member=snapshot.member;
  if(!member || !snapshot.access.canMutate || member.user_id!==ownId) return null;
  const actualKind=member.lifecycle_status==="alumni" || member.member_type==="alumni"?"alumni":"member";
  if(actualKind!==kind) return null;
  const department=member.department_code
    ? await admin.from("departments").select("code").eq("code",member.department_code).maybeSingle()
    : {data:null,error:null};
  const evidence=memberCompletionEvidence(member,{emailVerified,departmentRecognized:department.error?null:!!department.data});
  const summary=evaluateProfileCompletion(kind,evidence);
  const nextSteps:CompletionNextStep[]=summary.missing.slice(0,3).map(field=>{
   const payloadKey=pendingKeys[field];
   const pending=(snapshot.profileChangeRequests??[]).some(request=>request.status==="pending" &&
    (field==="email"?request.request_type==="email_change":field==="jnuitsId"?request.request_type==="jnuits_id_change":
      request.request_type==="profile_change" && !!payloadKey && typeof request.payload==="object" &&
      request.payload!==null && payloadKey in request.payload));
   return {field,label:pending?"Your identity correction is under review":labels[field],
    href:field==="jnuitsId" && !pending?"/contact":"/portal/profile/edit",
    mode:field==="jnuitsId"?"support":identityFields.has(field)||field==="email"?"reviewed_identity":"self_edit",
    state:pending?"pending_review":field==="email"?"needs_verification":"missing",
    ...(focuses[field]?{focusId:focuses[field]}:{})};
  });
  return {summary,nextSteps};
 } catch {
  // Availability is advisory; no database/provider errors or protected values reach the card.
  return {summary:unavailableCompletion(),nextSteps:[]};
 }
});
export const getOwnProfileCompletion=cache(async(kind:CompletionKind)=>(await getOwnCompletionPresentation(kind))?.summary??null);

/** Admin self-service only: never force an admin-only account into member linking. */
export const getOwnLinkedMemberCompletion=cache(async()=>{
 const auth=await requireAdminUser();
 if(!auth.user || !hasMemberPortalAccessRole(auth.roles)) return null;
 try {
  const snapshot=await getPortalMemberSnapshot(auth.user.id);
  const member=snapshot.member;
  if(!member || member.user_id!==auth.user.id || !snapshot.access.canMutate) return null;
  const kind=member.lifecycle_status==="alumni" || member.member_type==="alumni"?"alumni":"member";
  const presentation=await getOwnCompletionPresentation(kind);
  return presentation?{...presentation,title:kind==="alumni"?"Linked alumni profile completeness":"Linked member profile completeness"}:null;
 }catch{return null;}
});
